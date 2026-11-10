process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser, openTestShift } = require('./factories');

let owner, cashier, cashierId, w;
const post = (path, body, token = owner.token) => request(app).post('/api/scanner/' + path).set('Authorization', 'Bearer ' + token).set('Idempotency-Key', crypto.randomUUID()).send(body);
const get = (path, token = owner.token) => request(app).get('/api/scanner/' + path).set('Authorization', 'Bearer ' + token);

beforeAll(async () => {
  owner = await createTenant();
  w = await createWarehouse(owner.tenantId);
  const p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'A-SKU','Aşama A ürünü','000-A1','adet',10,'NORMAL') RETURNING *", [owner.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [owner.tenantId, w.id, p.id]);
  const u = await createUser(owner.tenantId, 'cashier');
  cashierId = u.id;
  await db.query('INSERT INTO retail_cashier_permissions (tenant_id,user_id,permissions_json) VALUES ($1,$2,$3)', [owner.tenantId, u.id, JSON.stringify({ shift_open: true, day_close: true })]);
  cashier = { token: jwt.sign({ userId: u.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
});

test('çalışan performansı: kasiyerin kapattığı vardiyadaki eksik fark ve yaptığı iade raporda görünür', async () => {
  const shift = await post('shifts/open', { warehouse_id: w.id, opening_cash: 100 }, cashier.token);
  expect(shift.status).toBe(201);
  const closed = await post(`shifts/${shift.body.shift_id}/close`, { counted_cash: 90, reason: 'Kasada on lira eksik' }, cashier.token);
  expect(closed.status).toBe(200);
  expect(closed.body.difference_cents).toBe(-1000);

  const ownerShift = await openTestShift(owner, w.id, 0);
  const sale = await post('sale', { warehouse_id: w.id, shift_id: ownerShift.shift_id, register_id: ownerShift.register_id, items: [{ barcode: '000-A1', count: 2 }], payment_method: 'cash' });
  expect(sale.status).toBe(201);
  const returned = await post(`sales/${sale.body.sale_id}/return`, { reason: 'Müşteri iadesi', register_id: ownerShift.register_id, shift_id: ownerShift.shift_id, items: [{ id: 1, quantity: 1, disposition: 'saleable' }] });
  expect(returned.status).toBe(200);

  const report = (await get('pro/insights')).body;
  const row = report.cashiers.find(c => c.user_id === cashierId);
  expect(row).toMatchObject({ shifts_closed: 1, difference_cents: -1000, short_cents: 1000, reversal_count: 0 });
  const boss = report.cashiers.find(c => c.user_id !== cashierId);
  expect(boss).toMatchObject({ receipts: 1, reversal_count: 1, reversal_cents: 1000 });
});

test('hızlı gider: "Gider · kategori · not" açıklamalı nakit çıkışı kasadan düşer ve vardiya özetinde görünür; kasadaki nakdi aşan çıkış reddedilir', async () => {
  // Önceki testte yöneticinin vardiyasında 20 TL satış ve 10 TL iade var: kasada beklenen nakit 10 TL.
  const open = (await get(`shifts/context?warehouse_id=${w.id}`)).body.active_shift.shift_id;
  const expense = await post(`shifts/${open}/cash`, { direction: 'out', amount: 5.5, reason: 'Gider · Yemek / içecek · ekmek ve su' });
  expect(expense.status).toBe(201);
  const detail = (await get(`shifts/${open}`)).body;
  expect(detail.cash_out_cents).toBe(550);
  expect(detail.expected_cash_cents).toBe(450);
  expect(detail.movements.some(m => m.reason.startsWith('Gider · Yemek / içecek'))).toBe(true);
  const tooMuch = await post(`shifts/${open}/cash`, { direction: 'out', amount: 100000, reason: 'Gider · Diğer · çok büyük' });
  expect(tooMuch.status).toBe(409);
});

test('çok satanlar: son günlerde en çok satılan ürün kasiyere sıralı döner', async () => {
  const top = await get('pro/top-products', cashier.token);
  expect(top.status).toBe(200);
  expect(top.body.items[0]).toMatchObject({ name: 'Aşama A ürünü', barcode: '000-A1' });
  expect(top.body.items).toHaveLength(1);
});
