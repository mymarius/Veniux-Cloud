const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
const currency = require('../src/services/currencyService');
let owner, wh;
const auth = r => r.set('Authorization', 'Bearer ' + owner.token);
const post = (route, body) => auth(request(app).post('/api/scanner/' + route)).set('Idempotency-Key', crypto.randomUUID()).send(body);
async function product(price) {
  const code = 'FX-' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',$5,10,'NORMAL') RETURNING id,barcode", [owner.tenantId, code, code, 'Dövizli ' + code, price])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [owner.tenantId, wh.id, p.id]);
  return p;
}
const sale = (p, extra = {}) => post('sale', { warehouse_id: wh.id, payment_method: 'cash', items: [{ barcode: p.barcode, count: 2 }], ...extra });
beforeAll(async () => { owner = await f.createTenant(); wh = await f.createWarehouse(owner.tenantId); await f.openTestShift(owner, wh.id); });
beforeEach(() => currency._forget(owner.tenantId));

test('kur girilir ve okunur; geçersiz kur ve para birimi reddedilir', async () => {
  let r = await auth(request(app).put('/api/products/currency-rates')).send({ USD: 38.5, EUR: 41.25 });
  expect(r.status).toBe(200);
  expect(r.body.rates.USD.rate).toBe(38.5);
  expect(r.body.rates.GBP).toBeNull();
  expect((await auth(request(app).put('/api/products/currency-rates')).send({ USD: 0 })).status).toBe(400);
  r = await auth(request(app).put('/api/products/currency-rates')).send({ EUR: null });
  expect(r.body.rates.EUR).toBeNull();
  const p = await product(100);
  expect((await auth(request(app).put(`/api/products/${p.id}/currency-price`)).send({ currency: 'XYZ', price: 5 })).status).toBe(400);
});

test('dövizli ürün güncel kurla TL satılır; kur değişince fiyat değişir; kur yoksa normal fiyat', async () => {
  const p = await product(100);
  await auth(request(app).put('/api/products/currency-rates')).send({ USD: 40 });
  expect((await auth(request(app).put(`/api/products/${p.id}/currency-price`)).send({ currency: 'USD', price: 2.5 })).body).toMatchObject({ currency: 'USD', price: 2.5 });
  const s1 = await sale(p);
  expect(s1.status).toBe(201);
  expect(s1.body.total).toBe(200);
  await auth(request(app).put('/api/products/currency-rates')).send({ USD: 42 });
  const s2 = await sale(p);
  expect(s2.body.total).toBe(210);
  const lookup = await post('lookup', { barcode: p.barcode, warehouse_id: wh.id });
  expect(lookup.body.unit_price).toBe(105);
  expect(lookup.body.fx).toMatchObject({ currency: 'USD', rate: 42 });
  await auth(request(app).put('/api/products/currency-rates')).send({ USD: null });
  const s3 = await sale(p);
  expect(s3.body.total).toBe(200);
});

test('dövizli fiyat silinince ürün normal fiyatına döner; fiyat türü seçiliyse kademe önceliklidir', async () => {
  const p = await product(50);
  await auth(request(app).put('/api/products/currency-rates')).send({ EUR: 10 });
  await auth(request(app).put(`/api/products/${p.id}/currency-price`)).send({ currency: 'EUR', price: 7 });
  await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier2: 45 });
  expect((await sale(p)).body.total).toBe(140);
  expect((await sale(p, { price_tier: 2 })).body.total).toBe(90);
  await auth(request(app).put(`/api/products/${p.id}/currency-price`)).send({ currency: null });
  expect((await sale(p)).body.total).toBe(100);
});

test('yetki ve işletme izolasyonu', async () => {
  const p = await product(10);
  expect((await request(app).get('/api/products/currency-rates')).status).toBe(401);
  const other = await f.createTenant();
  const r = await request(app).get(`/api/products/${p.id}/currency-price`).set('Authorization', 'Bearer ' + other.token);
  expect(r.status).toBe(404);
});
