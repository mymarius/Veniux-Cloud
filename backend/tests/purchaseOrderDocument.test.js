const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const notifications = require('../src/services/notificationService');
const docs = require('../src/services/purchaseOrderDocumentService');
const { createTenant } = require('./factories');

let owner, other, order;
const as = (u, r) => r.set('Authorization', 'Bearer ' + u.token);
beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  const wh = (await db.query('SELECT * FROM warehouses WHERE tenant_id=$1 LIMIT 1', [owner.tenantId])).rows[0];
  const supplier = (await db.query("UPDATE suppliers SET email='satis@tedarikci.test', phone='0532 111 22 33', name='Tedarikçi <A&B>' WHERE tenant_id=$1 RETURNING *", [owner.tenantId])).rows[0];
  const product = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,purchase_price,sale_price,module_type) VALUES ($1,$2,'Çay <script>',$3,'adet',3,10,'NORMAL') RETURNING *", [owner.tenantId, 'PO-' + crypto.randomUUID().slice(0, 6), '869' + Date.now().toString().slice(-10)])).rows[0];
  const r = await as(owner, request(app).post('/api/purchase-orders')).set('Idempotency-Key', crypto.randomUUID()).send({ supplier_id: supplier.id, target_warehouse_id: wh.id, items: [{ product_id: product.id, quantity: 12, unit_price: 4.25 }] });
  expect(r.status).toBe(201);
  order = r.body.order;
});
afterEach(() => jest.restoreAllMocks());

test('sipariş belgesi kaçışlı HTML üretir; başka firmanın siparişi açılmaz', async () => {
  const r = await as(owner, request(app).get(`/api/purchase-orders/${order.id}/document`));
  expect(r.status).toBe(200);
  expect(r.text).toContain(order.order_no);
  expect(r.text).toContain('Tedarikçi &lt;A&amp;B&gt;');
  expect(r.text).not.toContain('<script>');
  expect(r.text).toContain('51,00 TL');
  expect((await as(other, request(app).get(`/api/purchase-orders/${order.id}/document`))).status).toBe(404);
});

test('tedarikçiye e-posta: ekli belge, yanıt adresi firma; SMTP yoksa açık hata; geçersiz adres reddedilir', async () => {
  const sent = jest.spyOn(notifications, 'sendEmail').mockResolvedValue({ success: true, messageId: 'm1' });
  jest.spyOn(docs, 'pdf');
  const r = await as(owner, request(app).post(`/api/purchase-orders/${order.id}/send-email`)).send({ message: 'Salı teslim rica ederiz.' });
  expect(r.status).toBe(200);
  expect(r.body.to).toBe('satis@tedarikci.test');
  const [to, subject, text, , extra] = sent.mock.calls[0];
  expect(to).toBe('satis@tedarikci.test');
  expect(subject).toContain(order.order_no);
  expect(text).toContain('Salı teslim');
  expect(extra.attachments).toHaveLength(1);
  expect(extra.attachments[0].filename).toMatch(/^siparis-.*\.(pdf|html)$/);
  const audit = (await db.query("SELECT details FROM audit_logs WHERE tenant_id=$1 AND action='purchase_order.emailed'", [owner.tenantId])).rows;
  expect(audit).toHaveLength(1);
  sent.mockResolvedValue({ success: false, error: 'Not configured' });
  const fail = await as(owner, request(app).post(`/api/purchase-orders/${order.id}/send-email`)).send({});
  expect(fail.status).toBe(502);
  expect(fail.body.error).toContain('SMTP');
  expect((await as(owner, request(app).post(`/api/purchase-orders/${order.id}/send-email`)).send({ to: 'gecersiz, a@b.c' })).status).toBe(400);
});

test('WhatsApp bağlantısı tedarikçi numarasıyla hazır mesaj açar', async () => {
  const r = await as(owner, request(app).get(`/api/purchase-orders/${order.id}/whatsapp-link`));
  expect(r.status).toBe(200);
  expect(r.body.url.startsWith('https://wa.me/905321112233?text=')).toBe(true);
  expect(decodeURIComponent(r.body.url.split('text=')[1])).toContain(order.order_no);
  expect(docs.whatsappPhone('5321112233')).toBe('905321112233');
  expect(docs.whatsappPhone('12')).toBe(null);
});
