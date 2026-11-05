process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createTenant } = require('./factories/index');
const monitor = require('../src/services/stockLossMonitor');

// Kayıt hız sınırı dosya başına dört firmaya izin verir; son testler onları yeniden kullanır.
const tenants = [];
async function fixture(prefix, reuse) {
  const t = reuse === undefined ? await createTenant() : tenants[reuse];
  if (reuse === undefined) tenants.push(t);
  const auth = r => r.set('Authorization', 'Bearer ' + t.token);
  const wh = (await auth(request(app).post('/api/warehouses')).send({ name: prefix + ' Depo', type: 'NORMAL', location: 'X', capacity: 100 })).body;
  const warehouseId = wh.id || wh.warehouse?.id || (await pool.query('SELECT id FROM warehouses WHERE tenant_id=$1 LIMIT 1', [t.tenantId])).rows[0].id;
  const sup = await auth(request(app).post('/api/suppliers')).send({ name: prefix + ' Tedarik', email: prefix + '@s.test', phone: '05550000000' });
  const product = async (sku, extra = {}) => { const r = await auth(request(app).post('/api/products')).send({ sku: prefix + sku, name: prefix + ' ' + sku, category: 'A', purchase_price: 10, sale_price: 20, min_stock_level: 10, max_stock_level: 100, unit: 'adet', supplier_id: sup.body.id, ...extra }); expect(r.status).toBeLessThan(300); return r.body.id || r.body.product?.id; };
  const move = (product_id, change_amount, movement_type, note) => auth(request(app).post('/api/stock/movement')).send({ product_id, warehouse_id: warehouseId, change_amount, movement_type, note });
  return { t, auth, warehouseId, supplierId: sup.body.id, product, move };
}
const alertsOf = async (tenantId, type) => (await pool.query('SELECT * FROM alerts WHERE tenant_id=$1 AND alert_type=$2', [tenantId, type])).rows;

test('stok önerisi tedarikçiye göre satın alma taslağına döner, aynı anahtar tekrar üretmez', async () => {
  const f = await fixture('fc');
  const low = await f.product('LOW');await f.move(low, 2, 'inbound');
  const noSupplier = await f.product('NOSUP', { supplier_id: null });await f.move(noSupplier, 1, 'inbound');
  const safe = await f.product('SAFE');await f.move(safe, 90, 'inbound');
  const post = () => f.auth(request(app).post('/api/purchase-orders/from-forecast')).set('Idempotency-Key', 'fc-1').send({});
  const res = await post();
  expect(res.status).toBe(201);
  expect(res.body.orders).toHaveLength(1);
  expect(res.body.skipped.map(s => s.product_id)).toContain(noSupplier);
  const detail = await f.auth(request(app).get('/api/purchase-orders/' + res.body.orders[0].id));
  expect(detail.body.status).toBe('draft');
  const lines = detail.body.items.map(i => [i.product_id, Number(i.quantity)]);
  expect(lines).toContainEqual([low, 98]);
  expect(lines.map(l => l[0])).not.toContain(safe);
  const again = await post();
  expect(again.body.orders[0].id).toBe(res.body.orders[0].id);
  expect((await pool.query('SELECT COUNT(*) AS n FROM purchase_orders WHERE tenant_id=$1', [f.t.tenantId])).rows[0].n).toBe(1);
});

test('öneri başka firmanın ürününü taslağa koymaz ve anahtarsız çalışmaz', async () => {
  const a = await fixture('ta'), b = await fixture('tb');
  const other = await b.product('X');await b.move(other, 1, 'inbound');
  const mine = await a.product('Y');await a.move(mine, 1, 'inbound');
  expect((await a.auth(request(app).post('/api/purchase-orders/from-forecast')).send({ product_ids: [mine] })).status).toBe(400);
  const none = await a.auth(request(app).post('/api/purchase-orders/from-forecast')).set('Idempotency-Key', 'k').send({ product_ids: [other] });
  expect(none.status).toBe(400);
  expect((await pool.query('SELECT COUNT(*) AS n FROM purchase_orders WHERE tenant_id=$1', [a.t.tenantId])).rows[0].n).toBe(0);
});

test('sayım farkı kesinleşince eksik ve fazla için anında bildirim düşer, farksız ürün için düşmez', async () => {
  const f = await fixture('ct');
  const short = await f.product('S'), extra = await f.product('E'), same = await f.product('N');
  for (const id of [short, extra, same]) await f.move(id, 20, 'inbound');
  const count = await f.auth(request(app).post('/api/stock-counts')).send({ warehouse_id: f.warehouseId, notes: 't' });
  expect(count.status).toBeLessThan(300);
  const countId = count.body.stock_count.id;
  const rows = (await pool.query('SELECT * FROM stock_count_items WHERE count_id=$1', [countId])).rows;
  const counted = { [short]: 15, [extra]: 23, [same]: 20 };
  for (const row of rows) expect((await f.auth(request(app).put(`/api/stock-counts/${countId}/items/${row.id}`)).send({ counted_quantity: counted[row.product_id] })).status).toBe(200);
  expect((await f.auth(request(app).post(`/api/stock-counts/${countId}/finalize`))).status).toBe(200);
  const alerts = await alertsOf(f.t.tenantId, 'count_variance');
  expect(alerts).toHaveLength(2);
  const miss = alerts.find(a => a.product_id === short);
  expect(miss.severity).toBe('warning');
  expect(miss.message).toContain('5 adet eksik');
  expect(miss.message).toContain('50');
  expect(alerts.find(a => a.product_id === extra).message).toContain('3 adet fazla');
});

test('belgesiz büyük düşüş kayıp şüphesi olur, tekrar taramada çoğalmaz, firmalar karışmaz', async () => {
  const f = await fixture('ls', 3), other = await fixture('lo', 1);
  const id = await f.product('L');await f.move(id, 50, 'inbound');
  expect((await f.move(id, -8, 'outbound')).status).toBeLessThan(300);
  await monitor.run(f.t.tenantId);await monitor.run(f.t.tenantId);
  const alerts = await alertsOf(f.t.tenantId, 'loss_suspicion');
  expect(alerts).toHaveLength(1);
  expect(alerts[0].message).toContain('belgesiz 8 adet');
  expect(alerts[0].message).toContain('ipuçları');
  expect(alerts[0].message).toContain('80');
  expect(await alertsOf(other.t.tenantId, 'loss_suspicion')).toHaveLength(0);
});

test('tek birimlik düşüş ve normal satış hızındaki çıkış kayıp şüphesi sayılmaz', async () => {
  const f = await fixture('nm', 2);
  const id = await f.product('N');await f.move(id, 200, 'inbound');
  await f.move(id, -1, 'outbound');
  await monitor.run(f.t.tenantId);
  expect(await alertsOf(f.t.tenantId, 'loss_suspicion')).toHaveLength(0);
  const busy = await f.product('B');await f.move(busy, 900, 'inbound');
  for (let i = 0; i < 30; i++) await pool.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source) VALUES ($1,$2,$3,-30,'sale','scanner_pos')", [f.t.tenantId, busy, f.warehouseId]);
  await f.move(busy, -5, 'outbound');
  await monitor.run(f.t.tenantId);
  expect(await alertsOf(f.t.tenantId, 'loss_suspicion')).toHaveLength(0);
});
