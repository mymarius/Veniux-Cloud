const request = require('supertest'), app = require('../../src/index'), db = require('../../src/config/database'), adapter = require('../../src/config/mysqlAdapter');
const demo = require('../../src/services/demoAccount');

beforeAll(async () => { await db.ready; });
afterAll(async () => adapter.getMySQLPool()?.end());

test('MySQL: demo hesabı oluşur, lisans ve örnek veri yazılır, şifreyle giriş yapılır', async () => {
  const email = `demo_${Date.now()}@ornek.com`;
  const account = await demo.create(db, { email, company: 'Örnek Market', days: 14 });
  expect(db.getEngine()).toBe('mysql');
  expect(Number((await db.query('SELECT COUNT(*) AS n FROM products WHERE tenant_id=$1', [account.tenantId])).rows[0].n)).toBe(12);
  expect(Number((await db.query('SELECT COUNT(*) AS n FROM stock_records WHERE tenant_id=$1', [account.tenantId])).rows[0].n)).toBe(24);
  expect(Number((await db.query('SELECT COUNT(*) AS n FROM stock_movements WHERE tenant_id=$1', [account.tenantId])).rows[0].n)).toBe(24);
  const license = (await db.query('SELECT status, plan_id FROM licenses WHERE tenant_id=$1', [account.tenantId])).rows[0];
  expect(license).toMatchObject({ status: 'ACTIVE', plan_id: 'BUSINESS_ANNUAL' });

  const login = await request(app).post('/api/auth/login').send({ email, password: account.password });
  expect(login.status).toBe(200);
  const products = await request(app).get('/api/products').set('Authorization', 'Bearer ' + login.body.token);
  expect(products.status).toBe(200);
  expect(JSON.stringify(products.body)).toContain('Filtre Kahve');
  await expect(demo.create(db, { email })).rejects.toMatchObject({ code: 'EXISTS' });
});

test('MySQL: süresi biten demo lisansı girişi kapatır, veri silinmez', async () => {
  const email = `demo_exp_${Date.now()}@ornek.com`;
  const account = await demo.create(db, { email, days: 1 });
  await db.query("UPDATE licenses SET expires_at='2020-01-01 00:00:00' WHERE tenant_id=$1", [account.tenantId]);
  const login = await request(app).post('/api/auth/login').send({ email, password: account.password });
  expect(login.status).toBe(423);
  expect(login.body.code).toBe('LICENSE_REQUIRED');
  expect(Number((await db.query('SELECT COUNT(*) AS n FROM products WHERE tenant_id=$1', [account.tenantId])).rows[0].n)).toBe(12);
});
