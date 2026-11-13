process.env.AUTH_RATE_LIMIT_MAX = '3';
const request = require('supertest');
const app = require('../src/index');
const throttle = require('../src/services/loginThrottle');
const { createTenant, createUser } = require('./factories');

// IP sınırı: yalnız başarısız denemeler sayılır ve adres vekil başlığından (en sağdaki girdi) alınır.
describe('giriş IP sınırı', () => {
  beforeEach(() => throttle.reset());

  test('başarılı girişler sayılmaz; başarısızlar sınıra çarpar; başka istemci etkilenmez', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant.tenantId, 'admin');
    const ip = '203.0.113.50';
    const login = (email, password, address = ip) => request(app).post('/api/auth/login').set('X-Forwarded-For', address).send({ email, password });

    // 3 başarılı giriş sınırı (3) tüketmez
    for (let i = 0; i < 3; i++) expect((await login(user.email, 'password123')).status).toBe(200);
    // 3 başarısız deneme sınıra ulaşır, dördüncüsü 429
    for (let i = 0; i < 3; i++) expect((await login('yok' + i + '@example.test', 'x')).status).toBe(401);
    const blocked = await login('yok9@example.test', 'x');
    expect(blocked.status).toBe(429);
    // Başka bir istemci adresi etkilenmez
    expect((await login(user.email, 'password123', '198.51.100.20')).status).toBe(200);
  });
});
