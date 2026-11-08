process.env.AUTH_RATE_LIMIT_MAX = '1000';
const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser, openTestShift } = require('./factories');

let owner, warehouse, tea, soap, cashier;
const today = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
const shiftDay = n => new Date(Date.now() + 3 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const as = (token, r) => r.set('Authorization', 'Bearer ' + token);
const post = (token, path, body) => as(token, request(app).post('/api/scanner/' + path)).set('Idempotency-Key', crypto.randomUUID()).send(body);
const sell = (items, extra = {}, token = owner.token) => post(token, 'sale', { warehouse_id: warehouse.id, payment_method: 'cash', items, ...extra });
const points = async no => (await as(owner.token, request(app).get('/api/scanner/pro/loyalty/cards/' + no))).body.points;

beforeAll(async () => {
  owner = await createTenant();
  warehouse = await createWarehouse(owner.tenantId);
  const product = async (barcode, price) => (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,purchase_price,module_type) VALUES ($1,$2,$3,$4,'adet',$5,1,'NORMAL') RETURNING *", [owner.tenantId, 'P-' + barcode, 'Ürün ' + barcode, barcode, price])).rows[0];
  tea = await product('000-TEA', 10); soap = await product('000-SOAP', 20);
  for (const p of [tea, soap]) await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,100)', [owner.tenantId, warehouse.id, p.id]);
  await openTestShift(owner, warehouse.id, 100);
});

