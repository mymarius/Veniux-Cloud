process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const sync = require('../src/services/storeSyncService');
const { createTenant, createWarehouse, openTestShift } = require('./factories');

// Eşitleme senaryoları: kapanıp açılma, iki mağaza, satış sırasında fiyat değişimi, çakışan gönderim.
let cloud;
const stores = [];
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
const sell = (s, count = 1) => auth(s.user, request(app).post('/api/scanner/sale')).set('Idempotency-Key', crypto.randomUUID())
  .send({ warehouse_id: s.w.id, shift_id: s.shift.shift_id, register_id: s.shift.register_id, items: [{ barcode: s.barcode, count }], payment_method: 'cash' });
const copies = async () => (await db.query('SELECT device_id,remote_sale_id,net_amount,status,snapshot_json FROM store_sync_sales WHERE tenant_id=$1', [cloud.tenantId])).rows;
const price = async s => Number((await db.query('SELECT sale_price FROM products WHERE id=$1 AND tenant_id=$2', [s.productId, s.user.tenantId])).rows[0].sale_price);
const BARCODE = 'SENARYO-' + crypto.randomUUID().slice(0, 8);
let cloudProductId;

async function makeStore(label) {
  const user = await createTenant();
  const w = await createWarehouse(user.tenantId);
  const productId = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,'Ortak ürün',$3,'adet',10,'NORMAL') RETURNING id", [user.tenantId, `SN-${label}-${BARCODE}`, BARCODE])).rows[0].id;
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,500)', [user.tenantId, w.id, productId]);
  const shift = await openTestShift(user, w.id, 0);
  const device = await sync.createDevice(admin(cloud), 'Mağaza ' + label);
  await sync.saveConfig(admin(user), { cloud_url: 'http://localhost:3999', device_key: device.key });
  return { user, w, shift, productId, barcode: BARCODE, deviceId: device.id };
}

beforeAll(async () => {
  cloud = await createTenant();
  cloudProductId = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,'Ortak ürün',$3,'adet',10,'NORMAL') RETURNING id", [cloud.tenantId, 'SN-C-' + BARCODE, BARCODE])).rows[0].id;
  stores.push(await makeStore('A'), await makeStore('B'));
});

test('kasa yarıda kapanır (işaretleme tamamlanmadan): yeniden açılınca kalan gider, çift kayıt olmaz', async () => {
  const a = stores[0];
  for (let i = 0; i < 3; i += 1) expect((await sell(a)).status).toBe(201);
  const before = (await copies()).length;
  // Bulut kabul etti, program işaretleyemeden öldü.
  await sync.pushOnce(a.user.tenantId, { fetchImpl: async (url, opts) => { await toCloud(url, opts); throw new Error('süreç öldü'); } });
  // Yalnız bir satış "gönderildi" işaretlenmiş olsun (işaretleme ortasında kapanma).
  const first = (await db.query('SELECT p.id FROM pos_sales p WHERE p.tenant_id=$1 ORDER BY p.id LIMIT 1', [a.user.tenantId])).rows[0].id;
  await db.query("INSERT INTO store_sync_sent (tenant_id,kind,ref_id,snapshot_hash) VALUES ($1,'sale',$2,'eski-ozet')", [a.user.tenantId, first]);
  // Yeni süreç: bellekte hiçbir şey kalmadan modül yeniden yüklenir.
  let fresh; jest.isolateModules(() => { fresh = require('../src/services/storeSyncService'); });
  const r = await fresh.pushOnce(a.user.tenantId, { fetchImpl: toCloud });
  expect(r.error).toBeUndefined();
  expect((await copies()).length).toBe(before + 3);
  expect((await sync.getConfig(admin(a.user))).pending).toBe(0);
});

test('iki mağaza aynı barkodu satar: aynı satış numaraları çakışmaz, her mağaza ayrı görünür', async () => {
  const [a, b] = stores;
  expect((await sell(a, 2)).status).toBe(201);
  expect((await sell(b, 3)).status).toBe(201);
  expect((await sync.pushOnce(a.user.tenantId, { fetchImpl: toCloud })).error).toBeUndefined();
  expect((await sync.pushOnce(b.user.tenantId, { fetchImpl: toCloud })).error).toBeUndefined();
  const rows = await copies();
  const keys = rows.map(r => r.device_id + ':' + r.remote_sale_id);
  expect(new Set(keys).size).toBe(keys.length);
  const total = id => rows.filter(r => r.device_id === id).reduce((n, r) => n + Number(r.net_amount), 0);
  expect(total(a.deviceId)).toBe(50);
  expect(total(b.deviceId)).toBe(30);
});

