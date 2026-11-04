const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const StripeProvider = require('../src/services/payment/StripeProvider');
const { createTenant } = require('./factories');

const SECRET = 'whsec_unit_test_only';
const stripe = new StripeProvider();
const DAY = 86400000;
let platform, customer, other, licenseId, eventSeq = 0, clock = 1_900_000_000;

const send = (payload, { secret = SECRET, timestamp = Math.floor(Date.now() / 1000), raw } = {}) => {
  const body = raw ?? JSON.stringify(payload);
  return request(app).post('/api/license/webhooks/payment')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', stripe.sign(body, secret, timestamp))
    .send(body);
};
const event = (type, object, overrides = {}) => ({ id: `evt_test_${++eventSeq}`, type, created: ++clock, data: { object }, ...overrides });
const meta = (extra = {}) => ({ tenant_id: String(customer.tenantId), license_id: String(licenseId), ...extra });
const license = async () => (await db.query('SELECT * FROM licenses WHERE id = $1', [licenseId])).rows[0];
const expiry = async () => Date.parse(String((await license()).expires_at).replace(' ', 'T') + (String((await license()).expires_at).includes('Z') ? '' : 'Z'));
const newInvoice = async () => {
  const res = await request(app).post(`/api/platform/tenants/${customer.tenantId}/licenses/${licenseId}/invoices`)
    .set('Authorization', `Bearer ${platform.token}`).send({});
  expect(res.status).toBe(201);
  return res.body;
};
// Bu kolda geçerli lisansı olmayan firma 423 LICENSE_BLOCKED alır: erişim kapalı demektir.
const moduleType = async () => {
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${customer.token}`);
  return res.status === 423 ? 'NONE' : res.body.module_type;
};

beforeAll(async () => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  platform = await createTenant();
  customer = await createTenant();
  other = await createTenant();
  await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [platform.userId]);
  await db.query("UPDATE licenses SET status = 'REVOKED' WHERE tenant_id = $1", [customer.tenantId]);
  licenseId = (await db.query(
    "INSERT INTO licenses (license_key, tenant_id, plan_id, status, expires_at) VALUES ($1, $2, 'NORMAL_WMS_ANNUAL', 'PENDING_PAYMENT', '2000-01-01 00:00:00') RETURNING id",
    [`VNX-BILL-${Date.now()}`, customer.tenantId]
  )).rows[0].id;
});
afterAll(() => { delete process.env.PAYMENT_WEBHOOK_SECRET; });

test('unconfigured secret, bad signature, stale timestamp and re-serialized body are refused', async () => {
  const payload = event('invoice.paid', { amount_paid: 1, currency: 'usd', metadata: meta() });
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  expect((await send(payload)).status).toBe(503);
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  expect((await send(payload, { secret: 'whsec_wrong' })).status).toBe(400);
  expect((await send(payload, { timestamp: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(400);
  // İmza bir gövde için atılır, sunucuya farklı biçimlenmiş aynı JSON gider.
  const signed = JSON.stringify(payload);
  const res = await request(app).post('/api/license/webhooks/payment').set('Content-Type', 'application/json')
    .set('Stripe-Signature', stripe.sign(signed, SECRET)).send(JSON.stringify(payload, null, 2));
  expect(res.status).toBe(400);
  expect((await request(app).post('/api/license/webhooks/payment').send(payload)).status).toBe(400);
  expect((await license()).status).toBe('PENDING_PAYMENT');
});

test('only a platform administrator can invoice, cancel or extend a license', async () => {
  for (const action of ['invoices', 'cancel', 'extend']) {
    // Lisansı aktif olan ama platform yöneticisi olmayan firma da, lisansı kapalı müşteri de yapamaz.
    const licensed = await request(app).post(`/api/platform/tenants/${customer.tenantId}/licenses/${licenseId}/${action}`)
      .set('Authorization', `Bearer ${other.token}`).send({ days: 30, reason: 'deneme' });
    expect(licensed.status).toBe(403);
    const blocked = await request(app).post(`/api/platform/tenants/${customer.tenantId}/licenses/${licenseId}/${action}`)
      .set('Authorization', `Bearer ${customer.token}`).send({ days: 30, reason: 'deneme' });
    expect([403, 423]).toContain(blocked.status);
  }
  const wrongTenant = await request(app).post(`/api/platform/tenants/${other.tenantId}/licenses/${licenseId}/invoices`)
    .set('Authorization', `Bearer ${platform.token}`).send({});
  expect(wrongTenant.status).toBe(404);
});

test('wrong amount, foreign license and unknown invoice never activate the license', async () => {
  const { invoice, payment_metadata } = await newInvoice();
  const cents = Math.round(invoice.amount * 100);
  const wrongAmount = await send(event('invoice.paid', { amount_paid: cents - 1, currency: 'usd', metadata: payment_metadata }));
  expect(wrongAmount.body).toMatchObject({ outcome: 'rejected', reason: 'amount_mismatch' });
  const wrongCurrency = await send(event('invoice.paid', { amount_paid: cents, currency: 'eur', metadata: payment_metadata }));
  expect(wrongCurrency.body.reason).toBe('amount_mismatch');
  const foreign = await send(event('invoice.paid', { amount_paid: cents, currency: 'usd', metadata: { ...payment_metadata, tenant_id: String(other.tenantId) } }));
  expect(foreign.body.reason).toBe('unknown_license');
  const noInvoice = await send(event('invoice.paid', { amount_paid: cents, currency: 'usd', metadata: meta() }));
  expect(noInvoice.body.reason).toBe('unknown_invoice');
  expect((await license()).status).toBe('PENDING_PAYMENT');
  expect(await moduleType()).toBe('NONE');
  const logged = await db.query("SELECT status, error_message FROM webhook_logs WHERE license_id = $1 AND status = 'rejected'", [licenseId]);
  expect(logged.rows.map(r => r.error_message).sort()).toEqual(['amount_mismatch', 'amount_mismatch', 'unknown_invoice', 'unknown_license']);
});

test('verified payment activates once; replays and concurrent duplicates change nothing', async () => {
  const pending = (await db.query("SELECT * FROM invoices WHERE license_id = $1 AND status = 'PENDING'", [licenseId])).rows[0];
  const paid = event('checkout.session.completed', { amount_total: Math.round(pending.amount * 100), currency: 'usd', metadata: meta({ invoice_id: String(pending.id) }) });
  const results = await Promise.all([send(paid), send(paid)]);
  expect(results.map(r => r.status)).toEqual([200, 200]);
  expect(results.filter(r => r.body.duplicate).length).toBe(1);
  expect((await license()).status).toBe('ACTIVE');
  const first = await expiry();
  expect(first).toBeGreaterThan(Date.now() + 364 * DAY);
  expect(await moduleType()).toBe('NORMAL');
  expect((await send(paid)).body.duplicate).toBe(true);
  const redelivered = await send({ ...paid, id: `evt_test_${++eventSeq}`, created: ++clock });
  expect(redelivered.body.reason).toBe('invoice_already_paid');
  expect(await expiry()).toBe(first);
  expect((await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_id = $1 AND action = 'license_paid'", [licenseId])).rows[0].n).toBe(1);
});

test('failed payment marks past due but keeps the paid period; an older event cannot undo a newer one', async () => {
  const stale = event('invoice.payment_failed', { metadata: meta() }, { created: 1 });
  expect((await send(stale)).body).toMatchObject({ outcome: 'ignored', reason: 'stale_event' });
  expect((await license()).status).toBe('ACTIVE');
  expect((await send(event('invoice.payment_failed', { metadata: meta() }))).body.outcome).toBe('applied');
  expect((await license()).status).toBe('PAST_DUE');
  expect(await moduleType()).toBe('NORMAL');
});

test('renewal extends from the current expiry, not from today', async () => {
  const before = await expiry();
  const { invoice, payment_metadata } = await newInvoice();
  expect((await send(event('invoice.paid', { amount_paid: Math.round(invoice.amount * 100), currency: 'usd', metadata: payment_metadata }))).body.outcome).toBe('applied');
  expect((await license()).status).toBe('ACTIVE');
  expect(await expiry() - before).toBe(365 * DAY);
});

test('manual extension needs a reason and is audited', async () => {
  const url = `/api/platform/tenants/${customer.tenantId}/licenses/${licenseId}/extend`;
  expect((await request(app).post(url).set('Authorization', `Bearer ${platform.token}`).send({ days: 10 })).status).toBe(400);
  const before = await expiry();
  const res = await request(app).post(url).set('Authorization', `Bearer ${platform.token}`).send({ days: 10, reason: 'Kesinti telafisi' });
  expect(res.status).toBe(201);
  expect(await expiry() - before).toBe(10 * DAY);
  expect((await db.query("SELECT details FROM audit_logs WHERE entity_id = $1 AND action = 'license_extended'", [licenseId])).rows[0].details).toContain('Kesinti telafisi');
});

test('cancellation closes access, voids open invoices and a later payment cannot reopen it', async () => {
  const { invoice, payment_metadata } = await newInvoice();
  expect((await send(event('customer.subscription.deleted', { metadata: meta() }))).body.outcome).toBe('applied');
  expect((await license()).status).toBe('CANCELLED');
  expect(await moduleType()).toBe('NONE');
  expect((await db.query('SELECT status FROM invoices WHERE id = $1', [invoice.id])).rows[0].status).toBe('VOID');
  const late = await send(event('invoice.paid', { amount_paid: Math.round(invoice.amount * 100), currency: 'usd', metadata: payment_metadata }));
  expect(late.body.outcome).toBe('rejected');
  expect((await license()).status).toBe('CANCELLED');
});
