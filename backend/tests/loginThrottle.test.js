process.env.AUTH_RATE_LIMIT_MAX = '1000';
// IP başına sınır (authLimiter, 15 dakikada 10 istek) bu dosyadaki tüm HTTP isteklerini sayar; bu yüzden HTTP testleri toplamda 10 isteği aşmaz.
process.env.LOGIN_LOCK_MAX = '3';
process.env.LOGIN_EMAIL_CEILING = '7';
const request = require('supertest');
const app = require('../src/index');
const throttle = require('../src/services/loginThrottle');
const { createTenant, createUser } = require('./factories');

const ATTACKER = '203.0.113.9';
const OWNER_IP = '198.51.100.7';

describe('giriş sınırı: (e-posta, istemci adresi) çifti ve e-posta tavanı', () => {
  beforeEach(() => throttle.reset());

  test('sayaç birim davranışı: çift sınırda kilitlenir, süre dolunca açılır, başarı yalnız o istemciyi sıfırlar', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < throttle.MAX - 1; i++) throttle.fail('Ali@Example.test', ATTACKER, t0 + i);
    expect(throttle.retryAfter('ali@example.test', ATTACKER, t0 + 10)).toBe(0);
    throttle.fail('ali@example.test', ATTACKER, t0 + 20);
    expect(throttle.retryAfter('ALI@example.test', ATTACKER, t0 + 30)).toBeGreaterThan(0);
    // Aynı hesap, başka istemci adresi: kilitli değil
    expect(throttle.retryAfter('ali@example.test', OWNER_IP, t0 + 30)).toBe(0);
    expect(throttle.retryAfter('ali@example.test', ATTACKER, t0 + throttle.WINDOW_MS + 100)).toBe(0);
    throttle.fail('b@example.test', OWNER_IP, t0);
    throttle.clear('b@example.test', OWNER_IP);
    expect(throttle.retryAfter('b@example.test', OWNER_IP, t0 + 1)).toBe(0);
  });

  test('e-posta tavanı: çok sayıda adresten dağıtık denemeler tavanı aşınca hesap kapanır, pencere dolunca açılır', () => {
    const t0 = 2_000_000;
    for (let i = 0; i < throttle.EMAIL_CEILING - 1; i++) throttle.fail('hedef@example.test', '10.0.0.' + i, t0 + i);
    expect(throttle.retryAfter('hedef@example.test', OWNER_IP, t0 + 100)).toBe(0);
    throttle.fail('hedef@example.test', '10.0.1.1', t0 + 200);
    expect(throttle.retryAfter('hedef@example.test', OWNER_IP, t0 + 300)).toBeGreaterThan(0);
    expect(throttle.retryAfter('hedef@example.test', OWNER_IP, t0 + throttle.WINDOW_MS + 500)).toBe(0);
  });

  test('saldırganın hatalı denemeleri hesabın gerçek sahibini kilitlemez; saldırganın kendi istemcisi kilitlenir', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant.tenantId, 'admin');
    const other = await createUser(tenant.tenantId, 'admin');
    const login = (email, password, ip) => request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, password });
    for (let i = 0; i < throttle.MAX; i++) expect((await login(user.email, 'yanlis-parola-' + i, ATTACKER)).status).toBe(401);
    const attackerLocked = await login(user.email, 'password123', ATTACKER);
    expect(attackerLocked.status).toBe(429);
    expect(Number(attackerLocked.headers['retry-after'])).toBeGreaterThan(0);
    // Gerçek sahip kendi adresinden doğru parolayla girer
    const owner = await login(user.email, 'password123', OWNER_IP);
    expect(owner.status).toBe(200);
    expect(owner.body.token).toBeTruthy();
    // Başka hesap etkilenmez
    expect((await login(other.email, 'yanlis', ATTACKER)).status).toBe(401);
  });
});
