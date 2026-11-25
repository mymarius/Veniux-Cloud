process.env.API_THROTTLE_AUTH_MAX = '1000000';
process.env.API_THROTTLE_ANON_MAX = '1000000';
process.env.AUTH_RATE_LIMIT_MAX = '1000000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const sync = require('../src/services/storeSyncService');
const { createTenant, createWarehouse, openTestShift } = require('./factories');

// Eşitleme yük ve dayanıklılık: 1.000 satış, aynı satışın 10 kez gönderilmesi, bulut/yerel toplam karşılaştırması.
// 10.000 kayıt senaryosu SYNC_LOAD=10000 ile elle çalıştırılır (süre ve bellek ortama bağlıdır).
// Ağır test: ortak test veritabanını şişirir (10.000 satırda ~60 MB) ve yedek testlerini yavaşlatır. Bu yüzden yalnızca SYNC_LOAD ayarlıyken çalışır:
//   SYNC_LOAD=1000 npx jest tests/storeSyncLoad.test.js ...   sonra backend/stok_takip_test.db silinmelidir.
const COUNT = Number(process.env.SYNC_LOAD || 0);
const heavy = COUNT > 0 ? test : test.skip;
let store, cloud, w, shift, deviceKey;
const admin = who => ({ ...who, role: 'admin' });
const auth = (who, req) => req.set('Authorization', 'Bearer ' + who.token);
const toCloud = async (url, opts) => {
  const r = await request(app).post('/api/store-sync/sales').set('Authorization', opts.headers.Authorization).send(JSON.parse(opts.body));
  return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.body) };
};

beforeAll(async () => {
  if (!COUNT) return;
  store = await createTenant(); cloud = await createTenant();
  w = await createWarehouse(store.tenantId);
  const p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'LOAD-1','Yük ürünü','000-LOAD','adet',10,'NORMAL') RETURNING id", [store.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [store.tenantId, w.id, p.id, COUNT * 2]);
  shift = await openTestShift(store, w.id, 0);
  deviceKey = (await sync.createDevice(admin(cloud), 'Yük testi')).key;
  await sync.saveConfig(admin(store), { cloud_url: 'http://localhost:3999', device_key: deviceKey });
}, 60000);

heavy(`${COUNT} satış eşitlenir; ikinci tur ve 10 tekrar çift kayıt oluşturmaz; yerel ve bulut toplamları eşit`, async () => {
  const sell = () => auth(store, request(app).post('/api/scanner/sale')).set('Idempotency-Key', crypto.randomUUID())
    .send({ warehouse_id: w.id, shift_id: shift.shift_id, register_id: shift.register_id, items: [{ barcode: '000-LOAD', count: 1 }], payment_method: 'cash' });
  const t0 = Date.now();
  for (let i = 0; i < COUNT; i += 1) { const r = await sell(); if (r.status !== 201) throw new Error(`satış ${i} oluşmadı: ${r.status}`); await new Promise(resolve => setTimeout(resolve, 20)); } // istek güvenlik duvarının 10 sn'de 600 istek sınırını aşmamak için
  const salesMs = Date.now() - t0;
  const t1 = Date.now();
  const first = await sync.pushOnce(store.tenantId, { fetchImpl: toCloud });
  const syncMs = Date.now() - t1;
  expect(first.error).toBeUndefined();
  expect(first.sent).toBe(COUNT);
  for (let i = 0; i < 10; i += 1) expect((await sync.pushOnce(store.tenantId, { fetchImpl: toCloud })).sent).toBe(0);
  const local = (await db.query("SELECT COUNT(*) AS c, COALESCE(SUM(net_amount),0) AS s FROM pos_sales WHERE tenant_id=$1 AND status='completed'", [store.tenantId])).rows[0];
  const remote = (await db.query('SELECT COUNT(*) AS c, COALESCE(SUM(net_amount),0) AS s FROM store_sync_sales WHERE tenant_id=$1', [cloud.tenantId])).rows[0];
  expect(Number(remote.c)).toBe(COUNT);
  expect(Number(remote.c)).toBe(Number(local.c));
  expect(Number(remote.s)).toBeCloseTo(Number(local.s), 2);
  const dup = (await db.query('SELECT remote_sale_id, COUNT(*) AS c FROM store_sync_sales WHERE tenant_id=$1 GROUP BY remote_sale_id HAVING COUNT(*) > 1', [cloud.tenantId])).rows;
  expect(dup).toHaveLength(0);
  // Süreler ortama bağlıdır; raporlamak için yazılır, eşik koymaz.
  console.log(`[yük] ${COUNT} satış: oluşturma ${salesMs} ms, eşitleme ${syncMs} ms, bellek ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`);
}, 600000);
