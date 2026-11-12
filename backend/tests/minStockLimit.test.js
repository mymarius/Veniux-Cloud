process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createUser } = require('./factories');

describe('minimum stok üst sınırı', () => {
  let auth, tenant;
  beforeAll(async () => {
    tenant = await createTenant();
    const user = await createUser(tenant.tenantId, 'admin');
    auth = { Authorization: 'Bearer ' + jwt.sign({ userId: user.id, tenantId: tenant.tenantId, role: 'admin' }, JWT_SECRET) };
  });
  const make = (extra = {}) => request(app).post('/api/products').set(auth).send({ sku: 'MS-' + Date.now() + Math.floor(Math.random() * 1000), name: 'Sinir urunu', unit: 'adet', module_type: 'NORMAL', purchase_price: 1, sale_price: 2, ...extra });

  test('1.000.000 kabul edilir, bir fazlası ve eskiden geçen 10.000.000 reddedilir', async () => {
    expect((await make({ min_stock_level: 1000000 })).status).toBe(201);
    const over = await make({ min_stock_level: 1000001 });
    expect(over.status).toBe(400);
    expect(over.body.error).toMatch(/1\.000\.000/);
    expect((await make({ min_stock_level: 10000000 })).status).toBe(400);
  });

  test('negatif ve sayı olmayan değer reddedilir, sıfır ve olağan değer kabul edilir', async () => {
    expect((await make({ min_stock_level: -1 })).status).toBe(400);
    expect((await make({ min_stock_level: 'yok' })).status).toBe(400);
    expect((await make({ min_stock_level: 0 })).status).toBe(201);
    expect((await make({ min_stock_level: 25 })).status).toBe(201);
  });

  test('güncellemede de aynı sınır geçerlidir', async () => {
    const created = await make({ min_stock_level: 5 });
    expect(created.status).toBe(201);
    const put = body => request(app).put('/api/products/' + created.body.id).set(auth).send({ ...created.body, ...body });
    expect((await put({ min_stock_level: 10000000 })).status).toBe(400);
    expect((await put({ min_stock_level: 100 })).status).toBe(200);
  });
});
