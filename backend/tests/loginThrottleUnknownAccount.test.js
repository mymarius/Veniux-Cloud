process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.LOGIN_LOCK_MAX = '3';
const request = require('supertest');
const app = require('../src/index');
const throttle = require('../src/services/loginThrottle');
const ATTACKER = '203.0.113.9';

// Ayrı dosya: IP başına sınır (authLimiter) her test dosyasında ayrı sayılır.
describe('giriş sınırı: olmayan hesap', () => {
  beforeEach(() => throttle.reset());
  test('olmayan hesapta hatalı deneme de sayılır ve aynı 401 yanıtı döner', async () => {
    const login = () => request(app).post('/api/auth/login').set('X-Forwarded-For', ATTACKER).send({ email: 'yok-hesap@example.test', password: 'x' });
    for (let i = 0; i < throttle.MAX; i++) expect((await login()).status).toBe(401);
    expect((await login()).status).toBe(429);
  });
});
