const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
let owner, wh;
const auth = r => r.set('Authorization', 'Bearer ' + owner.token);
const post = (route, body) => auth(request(app).post('/api/scanner/' + route)).set('Idempotency-Key', crypto.randomUUID()).send(body);
async function product(price) {
  const code = 'PT-' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',$5,10,'NORMAL') RETURNING id,barcode", [owner.tenantId, code, code, 'Kademe ' + code, price])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [owner.tenantId, wh.id, p.id]);
  return p;
}
const sale = (p, extra = {}) => post('sale', { warehouse_id: wh.id, payment_method: 'cash', items: [{ barcode: p.barcode, count: 2 }], ...extra });
beforeAll(async () => { owner = await f.createTenant(); wh = await f.createWarehouse(owner.tenantId); await f.openTestShift(owner, wh.id); });

test('kademe fiyatı girilir, okunur, silinir; geçersiz değer reddedilir', async () => {
  const p = await product(100);
  let r = await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier2: 80, tier3: 70.5 });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ tier1: 100, tier2: 80, tier3: 70.5 });
  r = await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier3: null });
  expect(r.body.tier3).toBeNull();
  expect(r.body.tier2).toBe(80);
  expect((await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier2: -5 })).status).toBe(400);
  expect((await auth(request(app).put('/api/products/999999/price-tiers')).send({ tier2: 5 })).status).toBe(404);
  expect((await auth(request(app).get('/api/scanner/price-tiers/status'))).body.enabled).toBe(true);
});

test('satış seçilen fiyat türünden yapılır; fiyat girilmemişse Fiyat 1; kayıtta tür yazılır', async () => {
  const p = await product(100), q = await product(50);
  await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier2: 80 });
  const normal = await sale(p);
  expect(normal.status).toBe(201);
  expect(normal.body.total).toBe(200);
  const wholesale = await sale(p, { price_tier: 2 });
  expect(wholesale.status).toBe(201);
  expect(wholesale.body.total).toBe(160);
  const snap = JSON.parse((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1 AND tenant_id=$2', [wholesale.body.sale_id, owner.tenantId])).rows[0].snapshot_json);
  expect(snap.price_tier).toBe(2);
  const fallback = await sale(q, { price_tier: 3 });
  expect(fallback.body.total).toBe(100);
  expect((await sale(p, { price_tier: 9 })).status).toBe(400);
});

test('okutma sonucu seçilen fiyat türünü gösterir', async () => {
  const p = await product(40);
  await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier2: 30 });
  const plain = await post('lookup', { barcode: p.barcode, warehouse_id: wh.id });
  expect(plain.body.unit_price).toBe(40);
  const tiered = await post('lookup', { barcode: p.barcode, warehouse_id: wh.id, price_tier: 2 });
  expect(tiered.body.unit_price).toBe(30);
  expect(tiered.body.price_tier).toBe(2);
});

test('kimlik gerekir ve başka işletmenin ürünü görünmez', async () => {
  const p = await product(10);
  expect((await request(app).get(`/api/products/${p.id}/price-tiers`)).status).toBe(401);
  const other = await f.createTenant();
  const r = await request(app).get(`/api/products/${p.id}/price-tiers`).set('Authorization', 'Bearer ' + other.token);
  expect(r.status).toBe(404);
});
