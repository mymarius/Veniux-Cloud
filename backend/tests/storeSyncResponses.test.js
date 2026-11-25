process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const sync = require('../src/services/storeSyncService');
const { createTenant, createWarehouse, openTestShift } = require('./factories');

// Bulut yanıtı bozuk, ara sayfa, 502/503 ya da cihaz anahtarı iptal: satışlar kaybolmaz, yanlışlıkla "gönderildi" sayılmaz.
let store, cloud, w, shift, key;
const admin = who => ({ ...who, role: 'admin' });
const auth = (who, req) => req.set('Authorization', 'Bearer ' + who.token);
const toCloud = async (url, opts) => {
  const r = await request(app).post('/api/store-sync/sales').set('Authorization', opts.headers.Authorization).send(JSON.parse(opts.body));
  return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.body) };
};
const fixed = (status, body) => async () => ({ ok: status < 300, status, text: async () => body });
const sell = () => auth(store, request(app).post('/api/scanner/sale')).set('Idempotency-Key', crypto.randomUUID())
  .send({ warehouse_id: w.id, shift_id: shift.shift_id, register_id: shift.register_id, items: [{ barcode: '000-RSP', count: 1 }], payment_method: 'cash' });
const cloudCount = () => db.query('SELECT COUNT(*) AS c FROM store_sync_sales WHERE tenant_id=$1', [cloud.tenantId]).then(r => Number(r.rows[0].c));
const pending = async () => (await sync.getConfig(admin(store))).pending;

beforeAll(async () => {
  store = await createTenant(); cloud = await createTenant();
  w = await createWarehouse(store.tenantId);
  const p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'RSP-1','Yanıt ürünü','000-RSP','adet',10,'NORMAL') RETURNING id", [store.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,500)', [store.tenantId, w.id, p.id]);
  shift = await openTestShift(store, w.id, 0);
  key = (await sync.createDevice(admin(cloud), 'Yanıt testi')).key;
  await sync.saveConfig(admin(store), { cloud_url: 'http://localhost:3999', device_key: key });
});

test('200 dönen ama bulut yanıtı olmayan ara sayfa (HTML) satışı gönderilmiş saymaz', async () => {
  for (let i = 0; i < 3; i += 1) expect((await sell()).status).toBe(201);
  const before = await pending();
  const r = await sync.pushOnce(store.tenantId, { fetchImpl: fixed(200, '<html><body>Wi-Fi girişi</body></html>') });
  expect(r.error).toMatch(/doğrulanamadı/);
  expect(await pending()).toBe(before);
  expect(await cloudCount()).toBe(0);
  const ok = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(ok.error).toBeUndefined();
  expect(await cloudCount()).toBe(3);
  expect(await pending()).toBe(0);
});

test('yarım kesilmiş JSON ve eksik alanlı yanıt da gönderilmiş sayılmaz; sayılar uyuşmazsa reddedilir', async () => {
  expect((await sell()).status).toBe(201);
  const before = await pending();
  for (const body of ['{"added":1,"upd', '{}', '{"added":"1","updated":0,"unchanged":0}', '{"added":0,"updated":0,"unchanged":0}']) {
    const r = await sync.pushOnce(store.tenantId, { fetchImpl: fixed(200, body) });
    expect(r.error).toBeTruthy();
    expect(await pending()).toBe(before);
  }
  expect((await sync.pushOnce(store.tenantId, { fetchImpl: toCloud })).error).toBeUndefined();
  expect(await pending()).toBe(0);
});

test('502 ve 503: hata görünür, kayıtlar kaybolmaz, bağlantı gelince gider', async () => {
  expect((await sell()).status).toBe(201);
  const before = await pending();
  for (const status of [502, 503]) {
    const r = await sync.pushOnce(store.tenantId, { fetchImpl: fixed(status, 'Bad Gateway') });
    expect(r.error).toContain(String(status));
    expect(await pending()).toBe(before);
    expect((await sync.getConfig(admin(store))).last_error).toContain(String(status));
  }
  expect((await sync.pushOnce(store.tenantId, { fetchImpl: toCloud })).error).toBeUndefined();
  expect((await sync.getConfig(admin(store))).last_error).toBeNull();
});

test('cihaz anahtarı iptal edildi: 401, kayıtlar bekler; yeni anahtar girilince gönderilir', async () => {
  const device = (await db.query('SELECT id FROM store_sync_devices WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1', [cloud.tenantId])).rows[0];
  expect((await sell()).status).toBe(201);
  await sync.revokeDevice(admin(cloud), device.id);
  const before = await pending();
  const r = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(r.error).toMatch(/401/);
  expect(await pending()).toBe(before);
  const fresh = (await sync.createDevice(admin(cloud), 'Yeni anahtar')).key;
  await sync.saveConfig(admin(store), { cloud_url: 'http://localhost:3999', device_key: fresh });
  expect((await sync.pushOnce(store.tenantId, { fetchImpl: toCloud })).error).toBeUndefined();
  expect(await pending()).toBe(0);
});
