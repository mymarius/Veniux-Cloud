process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const sync = require('../src/services/storeSyncService');
const { createTenant, createWarehouse, createUser, openTestShift } = require('./factories');

// Aynı test veritabanında iki işletme: "store" (mağaza bilgisayarı) satış yapar, "cloud" (bulut hesabı) kopyaları alır.
let store, cloud, other, w, shift, product, deviceKey;
const auth = (who, req) => req.set('Authorization', 'Bearer ' + who.token);
const toCloud = async (url, opts) => {
  const r = await request(app).post('/api/store-sync/sales').set('Authorization', opts.headers.Authorization).send(JSON.parse(opts.body));
  return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.body) };
};
const sell = count => auth(store, request(app).post('/api/scanner/sale')).set('Idempotency-Key', crypto.randomUUID())
  .send({ warehouse_id: w.id, shift_id: shift.shift_id, register_id: shift.register_id, items: [{ barcode: '000-SYN', count }], payment_method: 'cash' });
const copies = tenant => db.query('SELECT * FROM store_sync_sales WHERE tenant_id=$1 ORDER BY remote_sale_id', [tenant]).then(r => r.rows);

beforeAll(async () => {
  store = await createTenant(); cloud = await createTenant(); other = await createTenant();
  w = await createWarehouse(store.tenantId);
  product = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'SYN-1','Eşitleme ürünü','000-SYN','adet',10,'NORMAL') RETURNING *", [store.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [store.tenantId, w.id, product.id]);
  shift = await openTestShift(store, w.id, 0);
});

test('cihaz anahtarı bir kez gösterilir, yalnız özeti saklanır; kasiyer oluşturamaz', async () => {
  const cashier = await createUser(cloud.tenantId, 'cashier');
  const denied = await request(app).post('/api/store-sync/devices').set('Authorization', 'Bearer ' + jwt.sign({ userId: cashier.id, tenantId: cloud.tenantId, role: 'cashier' }, JWT_SECRET)).send({ name: 'Kadıköy' });
  expect(denied.status).toBe(403);
  const r = await auth(cloud, request(app).post('/api/store-sync/devices')).send({ name: 'Kadıköy şubesi' });
  expect(r.status).toBe(201);
  deviceKey = r.body.key;
  expect(deviceKey).toMatch(sync.KEY);
  const row = (await db.query('SELECT key_hash FROM store_sync_devices WHERE id=$1', [r.body.id])).rows[0];
  expect(row.key_hash).not.toContain(deviceKey);
  const list = await auth(cloud, request(app).get('/api/store-sync/devices'));
  expect(JSON.stringify(list.body)).not.toContain(deviceKey);
});

test('yükleme anahtarsız, yanlış veya başka biçimde anahtarla reddedilir', async () => {
  for (const header of [undefined, 'Bearer vsk_yanlis', 'Bearer vsk_' + 'A'.repeat(32), 'Basic abc']) {
    const req = request(app).post('/api/store-sync/sales'); if (header) req.set('Authorization', header);
    expect((await req.send({ sales: [] })).status).toBe(401);
  }
});

test('mağaza satışları buluta yüklenir; ikinci tur tekrar yüklemez; bulut kendi satışına dokunmaz', async () => {
  expect((await sell(2)).status).toBe(201);
  expect((await sell(1)).status).toBe(201);
  await sync.saveConfig({ ...store, role: 'admin' }, { cloud_url: 'http://localhost:3999', device_key: deviceKey });
  expect((await sync.getConfig({ ...store, role: 'admin' })).pending).toBe(3);
  const first = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(first).toEqual({ sent: 2, shifts: 1 });
  expect(await db.query('SELECT COUNT(*) AS c FROM store_sync_shifts WHERE tenant_id=$1', [cloud.tenantId]).then(r => Number(r.rows[0].c))).toBe(1);
  const rows = await copies(cloud.tenantId);
  expect(rows).toHaveLength(2);
  expect(rows.map(r => Number(r.net_amount))).toEqual([20, 10]);
  expect(await copies(store.tenantId)).toHaveLength(0);
  expect(await copies(other.tenantId)).toHaveLength(0);
  expect(await sync.pushOnce(store.tenantId, { fetchImpl: toCloud })).toEqual({ sent: 0, shifts: 0 });
  expect(await copies(cloud.tenantId)).toHaveLength(2);
  expect((await sync.getConfig({ ...store, role: 'admin' })).pending).toBe(0);
});

