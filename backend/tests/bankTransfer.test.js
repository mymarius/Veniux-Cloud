// Havale: fatura platform yöneticisince kesilir, ödeme yine onun onayıyla lisansı açar.
jest.mock('express-rate-limit', () => () => (req, res, next) => next()); // sınırlar başka testlerde denenir
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const billing = require('../src/services/billingService');
const StripeProvider = require('../src/services/payment/StripeProvider');
const { createTenant, createUser } = require('./factories');

const IBAN = 'TR33 0006 1005 1978 6457 8413 26', CLEAN_IBAN = 'TR330006100519786457841326', SECRET = 'whsec_bank_test_only';
const stripe = new StripeProvider();
let platform, customer, other, licenseId, seq = 0;
const as = (who, method, url, body) => request(app)[method](url).set('Authorization', `Bearer ${who.token}`).send(body);
const base = () => `/api/platform/tenants/${customer.tenantId}/licenses/${licenseId}/invoices`;
const license = async () => (await db.query('SELECT status, expires_at, last_billing_event_at FROM licenses WHERE id=$1', [licenseId])).rows[0];
const invoiceRow = async id => (await db.query('SELECT * FROM invoices WHERE id=$1', [id])).rows[0];
const newInvoice = async (extra = {}) => {
  const res = await as(platform, 'post', base(), { payment_method: 'BANK_TRANSFER', amount: 12500.5, currency: 'TRY', ...extra });
  expect(res.status).toBe(201);
  return res.body.invoice;
};
const confirm = (invoice, body, who = platform) => as(who, 'post', `${base()}/${invoice.id}/confirm-bank-transfer`, body);
const voidIt = (invoice, who = platform) => as(who, 'post', `${base()}/${invoice.id}/void`, {});
const reference = () => `DEKONT-${Date.now()}-${++seq}`;

beforeAll(async () => {
  Object.assign(process.env, { BANK_IBAN: IBAN, BANK_ACCOUNT_NAME: 'Veniux Yazilim', BANK_NAME: 'Test Bankasi', PAYMENT_WEBHOOK_SECRET: SECRET });
  platform = await createTenant();
  customer = await createTenant();
  other = await createTenant();
  await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [platform.userId]);
  await db.query("UPDATE licenses SET status='REVOKED' WHERE tenant_id=$1", [customer.tenantId]);
  licenseId = (await db.query("INSERT INTO licenses (license_key,tenant_id,plan_id,status,expires_at) VALUES ($1,$2,'NORMAL_WMS_ANNUAL','PENDING_PAYMENT','2000-01-01 00:00:00') RETURNING id", [`VNX-BANK-${Date.now()}`, customer.tenantId])).rows[0].id;
});
afterAll(() => { for (const key of ['BANK_IBAN', 'BANK_ACCOUNT_NAME', 'BANK_NAME', 'PAYMENT_WEBHOOK_SECRET']) delete process.env[key]; });

test('IBAN check digits are enforced', () => {
  expect(billing.normalizeIban(IBAN)).toBe(CLEAN_IBAN);
  expect(billing.normalizeIban('TR330006100519786457841327')).toBeNull();
  expect(billing.normalizeIban('TR33000610051978645784132')).toBeNull();
  expect(billing.normalizeIban('')).toBeNull();
});

test('no invoice can be created while bank details are missing or invalid', async () => {
  for (const value of [undefined, 'TR330006100519786457841327']) {
    if (value) process.env.BANK_IBAN = value; else delete process.env.BANK_IBAN;
    const res = await as(platform, 'post', base(), { payment_method: 'BANK_TRANSFER', amount: 10, currency: 'TRY' });
    expect(res.status).toBe(503);
  }
  process.env.BANK_IBAN = IBAN;
  expect((await db.query('SELECT COUNT(*) AS n FROM invoices WHERE license_id=$1', [licenseId])).rows[0].n).toBe(0);
});

