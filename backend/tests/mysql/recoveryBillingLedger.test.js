// Şifre sıfırlama, ödeme bildirimi, 2FA sıfırlaması ve stok defteri gerçek MySQL'de: tarih, tekillik ve RETURNING SQLite'tan farklı davranır.
const sent = [];
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: async mail => { sent.push(mail); return { messageId: 'mysql-test' }; } }) }));
jest.mock('express-rate-limit', () => () => (req, res, next) => next()); // sınırlar başka testlerde denenir
process.env.JWT_SECRET = 'isolated-mysql-recovery-secret-at-least-32-bytes';
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/index');
const db = require('../../src/config/database');
const adapter = require('../../src/config/mysqlAdapter');
const mfa = require('../../src/services/mfaService');
const StripeProvider = require('../../src/services/payment/StripeProvider');
const { DRIFT_SQL, BACKFILL_SQL } = require('../../src/database/migrations/034_ledger_opening_balance');

const SECRET = 'whsec_mysql_test_only', password = 'password123';
const stripe = new StripeProvider();
const login = (email, pass = password, extra = {}) => request(app).post('/api/auth/login').send({ email, password: pass, ...extra });
const as = (token, method, url, body) => request(app)[method](url).set('Authorization', `Bearer ${token}`).set('Idempotency-Key', crypto.randomUUID()).send(body);
const insert = async (sql, args) => (await db.query(`${sql} RETURNING *`, args)).rows[0];
const account = async () => {
  const email = `mysql-${crypto.randomUUID()}@example.invalid`;
  const registered = await request(app).post('/api/auth/register').send({ email, password, phone: '05551234567' });
  expect(registered.status).toBe(201);
  const tenantId = registered.body.user.tenant_id;
  await db.query("INSERT INTO licenses (license_key,tenant_id,plan_id,status,max_users,max_warehouses,max_devices,expires_at) VALUES ($1,$2,'ENTERPRISE_ANNUAL','ACTIVE',100,100,100,'2099-01-01 00:00:00')", [`VNX-MYSQL-${crypto.randomUUID()}`, tenantId]);
  const signedIn = await login(email);
  expect(signedIn.status).toBe(200);
  return { email, tenantId, userId: registered.body.user.id, token: signedIn.body.token };
};

beforeAll(async () => {
  await db.ready;
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_USER: 'mailer', SMTP_PASS: 'sink', APP_BASE_URL: 'https://app.veniux.test', PAYMENT_WEBHOOK_SECRET: SECRET });
});
afterAll(async () => adapter.getMySQLPool()?.end());

test('password reset: single use, expiry and session revocation', async () => {
  const owner = await account();
  const ask = async () => {
    sent.length = 0;
    expect((await request(app).post('/api/auth/forgot-password').send({ email: owner.email })).status).toBe(200);
    for (let i = 0; i < 50 && !sent.length; i++) await new Promise(r => setTimeout(r, 20));
    return String(sent[0].text || sent[0].html).match(/token=([0-9a-f]{64})/)[1];
  };
  const token = await ask();
  expect((await as(owner.token, 'get', '/api/auth/me')).status).toBe(200);
  const reset = (value, pass) => request(app).post('/api/auth/reset-password').send({ token: value, password: pass });
  expect((await reset(token, 'NewPassw0rd!x')).status).toBe(200);
  expect((await as(owner.token, 'get', '/api/auth/me')).status).toBe(401);
  expect((await reset(token, 'Another0ne!xx')).status).toBe(400);
  expect((await login(owner.email)).status).toBe(401);
  expect((await login(owner.email, 'NewPassw0rd!x')).status).toBe(200);

  const first = await ask(), second = await ask();
  expect((await reset(first, 'NewPassw0rd!y')).status).toBe(400);
  await db.query("UPDATE password_reset_tokens SET expires_at = '2000-01-01 00:00:00' WHERE tenant_id = $1", [owner.tenantId]);
  expect((await reset(second, 'NewPassw0rd!y')).status).toBe(400);
  expect((await login(owner.email, 'NewPassw0rd!x')).status).toBe(200);
});