test('satış sırasında bulut fiyatı değişir: eski satış eski fiyatla kalır, yeni satış yeni fiyatla gider; iki mağaza da aynı fiyatı alır', async () => {
  const [a, b] = stores;
  expect((await sell(a)).status).toBe(201); // 10 TL, henüz gönderilmedi
  await db.query('UPDATE products SET sale_price=15 WHERE id=$1 AND tenant_id=$2', [cloudProductId, cloud.tenantId]);
  for (const s of stores) expect((await sync.pullProducts(s.user.tenantId, { fetchImpl: fromCloud })).error).toBeUndefined();
  expect(await price(a)).toBe(15);
  expect(await price(b)).toBe(15);
  expect((await sell(a)).status).toBe(201);
  const before = (await copies()).length;
  expect((await sync.pushOnce(a.user.tenantId, { fetchImpl: toCloud })).error).toBeUndefined();
  const added = (await copies()).filter(r => r.device_id === a.deviceId).sort((x, y) => Number(x.remote_sale_id) - Number(y.remote_sale_id)).slice(-2);
  expect((await copies()).length).toBe(before + 2);
  expect(added.map(r => Number(r.net_amount))).toEqual([10, 15]);
});

test('bir mağaza fiyatı elle değiştirirse diğerini ve bulutu etkilemez; bulut yeni fiyat yayınlayınca bulut kazanır', async () => {
  const [a, b] = stores;
  await db.query('UPDATE products SET sale_price=99 WHERE id=$1 AND tenant_id=$2', [a.productId, a.user.tenantId]);
  await sync.pullProducts(a.user.tenantId, { fetchImpl: fromCloud });
  await sync.pullProducts(b.user.tenantId, { fetchImpl: fromCloud });
  expect(await price(a)).toBe(99); // bulut değişmediği için yerel fiyat korunur
  expect(await price(b)).toBe(15);
  await db.query('UPDATE products SET sale_price=17 WHERE id=$1 AND tenant_id=$2', [cloudProductId, cloud.tenantId]);
  await sync.pullProducts(a.user.tenantId, { fetchImpl: fromCloud });
  expect(await price(a)).toBe(17);
});

test('aynı anda iki gönderim (zamanlayıcı + elle): çift kayıt yok, hata yok, bekleyen kalmaz', async () => {
  const a = stores[0];
  for (let i = 0; i < 5; i += 1) await sell(a);
  const before = (await copies()).length;
  let calls = 0;
  const slow = async (url, opts) => { calls += 1; await new Promise(r => setTimeout(r, 50)); return toCloud(url, opts); };
  const [x, y] = await Promise.all([sync.pushOnce(a.user.tenantId, { fetchImpl: slow }), sync.pushOnce(a.user.tenantId, { fetchImpl: slow })]);
  expect(x.error).toBeUndefined();
  expect(y.error).toBeUndefined();
  expect((await copies()).length).toBe(before + 5);
  expect((await sync.getConfig(admin(a.user))).pending).toBe(0);
  expect(calls).toBe(1);
});

test('aynı anda iki ürün çekme: yeni ürün mağazaya yalnız bir kez eklenir', async () => {
  const b = stores[1], barcode = 'YENI-' + BARCODE;
  await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,'Yeni ürün',$3,'adet',5,'NORMAL')", [cloud.tenantId, 'SN-Y-' + BARCODE, barcode]);
  const slow = async (url, opts) => { await new Promise(r => setTimeout(r, 50)); return fromCloud(url, opts); };
  await Promise.all([sync.pullProducts(b.user.tenantId, { fetchImpl: slow }), sync.pullProducts(b.user.tenantId, { fetchImpl: slow })]);
  const rows = (await db.query('SELECT id FROM products WHERE tenant_id=$1 AND barcode=$2', [b.user.tenantId, barcode])).rows;
  expect(rows.length).toBe(1);
});
