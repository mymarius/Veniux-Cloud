process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const demo = require('../src/services/demoAccount');

describe('kişiye özel demo hesabı', () => {
  let account;
  const email = `demo_${Date.now()}@ornek.com`;

  test('hesap, lisans ve örnek veri oluşturulur; şifre ile giriş yapılır', async () => {
    account = await demo.create(db, { email: email.toUpperCase(), company: 'Örnek Market', days: 14 });
    expect(account.email).toBe(email);
    expect(account.password).toHaveLength(14);

    const tenant = (await db.query('SELECT company_name FROM tenants WHERE id=$1', [account.tenantId])).rows[0];
    expect(tenant.company_name).toBe('[DEMO] Örnek Market');
    const license = (await db.query("SELECT status,plan_id,expires_at FROM licenses WHERE tenant_id=$1", [account.tenantId])).rows[0];
    expect(license.status).toBe('ACTIVE');
    expect(license.plan_id).toBe('BUSINESS_ANNUAL');
    const days = (new Date(String(license.expires_at).replace(' ', 'T') + 'Z') - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(13.5);
    expect(days).toBeLessThan(14.5);
    expect((await db.query('SELECT COUNT(*) AS n FROM products WHERE tenant_id=$1', [account.tenantId])).rows[0].n).toBe(12);
    expect((await db.query('SELECT COUNT(*) AS n FROM warehouses WHERE tenant_id=$1', [account.tenantId])).rows[0].n).toBe(2);
    expect((await db.query('SELECT COUNT(*) AS n FROM stock_records WHERE tenant_id=$1', [account.tenantId])).rows[0].n).toBe(24);

    const login = await request(app).post('/api/auth/login').send({ email, password: account.password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    const products = await request(app).get('/api/products').set('Authorization', 'Bearer ' + login.body.token);
    expect(products.status).toBe(200);
    expect(JSON.stringify(products.body)).toContain('Filtre Kahve');
  });

  test('aynı e-posta, geçersiz e-posta/süre ve rezerve sahip e-postası reddedilir; şifre kayda yazılmaz', async () => {
    await expect(demo.create(db, { email })).rejects.toMatchObject({ code: 'EXISTS' });
    await expect(demo.create(db, { email: 'gecersiz' })).rejects.toMatchObject({ code: 'BAD_EMAIL' });
    await expect(demo.create(db, { email: `x_${Date.now()}@ornek.com`, days: 0 })).rejects.toMatchObject({ code: 'BAD_DAYS' });
    await expect(demo.create(db, { email: require('../src/services/ownerIdentity').OWNER_EMAIL })).rejects.toMatchObject({ code: 'RESERVED' });
    const audit = (await db.query("SELECT details FROM audit_logs WHERE tenant_id=$1 AND action='demo.created'", [account.tenantId])).rows[0];
    expect(audit.details).not.toContain(account.password);
    const hash = (await db.query('SELECT password_hash FROM users WHERE email=$1', [email])).rows[0].password_hash;
    expect(hash).not.toContain(account.password);
  });

  test('süresi biten demo lisansı girişi kapatır, veri silinmez', async () => {
    const expiring = `demo_exp_${Date.now()}@ornek.com`;
    const created = await demo.create(db, { email: expiring, days: 1 });
    await db.query("UPDATE licenses SET expires_at='2020-01-01 00:00:00' WHERE tenant_id=$1", [created.tenantId]);
    const login = await request(app).post('/api/auth/login').send({ email: expiring, password: created.password });
    expect(login.status).toBe(423);
    expect(login.body.code).toBe('LICENSE_REQUIRED');
    expect(Number((await db.query('SELECT COUNT(*) AS n FROM products WHERE tenant_id=$1', [created.tenantId])).rows[0].n)).toBe(12);
  });

  test('iki hesabın şifresi ve barkodları farklıdır; barkodlar geçerli EAN-13', () => {
    expect(demo.makePassword()).not.toBe(demo.makePassword());
    const code = demo.ean13(123456);
    expect(code).toHaveLength(13);
    const digits = code.split('').map(Number);
    const sum = digits.slice(0, 12).reduce((t, d, i) => t + d * (i % 2 ? 3 : 1), 0);
    expect((10 - (sum % 10)) % 10).toBe(digits[12]);
  });
});
