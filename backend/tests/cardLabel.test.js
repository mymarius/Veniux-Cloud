const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
let owner, wh;
const post = (route, body, key = crypto.randomUUID()) => request(app).post('/api/scanner/' + route).set('Authorization', 'Bearer ' + owner.token).set('Idempotency-Key', key).send(body);
async function product(price = 100) {
  const code = 'CL-' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',$5,10,'NORMAL') RETURNING id,barcode", [owner.tenantId, code, code, 'Kart etiket ' + code, price])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,50)', [owner.tenantId, wh.id, p.id]);
  return p;
}
const snapshot = async id => JSON.parse((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1 AND tenant_id=$2', [id, owner.tenantId])).rows[0].snapshot_json);
const report = async () => (await request(app).get('/api/scanner/day-report').query({ warehouse_id: wh.id }).set('Authorization', 'Bearer ' + owner.token));
beforeAll(async () => { owner = await f.createTenant(); wh = await f.createWarehouse(owner.tenantId); await f.openTestShift(owner, wh.id); });

test('yemek kartı etiketi snapshot\'a yazılır, ana yöntem kart kalır', async () => {
  const p = await product(100);
  const r = await post('sale', { warehouse_id: wh.id, payment_method: 'credit_card', card_label: 'meal', items: [{ barcode: p.barcode, count: 1 }] });
  expect(r.status).toBe(201);
  const snap = await snapshot(r.body.sale_id);
  expect(snap.card_label).toBe('meal');
  expect(snap.payments.credit_card).toBeGreaterThan(0);
});

test('banka kartı etiketi yazılmaz; nakit satışta etiket yok sayılır; geçersiz etiket reddedilir', async () => {
  const p = await product(50);
  const bank = await post('sale', { warehouse_id: wh.id, payment_method: 'credit_card', card_label: 'bank', items: [{ barcode: p.barcode, count: 1 }] });
  expect(bank.status).toBe(201);
  expect((await snapshot(bank.body.sale_id)).card_label).toBeUndefined();
  const cash = await post('sale', { warehouse_id: wh.id, payment_method: 'cash', card_label: 'meal', items: [{ barcode: p.barcode, count: 1 }] });
  expect(cash.status).toBe(201);
  expect((await snapshot(cash.body.sale_id)).card_label).toBeUndefined();
  const bad = await post('sale', { warehouse_id: wh.id, payment_method: 'credit_card', card_label: 'altin', items: [{ barcode: p.barcode, count: 1 }] });
  expect(bad.status).toBe(400);
});

test('gün sonu raporu kart tutarını türe göre ayırır ve toplamı korur', async () => {
  const res = await report();
  expect(res.status).toBe(200);
  const labels = res.body.card_labels;
  expect(labels.meal).toBeGreaterThan(0);
  expect(labels.bank + labels.meal + labels.transfer).toBe(res.body.card_cents);
});
