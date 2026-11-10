process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser, openTestShift } = require('./factories');

let owner, cashier, w, shift, product;
const stamp = (n, at = new Date()) => `E1AB-20261110-${String(n).padStart(5, '0')}|${at.toISOString()}`;
const sale = (count, { key = crypto.randomUUID(), header, token = owner.token } = {}) => {
  const r = request(app).post('/api/scanner/sale').set('Authorization', 'Bearer ' + token).set('Idempotency-Key', key);
  if (header) r.set('X-Veniux-Offline', header);
  return r.send({ warehouse_id: w.id, shift_id: shift.shift_id, register_id: shift.register_id, items: [{ barcode: '000-OFF', count }], payment_method: 'cash' });
};
const stock = async () => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id=$2', [owner.tenantId, product.id])).rows[0].q);
const setStock = q => db.query('UPDATE stock_records SET quantity=$1 WHERE tenant_id=$2 AND product_id=$3', [q, owner.tenantId, product.id]);
const get = (path, token = owner.token) => request(app).get('/api/scanner/' + path).set('Authorization', 'Bearer ' + token);

beforeAll(async () => {
  owner = await createTenant();
  w = await createWarehouse(owner.tenantId);
  product = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'OFF-1','Çevrimdışı ürün','000-OFF','adet',10,'NORMAL') RETURNING *", [owner.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,2)', [owner.tenantId, w.id, product.id]);
  shift = await openTestShift(owner, w.id, 0);
  const u = await createUser(owner.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: u.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
});

test('çevrimiçi satışta yetersiz stok hâlâ reddedilir (mevcut kural bozulmaz)', async () => {
  const r = await sale(5);
  expect(r.status).toBe(409);
  expect(await stock()).toBe(2);
});

test('çevrimdışı satış: stok açığı reddedilmez, stok eksiye düşmez, açık uyuşmazlık yazılır, geçici fiş izi saklanır', async () => {
  const r = await sale(5, { header: stamp(1) });
  expect(r.status).toBe(201);
  expect(r.body.offline).toEqual({ receipt_no: 'E1AB-20261110-00001', stock_shortfalls: [{ product_id: product.id, quantity: 3 }] });
  expect(await stock()).toBe(0);
  const meta = (await db.query('SELECT mode FROM pos_sale_meta WHERE tenant_id=$1 AND sale_id=$2', [owner.tenantId, r.body.sale_id])).rows[0];
  expect(meta.mode).toBe('offline');
  const trace = (await db.query('SELECT emergency_receipt_no,conflict_count FROM pos_offline_sales WHERE tenant_id=$1 AND sale_id=$2', [owner.tenantId, r.body.sale_id])).rows[0];
  expect(trace).toMatchObject({ emergency_receipt_no: 'E1AB-20261110-00001', conflict_count: 1 });
  const movement = (await db.query("SELECT change_amount FROM stock_movements WHERE tenant_id=$1 AND source='offline_shortfall'", [owner.tenantId])).rows;
  expect(movement).toHaveLength(1);
  expect(Number(movement[0].change_amount)).toBe(3);
  const html = await request(app).get(`/api/scanner/sales/${r.body.sale_id}/receipt?width=80`).set('Authorization', 'Bearer ' + owner.token);
  expect(html.text).toContain('Geçici fiş no: E1AB-20261110-00001');
});

test('aynı satış aynı anahtarla tekrar gelirse çift kayıt, çift uyuşmazlık veya çift stok düzeltmesi oluşmaz', async () => {
  await setStock(1);
  const key = crypto.randomUUID(), header = stamp(2);
  const first = await sale(4, { key, header }), again = await sale(4, { key, header });
  expect(first.status).toBe(201); expect(again.status).toBe(201);
  expect(again.body.sale_id).toBe(first.body.sale_id);
  expect(await stock()).toBe(0);
  const conflicts = (await db.query('SELECT shortfall_quantity FROM pos_offline_conflicts WHERE tenant_id=$1 AND sale_id=$2', [owner.tenantId, first.body.sale_id])).rows;
  expect(conflicts).toHaveLength(1);
  expect(Number(conflicts[0].shortfall_quantity)).toBe(3);
});

