process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const seen = require('../src/services/cloudLicenseSeen');
const { createTenant, createWarehouse, createUser } = require('./factories');

let a, b, w, wb, cashier;
const post = (who, body) => request(app).post('/api/label-checks').set('Authorization', 'Bearer ' + who.token).send(body);
const get = (who, query) => request(app).get('/api/label-checks').set('Authorization', 'Bearer ' + who.token).query(query);
const check = (extra = {}) => ({ id: crypto.randomUUID(), warehouse_id: w.id, barcode: '869000000001', product_name: 'Süt', shelf_price: 20, system_price: 20, ...extra });

beforeAll(async () => {
  a = await createTenant(); b = await createTenant();
  w = await createWarehouse(a.tenantId); wb = await createWarehouse(b.tenantId);
  const u = await createUser(a.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: u.id, tenantId: a.tenantId, role: 'cashier' }, JWT_SECRET) };
});

test('doğru ve hatalı etiket kaydı: karar sunucuda hesaplanır, özet sayaç ve hatalı listeyi verir', async () => {
  expect((await post(a, check())).status).toBe(201);
  const wrong = await post(a, check({ barcode: '869000000002', product_name: 'Ekmek', shelf_price: 5, system_price: 6 }));
  expect(wrong.status).toBe(201); expect(wrong.body.ok).toBe(false);
  // istemci "doğru" dese bile fiyatlar farklıysa hatalıdır
  const sneaky = await post(a, { ...check({ barcode: '869000000003', shelf_price: 9, system_price: 10 }), ok: true });
  expect(sneaky.body.ok).toBe(false);
  const s = await get(a, { warehouse_id: w.id });
  expect(s.status).toBe(200);
  expect(s.body.correct).toBe(1);
  expect(s.body.wrong.map(x => x.barcode).sort()).toEqual(['869000000002', '869000000003']);
});

test('aynı kimlik tekrar gönderilince çift sayılmaz; aynı barkod sonradan doğru girilirse hatalı listesinden çıkar', async () => {
  const body = check({ barcode: '869000000010' });
  expect((await post(a, body)).body.duplicate).toBe(false);
  expect((await post(a, body)).body.duplicate).toBe(true);
  expect((await get(a, { warehouse_id: w.id })).body.correct).toBe(2);
  await post(a, check({ barcode: '869000000002', product_name: 'Ekmek', shelf_price: 6, system_price: 6, checked_at: new Date(Date.now() + 1000).toISOString() }));
  const s = await get(a, { warehouse_id: w.id });
  expect(s.body.wrong.map(x => x.barcode)).not.toContain('869000000002');
});

test('başka işletmenin mağazasına yazılamaz, okunamaz; geçersiz girişler reddedilir', async () => {
  expect((await post(a, check({ warehouse_id: wb.id }))).status).toBe(404);
  expect((await get(a, { warehouse_id: wb.id })).body.correct).toBe(0);
  expect((await get(b, { warehouse_id: w.id })).body.total).toBe(0);
  for (const bad of [{ id: 'x' }, { warehouse_id: 0 }, { barcode: '' }, { shelf_price: -1 }, { system_price: 'abc' }, { product_id: 'x' }])
    expect([JSON.stringify(bad), (await post(a, check(bad))).status]).toEqual([JSON.stringify(bad), 400]);
  expect((await request(app).post('/api/label-checks').send(check())).status).toBe(401);
});

test('kasiyer de kayıt yapabilir', async () => {
  expect((await post(cashier, check({ barcode: '869000000020' }))).status).toBe(201);
});

describe('bulut lisans izi', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  const nowS = () => Math.floor(Date.now() / 1000);

  test('lisans izlenmeyen kurulumda eşitleme her zaman izinlidir', async () => {
    expect(await seen.tenantAllowed(a.tenantId)).toBe(true);
  });

  test('izlenen bulutta: bağlı lisans yakında doğrulandıysa izinli, 7 günden eskiyse durdurulur, bağlantısız hesap izinsiz', async () => {
    process.env.VENIUX_CLOUD_SERVICE = '1'; process.env.VENIUX_LICENSE_AUTHORITY_URL = 'https://lisans.example.test';
    const licenseId = 900000 + Math.floor(Math.random() * 90000);
    expect(await seen.tenantAllowed(a.tenantId)).toBe(false); // bağlantı yok
    await db.query('INSERT INTO cloud_license_bindings (authority_license_id,tenant_id) VALUES ($1,$2)', [licenseId, a.tenantId]);
    expect(await seen.tenantAllowed(a.tenantId)).toBe(true); // ilk görülme: saat şimdi başlar
    await db.query('UPDATE cloud_license_seen SET last_valid_epoch=$1 WHERE authority_license_id=$2', [nowS() - 6 * 86400, licenseId]);
    expect(await seen.tenantAllowed(a.tenantId)).toBe(true);
    await db.query('UPDATE cloud_license_seen SET last_valid_epoch=$1 WHERE authority_license_id=$2', [nowS() - 8 * 86400, licenseId]);
    expect(await seen.tenantAllowed(a.tenantId)).toBe(false);
    await seen.touch({ valid: true, license_id: licenseId });
    expect(await seen.tenantAllowed(a.tenantId)).toBe(true);
    await db.query('DELETE FROM cloud_license_bindings WHERE authority_license_id=$1', [licenseId]);
  });
});
