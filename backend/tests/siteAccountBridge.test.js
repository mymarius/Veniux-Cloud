process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const bridge = require('../src/services/siteAccountBridge');

// veniux.com hesabıyla ilk girişte bulut hesabı açılır; site çağrısı sahte fetch ile denenir.
const SECRET = 'k'.repeat(40);
const mail = () => `site-${crypto.randomBytes(4).toString('hex')}@example.test`;
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
let realFetch;
beforeAll(() => { realFetch = global.fetch; });
afterEach(() => { global.fetch = realFetch; delete process.env.VENIUX_SITE_BRIDGE_SECRET; });
const mockSite = (reply, calls = []) => { global.fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200, json: async () => reply }; }; return calls; };

test('anahtar tanımlı değilse köprü kapalıdır: hesapsız giriş eskisi gibi reddedilir ve siteye gidilmez', async () => {
  const calls = mockSite({ valid: true, company: 'X' });
  const res = await login(mail(), 'dogru-parola-12345');
  expect(res.status).toBe(401);
  expect(res.body.error).toBe('E-posta veya parola hatalı.');
  expect(calls).toHaveLength(0);
});

test('site hesabı doğruysa ilk girişte işletme ve yönetici açılır, imzalı istek gider, sonraki giriş yerel parolayla çalışır', async () => {
  process.env.VENIUX_SITE_BRIDGE_SECRET = SECRET;
  const email = mail();
  const calls = mockSite({ valid: true, company: 'Deneme Market' });
  const first = await login(email, 'dogru-parola-12345');
  expect([200, 423]).toContain(first.status); // 423: lisans zorunluluğu; hesap yine açılmıştır
  expect(calls).toHaveLength(1);
  const sent = calls[0];
  expect(sent.url).toMatch(/\/api\/hesap-dogrula$/);
  const body = sent.opts.body, ts = sent.opts.headers['X-Veniux-Timestamp'];
  expect(sent.opts.headers['X-Veniux-Signature']).toBe(crypto.createHmac('sha256', SECRET).update(ts + '\n' + body).digest('hex'));
  const row = (await db.query('SELECT u.role,t.company_name FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE LOWER(u.email)=$1', [email])).rows[0];
  expect(row).toMatchObject({ role: 'admin', company_name: 'Deneme Market' });
  const again = await login(email, 'dogru-parola-12345');
  expect([200, 423]).toContain(again.status);
  expect(calls).toHaveLength(1); // hesap artık bulutta, siteye tekrar sorulmaz
  const wrong = await login(email, 'yanlis-parola-12345');
  expect(wrong.status).toBe(401);
});

test('site parolayı reddederse hesap açılmaz; doğrulanmamış e-posta anlaşılır mesaj alır', async () => {
  process.env.VENIUX_SITE_BRIDGE_SECRET = SECRET;
  const bad = mail();
  mockSite({ valid: false, reason: 'invalid' });
  const res = await login(bad, 'yanlis-parola-12345');
  expect(res.status).toBe(401);
  expect(res.body.error).toMatch(/veniux\.com hesabınız varsa/);
  expect((await db.query('SELECT id FROM users WHERE LOWER(email)=$1', [bad])).rows).toHaveLength(0);
  const unverified = mail();
  mockSite({ valid: false, reason: 'unverified' });
  const res2 = await login(unverified, 'dogru-parola-12345');
  expect(res2.status).toBe(403);
  expect(res2.body.code).toBe('SITE_EMAIL_UNVERIFIED');
});

test('site erişilemezse giriş normal reddedilir; mevcut bulut hesabının parolası site tarafından değiştirilmez', async () => {
  process.env.VENIUX_SITE_BRIDGE_SECRET = SECRET;
  global.fetch = async () => { throw new Error('ağ yok'); };
  expect((await login(mail(), 'dogru-parola-12345')).status).toBe(401);
  const email = mail();
  await bridge.provision(email, 'bulut-parolasi-12345', 'Mevcut');
  const calls = mockSite({ valid: true, company: 'Başka' });
  const res = await login(email, 'site-parolasi-12345');
  expect(res.status).toBe(401);
  expect(calls).toHaveLength(0);
});