test('geçici fiş numarası başka bir satışta kullanılamaz; bozuk veya eski başlık reddedilir', async () => {
  await setStock(10);
  expect((await sale(1, { header: stamp(1) })).status).toBe(409);
  expect((await sale(1, { header: 'E1AB-20261110-3|' + new Date().toISOString() })).status).toBe(400);
  expect((await sale(1, { header: 'bozuk' })).status).toBe(400);
  expect((await sale(1, { header: stamp(9, new Date(Date.now() - 8 * 86400000)) })).status).toBe(400);
  expect((await sale(1, { header: stamp(9, new Date(Date.now() + 3600000)) })).status).toBe(400);
  expect(await stock()).toBe(10);
});

test('çevrimdışı satışta stok yeterliyse uyuşmazlık yazılmaz ama satış çevrimdışı olarak işaretlenir', async () => {
  await setStock(10);
  const r = await sale(2, { header: stamp(3) });
  expect(r.status).toBe(201);
  expect(r.body.offline.stock_shortfalls).toEqual([]);
  expect(await stock()).toBe(8);
  const trace = (await db.query('SELECT conflict_count FROM pos_offline_sales WHERE tenant_id=$1 AND sale_id=$2', [owner.tenantId, r.body.sale_id])).rows[0];
  expect(trace.conflict_count).toBe(0);
});

test('uyuşmazlık listesi yalnız yönetici içindir; ürün adı ve fiş numaraları görünür; kapatmak açıklama ister ve bir kez yapılır', async () => {
  expect((await get('offline-conflicts', cashier.token)).status).toBe(403);
  const open = (await get('offline-conflicts')).body.items;
  expect(open).toHaveLength(2);
  expect(open[0]).toMatchObject({ product_name: 'Çevrimdışı ürün', status: 'open', kind: 'stock_shortfall' });
  expect(open.map(c => c.emergency_receipt_no).sort()).toEqual(['E1AB-20261110-00001', 'E1AB-20261110-00002']);
  expect(open.every(c => c.local_receipt_no)).toBe(true);
  const id = open[0].id;
  const put = (body, token = owner.token) => request(app).put(`/api/scanner/offline-conflicts/${id}/resolve`).set('Authorization', 'Bearer ' + token).send(body);
  expect((await put({ note: 'kısa' })).status).toBe(400);
  expect((await put({ note: 'Sayım yapıldı, stok düzeltildi' }, cashier.token)).status).toBe(403);
  expect((await put({ note: 'Sayım yapıldı, stok düzeltildi' })).status).toBe(200);
  expect((await put({ note: 'Sayım yapıldı, stok düzeltildi' })).status).toBe(409);
  expect((await get('offline-conflicts')).body.items).toHaveLength(1);
  const all = (await get('offline-conflicts?status=all')).body.items;
  expect(all).toHaveLength(2);
  expect(all.find(c => c.id === id)).toMatchObject({ status: 'resolved', note: 'Sayım yapıldı, stok düzeltildi' });
});

test('stok açığı olan çevrimdışı satışın iadesi normal çalışır (stok iade edilen adet kadar artar)', async () => {
  await setStock(1);
  const r = await sale(3, { header: stamp(4) });
  expect(r.status).toBe(201);
  expect(await stock()).toBe(0);
  const back = await request(app).post(`/api/scanner/sales/${r.body.sale_id}/return`).set('Authorization', 'Bearer ' + owner.token).set('Idempotency-Key', crypto.randomUUID())
    .send({ reason: 'Müşteri iadesi', register_id: shift.register_id, shift_id: shift.shift_id, items: [{ id: 1, quantity: 3, disposition: 'saleable' }] });
  expect(back.status).toBe(200);
  expect(await stock()).toBe(3);
});
