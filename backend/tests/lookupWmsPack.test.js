const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');
let owner, other;
const get = (who, query) => request(app).get('/api/retail/lookup').query(query).set('Authorization', 'Bearer ' + who.token);

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  await createWarehouse(owner.tenantId);
  const wms = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES ($1,'WMS-PK-1','Depo Ürünü','8690000700011','adet',5,'WMS') RETURNING *", [owner.tenantId])).rows[0];
  await db.query("INSERT INTO product_uoms (tenant_id,product_id,uom_code,barcode,conversion_factor) VALUES ($1,$2,'koli','8690000700028',24)", [owner.tenantId, wms.id]);
});

test('varsayılan: depo (WMS) ürünü perakende aramasında bulunmaz', async () => {
  const r = await get(owner, { barcode: '8690000700011' });
  expect(r.status).toBe(200); expect(r.body.product).toBeNull();
  const pack = await get(owner, { barcode: '8690000700028' });
  expect(pack.body).toMatchObject({ product: null, pack: null });
});

test('any=1: depo ürününün koli barkodu ürüne ve çarpana çözülür (sayım ekranı için)', async () => {
  const pack = await get(owner, { barcode: '8690000700028', any: 1 });
  expect(pack.status).toBe(200);
  expect(pack.body).toMatchObject({ product: { name: 'Depo Ürünü' }, pack: { unit: 'koli', factor: 24 } });
  expect((await get(owner, { barcode: '8690000700011', any: 1 })).body.product).toMatchObject({ name: 'Depo Ürünü' });
  // başka işletme göremez
  expect((await get(other, { barcode: '8690000700028', any: 1 })).body).toMatchObject({ product: null, pack: null });
});
