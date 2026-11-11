process.env.AUTH_RATE_LIMIT_MAX = '1000';
// IP başına sınır (15 dakikada 10 istek) bu dosyadaki tüm istekleri sayar; hesap kilidini 3 denemede sınamak için düşürülür.
process.env.LOGIN_LOCK_MAX = '3';
const request = require('supertest');
const app = require('../src/index');
const throttle = require('../src/services/loginThrottle');
const { createTenant, createUser } = require('./factories');

describe('hesap başına giriş sınırı', () => {
  beforeEach(() => throttle.reset());

  test('sayaç birim davranışı: sınırda kilitlenir, süre dolunca açılır, başarı sıfırlar', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < throttle.MAX - 1; i++) throttle.fail('Ali@Example.test', t0 + i);
    expect(throttle.retryAfter('ali@example.test', t0 + 10)).toBe(0);
    throttle.fail('ali@example.test', t0 + 20);
    expect(throttle.retryAfter('ALI@example.test', t0 + 30)).toBeGreaterThan(0);
    expect(throttle.retryAfter('ali@example.test', t0 + throttle.WINDOW_MS + 100)).toBe(0);
    throttle.fail('b@example.test', t0);
    throttle.clear('b@example.test');
    expect(throttle.retryAfter('b@example.test', t0 + 1)).toBe(0);
  });

  test('yanlış parola sınırı aşınca doğru parola bile 429 alır; Retry-After gelir; başka hesap etkilenmez', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant.tenantId, 'admin');
    const other = await createUser(tenant.tenantId, 'admin');
    const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
    for (let i = 0; i < throttle.MAX; i++) expect((await login(user.email, 'yanlis-parola-' + i)).status).toBe(401);
    const locked = await login(user.email, 'password123');
    expect(locked.status).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await login(other.email, 'yanlis')).status).toBe(401);
  });

  test('olmayan hesapta hatalı deneme de sayılır ve aynı 401 yanıtı döner', async () => {
    const login = () => request(app).post('/api/auth/login').send({ email: 'yok-hesap@example.test', password: 'x' });
    for (let i = 0; i < throttle.MAX; i++) expect((await login()).status).toBe(401);
    expect((await login()).status).toBe(429);
  });
});