test('iade sonrası değişen satış güncellenir (çift kayıt olmaz)', async () => {
  const sale = (await db.query('SELECT id FROM pos_sales WHERE tenant_id=$1 ORDER BY id LIMIT 1', [store.tenantId])).rows[0];
  await db.query("UPDATE pos_sales SET status='cancelled',net_amount=0 WHERE id=$1", [sale.id]);
  const snap = (await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1', [sale.id])).rows[0];
  await db.query('UPDATE retail_sales SET snapshot_json=$1 WHERE sale_id=$2', [JSON.stringify({ ...JSON.parse(snap.snapshot_json), status: 'cancelled' }), sale.id]);
  expect(await sync.pushOnce(store.tenantId, { fetchImpl: toCloud })).toEqual({ sent: 1, shifts: 0 });
  const rows = await copies(cloud.tenantId);
  expect(rows).toHaveLength(2);
  expect(rows.find(r => Number(r.remote_sale_id) === Number(sale.id))).toMatchObject({ status: 'cancelled' });
  expect(Number(rows.find(r => Number(r.remote_sale_id) === Number(sale.id)).net_amount)).toBe(0);
});

test('özet yalnız kendi işletmesini gösterir; iptal edilen cihaz artık yükleyemez', async () => {
  const mine = await auth(cloud, request(app).get('/api/store-sync/summary'));
  expect(mine.status).toBe(200);
  expect(mine.body.items.reduce((s, r) => s + r.sale_count, 0)).toBe(2);
  expect(mine.body.items.reduce((s, r) => s + r.net_total, 0)).toBe(10);
  const theirs = await auth(other, request(app).get('/api/store-sync/summary'));
  expect(theirs.body.items).toEqual([]);
  const id = (await auth(cloud, request(app).get('/api/store-sync/devices'))).body.items[0].id;
  expect((await auth(other, request(app).delete('/api/store-sync/devices/' + id))).status).toBe(404);
  expect((await auth(cloud, request(app).delete('/api/store-sync/devices/' + id))).status).toBe(200);
  await sell(1);
  const after = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(after.sent).toBe(0);
  expect(after.error).toMatch(/401/);
  expect((await sync.getConfig({ ...store, role: 'admin' })).last_error).toMatch(/401/);
  expect((await sync.getConfig({ ...store, role: 'admin' })).pending).toBe(1);
});

test('bulut adresi güvenli olmalı; geçersiz yük reddedilir', async () => {
  expect(() => sync.normalizeUrl('http://app.veniux.com')).toThrow();
  expect(() => sync.normalizeUrl('https://user:pw@app.veniux.com')).toThrow();
  expect(() => sync.normalizeUrl('ftp://x')).toThrow();
  expect(sync.normalizeUrl('https://app.veniux.com/yol')).toBe('https://app.veniux.com');
  const key = (await auth(other, request(app).post('/api/store-sync/devices')).send({ name: 'Başka' })).body.key;
  const bad = body => request(app).post('/api/store-sync/sales').set('Authorization', 'Bearer ' + key).send(body);
  expect((await bad({ sales: [] })).status).toBe(400);
  expect((await bad({ sales: [{ remote_sale_id: 1, receipt_no: 'A', business_date: 'dün', sold_at: 'x', status: 'completed', total_amount: 1, net_amount: 1, snapshot: {} }] })).status).toBe(400);
  expect((await bad({ sales: [{ remote_sale_id: 1, receipt_no: 'A', business_date: '2026-11-10', sold_at: new Date().toISOString(), status: 'sahte', total_amount: 1, net_amount: 1, snapshot: {} }] })).status).toBe(400);
});

test('anahtar mağaza veritabanında düz metin değildir; vardiya kapanışı ve gider buluta gider, tekrar göndermez', async () => {
  const stored = (await db.query('SELECT device_key FROM store_sync_config WHERE tenant_id=$1', [store.tenantId])).rows[0].device_key;
  expect(stored.startsWith('enc1:')).toBe(true);
  expect(stored).not.toContain(deviceKey);
  const key = (await auth(cloud, request(app).post('/api/store-sync/devices')).send({ name: 'Yeni anahtar' })).body.key;
  await sync.saveConfig({ ...store, role: 'admin' }, { cloud_url: 'http://localhost:3999', device_key: key });
  await db.query("INSERT INTO retail_cash_movements (id,tenant_id,shift_id,user_id,user_email,direction,amount_cents,reason) VALUES ($1,$2,$3,$4,'a@b.c','out',2500,'Su faturası')", [crypto.randomUUID(), store.tenantId, shift.shift_id, store.userId]);
  const r = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(r.error).toBeUndefined();
  expect(r.shifts).toBe(1);
  const row = (await db.query('SELECT cash_out_cents,status FROM store_sync_shifts WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1', [cloud.tenantId])).rows[0];
  expect(Number(row.cash_out_cents)).toBe(2500);
  const mine = await auth(cloud, request(app).get('/api/store-sync/summary'));
  expect(mine.body.shifts.reduce((s, x) => s + x.cash_out, 0)).toBeGreaterThanOrEqual(25);
  expect((await sync.pushOnce(store.tenantId, { fetchImpl: toCloud })).shifts).toBe(0);
});

test('ürün ve fiyat buluttan mağazaya iner: bulut kazanır, yeni ürün eklenir, mağazanın kendi ürünü ve stok değişmez, silme yok', async () => {
  const fromCloud = async (url, opts) => {
    const r = await request(app).get(url.replace('http://localhost:3999', '')).set('Authorization', opts.headers.Authorization);
    return { ok: r.status < 300, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  };
  const add = (tenant, sku, name, barcode, price) => db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type,kdv_orani) VALUES($1,$2,$3,$4,'adet',$5,'NORMAL',20) RETURNING id", [tenant, sku, name, barcode, price]);
  await add(cloud.tenantId, 'CLD-SYN', 'Bulut adı', '000-SYN', 12.5);
  await add(cloud.tenantId, 'CLD-NEW', 'Yeni bulut ürünü', '000-NEW', 7);
  await add(store.tenantId, 'ST-OWN', 'Mağazanın kendi ürünü', '000-OWN', 3);
  const cloudCount = async () => Number((await db.query('SELECT COUNT(*) AS c FROM products WHERE tenant_id=$1', [cloud.tenantId])).rows[0].c), cloudBefore = await cloudCount();
  const stockBefore = Number((await db.query('SELECT SUM(quantity) AS q FROM stock_records WHERE tenant_id=$1', [store.tenantId])).rows[0].q);
  const first = await sync.pullProducts(store.tenantId, { fetchImpl: fromCloud });
  expect(first).toMatchObject({ added: 1, updated: 1 });
  expect(first.error).toBeUndefined();
  const get = barcode => db.query('SELECT name,sale_price,unit FROM products WHERE tenant_id=$1 AND barcode=$2', [store.tenantId, barcode]).then(r => r.rows);
  expect((await get('000-SYN'))[0]).toMatchObject({ name: 'Bulut adı', sale_price: 12.5 });
  expect((await get('000-NEW'))[0]).toMatchObject({ name: 'Yeni bulut ürünü', sale_price: 7 });
  expect((await get('000-OWN'))[0]).toMatchObject({ name: 'Mağazanın kendi ürünü', sale_price: 3 });
  expect(Number((await db.query('SELECT SUM(quantity) AS q FROM stock_records WHERE tenant_id=$1', [store.tenantId])).rows[0].q)).toBe(stockBefore);
  const again = await sync.pullProducts(store.tenantId, { fetchImpl: fromCloud });
  expect(again).toMatchObject({ added: 0, updated: 0 });
  await db.query("UPDATE products SET sale_price=15 WHERE tenant_id=$1 AND barcode='000-SYN'", [cloud.tenantId]);
  await db.query("UPDATE products SET sale_price=99 WHERE tenant_id=$1 AND barcode='000-OWN'", [store.tenantId]);
  const third = await sync.pullProducts(store.tenantId, { fetchImpl: fromCloud });
  expect(third.updated).toBe(1);
  expect((await get('000-SYN'))[0].sale_price).toBe(15);
  expect((await get('000-OWN'))[0].sale_price).toBe(99);
  expect(await cloudCount()).toBe(cloudBefore);
});

test('ürün çekme anahtarsız veya iptal edilmiş anahtarla reddedilir', async () => {
  expect((await request(app).get('/api/store-sync/products')).status).toBe(401);
  expect((await request(app).get('/api/store-sync/products').set('Authorization', 'Bearer vsk_' + 'B'.repeat(32))).status).toBe(401);
});

test('denetim kaydı: cihaz kimliği sayısal entity_id sütununa değil details içine yazılır (MySQL BIGINT)', async () => {
  const row = (await db.query("SELECT entity_id,details FROM audit_logs WHERE tenant_id=$1 AND action='store_sync.device_created' ORDER BY id DESC LIMIT 1", [cloud.tenantId])).rows[0];
  expect(row.entity_id).toBeNull();
  expect(JSON.parse(row.details).device_id).toMatch(/^[0-9a-f-]{36}$/);
});
