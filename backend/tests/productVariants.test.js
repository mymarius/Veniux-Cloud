const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');
const { ean13 } = require('../src/services/productVariantService');

describe('Varyantlı ürün oluşturma', () => {
  let token;
  beforeAll(async () => { token = (await createTenant()).token; });
  const post = body => request(app).post('/api/products/variants').set('Authorization', `Bearer ${token}`).send(body);

  it('beden × renk kombinasyonlarını ayrı ürün olarak açar, barkodlar geçerli ve benzersizdir', async () => {
    const res = await post({ name: 'Tişört', sku_prefix: 'ts', sizes: 'S, M, L', colors: ['Kırmızı', 'Mavi'], sale_price: 199.9, purchase_price: 90 });
    expect(res.statusCode).toBe(201);
    expect(res.body.created).toHaveLength(6);
    const codes = res.body.created.map(c => c.barcode);
    expect(new Set(codes).size).toBe(6);
    for (const c of codes) { expect(c).toMatch(/^29\d{11}$/); expect(ean13(c.slice(0, 12))).toBe(c); }
    expect(res.body.created[0].sku).toBe('TS-S-KIRMIZI');
    expect(res.body.created[0].name).toBe('Tişört · S · Kırmızı');
    const list = await request(app).get('/api/products?search=Tişört').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(list.body)).toContain('TS-M-MAVI');
  });

  it('aynı stok kodu varsa atlar, çift kayıt açmaz', async () => {
    const res = await post({ name: 'Tişört', sku_prefix: 'TS', sizes: ['S', 'XL'], colors: ['Kırmızı'] });
    expect(res.statusCode).toBe(201);
    expect(res.body.skipped).toEqual(['TS-S-KIRMIZI']);
    expect(res.body.created.map(c => c.sku)).toEqual(['TS-XL-KIRMIZI']);
  });

  it('eksik veya fazla girişi reddeder', async () => {
    expect((await post({ name: '', sku_prefix: 'A', sizes: 'S' })).statusCode).toBe(400);
    expect((await post({ name: 'A', sku_prefix: 'A' })).statusCode).toBe(400);
    const many = Array.from({ length: 13 }, (_, i) => 'B' + i), many2 = Array.from({ length: 10 }, (_, i) => 'C' + i);
    expect((await post({ name: 'A', sku_prefix: 'A', sizes: many, colors: many2 })).statusCode).toBe(400);
  });

  it('kasiyer varyant oluşturamaz', async () => {
    const res = await request(app).post('/api/products/variants').send({ name: 'A', sku_prefix: 'A', sizes: 'S' });
    expect(res.statusCode).toBe(401);
  });
});
