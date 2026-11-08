const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant } = require('./factories/index');

let owner, other, warehouse;
const auth = user => ({ Authorization: 'Bearer ' + user.token });
const weightRule = { prefix: '27', length: 13, productStart: 2, productLength: 5, valueStart: 7, valueLength: 5, divisor: 1000, kind: 'weight' };
const priceRule = { ...weightRule, prefix: '28', divisor: 100, kind: 'price' };
const ean = body => { let s = 0; for (let i = body.length - 1, w = 3; i >= 0; i--, w = 4 - w) s += Number(body[i]) * w; return body + ((10 - s % 10) % 10); };
async function product(user, unit, price, name) {
  return (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES ($1,$2,$3,NULL,$4,$5,'NORMAL') RETURNING *", [user.tenantId, 'W-' + Date.now() + Math.random(), name, unit, price])).rows[0];
}
const preview = (user, barcode, weighted = [weightRule, priceRule]) => request(app).post('/api/scanner/weighted-preview').set(auth(user)).send({ barcode, weighted });

beforeAll(async () => { owner = await createTenant(); other = await createTenant(); });

test('terazi kodu ürüne verilir, baştaki sıfırlar önemsizdir, başka ürüne verilemez', async () => {
  const elma = await product(owner, 'kg', 40, 'Elma'), armut = await product(owner, 'kg', 50, 'Armut');
  expect((await request(app).put(`/api/products/${elma.id}/scale-code`).set(auth(owner)).send({ plu: '00123' })).body.plu).toBe('123');
  expect((await request(app).put(`/api/products/${armut.id}/scale-code`).set(auth(owner)).send({ plu: '123' })).status).toBe(409);
  expect((await request(app).get(`/api/products/${elma.id}/scale-code`).set(auth(owner))).body.plu).toBe('123');
  const adet = await product(owner, 'adet', 5, 'Sakız');
  expect((await request(app).put(`/api/products/${adet.id}/scale-code`).set(auth(owner)).send({ plu: '9' })).status).toBe(400);
  expect((await request(app).get(`/api/products/${elma.id}/scale-code`).set(auth(other))).status).toBe(404);
});

test('ağırlıklı ve fiyatlı etiket terazi koduyla çözülür, tutar kuruşa doğru', async () => {
  const kiyma = await product(owner, 'kg', 449.9, 'Kıyma');
  await request(app).put(`/api/products/${kiyma.id}/scale-code`).set(auth(owner)).send({ plu: '456' });
  const w = await preview(owner, ean('270045601250'));
  expect(w.status).toBe(200);
  expect(w.body.product.id).toBe(kiyma.id);
  expect(w.body.quantity).toBe(1.25);
  expect(Math.round(w.body.line_total * 100)).toBe(56238);
  const p = await preview(owner, ean('280045605624'));
  expect(p.body.line_total).toBe(56.24);
  expect(p.body.quantity).toBeCloseTo(56.24 / 449.9, 6);
});

test('kontrol hanesi hatalı, eşleşmeyen ve başka firmanın kodu', async () => {
  const bad = ean('270045601250').slice(0, 12) + '9';
  expect((await preview(owner, bad)).status).toBe(400);
  const none = await preview(owner, ean('279999901000'));
  expect(none.status).toBe(200);
  expect(none.body.product).toBe(null);
  expect(none.body.product_code).toBe('99999');
  const foreign = await preview(other, ean('270045601250'));
  expect(foreign.body.product).toBe(null);
});

test('deneme kaydedilmemiş şemayla çalışır ve ayarı değiştirmez; yetkisiz kullanıcı giremez', async () => {
  const before = (await request(app).get('/api/scanner/settings').set(auth(owner))).body.weighted;
  await preview(owner, ean('270045601250'));
  expect((await request(app).get('/api/scanner/settings').set(auth(owner))).body.weighted).toEqual(before);
  expect((await preview(owner, '123', [{ ...weightRule, divisor: 7 }])).status).toBe(400);
  await db.query("UPDATE users SET role='cashier' WHERE id=$1", [owner.userId]);
  try { expect((await preview(owner, ean('270045601250'))).status).toBe(403); }
  finally { await db.query("UPDATE users SET role='admin' WHERE id=$1", [owner.userId]); }
});

test('Digi tip 20 düzeni: fiyat kontrol hanesi atlanır, 4 haneli fiyat okunur', async () => {
  const peynir = await product(owner, 'kg', 300, 'Peynir');
  await request(app).put(`/api/products/${peynir.id}/scale-code`).set(auth(owner)).send({ plu: '789' });
  const rule = { prefix: '28', length: 13, productStart: 2, productLength: 5, valueStart: 8, valueLength: 4, divisor: 100, kind: 'price' };
  const r = await preview(owner, ean('280078971234'), [rule]);
  expect(r.status).toBe(200);
  expect(r.body.product.id).toBe(peynir.id);
  expect(r.body.line_total).toBe(12.34);
});

test('otomatik bulma: ürünle eşleşen düzenleri önerir, hiçbir şeyi kaydetmez', async () => {
  const sucuk = await product(owner, 'kg', 600, 'Sucuk');
  await request(app).put(`/api/products/${sucuk.id}/scale-code`).set(auth(owner)).send({ plu: '321' });
  const before = (await request(app).get('/api/scanner/settings').set(auth(owner))).body.weighted;
  const r = await request(app).post('/api/scanner/weighted-detect').set(auth(owner)).send({ barcode: ean('290032100750') });
  expect(r.status).toBe(200);
  const weight = r.body.candidates.find(c => c.rule.kind === 'weight' && c.product);
  expect(weight.product.id).toBe(sucuk.id);
  expect(weight.quantity).toBe(0.75);
  expect(Math.round(weight.line_total * 100)).toBe(45000);
  expect(weight.rule.prefix).toBe('29');
  expect((await request(app).get('/api/scanner/settings').set(auth(owner))).body.weighted).toEqual(before);
  const unknown = await request(app).post('/api/scanner/weighted-detect').set(auth(owner)).send({ barcode: ean('290099900750') });
  expect(unknown.body.candidates.every(c => !c.product)).toBe(true);
  expect(unknown.body.candidates.map(c => c.product_code)).toContain('00999');
  expect((await request(app).post('/api/scanner/weighted-detect').set(auth(owner)).send({ barcode: '4006381333931' })).status).toBe(400);
});
