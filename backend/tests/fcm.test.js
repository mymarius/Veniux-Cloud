process.env.AUTH_RATE_LIMIT_MAX = '1000';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const accountFile = path.join(os.tmpdir(), 'fcm-test-account-' + process.pid + '.json');
fs.writeFileSync(accountFile, JSON.stringify({ project_id: 'veniux-test', client_email: 'sender@veniux-test.iam.gserviceaccount.com', private_key: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
process.env.FCM_SERVICE_ACCOUNT_FILE = accountFile;

const app = require('../src/index');
const fcm = require('../src/services/fcm');
const push = require('../src/services/pushNotifier');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createUser } = require('./factories');

afterAll(() => { fcm._setFetch(null); try { fs.unlinkSync(accountFile); } catch { /* yok */ } });

const TOKEN_A = 'A'.repeat(20) + ':' + 'b'.repeat(60) + '_-' + 'C'.repeat(40);
const TOKEN_B = 'B'.repeat(20) + ':' + 'd'.repeat(60) + '_-' + 'E'.repeat(40);

// Sahte Google: erişim anahtarı ve FCM uçları. Kalıp sırayla tüketilir.
function fakeGoogle() {
  const calls = { auth: [], send: [] }, plan = [];
  const fetchFn = async (url, init) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      const assertion = new URLSearchParams(init.body).get('assertion'), [h, c, s] = assertion.split('.');
      const valid = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + c), pair.publicKey, Buffer.from(s, 'base64url'));
      calls.auth.push({ valid, claims: JSON.parse(Buffer.from(c, 'base64url').toString()), header: JSON.parse(Buffer.from(h, 'base64url').toString()) });
      return { ok: true, status: 200, json: async () => ({ access_token: 'erisim-' + calls.auth.length, expires_in: 3600 }) };
    }
    calls.send.push({ url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) });
    const next = plan.shift() || { status: 200 };
    return { ok: next.status === 200, status: next.status, json: async () => next.body || {} };
  };
  return { fetchFn, calls, plan };
}

describe('FCM göndericisi', () => {
  let google;
  beforeEach(() => { fcm._reset(); google = fakeGoogle(); fcm._setFetch(google.fetchFn); });

  test('yapılandırma dosyası varsa hazır, yoksa değil', () => {
    expect(fcm.configured()).toBe(true);
    fcm._reset(); const saved = process.env.FCM_SERVICE_ACCOUNT_FILE; delete process.env.FCM_SERVICE_ACCOUNT_FILE;
    expect(fcm.configured()).toBe(false);
    process.env.FCM_SERVICE_ACCOUNT_FILE = saved; fcm._reset();
    expect(fcm.configured()).toBe(true);
  });

  test('erişim anahtarı RS256 ile doğru imzalanır, süresi dolana dek önbellekten gelir', async () => {
    expect((await fcm.send(TOKEN_A, { title: 'Başlık', body: 'Metin' })).ok).toBe(true);
    expect((await fcm.send(TOKEN_B, { title: 'Başlık', body: 'Metin' })).ok).toBe(true);
    expect(google.calls.auth).toHaveLength(1);
    const auth = google.calls.auth[0];
    expect(auth.valid).toBe(true);
    expect(auth.header.alg).toBe('RS256');
    expect(auth.claims.iss).toBe('sender@veniux-test.iam.gserviceaccount.com');
    expect(auth.claims.scope).toBe('https://www.googleapis.com/auth/firebase.messaging');
    expect(auth.claims.exp - auth.claims.iat).toBe(3600);
    expect(google.calls.send[0].auth).toBe('Bearer erisim-1');
  });

  test('bildirim gövdesi: kanal, öncelik, veri ve proje adresi', async () => {
    await fcm.send(TOKEN_A, { title: 'Kritik stok uyarısı', body: 'Süt 1L: 0 kaldı', url: '/m/bildirimler', tag: 'alerts' });
    const sent = google.calls.send[0];
    expect(sent.url).toBe('https://fcm.googleapis.com/v1/projects/veniux-test/messages:send');
    expect(sent.body.message.token).toBe(TOKEN_A);
    expect(sent.body.message.notification).toEqual({ title: 'Kritik stok uyarısı', body: 'Süt 1L: 0 kaldı' });
    expect(sent.body.message.data).toEqual({ url: '/m/bildirimler', tag: 'alerts' });
    expect(sent.body.message.android.priority).toBe('HIGH');
    expect(sent.body.message.android.notification.channel_id).toBe('veniux-alerts');
  });

  test('hata sınıfları: geçersiz token silinir, yetki hatası yapılandırma, 5xx geçici', async () => {
    google.plan.push({ status: 404, body: { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } } });
    expect(await fcm.send(TOKEN_A, {})).toEqual({ ok: false, gone: true });
    google.plan.push({ status: 400, body: { error: { status: 'INVALID_ARGUMENT' } } });
    expect((await fcm.send(TOKEN_A, {})).gone).toBe(true);
    google.plan.push({ status: 403, body: { error: { status: 'PERMISSION_DENIED' } } });
    expect((await fcm.send(TOKEN_A, {})).config).toBe(true);
    google.plan.push({ status: 503, body: {} });
    expect((await fcm.send(TOKEN_A, {})).transient).toBe(true);
    expect((await fcm.send('kisa', {})).gone).toBe(true);
    expect(google.calls.send).toHaveLength(4);
  });
});

