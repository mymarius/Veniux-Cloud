process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const sync = require('../src/services/storeSyncService');
const { createTenant, createWarehouse, openTestShift } = require('./factories');

// Mağaza–bulut eşitlemesinde hata anları: ağ kopması, bulutun yarıda hata vermesi, büyük katalog.
let store, cloud, w, shift, product, deviceKey;
const admin = who => ({ ...who, role: 'admin' });
const auth = (who, req) => req.set('Authorization', 'Bearer ' + who.token);
const toCloud = async (url, opts) => {
  const r = await request(app).post('/api/store-sync/sales').set('Authorization', opts.headers.Authorization).send(JSON.parse(opts.body));
  return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.body) };
};
const fromCloud = async (url, opts) => {
  const r = await request(app).get(url.replace('http://localhost:3999', '')).set('Authorization', opts.headers.Authorization);
  return { ok: r.status < 300, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
};
const sell = count => auth(store, request(app).post('/api/scanner/sale')).set('Idempotency-Key', crypto.randomUUID())
  .send({ warehouse_id: w.id, shift_id: shift.shift_id, register_id: shift.register_id, items: [{ barcode: '000-FAIL', count }], payment_method: 'cash' });
const cloudCopies = () => db.query('SELECT COUNT(*) AS c FROM store_sync_sales WHERE tenant_id=$1', [cloud.tenantId]).then(r => Number(r.rows[0].c));

beforeAll(async () => {
  store = await createTenant(); cloud = await createTenant();
  w = await createWarehouse(store.tenantId);
  product = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'FAIL-1','Hata ürünü','000-FAIL','adet',10,'NORMAL') RETURNING id", [store.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,1000)', [store.tenantId, w.id, product.id]);
  shift = await openTestShift(store, w.id, 0);
  const device = await sync.createDevice(admin(cloud), 'Hata testi');
  deviceKey = device.key || device.device_key;
  await sync.saveConfig(admin(store), { cloud_url: 'http://localhost:3999', device_key: deviceKey });
});

test('ağ kopar: satışlar kaybolmaz, hata yazılır, bağlantı gelince kalanı gider', async () => {
  for (let i = 0; i < 3; i += 1) expect((await sell(1)).status).toBe(201);
  const down = await sync.pushOnce(store.tenantId, { fetchImpl: async () => { throw new Error('fetch failed'); } });
  expect(down.error).toMatch(/fetch failed/);
  expect(await cloudCopies()).toBe(0);
  const cfg = await sync.getConfig(admin(store));
  expect(cfg.pending).toBeGreaterThanOrEqual(3);
  expect(cfg.last_error || cfg.lastError).toBeTruthy();
  const up = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(up.error).toBeUndefined();
  expect(await cloudCopies()).toBe(3);
  expect((await sync.getConfig(admin(store))).pending).toBe(0);
});

test('bulut yarıda 500 verir: gönderilen parti işaretlenir, kalanı sonraki turda gider, çift kayıt olmaz', async () => {
  for (let i = 0; i < 205; i += 1) await sell(1);
  let calls = 0;
  const flaky = async (url, opts) => {
    calls += 1;
    if (calls === 2) return { ok: false, status: 500, text: async () => 'sunucu hatası' };
    return toCloud(url, opts);
  };
  const before = await cloudCopies();
  const first = await sync.pushOnce(store.tenantId, { fetchImpl: flaky });
  expect(first.error).toMatch(/500/);
  expect(first.sent).toBe(100);
  expect(await cloudCopies()).toBe(before + 100);
  const second = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(second.error).toBeUndefined();
  expect(second.sent).toBe(105);
  expect(await cloudCopies()).toBe(before + 205);
});

test('bulut kaydı aldı ama yanıt mağazaya ulaşmadı: aynı satışlar tekrar gönderilince çift kayıt olmaz', async () => {
  await sell(1);
  const before = await cloudCopies();
  const lostReply = async (url, opts) => { await toCloud(url, opts); throw new Error('socket hang up'); };
  const first = await sync.pushOnce(store.tenantId, { fetchImpl: lostReply });
  expect(first.error).toMatch(/socket hang up/);
  expect(await cloudCopies()).toBe(before + 1);
  const retry = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  expect(retry.error).toBeUndefined();
  expect(await cloudCopies()).toBe(before + 1);
  expect((await sync.getConfig(admin(store))).pending).toBe(0);
});

test('büyük katalog sayfa sayfa iner: 1200 ürün eksiksiz, ikinci çekimde değişiklik yok', async () => {
  const rows = [];
  for (let i = 0; i < 1200; i += 1) rows.push(`('${cloud.tenantId}','BIG-${i}','Büyük ${i}','9${String(i).padStart(11, '0')}','adet',${(i % 50) + 1},'NORMAL',20)`);
  await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type,kdv_orani) VALUES " + rows.join(','));
  const first = await sync.pullProducts(store.tenantId, { fetchImpl: fromCloud });
  expect(first.error).toBeUndefined();
  expect(first.added).toBeGreaterThanOrEqual(1200);
  const count = await db.query("SELECT COUNT(*) AS c FROM products WHERE tenant_id=$1 AND sku LIKE 'BIG-%'", [store.tenantId]).then(r => Number(r.rows[0].c));
  expect(count).toBe(1200);
  const again = await sync.pullProducts(store.tenantId, { fetchImpl: fromCloud });
  expect(again).toMatchObject({ added: 0, updated: 0 });
});

test('bulut ürün çekerken kesilir: hata yazılır, mağazadaki ürünler bozulmaz', async () => {
  const before = await db.query('SELECT COUNT(*) AS c FROM products WHERE tenant_id=$1', [store.tenantId]).then(r => Number(r.rows[0].c));
  let n = 0;
  const cut = async (url, opts) => { n += 1; if (n === 2) throw new Error('ECONNRESET'); return fromCloud(url, opts); };
  await db.query("UPDATE products SET sale_price=sale_price+1 WHERE tenant_id=$1 AND sku LIKE 'BIG-%'", [cloud.tenantId]);
  const r = await sync.pullProducts(store.tenantId, { fetchImpl: cut });
  expect(r.error).toMatch(/ECONNRESET/);
  const after = await db.query('SELECT COUNT(*) AS c FROM products WHERE tenant_id=$1', [store.tenantId]).then(r2 => Number(r2.rows[0].c));
  expect(after).toBe(before);
});
