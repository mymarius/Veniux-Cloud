const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
let owner, other, wh;
const auth = (r, a = owner) => r.set('Authorization', 'Bearer ' + a.token);
const post = (route, body) => auth(request(app).post('/api/scanner/' + route)).set('Idempotency-Key', crypto.randomUUID()).send(body);
async function product(price) {
  const code = 'CR-' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',$5,10,'NORMAL') RETURNING id,barcode", [owner.tenantId, code, code, 'Kural ' + code, price])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [owner.tenantId, wh.id, p.id]);
  return p;
}
const account = async (t, name) => (await db.query('INSERT INTO retail_credit_accounts(tenant_id,name) VALUES($1,$2) RETURNING id', [t.tenantId, name])).rows[0];
beforeAll(async () => { owner = await f.createTenant(); other = await f.createTenant(); wh = await f.createWarehouse(owner.tenantId); await f.openTestShift(owner, wh.id); });

test('müşteri kuralı girilir, okunur, sıfırlanınca silinir; geçersiz ve başka işletme reddedilir', async () => {
  const a = await account(owner, 'Toptan Bakkal');
  let r = await auth(request(app).put(`/api/scanner/pro/accounts/${a.id}/price-rule`)).send({ price_tier: 2, discount_percent: 5 });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ price_tier: 2, discount_percent: 5 });
  expect((await auth(request(app).get('/api/scanner/customers'))).body.items.find(i => i.id === Number(a.id))).toMatchObject({ price_tier: 2, discount_percent: 5 });
  expect((await auth(request(app).put(`/api/scanner/pro/accounts/${a.id}/price-rule`)).send({ price_tier: 4 })).status).toBe(400);
  expect((await auth(request(app).put(`/api/scanner/pro/accounts/${a.id}/price-rule`)).send({ discount_percent: 101 })).status).toBe(400);
  expect((await auth(request(app).put(`/api/scanner/pro/accounts/${a.id}/price-rule`), other).send({ price_tier: 2 })).status).toBe(404);
  r = await auth(request(app).put(`/api/scanner/pro/accounts/${a.id}/price-rule`)).send({ price_tier: 1, discount_percent: 0 });
  expect(r.body).toMatchObject({ price_tier: 1, discount_percent: 0 });
  expect((await db.query('SELECT COUNT(*) n FROM customer_price_rules WHERE account_id=$1', [a.id])).rows[0].n).toBe(0);
});

test('müşteri seçilince satış kuralın fiyat türü ve iskontosuyla yapılır; fiş kaydına yazılır', async () => {
  const p = await product(100);
  await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier2: 80 });
  const a = await account(owner, 'Kuralli');
  await auth(request(app).put(`/api/scanner/pro/accounts/${a.id}/price-rule`)).send({ price_tier: 2, discount_percent: 10 });
  const lookup = await post('lookup', { barcode: p.barcode, warehouse_id: wh.id, customer_id: a.id });
  expect(lookup.body.unit_price).toBe(72);
  const base = { warehouse_id: wh.id, payment_method: 'cash', items: [{ barcode: p.barcode, count: 2 }] };
  expect((await post('sale', base)).body.total).toBe(200);
  const sold = await post('sale', { ...base, customer_id: a.id });
  expect(sold.status).toBe(201);
  expect(sold.body.total).toBe(144);
  const snap = JSON.parse((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1 AND tenant_id=$2', [sold.body.sale_id, owner.tenantId])).rows[0].snapshot_json);
  expect(snap).toMatchObject({ customer_id: Number(a.id), price_tier: 2, customer_discount_percent: 10 });
  expect((await post('sale', { ...base, customer_id: 999999 })).status).toBe(404);
});
