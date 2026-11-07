const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories');

const auth = user => ({ Authorization: 'Bearer ' + user.token });
let first, second;

beforeAll(async () => {
  first = await createTenant();
  second = await createTenant();
});

test('dashboard does not show another tenant products', async () => {
  const sku = 'GIZLI-' + Date.now();
  const made = await request(app).post('/api/products').set(auth(first)).send({ sku, name: 'Gizli urun', min_stock_level: 5, unit: 'adet', module_type: 'NORMAL', purchase_price: 1, sale_price: 2 });
  expect(made.status).toBeLessThan(300);
  const own = await request(app).get('/api/stock/dashboard-metrics').set(auth(first));
  expect(own.status).toBe(200);
  expect(JSON.stringify(own.body)).toContain(sku);
  for (const path of ['/api/stock/dashboard-metrics', '/api/stock/analytics']) {
    const other = await request(app).get(path).set(auth(second));
    expect(other.status).toBe(200);
    expect(JSON.stringify(other.body)).not.toContain(sku);
  }
});

test('email change requires the current password', async () => {
  const email = 'yeni' + Date.now() + '@example.com';
  const refused = await request(app).put('/api/settings/account').set(auth(second)).send({ email });
  expect(refused.status).toBe(400);
  const account = await request(app).get('/api/settings/account').set(auth(second));
  expect(account.body.email).not.toBe(email);
  const sameEmail = await request(app).put('/api/settings/account').set(auth(second)).send({ email: account.body.email, fullName: 'Ad Soyad' });
  expect(sameEmail.status).toBe(200);
});