test('webhook: verified payment activates once, replay changes nothing, cancel closes', async () => {
  const platform = await account(), customer = await account();
  await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [platform.userId]);
  await db.query("UPDATE licenses SET status='REVOKED' WHERE tenant_id=$1", [customer.tenantId]);
  const licenseId = (await insert("INSERT INTO licenses (license_key,tenant_id,plan_id,status,expires_at) VALUES ($1,$2,'NORMAL_WMS_ANNUAL','PENDING_PAYMENT','2000-01-01 00:00:00')", [`VNX-BILL-${crypto.randomUUID()}`, customer.tenantId])).id;
  const license = async () => (await db.query('SELECT status, expires_at FROM licenses WHERE id=$1', [licenseId])).rows[0];
  const send = payload => {
    const body = JSON.stringify(payload);
    return request(app).post('/api/license/webhooks/payment').set('Content-Type', 'application/json').set('Stripe-Signature', stripe.sign(body, SECRET, Math.floor(Date.now() / 1000))).send(body);
  };
  const created = await as(platform.token, 'post', `/api/platform/tenants/${customer.tenantId}/licenses/${licenseId}/invoices`, {});
  expect(created.status).toBe(201);
  const { invoice, payment_metadata } = created.body;
  const paid = { id: `evt_${crypto.randomUUID()}`, type: 'invoice.paid', created: 1900000000, data: { object: { amount_paid: Math.round(invoice.amount * 100), currency: 'usd', metadata: payment_metadata } } };
  const results = await Promise.all([send(paid), send(paid)]);
  expect(results.map(r => r.status)).toEqual([200, 200]);
  expect(results.filter(r => r.body.duplicate).length).toBe(1);
  const active = await license();
  expect(active.status).toBe('ACTIVE');
  expect((await send(paid)).body.duplicate).toBe(true);
  expect((await license()).expires_at).toEqual(active.expires_at);
  const cancelled = await send({ id: `evt_${crypto.randomUUID()}`, type: 'customer.subscription.deleted', created: 1900000100, data: { object: { metadata: { tenant_id: String(customer.tenantId), license_id: String(licenseId) } } } });
  expect(cancelled.status).toBe(200);
  expect((await license()).status).toBe('CANCELLED');
});

