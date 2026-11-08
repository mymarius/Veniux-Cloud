process.env.AUTH_RATE_LIMIT_MAX = '1000';
const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const pool = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createUser } = require('./factories');

let owner, w1, w2, product;
const as = (token, r) => r.set('Authorization', 'Bearer ' + token);
const tokenFor = async (role, scope) => { const u = await createUser(owner.tenantId, role, scope); return jwt.sign({ userId: u.id, tenantId: owner.tenantId, role }, JWT_SECRET); };
beforeAll(async () => {
  owner = await createTenant();
  const wh = async name => (await as(owner.token, request(app).post('/api/warehouses')).send({ name, type: 'main', location: 'X', capacity: 100 })).body.id;
  w1 = await wh('Merkez Şube'); w2 = await wh('Kadıköy Şube');
  product = (await as(owner.token, request(app).post('/api/products')).send({ sku: 'BR-1', name: 'Şube ürünü', barcode: '8690000000017', category: 'A', purchase_price: 2.5, sale_price: 4, unit: 'adet' })).body.id;
  expect((await as(owner.token, request(app).post('/api/stock/movement')).send({ product_id: product, warehouse_id: w1, change_amount: 40, movement_type: 'inbound' })).status).toBe(201);
});

test('depo sorumlusu transfer yapar ama stok düzeltemez; transfer firma toplamını değiştirmez', async () => {
  const lead = await tokenFor('warehouse_lead', { mode: 'company', warehouse_ids: [] });
  const before = (await as(owner.token, request(app).get('/api/warehouses/branch-report'))).body;
  const t = await as(lead, request(app).post('/api/stock/transfer')).send({ product_id: product, from_warehouse_id: w1, to_warehouse_id: w2, quantity: 15 });
  expect(t.status).toBeLessThan(300);
  expect((await as(lead, request(app).post('/api/stock/adjust')).send({ product_id: product, warehouse_id: w1, new_quantity: 999, reason: 'deneme' })).status).toBe(403);
  expect((await as(lead, request(app).get('/api/warehouses/branch-report'))).status).toBe(403);
  const after = (await as(owner.token, request(app).get('/api/warehouses/branch-report'))).body;
  expect(after.totals.stock_units).toBe(before.totals.stock_units);
  expect(after.totals.stock_value_cents).toBe(before.totals.stock_value_cents);
  const byId = Object.fromEntries(after.branches.map(b => [b.warehouse_id, b]));
  expect(byId[w1].stock_units).toBe(25);
  expect(byId[w2].stock_units).toBe(15);
  expect(byId[w2].stock_value_cents).toBe(3750);
});

test('şube müdürü (kısıtlı müdür) yalnız kendi şubesini görür', async () => {
  const branch = await tokenFor('manager', { mode: 'restricted', warehouse_ids: [w2] });
  const r = await as(branch, request(app).get('/api/warehouses/branch-report'));
  expect(r.status).toBe(200);
  expect(r.body.scope).toBe('restricted');
  expect(r.body.branches.map(b => b.warehouse_id)).toEqual([w2]);
  expect((await as(owner.token, request(app).get('/api/warehouses/branch-report?from=2026-05-01&to=2026-01-01'))).status).toBe(400);
});

test('vade hatırlatması: ödenmemiş vadesi geçmiş ve yaklaşan borçlar hesap başına listelenir', async () => {
  const account = (await as(owner.token, request(app).post('/api/scanner/pro/accounts')).set('Idempotency-Key', crypto.randomUUID()).send({ name: 'Bakkal Ali', limit: '1000' })).body;
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const entry = (kind, cents, due) => pool.query('INSERT INTO retail_credit_entries(id,tenant_id,account_id,kind,amount_cents,due_date,reason,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(), owner.tenantId, account.id, kind, cents, due, 'test kaydı', owner.userId]);
  await entry('sale', 10000, day(-10));
  await entry('sale', 5000, day(2));
  await entry('sale', 7000, day(20));
  await entry('collection', -4000, null);
  const r = await as(owner.token, request(app).get('/api/scanner/pro/accounts/reminders'));
  expect(r.status).toBe(200);
  const row = r.body.accounts.find(a => a.account_id === account.id);
  // Tahsilat en eski vadeli borcu kapatır: 100 TL'nin 40 TL'si ödendi.
  expect(row).toMatchObject({ name: 'Bakkal Ali', overdue_cents: 6000, due_soon_cents: 5000, oldest_due_date: day(-10) });
  const cashier = await tokenFor('cashier', { mode: 'company', warehouse_ids: [] });
  expect((await as(cashier, request(app).get('/api/scanner/pro/accounts/reminders'))).status).toBe(403);
});

test('pasif kullanıcıyı yeniden açmak paket kullanıcı sınırını aşamaz', async () => {
  const small = await createTenant();
  await pool.query("UPDATE licenses SET plan_id='STARTER_ANNUAL' WHERE tenant_id=$1", [small.tenantId]);
  const users = (await pool.query('SELECT COUNT(*) AS n FROM users WHERE tenant_id=$1', [small.tenantId])).rows[0].n;
  const ids = [];
  for (let i = Number(users); i < 5; i++) ids.push((await createUser(small.tenantId, 'viewer')).id);
  expect((await as(small.token, request(app).post('/api/settings/users')).send({ email: 'fazla@x.com', password: 'password123', role: 'viewer', fullName: 'Fazla' })).status).toBe(403);
  expect((await as(small.token, request(app).put('/api/settings/users/' + ids[0])).send({ status: 'inactive' })).status).toBe(200);
  const extra = await createUser(small.tenantId, 'viewer');
  expect((await as(small.token, request(app).put('/api/settings/users/' + ids[0])).send({ status: 'active' })).status).toBe(403);
  expect((await as(small.token, request(app).put('/api/settings/users/' + extra.id)).send({ status: 'active', fullName: 'Aynı' })).status).toBe(200);
});
