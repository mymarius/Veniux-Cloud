const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');

describe('Kasiyer hareketleri', () => {
  let t;
  beforeAll(async () => { t = await createTenant(); });
  const post = (token, body) => request(app).post('/api/scanner/pos-events').set('Authorization', `Bearer ${token}`).send(body);
  const get = (token, q = '') => request(app).get('/api/scanner/pos-events' + q).set('Authorization', `Bearer ${token}`);

  it('kayıt eder ve yönetici listeler, özet kasiyer bazında', async () => {
    expect((await post(t.token, { type: 'line_removed', product: 'Süt', quantity: 2, amount: 60 })).statusCode).toBe(200);
    expect((await post(t.token, { type: 'cart_cleared', lines: 3, amount: 120 })).statusCode).toBe(200);
    expect((await post(t.token, { type: 'no_sale_exit' })).statusCode).toBe(200);
    const res = await get(t.token);
    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[2].product).toBe('Süt');
    expect(res.body.summary[0].line_removed).toBe(1);
    const only = await get(t.token, '?type=cart_cleared');
    expect(only.body.items).toHaveLength(1);
  });

  it('geçersiz tür reddedilir; metin temizlenir ve kısaltılır', async () => {
    expect((await post(t.token, { type: 'x' })).statusCode).toBe(400);
    await post(t.token, { type: 'line_removed', product: 'A'.repeat(500) + '\n' });
    const res = await get(t.token, '?type=line_removed');
    expect(res.body.items[0].product.length).toBe(120);
  });

  it('kimlik ister; başka işletmenin kaydı görünmez', async () => {
    expect((await request(app).post('/api/scanner/pos-events').send({ type: 'no_sale_exit' })).statusCode).toBe(401);
    const other = await createTenant();
    expect((await get(other.token)).body.items).toHaveLength(0);
  });
});