test('admin two factor reset opens password login and drops sessions', async () => {
  const owner = await account();
  const email = `mysql-${crypto.randomUUID()}@example.invalid`;
  expect((await as(owner.token, 'post', '/api/settings/users', { email, password: 'Member-Pass-123', role: 'manager' })).status).toBe(201);
  const memberId = (await db.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id;
  const token = (await login(email, 'Member-Pass-123')).body.token;
  const setup = await as(token, 'post', '/api/auth/mfa/setup', { password: 'Member-Pass-123' });
  expect(setup.status).toBe(200);
  const step = Math.floor(Date.now() / 30000);
  expect((await as(token, 'post', '/api/auth/mfa/confirm', { password: 'Member-Pass-123', code: mfa.totp(setup.body.secret, step) })).status).toBe(200);
  expect((await login(email, 'Member-Pass-123')).body.mfa_required).toBe(true);
  expect((await as(owner.token, 'post', `/api/settings/users/${memberId}/mfa-reset`, { password: 'wrong-password' })).status).toBe(403);
  const reset = await as(owner.token, 'post', `/api/settings/users/${memberId}/mfa-reset`, { password });
  expect(reset.status).toBe(200);
  expect(reset.body.reset).toBe(true);
  expect((await login(email, 'Member-Pass-123')).body.token).toBeTruthy();
});

test('stock paths write the ledger and the opening balance closes old drift once', async () => {
  const owner = await account();
  const warehouse = async name => insert("INSERT INTO warehouses (tenant_id,name,type) VALUES ($1,$2,'main')", [owner.tenantId, `${name}-${crypto.randomUUID()}`]);
  const north = await warehouse('Kuzey'), south = await warehouse('Guney');
  const sku = `MYSQL-${crypto.randomUUID()}`;
  const product = await insert("INSERT INTO products (tenant_id,sku,name,unit,sale_price,module_type) VALUES ($1,$2,'MySQL urun','adet',10,'NORMAL')", [owner.tenantId, sku]);
  const sum = async (table, warehouseId) => Number((await db.query(`SELECT COALESCE(SUM(quantity),0) AS q FROM ${table} WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3`, [owner.tenantId, warehouseId, product.id])).rows[0].q);
  const expectBoth = async (warehouseId, quantity) => expect({ stock: await sum('stock_records', warehouseId), ledger: await sum('inventory_transactions', warehouseId) }).toEqual({ stock: quantity, ledger: quantity });

  expect((await as(owner.token, 'post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: 50, movement_type: 'inbound' })).status).toBe(201);
  await expectBoth(north.id, 50);
  expect((await as(owner.token, 'post', '/api/stock/transfer', { product_id: product.id, from_warehouse_id: north.id, to_warehouse_id: south.id, quantity: 15 })).status).toBe(200);
  await expectBoth(north.id, 35);
  await expectBoth(south.id, 15);
  expect((await as(owner.token, 'post', '/api/stock/adjust', { product_id: product.id, warehouse_id: north.id, new_quantity: 30 })).status).toBe(200);
  await expectBoth(north.id, 30);

  await db.query('UPDATE stock_records SET quantity=44 WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3', [owner.tenantId, south.id, product.id]);
  const connection = await adapter.getMySQLPool().getConnection();
  try {
    const drift = async () => (await connection.query(DRIFT_SQL))[0].filter(row => Number(row.tenant_id) === Number(owner.tenantId));
    expect(await drift()).toHaveLength(1);
    await connection.query(BACKFILL_SQL);
    expect(await drift()).toEqual([]);
    await expectBoth(south.id, 44);
    const [before] = await connection.query('SELECT COUNT(*) AS n FROM inventory_transactions WHERE tenant_id=?', [owner.tenantId]);
    await connection.query(BACKFILL_SQL);
    expect((await connection.query('SELECT COUNT(*) AS n FROM inventory_transactions WHERE tenant_id=?', [owner.tenantId]))[0][0].n).toBe(before[0].n);
  } finally { connection.release(); }
});

test('date columns accept what the invitation and license paths write', async () => {
  const owner = await account();
  await db.query('INSERT INTO business_portal_settings(tenant_id,enabled) VALUES($1,1)', [owner.tenantId]);
  const partner = await as(owner.token, 'post', '/api/business/partners', { name: 'MySQL bayi' });
  expect(partner.status).toBeLessThan(300);
  const invited = await as(owner.token, 'post', '/api/business/invitations', { email: `invite-${crypto.randomUUID()}@example.invalid`, role: 'dealer', partner_id: partner.body.id });
  expect(invited.status).toBe(201);

  const code = crypto.randomUUID().slice(0, 8).toUpperCase();
  await require('../../src/services/licenseService').purchaseAnnualLicense({ tenant_code: `MY${code}`, company_name: 'MySQL Firma', email: `buy-${code}@example.invalid`.toLowerCase(), password: 'Purchase-Pass-123', phone: '05551234567', plan_id: 'NORMAL_WMS_ANNUAL' });
  const stored = (await db.query('SELECT l.expires_at FROM licenses l JOIN users u ON u.tenant_id=l.tenant_id WHERE u.email=$1', [`buy-${code}@example.invalid`.toLowerCase()])).rows[0];
  expect(Date.parse(String(stored.expires_at).replace(' ', 'T') + 'Z')).toBeGreaterThan(Date.now());
});

test('bank transfer: blocked customer sees the IBAN, the admin confirms once', async () => {
  process.env.BANK_IBAN = 'TR330006100519786457841326';
  process.env.BANK_ACCOUNT_NAME = 'Veniux Yazilim';
  const platform = await account(), customer = await account();
  await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [platform.userId]);
  await db.query("UPDATE licenses SET status='REVOKED' WHERE tenant_id=$1", [customer.tenantId]);
  const licenseId = (await insert("INSERT INTO licenses (license_key,tenant_id,plan_id,status,expires_at) VALUES ($1,$2,'NORMAL_WMS_ANNUAL','PENDING_PAYMENT','2000-01-01 00:00:00')", [`VNX-BANK-${crypto.randomUUID()}`, customer.tenantId])).id;
  const base = `/api/platform/tenants/${customer.tenantId}/licenses/${licenseId}/invoices`;
  const created = await as(platform.token, 'post', base, { payment_method: 'BANK_TRANSFER', amount: 12500.5, currency: 'TRY' });
  expect(created.status).toBe(201);
  const seen = await login(customer.email);
  expect(seen.status).toBe(423);
  expect(seen.body.billing.bank.iban).toBe('TR330006100519786457841326');
  expect(Number(seen.body.billing.invoices[0].amount)).toBe(12500.5);
  const url = `${base}/${created.body.invoice.id}/confirm-bank-transfer`, reference = `DEKONT-${crypto.randomUUID()}`;
  expect((await as(platform.token, 'post', url, { amount: 12500.49, reference })).status).toBe(400);
  const results = await Promise.all([as(platform.token, 'post', url, { amount: 12500.5, reference }), as(platform.token, 'post', url, { amount: 12500.5, reference })]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  const license = (await db.query('SELECT status, expires_at FROM licenses WHERE id=$1', [licenseId])).rows[0];
  expect(license.status).toBe('ACTIVE');
  expect(Date.parse(String(license.expires_at).replace(' ', 'T') + 'Z')).toBeGreaterThan(Date.now() + 364 * 86400000);
});