test('kampanya doğrulanır; 3 al 2 öde ve yüzde indirim kasada uygulanır, kaleme en iyisi seçilir', async () => {
  expect((await post(owner.token, 'pro/campaigns', { name: 'Hatalı', kind: 'buy_x_pay_y', product_id: tea.id, buy_qty: 2, pay_qty: 2, starts_on: today(), ends_on: today() })).status).toBe(400);
  expect((await post(owner.token, 'pro/campaigns', { name: 'Ters tarih', kind: 'percent', percent: 10, starts_on: shiftDay(2), ends_on: today() })).status).toBe(400);
  const three = await post(owner.token, 'pro/campaigns', { name: 'Çay 3 al 2 öde', kind: 'buy_x_pay_y', product_id: tea.id, buy_qty: 3, pay_qty: 2, starts_on: today(), ends_on: shiftDay(7) });
  expect(three.status).toBe(200);
  await post(owner.token, 'pro/campaigns', { name: 'Çay %10', kind: 'percent', product_id: tea.id, percent: 10, starts_on: today(), ends_on: today() });
  await post(owner.token, 'pro/campaigns', { name: 'Sabun %25', kind: 'percent', product_id: soap.id, percent: 25, starts_on: today(), ends_on: today() });
  await post(owner.token, 'pro/campaigns', { name: 'Gelecek hafta', kind: 'percent', percent: 50, starts_on: shiftDay(5), ends_on: shiftDay(9) });
  const q = await post(owner.token, 'sale-quote', { warehouse_id: warehouse.id, items: [{ barcode: '000-TEA', count: 7 }, { barcode: '000-SOAP', count: 1 }] });
  expect(q.body).toMatchObject({ gross: 90, campaign_discount: 25, total: 65 });
  // Kasa ekranı gibi açık ödeme tutarıyla: teklif edilen toplam satışta da tutar.
  const paid = await sell([{ barcode: '000-TEA', count: 7 }, { barcode: '000-SOAP', count: 1 }], { payments: [{ method: 'credit_card', amount: q.body.total }] });
  expect(paid.status).toBe(201);
  const sale = await sell([{ barcode: '000-TEA', count: 7 }, { barcode: '000-SOAP', count: 1 }]);
  expect(sale.status).toBe(201);
  // Çay 7 adet = 70 TL: 3 al 2 öde ile 2 adet bedava (20 TL) > %10 (7 TL). Sabun 20 TL'nin %25'i = 5 TL. Toplam 90 - 25 = 65 TL.
  expect(sale.body.total).toBe(65);
  expect(sale.body.campaigns.map(c => c.name).sort()).toEqual(['Sabun %25', 'Çay 3 al 2 öde']);
  const snap = JSON.parse((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1', [sale.body.sale_id])).rows[0].snapshot_json);
  expect(snap.discounts).toMatchObject({ manual_cents: 0, campaign_cents: 2500, loyalty_cents: 0 });
  expect(snap.items.reduce((t, i) => t + i.net_cents, 0)).toBe(6500);
  // Kampanya kapatılınca uygulanmaz.
  await as(owner.token, request(app).put('/api/scanner/pro/campaigns/' + three.body.id + '/active')).send({ active: false });
  expect((await sell([{ barcode: '000-TEA', count: 3 }])).body.total).toBe(27);
});

test('onay gerektiren kampanya yetkisiz kasiyerde uygulanmaz, yöneticide uygulanır', async () => {
  const c = await post(owner.token, 'pro/campaigns', { name: 'Müdür onaylı %50', kind: 'percent', product_id: soap.id, percent: 50, requires_approval: true, starts_on: today(), ends_on: today() });
  expect(c.status).toBe(200);
  const u = await createUser(owner.tenantId, 'cashier');
  cashier = jwt.sign({ userId: u.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET);
  expect((await post(cashier, 'pro/campaigns', { name: 'x', kind: 'percent', percent: 5, starts_on: today(), ends_on: today() })).status).toBe(403);
  const asOwner = await sell([{ barcode: '000-SOAP', count: 1 }]);
  expect(asOwner.body.total).toBe(10);
  await db.query('UPDATE retail_campaigns SET active=0 WHERE tenant_id=$1 AND id=$2', [owner.tenantId, c.body.id]);
});

test('sadakat: puan kazanılır, harcanır, iadede geri alınır; yetersiz puan reddedilir', async () => {
  await db.query('UPDATE retail_campaigns SET active=0 WHERE tenant_id=$1', [owner.tenantId]);
  expect((await post(owner.token, 'pro/loyalty/cards', { card_no: 'K-1001', name: 'Ayşe Yılmaz', phone: '0555 111 22 33' })).status).toBe(200);
  expect((await post(owner.token, 'pro/loyalty/cards', { card_no: 'K-1001', name: 'Tekrar' })).status).toBe(409);
  const first = await sell([{ barcode: '000-SOAP', count: 5 }], { loyalty_card: 'K-1001' });
  expect(first.body.loyalty).toEqual({ earned: 10, redeemed: 0 });
  expect(await points('K-1001')).toBe(10);
  expect((await sell([{ barcode: '000-TEA', count: 1 }], { loyalty_card: 'K-1001', loyalty_redeem: 11 })).status).toBe(409);
  const spend = await sell([{ barcode: '000-TEA', count: 2 }], { loyalty_card: 'K-1001', loyalty_redeem: 10 });
  expect(spend.body.total).toBe(19); // 20 TL - 10 puan × 10 kuruş = 19 TL; 19 TL için 1 puan kazanılır.
  expect(await points('K-1001')).toBe(1);
  const back = await post(owner.token, 'sales/' + first.body.sale_id + '/return', { reason: 'Puan iade testi', items: [{ id: 1, quantity: 5 }] });
  expect(back.status).toBe(200);
  expect(await points('K-1001')).toBe(-9);
  const cancel = await post(owner.token, 'sales/' + spend.body.sale_id + '/cancel', { reason: 'Harcanan puan iadesi' });
  expect(cancel.status).toBe(200);
  expect(await points('K-1001')).toBe(0);
  expect((await as(cashier, request(app).get('/api/scanner/pro/loyalty/cards/K-1001'))).body).toEqual({ card_no: 'K-1001', name: 'Ayşe Yılmaz', points: 0, value_cents: 0 });
  expect((await as(cashier, request(app).get('/api/scanner/pro/loyalty/cards'))).status).toBe(403);
});

test('raporlar: en çok satan, kasiyer, saat yoğunluğu ve ölü stok', async () => {
  const r = await as(owner.token, request(app).get('/api/scanner/pro/insights'));
  expect(r.status).toBe(200);
  expect(r.body.top_by_quantity[0].product_id).toBe(tea.id);
  expect(r.body.cashiers).toHaveLength(1);
  expect(r.body.hours).toHaveLength(24);
  expect(r.body.hours.reduce((t, h) => t + h.receipts, 0)).toBe(r.body.cashiers[0].receipts);
  expect(r.body.cashiers[0].net_cents).toBe(r.body.hours.reduce((t, h) => t + h.net_cents, 0));
  const idle = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,purchase_price,module_type) VALUES ($1,'P-IDLE','Satılmayan','000-IDLE','adet',5,2,'NORMAL') RETURNING id", [owner.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,7)', [owner.tenantId, warehouse.id, idle.id]);
  const dead = await as(owner.token, request(app).get('/api/stock/dead-stock?days=30'));
  expect(dead.status).toBe(200);
  const ids = dead.body.items.map(i => i.product_id);
  expect(ids).toContain(idle.id);
  expect(ids).not.toContain(tea.id);
  expect(dead.body.items.find(i => i.product_id === idle.id).value_cents).toBe(1400);
  expect((await as(cashier, request(app).get('/api/scanner/pro/insights'))).status).toBe(403);
  expect((await as(cashier, request(app).get('/api/stock/dead-stock'))).status).toBe(403);
});
