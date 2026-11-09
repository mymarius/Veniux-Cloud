process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');

let owner, cashier, w, p;
const post = (path, body, token = owner.token) => request(app).post('/api/scanner/' + path).set('Authorization', 'Bearer ' + token).set('Idempotency-Key', crypto.randomUUID()).send(body);
const get = (path, token = owner.token) => request(app).get('/api/scanner/' + path).set('Authorization', 'Bearer ' + token);
beforeAll(async () => {
  owner = await createTenant();
  w = await createWarehouse(owner.tenantId);
  p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'V1-SKU','Vardiya ürünü','000-V1','adet',100,'NORMAL') RETURNING *", [owner.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,50)', [owner.tenantId, w.id, p.id]);
  const u = await createUser(owner.tenantId, 'cashier');
  await db.query('INSERT INTO retail_cashier_permissions (tenant_id,user_id,permissions_json) VALUES ($1,$2,$3)', [owner.tenantId, u.id, JSON.stringify({ shift_open: true, day_close: true })]);
  cashier = { token: jwt.sign({ userId: u.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
});

test('kasa kuralı: yalnız yönetici değiştirir; varsayılan sınır 50 TL', async () => {
  expect((await get('pos-policy')).body).toEqual({ shiftDifferenceLimitCents: 5000 });
  expect((await request(app).put('/api/scanner/pos-policy').set('Authorization', 'Bearer ' + cashier.token).send({ shift_difference_limit: '10' })).status).toBe(403);
  const r = await request(app).put('/api/scanner/pos-policy').set('Authorization', 'Bearer ' + owner.token).send({ shift_difference_limit: '20' });
  expect(r.status).toBe(200);
  expect(r.body.shiftDifferenceLimitCents).toBe(2000);
});

test('sınırı aşan farkla kasiyer kapatamaz; müdür kapatır ve onay kayda geçer; sınır içi fark kasiyerle kapanır', async () => {
  const s1 = await post('shifts/open', { warehouse_id: w.id, opening_cash: 100 }, cashier.token);
  expect(s1.status).toBe(201);
  const over = await post(`shifts/${s1.body.shift_id}/close`, { counted_cash: 70, reason: 'Kasada eksik var' }, cashier.token);
  expect(over.status).toBe(409);
  expect(over.body.error).toContain('müdür veya yönetici');
  const byOwner = await post(`shifts/${s1.body.shift_id}/close`, { counted_cash: 70, reason: 'Kasada eksik var' });
  expect(byOwner.status).toBe(200);
  expect(byOwner.body).toMatchObject({ difference_cents: -3000, difference_limit_cents: 2000, approved_by: owner.email });
  const s2 = await post('shifts/open', { warehouse_id: w.id, opening_cash: 100 }, cashier.token);
  const within = await post(`shifts/${s2.body.shift_id}/close`, { counted_cash: 90, reason: 'Para üstü hatası' }, cashier.token);
  expect(within.status).toBe(200);
  expect(within.body.approved_by).toBeUndefined();
});

test('geçmiş vardiya listesi farkı, kapatanı ve onaylayanı gösterir; yetkisiz kullanıcı göremez', async () => {
  const h = await get('shifts/history');
  expect(h.status).toBe(200);
  expect(h.body.shifts.length).toBeGreaterThanOrEqual(2);
  const approved = h.body.shifts.find(s => s.approved_by);
  expect(approved).toMatchObject({ difference_cents: -3000, register_name: 'Ana kasa' });
  expect(h.body.totals.over_limit).toBeGreaterThanOrEqual(1);
  expect(h.body.totals.shortage_cents).toBeLessThanOrEqual(-4000);
  const plain = await createUser(owner.tenantId, 'cashier');
  const t = jwt.sign({ userId: plain.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET);
  expect((await get('shifts/history', t)).status).toBe(403);
});

test('satış raporunda kasa bazında kırılım var', async () => {
  const s = await post('shifts/open', { warehouse_id: w.id, opening_cash: 0 });
  const sale = await post('sale', { warehouse_id: w.id, shift_id: s.body.shift_id, register_id: s.body.register_id, items: [{ barcode: '000-V1', count: 2 }], payment_method: 'cash' });
  expect(sale.status).toBe(201);
  const r = await get('pro/insights');
  expect(r.status).toBe(200);
  expect(r.body.registers).toEqual([expect.objectContaining({ name: 'Ana kasa', receipts: 1, net_cents: 20000 })]);
});
