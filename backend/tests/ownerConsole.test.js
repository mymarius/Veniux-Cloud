const SECRET = 'test-console-secret-0123456789abcdef-0123456789';
process.env.VENIUX_OWNER_CONSOLE_SECRET = SECRET;
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const { sign } = require('../src/middlewares/ownerConsoleAuth');
const { createTenant } = require('./factories');

// Yönetim sitesinin imzalı uçları: imza doğrulama, tekrar saldırısı, hesap erişimi, katalog fiyatı.
let owner, customer;
const call = (method, path, body, over = {}) => {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const time = over.time ?? Math.floor(Date.now() / 1000), nonce = over.nonce ?? crypto.randomBytes(12).toString('hex');
  const signature = over.signature ?? sign(over.key ?? SECRET, method, over.signPath ?? path, time, nonce, Buffer.from(over.signBody ?? raw));
  const r = request(app)[method.toLowerCase()](path).set('X-Console-Time', String(time)).set('X-Console-Nonce', nonce).set('X-Console-Signature', signature);
  return raw ? r.set('Content-Type', 'application/json').send(raw) : r;
};
beforeAll(async () => {
  owner = await createTenant(); await db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [owner.userId]);
  customer = await createTenant();
});

describe('imza doğrulama', () => {
  test('doğru imza geçer', async () => { expect((await call('GET', '/api/owner-console/ping')).body).toEqual({ ok: true }); });
  test('imzasız, yanlış anahtar, eski zaman, değişmiş gövde ve yol reddedilir', async () => {
    expect((await request(app).get('/api/owner-console/ping')).status).toBe(401);
    expect((await call('GET', '/api/owner-console/ping', undefined, { key: 'baska-anahtar-baska-anahtar-baska-anahtar-1' })).body.code).toBe('BAD_SIGNATURE');
    expect((await call('GET', '/api/owner-console/ping', undefined, { time: Math.floor(Date.now() / 1000) - 600 })).body.code).toBe('BAD_SIGNATURE');
    expect((await call('POST', `/api/owner-console/tenants/${customer.tenantId}/access`, { active: false, reason: 'gerekçe burada' }, { signBody: JSON.stringify({ active: true, reason: 'gerekçe burada' }) })).body.code).toBe('BAD_SIGNATURE');
    expect((await call('GET', '/api/owner-console/catalogue', undefined, { signPath: '/api/owner-console/ping' })).body.code).toBe('BAD_SIGNATURE');
  });
  test('aynı nonce ikinci kez kabul edilmez', async () => {
    const nonce = crypto.randomBytes(12).toString('hex');
    expect((await call('GET', '/api/owner-console/ping', undefined, { nonce })).status).toBe(200);
    expect((await call('GET', '/api/owner-console/ping', undefined, { nonce })).body.code).toBe('REPLAY');
  });
  test('anahtar tanımlı değilse uç kapalıdır', async () => {
    delete process.env.VENIUX_OWNER_CONSOLE_SECRET;
    expect((await call('GET', '/api/owner-console/ping')).status).toBe(503);
    process.env.VENIUX_OWNER_CONSOLE_SECRET = 'kisa';
    expect((await call('GET', '/api/owner-console/ping')).status).toBe(503);
    process.env.VENIUX_OWNER_CONSOLE_SECRET = SECRET;
  });
});

describe('hesaba erişim', () => {
  const access = (id, body) => call('POST', `/api/owner-console/tenants/${id}/access`, body);
  test('gerekçe ve tür zorunlu', async () => {
    expect((await access(customer.tenantId, { active: false, reason: 'kısa' })).body.code).toBe('BAD_REASON');
    expect((await access(customer.tenantId, { active: 'hayır', reason: 'yeterince uzun gerekçe' })).body.code).toBe('BAD_ACTIVE');
    expect((await access(999999, { active: false, reason: 'yeterince uzun gerekçe' })).status).toBe(404);
  });
  test('kapatma ve açma; denetim kaydı; platform yöneticisi işletmesi korunur', async () => {
    expect((await access(customer.tenantId, { active: false, reason: 'ödeme gecikti' })).body).toEqual({ tenant_id: customer.tenantId, active: false });
    expect(Number((await db.query('SELECT is_active FROM tenants WHERE id=$1', [customer.tenantId])).rows[0].is_active)).toBe(0);
    expect((await access(customer.tenantId, { active: true, reason: 'ödeme alındı' })).body.active).toBe(true);
    expect(Number((await db.query('SELECT is_active FROM tenants WHERE id=$1', [customer.tenantId])).rows[0].is_active)).toBe(1);
    const log = (await db.query("SELECT user_email,details FROM audit_logs WHERE tenant_id=$1 AND action='tenant_access_changed' ORDER BY id DESC LIMIT 1", [customer.tenantId])).rows[0];
    expect(log.user_email).toBe('yonetim-sitesi'); expect(log.details).toContain('ödeme alındı');
    expect((await access(owner.tenantId, { active: false, reason: 'koruma denemesi' })).body.code).toBe('PROTECTED');
  });
});

describe('katalog fiyatı', () => {
  const plan = (code, body) => call('PUT', `/api/owner-console/catalogue/plans/${code}`, body);
  test('fiyat değişir, revizyon artar; çakışma, hata ve değişiklik yok durumları', async () => {
    const cat = (await call('GET', '/api/owner-console/catalogue')).body;
    expect(cat.plans.length).toBeGreaterThanOrEqual(14);
    const online = cat.plans.find(p => p.code === 'RETAIL_ONLINE');
    expect((await plan('RETAIL_ONLINE', { revision: cat.revision, annual_cents: 1599900, reason: 'fiyat güncellemesi' })).body).toMatchObject({ revision: cat.revision + 1, plan: { annual_cents: 1599900 } });
    expect((await plan('RETAIL_ONLINE', { revision: cat.revision, annual_cents: 1700000, reason: 'eski revizyonla' })).body.code).toBe('REVISION_CONFLICT');
    const now = (await call('GET', '/api/owner-console/catalogue')).body;
    expect((await plan('RETAIL_ONLINE', { revision: now.revision, annual_cents: 50, reason: 'çok düşük fiyat' })).body.code).toBe('BAD_PRICE');
    expect((await plan('RETAIL_ONLINE', { revision: now.revision, annual_cents: 1599900, reason: 'aynı değer' })).body.code).toBe('NO_CHANGE');
    expect((await plan('YOK_BOYLE', { revision: now.revision, annual_cents: 1000, reason: 'olmayan paket' })).status).toBe(404);
    expect((await plan('RETAIL_PIDE', { revision: now.revision, available: false, reason: 'satıştan kaldır' })).body.plan.available).toBe(false);
    expect((await plan('RETAIL_PIDE', { revision: (await call('GET', '/api/owner-console/catalogue')).body.revision, available: true, reason: 'eski haline getir' })).body.plan).toMatchObject({ available: true });
    expect((await plan('RETAIL_ONLINE', { revision: 1, annual_cents: 1000, reason: '' })).body.code).toBe('BAD_REASON');
  });
});
