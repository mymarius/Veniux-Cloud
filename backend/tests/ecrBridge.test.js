const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
let owner, wh;
const auth = r => r.set('Authorization', 'Bearer ' + owner.token);
const post = (route, body, key = crypto.randomUUID()) => auth(request(app).post('/api/scanner/' + route)).set('Idempotency-Key', key).send(body);
async function product(price = 40) {
  const code = 'ECR-' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',$5,10,'NORMAL') RETURNING id,barcode", [owner.tenantId, code, code, 'ÖKC ' + code, price])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,50)', [owner.tenantId, wh.id, p.id]);
  return p;
}
const sell = async p => { const r = await post('sale', { warehouse_id: wh.id, payment_method: 'cash', items: [{ barcode: p.barcode, count: 1 }] }); expect(r.status).toBe(201); return r.body; };
beforeAll(async () => { owner = await f.createTenant(); wh = await f.createWarehouse(owner.tenantId); await f.openTestShift(owner, wh.id); });

test('cihaz yokken satış etkilenmez ve iş oluşmaz', async () => {
  const p = await product();
  await sell(p);
  const jobs = await auth(request(app).get('/api/ecr/jobs'));
  expect(jobs.status).toBe(200);
  expect(jobs.body.items).toHaveLength(0);
  expect(jobs.body.blocking).toBe(0);
});

test('simülatör cihazıyla her satış bir iş üretir; işlenince mali fiş numarası gelir', async () => {
  const dev = await auth(request(app).post('/api/ecr/devices')).send({ brand: 'simulator', connection: 'simulated', name: 'Deneme ÖKC' });
  expect(dev.status).toBe(201);
  const p = await product();
  const s = await sell(p);
  let jobs = (await auth(request(app).get('/api/ecr/jobs'))).body;
  expect(jobs.counts.pending).toBe(1);
  expect(jobs.items[0].sale_id).toBe(Number(s.sale_id));
  const run = await auth(request(app).post('/api/ecr/process'));
  expect(run.body).toMatchObject({ processed: 1, done: 1, failed: 0 });
  expect(run.body.results[0].fiscal_receipt_no).toMatch(/^SIM-\d{6}$/);
  jobs = (await auth(request(app).get('/api/ecr/jobs'))).body;
  expect(jobs.counts).toMatchObject({ pending: 0, failed: 0, done: 1 });
  // aynı satış ikinci kez iş üretmez, işlenmiş iş tekrar yazılmaz
  const again = await auth(request(app).post(`/api/ecr/jobs/${jobs.items[0].id}/process`));
  expect(again.body.status).toBe('done');
});

test('cihaz hata verirse satış yine tamamlanır, iş failed kalır ve gün sonu engeli sayılır; deneme sınırı vardır', async () => {
  const t = await f.createTenant(); const w = await f.createWarehouse(t.tenantId); await f.openTestShift(t, w.id);
  const A = r => r.set('Authorization', 'Bearer ' + t.token);
  expect((await A(request(app).post('/api/ecr/devices')).send({ brand: 'simulator', connection: 'simulated', name: 'Hata cihazı' })).status).toBe(201);
  const code = 'ECR2-' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',10,10,'NORMAL') RETURNING id,barcode", [t.tenantId, code, code, 'X'])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,5)', [t.tenantId, w.id, p.id]);
  const sale = await A(request(app).post('/api/scanner/sale')).set('Idempotency-Key', crypto.randomUUID()).send({ warehouse_id: w.id, payment_method: 'cash', items: [{ barcode: p.barcode, count: 1 }] });
  expect(sale.status).toBe(201);
  const r1 = (await A(request(app).post('/api/ecr/process'))).body;
  expect(r1).toMatchObject({ processed: 1, done: 0, failed: 1 });
  expect(r1.results[0].error).toMatch(/Yazarkasa/);
  const jobs = (await A(request(app).get('/api/ecr/jobs'))).body;
  expect(jobs.blocking).toBe(1);
  for (let i = 0; i < 6; i++) await A(request(app).post('/api/ecr/process'));
  const last = await A(request(app).post(`/api/ecr/jobs/${jobs.items[0].id}/process`));
  expect(last.status).toBe(409);
});

test('üretici sürücüsü kurulu değilse açık hata; yetki ve doğrulama', async () => {
  expect((await auth(request(app).post('/api/ecr/devices')).send({ brand: 'bilinmeyen', connection: 'usb', name: 'X1' })).status).toBe(400);
  expect((await auth(request(app).post('/api/ecr/devices')).send({ brand: 'hugin', connection: 'serial', name: 'Hugin 1' })).status).toBe(201);
  expect((await request(app).get('/api/ecr/jobs')).status).toBe(401);
});
