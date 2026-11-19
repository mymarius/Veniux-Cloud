const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
let owner;
const add = async (category, name) => (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,category,module_type) VALUES($1,$2,$3,$4,'adet',10,$5,'NORMAL') RETURNING id", [owner.tenantId, 'CT-' + crypto.randomUUID(), 'CT-' + crypto.randomUUID(), name, category])).rows[0];
const list = category => request(app).get('/api/products').query({ category }).set('Authorization', 'Bearer ' + owner.token);
beforeAll(async () => { owner = await f.createTenant(); });

test('üst grup seçilince alt grup ürünleri de gelir; benzer adlı başka grup gelmez', async () => {
  await add('İçecek', 'Su');
  await add('İçecek › Gazlı', 'Kola');
  await add('İçecekler', 'Başka');
  await add('Gıda › Makarna', 'Spagetti');
  const res = await list('İçecek');
  const names = (res.body.products || res.body).map(p => p.name).sort();
  expect(names).toEqual(['Kola', 'Su']);
});

test('alt grup yalnız kendi ürünlerini getirir; özel karakterler joker sayılmaz', async () => {
  const sub = await list('İçecek › Gazlı');
  expect((sub.body.products || sub.body).map(p => p.name)).toEqual(['Kola']);
  await add('100%_özel', 'Yüzde');
  expect((await list('%')).body.products?.length ?? (await list('%')).body.length).toBe(0);
  expect(((await list('100%_özel')).body.products || (await list('100%_özel')).body).map(p => p.name)).toEqual(['Yüzde']);
});
