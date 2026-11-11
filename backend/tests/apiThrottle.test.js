process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_THROTTLE_TEST = '1';
process.env.API_THROTTLE_ANON_MAX = '5';
process.env.API_THROTTLE_AUTH_MAX = '8';
const request = require('supertest');
const app = require('../src/index');
const apiThrottle = require('../src/middlewares/apiThrottle');

describe('genel API hız sınırı', () => {
  beforeEach(() => apiThrottle.reset());

  test('kimliksiz istekler IP başına sınırı aşınca 429 ve Retry-After alır', async () => {
    for (let i = 0; i < 5; i++) expect((await request(app).get('/api/public/prices')).status).toBe(200);
    const blocked = await request(app).get('/api/public/prices');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('oturumlu istekler kendi sayaçlarını kullanır; bir oturumun sınırı diğerini kapatmaz', async () => {
    const tokenA = 'a'.repeat(40), tokenB = 'b'.repeat(40);
    const call = token => request(app).get('/api/public/prices').set('Authorization', 'Bearer ' + token);
    for (let i = 0; i < 8; i++) expect((await call(tokenA)).status).not.toBe(429);
    expect((await call(tokenA)).status).toBe(429);
    expect((await call(tokenB)).status).not.toBe(429);
  });

  test('yerel vekilin arkasında her istemci kendi IP sayacını kullanır (en sağdaki X-Forwarded-For girdisi)', async () => {
    const call = ip => request(app).get('/api/public/prices').set('X-Forwarded-For', '198.51.100.99, ' + ip);
    for (let i = 0; i < 5; i++) expect((await call('203.0.113.1')).status).toBe(200);
    expect((await call('203.0.113.1')).status).toBe(429);
    expect((await call('203.0.113.2')).status).toBe(200);
  });

  test('OPTIONS ön kontrol istekleri sayılmaz', async () => {
    for (let i = 0; i < 12; i++) expect((await request(app).options('/api/public/prices')).status).not.toBe(429);
  });
});