test('invalid amount and currency are refused; only the platform admin can create or confirm', async () => {
  for (const body of [{ amount: 0 }, { amount: -5 }, { amount: '100' }, { amount: 10.123 }, { amount: 10, currency: 'GBP' }]) {
    expect((await as(platform, 'post', base(), { payment_method: 'BANK_TRANSFER', currency: 'TRY', ...body })).status).toBe(400);
  }
  expect((await as(other, 'post', base(), { payment_method: 'BANK_TRANSFER', amount: 10, currency: 'TRY' })).status).toBe(403);
  const invoice = await newInvoice();
  expect(invoice).toMatchObject({ status: 'PENDING', payment_method: 'BANK_TRANSFER', currency: 'TRY', amount: 12500.5 });
  expect((await confirm(invoice, { amount: 12500.5, reference: reference() }, other)).status).toBe(403);
  expect((await voidIt(invoice, other)).status).toBe(403);
  expect((await license()).status).toBe('PENDING_PAYMENT');
  expect((await voidIt(invoice)).status).toBe(200);
  expect((await invoiceRow(invoice.id)).status).toBe('VOID');
  expect((await confirm(invoice, { amount: 12500.5, reference: reference() })).status).toBe(409);
});

test('another company\'s path cannot reach the invoice', async () => {
  const invoice = await newInvoice();
  const wrong = `/api/platform/tenants/${other.tenantId}/licenses/${licenseId}/invoices/${invoice.id}/confirm-bank-transfer`;
  expect((await as(platform, 'post', wrong, { amount: 12500.5, reference: reference() })).status).toBe(404);
  expect((await invoiceRow(invoice.id)).status).toBe('PENDING');
  await voidIt(invoice);
});

test('a blocked admin sees the invoice at login without a session; a renewing admin sees it in the app', async () => {
  const login = (email, password = 'password123') => request(app).post('/api/auth/login').send({ email, password });
  const nothingDue = await login(customer.email);
  expect(nothingDue.status).toBe(423);
  expect(nothingDue.body.billing).toBeUndefined();

  const invoice = await newInvoice();
  const expected = { iban: CLEAN_IBAN, account_name: 'Veniux Yazilim', bank_name: 'Test Bankasi' };
  expect((await login(customer.email, 'wrong-password')).body.billing).toBeUndefined();
  const viewer = await createUser(customer.tenantId, 'viewer');
  const viewerBlocked = await login(viewer.email);
  expect(viewerBlocked.status).toBe(423);
  expect(viewerBlocked.body.billing).toBeUndefined();
  const blocked = await login(customer.email);
  expect(blocked.status).toBe(423);
  expect(blocked.body.token).toBeUndefined();
  expect(blocked.body.billing.bank).toEqual(expected);
  expect(blocked.body.billing.invoices).toEqual([expect.objectContaining({ invoice_no: invoice.invoice_no, status: 'PENDING', currency: 'TRY', amount: 12500.5 })]);
  expect((await login(other.email)).body.billing).toBeUndefined();

  const code = reference();
  expect((await confirm(invoice, { amount: 12500.5, reference: code })).status).toBe(200);
  const signedIn = await login(customer.email);
  expect(signedIn.status).toBe(200);
  customer.token = signedIn.body.token;
  const paid = await as(customer, 'get', '/api/license/billing');
  expect(paid.status).toBe(200);
  expect(paid.body.bank).toBeNull();
  expect(paid.body.invoices[0].status).toBe('PAID');
  expect(JSON.stringify(paid.body)).not.toContain(code);
  expect((await as({ token: (await login(viewer.email)).body.token }, 'get', '/api/license/billing')).status).toBe(403);
  expect((await request(app).get('/api/license/billing')).status).toBe(401);

  const renewal = await newInvoice({ amount: 99 });
  const due = await as(customer, 'get', '/api/license/billing');
  expect(due.body.bank).toEqual(expected);
  expect(due.body.invoices[0].invoice_no).toBe(renewal.invoice_no);
  expect((await as(other, 'get', '/api/license/billing')).body).toEqual({ invoices: [], bank: null });
  await voidIt(renewal);
});

