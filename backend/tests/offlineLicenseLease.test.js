const crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
const express = require('express'), request = require('supertest');
const central = require('../src/services/centralLicense');

const token = 'a'.repeat(64), device = 'HW-' + 'B'.repeat(32);
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const saved = { ...process.env };
let dir, now, authority;
const sign = payload => { const text = JSON.stringify(payload); return { signed_payload: text, signature: crypto.sign('sha256', Buffer.from(text), keys.privateKey).toString('base64') }; };
function app() { const a = express(); a.use('/api', central.gate); a.use((req, res) => res.json({ ok: true, license: req.centralLicense })); return a; }
const call = () => request(app()).get('/api/products').set('x-veniux-device-token', token).set('x-device-id', device);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-lease-'));
  fs.writeFileSync(path.join(dir, 'authority.pem'), keys.publicKey);
  Object.assign(process.env, { VENIUX_LICENSE_AUTHORITY_URL: 'https://authority.example.invalid/v1', VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY: path.join(dir, 'authority.pem'), VENIUX_DATA_DIR: dir });
  delete process.env.VENIUX_CLOUD_SERVICE;
  now = Date.parse('2026-11-08T10:00:00Z');
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  authority = 'ok';
  global.fetch = jest.fn(async (url, options) => {
    if (authority === 'down') throw new Error('network');
    if (authority === 'revoked') return { ok: false, status: 403, json: async () => ({}) };
    const body = JSON.parse(options.body), at = Math.floor(now / 1000);
    return { ok: true, status: 200, json: async () => sign({ valid: authority === 'ok', status: authority === 'ok' ? 'ACTIVE' : 'SUSPENDED', nonce: body.nonce, device_fingerprint: body.device_fingerprint, issued_at: at, valid_until: at + 30 }) };
  });
});
afterEach(() => { jest.restoreAllMocks(); process.env = { ...saved }; fs.rmSync(dir, { recursive: true, force: true }); });

test('internet kesilince son geçerli lisansla 72 saat çalışır, sonra durur', async () => {
  expect((await call()).status).toBe(200);
  authority = 'down';
  now += 71 * 3600000;
  const offline = await call();
  expect(offline.status).toBe(200);
  expect(Number(offline.headers['x-veniux-offline-until'])).toBe(Math.floor(Date.parse('2026-11-08T10:00:00Z') / 1000) + 72 * 3600);
  now += 2 * 3600000;
  const expired = await call();
  expect(expired.status).toBe(503);
  expect(expired.body.code).toBe('LICENSE_UNAVAILABLE');
});

test('lisans sunucusu reddederse izin hemen silinir', async () => {
  await call();
  authority = 'revoked';
  expect((await call()).status).toBe(503);
  authority = 'down';
  expect((await call()).status).toBe(503);
});

test('askıya alınan lisans izni geçersiz kılar', async () => {
  await call();
  authority = 'suspended';
  expect((await call()).status).toBe(423);
  authority = 'down';
  expect((await call()).status).toBe(503);
});

test('saat geri alınırsa izin kullanılmaz', async () => {
  await call();
  authority = 'down';
  now += 10 * 3600000;
  expect((await call()).status).toBe(200);
  now -= 2 * 3600000;
  expect((await call()).status).toBe(503);
});

test('değiştirilmiş izin dosyası ve başka cihaz reddedilir', async () => {
  await call();
  authority = 'down';
  const file = path.join(dir, 'license-lease', fs.readdirSync(path.join(dir, 'license-lease'))[0]);
  const lease = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...lease, signed_payload: lease.signed_payload.replace('"issued_at":', '"issued_at":9') }));
  expect((await call()).status).toBe(503);
  expect(central.offlineLease(token, 'HW-' + 'C'.repeat(32))).toBe(null);
});

test('bulut sunucusunda çevrimdışı izin yoktur', async () => {
  process.env.VENIUX_CLOUD_SERVICE = '1';
  await call();
  authority = 'down';
  expect((await call()).status).toBe(503);
  expect(fs.existsSync(path.join(dir, 'license-lease'))).toBe(false);
});

test('açılış doğrulaması da internetsizken izinle geçer', async () => {
  const a = express(); a.use(express.json()); a.use('/api/license', require('../src/routes/licenseRoutes'));
  const plan = require('../src/services/licenseService').getPlans()[0];
  const original = global.fetch;
  global.fetch = jest.fn(async (url, options) => { const r = await original(url, options); if (!r.ok) return r; const body = await r.json(); const payload = JSON.parse(body.signed_payload); return { ...r, json: async () => sign({ ...payload, plan_id: plan.id }) }; });
  const validate = () => request(a).post('/api/license/validate').send({ device_token: token, device_fingerprint: device });
  expect((await validate()).body.valid).toBe(true);
  authority = 'down';
  now += 5 * 3600000;
  const offline = await validate();
  expect(offline.status).toBe(200);
  expect(offline.body.valid).toBe(true);
  expect(offline.headers['x-veniux-offline-until']).toBeDefined();
  authority = 'revoked';
  expect((await validate()).status).toBe(403);
  authority = 'down';
  expect((await validate()).status).toBe(503);
});
