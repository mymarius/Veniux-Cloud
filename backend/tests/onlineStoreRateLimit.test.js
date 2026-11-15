process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.SHOP_READ_MAX = '4'; process.env.SHOP_ORDER_MINUTE_MAX = '2'; process.env.SHOP_ORDER_HOUR_MAX = '100';
const request = require('supertest');
const app = require('../src/index');

// Herkese açık vitrin uçları istek sınırlıdır: sipariş dakikada 2 (burada), katalog dakikada 4 (burada; üretimde 120 ve 5).
test('sipariş ucu dakikalık sınıra takılır ve 429 RATE_LIMIT döner', async () => {
  const send = () => request(app).post('/api/public/shop/olmayan-magaza/orders').set('Idempotency-Key', 'rate-limit-test-1').send({});
  expect((await send()).status).toBe(404);
  expect((await send()).status).toBe(404);
  const third = await send();
  expect(third.status).toBe(429);
  expect(third.body.code).toBe('RATE_LIMIT');
});

test('katalog okuma ucu da sınırlıdır', async () => {
  const get = () => request(app).get('/api/public/shop/olmayan-magaza/products');
  for (let i = 0; i < 4; i += 1) expect((await get()).status).toBe(404);
  expect((await get()).status).toBe(429);
});