test('wrong amount or missing receipt changes nothing; a provider event cannot pay it', async () => {
  await db.query("UPDATE licenses SET status='PENDING_PAYMENT', expires_at='2000-01-01 00:00:00' WHERE id=$1", [licenseId]);
  const invoice = await newInvoice({ amount: 500 });
  for (const body of [{ amount: 499.99, reference: reference() }, { amount: '500', reference: reference() }, { amount: 500 }, { amount: 500, reference: ' a ' }]) {
    expect((await confirm(invoice, body)).status).toBe(400);
  }
  const payload = JSON.stringify({ id: `evt_bank_${Date.now()}`, type: 'invoice.paid', created: 1900000000, data: { object: { amount_paid: 50000, currency: 'try', metadata: { tenant_id: String(customer.tenantId), license_id: String(licenseId), invoice_id: String(invoice.id) } } } });
  const event = await request(app).post('/api/license/webhooks/payment').set('Content-Type', 'application/json').set('Stripe-Signature', stripe.sign(payload, SECRET, Math.floor(Date.now() / 1000))).send(payload);
  expect(event.body).toMatchObject({ outcome: 'rejected', reason: 'invoice_bank_transfer' });
  expect((await license()).status).toBe('PENDING_PAYMENT');
  expect((await invoiceRow(invoice.id)).status).toBe('PENDING');
});

test('confirmation activates once, keeps the remaining term on renewal and refuses a reused receipt', async () => {
  const invoice = (await db.query("SELECT * FROM invoices WHERE license_id=$1 AND status='PENDING'", [licenseId])).rows[0];
  const code = reference();
  const results = await Promise.all([confirm(invoice, { amount: 500, reference: code }), confirm(invoice, { amount: 500, reference: code })]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  const active = await license();
  expect(active.status).toBe('ACTIVE');
  const first = billing.parseStamp(active.expires_at);
  expect(first).toBeGreaterThan(Date.now() + 364 * 86400000);
  expect((await invoiceRow(invoice.id))).toMatchObject({ status: 'PAID', provider_reference: code });
  const audit = (await db.query("SELECT user_email, details FROM audit_logs WHERE entity_id=$1 AND action='license_paid' AND details LIKE $2", [licenseId, `%${code}%`])).rows;
  expect(audit).toHaveLength(1);
  expect(audit[0].user_email).toBe(platform.email);

  const renewal = await newInvoice({ amount: 40, currency: 'USD', billing_period: 'MONTHLY' });
  expect((await confirm(renewal, { amount: 40, reference: code })).status).toBe(409);
  expect((await invoiceRow(renewal.id)).status).toBe('PENDING');
  expect((await confirm(renewal, { amount: 40, reference: reference() })).status).toBe(200);
  const after = billing.parseStamp((await license()).expires_at);
  expect(Math.round((after - first) / 86400000)).toBe(30);
});

test('a revoked license is not reopened by a bank payment', async () => {
  const invoice = await newInvoice({ amount: 75 });
  await db.query("UPDATE licenses SET status='REVOKED' WHERE id=$1", [licenseId]);
  expect((await confirm(invoice, { amount: 75, reference: reference() })).status).toBe(409);
  expect((await invoiceRow(invoice.id)).status).toBe('PENDING');
  expect((await license()).status).toBe('REVOKED');
});

test('card invoices keep working and cannot be confirmed by hand', async () => {
  await db.query("UPDATE licenses SET status='ACTIVE' WHERE id=$1", [licenseId]);
  await db.query("UPDATE invoices SET status='VOID' WHERE license_id=$1 AND status='PENDING'", [licenseId]);
  const res = await as(platform, 'post', base(), {});
  expect(res.status).toBe(201);
  expect(res.body.invoice).toMatchObject({ payment_method: 'CREDIT_CARD', currency: 'USD' });
  expect((await confirm(res.body.invoice, { amount: res.body.invoice.amount, reference: reference() })).status).toBe(409);
});
