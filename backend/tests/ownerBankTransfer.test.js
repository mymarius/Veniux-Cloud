const SECRET = 'test-console-secret-0123456789abcdef-0123456789';
process.env.VENIUX_OWNER_CONSOLE_SECRET = SECRET;
process.env.BANK_IBAN = 'TR33 0006 1005 1978 6457 8413 26'; process.env.BANK_ACCOUNT_NAME = 'Veniux Yazilim';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const { sign } = require('../src/middlewares/ownerConsoleAuth');
const { createTenant } = require('./factories');

// Yönetim sitesinden havale: fatura kes, listele, dekontla onayla, yanlış faturayı geri al.
let customer, licenseId, seq = 0;
const call = (method, path, body) => {
  const raw = body === undefined ? '' : JSON.stringify(body), time = Math.floor(Date.now() / 1000), nonce = crypto.randomBytes(12).toString('hex');
  const r = request(app)[method.toLowerCase()](path).set('X-Console-Time', String(time)).set('X-Console-Nonce', nonce).set('X-Console-Signature', sign(SECRET, method, path, time, nonce, Buffer.from(raw)));
  return raw ? r.set('Content-Type', 'application/json').send(raw) : r;
};
const base = () => `/api/owner-console/tenants/${customer.tenantId}/licenses/${licenseId}/invoices`;
const reason = 'havale kontrol edildi';
beforeAll(async () => {
  customer = await createTenant();
  await db.query("UPDATE licenses SET status='REVOKED' WHERE tenant_id=$1", [customer.tenantId]);
  licenseId = (await db.query("INSERT INTO licenses (license_key,tenant_id,plan_id,status,expires_at) VALUES ($1,$2,'NORMAL_WMS_ANNUAL','PENDING_PAYMENT','2000-01-01 00:00:00') RETURNING id", ['VNX-OWN-' + crypto.randomBytes(6).toString('hex'), customer.tenantId])).rows[0].id;
});
afterAll(() => { delete process.env.BANK_IBAN; delete process.env.BANK_ACCOUNT_NAME; });

test('fatura kes, listele, yanlış tutarı reddet, dekontla onayla', async () => {
  const made = await call('POST', base(), { amount: 14388, currency: 'TRY', reason });
  expect(made.status).toBe(200); const invoice = made.body.invoice;
  const list = await call('GET', '/api/owner-console/bank-transfers');
  expect(list.body.pending.some(i => i.id === invoice.id)).toBe(true);
  expect((await call('POST', `${base()}/${invoice.id}/confirm`, { amount: 1, reference: 'DEKONT-X' + ++seq, reason })).status).toBe(400);
  expect((await call('POST', `${base()}/${invoice.id}/confirm`, { amount: 14388, reference: 'DEKONT-OK' + Date.now(), reason: 'x' })).body.code).toBe('BAD_REASON');
  const ok = await call('POST', `${base()}/${invoice.id}/confirm`, { amount: 14388, reference: 'DEKONT-OK' + Date.now(), reason });
  expect(ok.body.status).toBe('ACTIVE');
  expect((await db.query('SELECT status FROM invoices WHERE id=$1', [invoice.id])).rows[0].status).toBe('PAID');
  expect((await db.query("SELECT 1 FROM audit_logs WHERE tenant_id=$1 AND user_email='yonetim-sitesi' AND action='license_paid'", [customer.tenantId])).rows.length).toBe(1);
});

test('yanlış kesilen fatura geri alınır', async () => {
  const invoice = (await call('POST', base(), { amount: 500, currency: 'TRY', reason })).body.invoice;
  expect((await call('POST', `${base()}/${invoice.id}/void`, { reason })).body.status).toBe('VOID');
});

test('imzasız istek reddedilir', async () => {
  expect((await request(app).get('/api/owner-console/bank-transfers')).status).toBe(401);
});