describe('FCM abonelik uçları ve gönderim', () => {
  let google, tenant, admin, auth, other;
  beforeAll(async () => {
    tenant = await createTenant();
    admin = await createUser(tenant.tenantId, 'admin');
    other = await createUser(tenant.tenantId, 'admin');
    auth = who => ({ Authorization: 'Bearer ' + jwt.sign({ userId: who.id, tenantId: tenant.tenantId, role: 'admin' }, JWT_SECRET) });
  });
  beforeEach(() => { fcm._reset(); google = fakeGoogle(); fcm._setFetch(google.fetchFn); });
  const rows = async () => (await db.query('SELECT user_id,endpoint FROM push_subscriptions WHERE tenant_id=$1 ORDER BY endpoint', [tenant.tenantId])).rows;

  test('durum ucu, kayıt, tekrar kayıt (güncelleme), geçersiz token ve silme', async () => {
    expect((await request(app).get('/api/push/fcm').set(auth(admin))).body.configured).toBe(true);
    const first = await request(app).post('/api/push/fcm').set(auth(admin)).send({ token: TOKEN_A });
    expect(first.status).toBe(200);
    expect(first.body.updated).toBe(false);
    expect((await request(app).post('/api/push/fcm').set(auth(admin)).send({ token: TOKEN_A })).body.updated).toBe(true);
    expect((await request(app).post('/api/push/fcm').set(auth(admin)).send({ token: 'kisa' })).status).toBe(400);
    expect((await request(app).post('/api/push/fcm').send({ token: TOKEN_B })).status).toBeGreaterThanOrEqual(401);
    expect((await rows()).map(r => r.endpoint)).toEqual(['fcm:' + TOKEN_A]);
    expect((await request(app).delete('/api/push/fcm').set(auth(admin)).send({ token: TOKEN_A })).body.removed).toBe(1);
    expect(await rows()).toHaveLength(0);
  });

  test('işletme yöneticilerine gider; geçersiz token silinir, yapılandırma hatasında kayıt korunur', async () => {
    await request(app).post('/api/push/fcm').set(auth(admin)).send({ token: TOKEN_A });
    await request(app).post('/api/push/fcm').set(auth(other)).send({ token: TOKEN_B });
    const ok = await push.notifyTenant(tenant.tenantId, { title: 'T', body: 'B', url: '/m', tag: 'x' });
    expect(ok.sent).toBe(2);
    expect(google.calls.send.map(c => c.body.message.token).sort()).toEqual([TOKEN_A, TOKEN_B].sort());

    google.plan.push({ status: 404, body: { error: { details: [{ errorCode: 'UNREGISTERED' }] } } });
    const gone = await push.notifyTenant(tenant.tenantId, { title: 'T', body: 'B' });
    expect(gone.removed).toBe(1);
    expect(await rows()).toHaveLength(1);

    google.plan.push({ status: 401, body: {} });
    await push.notifyTenant(tenant.tenantId, { title: 'T', body: 'B' });
    expect(await rows()).toHaveLength(1);
    const kept = (await db.query('SELECT failures FROM push_subscriptions WHERE tenant_id=$1', [tenant.tenantId])).rows[0];
    expect(Number(kept.failures)).toBe(0);
  });

  test('yeni stok uyarısı özeti: tek uyarı metni, çoklu uyarı sayısı; kritik başlığı', async () => {
    await request(app).post('/api/push/fcm').set(auth(admin)).send({ token: TOKEN_A });
    await push.flushAlerts(tenant.tenantId, [{ text: 'Süt 1L: Merkez deposunda 0 kaldı.', severity: 'critical' }]);
    let sent = google.calls.send.pop().body.message.notification;
    expect(sent.title).toBe('Kritik stok uyarısı');
    expect(sent.body).toBe('Süt 1L: Merkez deposunda 0 kaldı.');
    await push.flushAlerts(tenant.tenantId, [{ text: 'Un: depo 3 kaldı.', severity: 'warning' }, { text: 'Şeker: depo 2 kaldı.', severity: 'warning' }, { text: 'Yağ: depo 1 kaldı.', severity: 'warning' }]);
    sent = google.calls.send.pop().body.message.notification;
    expect(sent.title).toBe('Stok uyarısı');
    expect(sent.body).toBe('3 yeni stok uyarısı: Un, Şeker…');
  });
});
