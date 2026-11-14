process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');

// Hırdavat derinleştirme: Türkçe karaktersiz arama, toplu zam, kritik stoktan satın alma taslağı, muadil ve ayrıntılı ölçü.
let owner, w, cashier, sup, dubel, dubel2, civata, vida;
const call = (who, method, url, body, key) => { const r = request(app)[method]('/api/sector/hardware' + url).set('Authorization', 'Bearer ' + who.token); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
const product = async (sku, name, price, extra = {}) => {
  const p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,purchase_price,category,min_stock_level,supplier_id,module_type) VALUES($1,$2,$3,$4,'adet',$5,$6,$7,$8,$9,'NORMAL') RETURNING *", [owner.tenantId, sku, name, sku, price, price / 2, extra.category || 'Bağlantı', extra.min ?? 0, extra.supplier ?? null])).rows[0];
  if (extra.stock !== undefined) await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [owner.tenantId, w.id, p.id, extra.stock]);
  return p;
};
const attr = (id, body) => call(owner, 'put', `/products/${id}/attributes`, body);

beforeAll(async () => {
  owner = await createTenant();
  w = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [w.id]);
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'hardware')", [owner.tenantId]);
  const c = await createUser(owner.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: c.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
  sup = (await db.query("INSERT INTO suppliers (tenant_id,name,phone) VALUES ($1,'Usta Toptan','05550000000') RETURNING id", [owner.tenantId])).rows[0];
  dubel = await product('D8', 'Dübel 8 mm', 0.8, { stock: 0, min: 100, supplier: sup.id });
  dubel2 = await product('D8B', 'Fischer dübel 8', 1.1, { stock: 300 });
  civata = await product('C10', 'Cıvata M10 çinko', 4, { stock: 20, min: 50, supplier: sup.id, category: 'Cıvata' });
  vida = await product('V4', 'Vida M4x30', 2, { stock: 5, min: 10 });
});

test('Türkçe karaktersiz arama: "dubel" Dübeli, "civata" Cıvatayı bulur', async () => {
  const names = async q => (await call(owner, 'get', '/search?q=' + encodeURIComponent(q))).body.items.map(i => i.name).sort();
  expect(await names('dubel 8')).toEqual(['Dübel 8 mm', 'Fischer dübel 8']);
  expect(await names('civata m10')).toEqual(['Cıvata M10 çinko']);
  expect(await names('CINKO')).toEqual(['Cıvata M10 çinko']);
  expect(await names('dübel 8 numarali')).toEqual(['Dübel 8 mm', 'Fischer dübel 8']);
});

test('ayrıntılı ölçü ve muadil: aynı muadil grubundaki stoklu ürün önerilir; malzemeye göre daraltılır', async () => {
  expect((await attr(dubel.id, { size: '8 mm', diameter: '8 mm', length: '40 mm', material: 'Naylon', equiv: 'DUBEL-8' })).status).toBe(200);
  await attr(dubel2.id, { size: '8 mm', material: 'Naylon', equiv: 'DUBEL-8' });
  await attr(civata.id, { size: 'M10', material: 'Çelik', finish: 'Çinko' });
  expect((await call(cashier, 'put', `/products/${dubel.id}/attributes`, { material: 'x' })).status).toBe(403);
  const hit = (await call(owner, 'get', '/search?q=D8')).body.items.find(i => i.id === dubel.id);
  expect(hit.details).toMatchObject({ diameter: '8 mm', length: '40 mm', material: 'Naylon', equiv: 'DUBEL-8' });
  expect(hit.equivalents).toEqual([{ id: dubel2.id, name: 'Fischer dübel 8', sale_price: 1.1, stock: 300, unit: 'adet' }]);
  const steel = (await call(owner, 'get', '/search?material=Çelik')).body.items.map(i => i.name);
  expect(steel).toEqual(['Cıvata M10 çinko']);
  const facets = (await call(owner, 'get', '/facets?q=')).body;
  expect(facets.materials.map(m => m.value).sort()).toEqual(['Naylon', 'Çelik']);
  expect(facets.finishes).toEqual([{ value: 'Çinko', count: 1 }]);
});

test('toplu zam: önizleme değiştirmez, onay sayısı tutmalı, yuvarlar, koli fiyatını da günceller, kasiyer yapamaz', async () => {
  await request(app).put(`/api/sector/hardware/products/${dubel.id}/units`).set('Authorization', 'Bearer ' + owner.token).send({ units: [{ unit: 'paket', factor: 100, price: '70' }] });
  expect((await call(cashier, 'post', '/prices/bulk', { category: 'Bağlantı', percent: 10 })).status).toBe(403);
  expect((await call(owner, 'post', '/prices/bulk', { percent: 10 })).status).toBe(400);
  expect((await call(owner, 'post', '/prices/bulk', { category: 'Bağlantı', percent: 10, amount: 1 })).status).toBe(400);
  const preview = await call(owner, 'post', '/prices/bulk', { category: 'Bağlantı', percent: 12, rounding: 0.05 });
  expect(preview.body).toMatchObject({ preview: true, matched: 3, changed: 3 });
  expect(preview.body.items.find(i => i.id === dubel.id)).toMatchObject({ before: 0.8, after: 0.9 });
  expect(Number((await db.query('SELECT sale_price FROM products WHERE id=$1', [dubel.id])).rows[0].sale_price)).toBe(0.8);
  expect((await call(owner, 'post', '/prices/bulk', { category: 'Bağlantı', percent: 12, rounding: 0.05, apply: true, expected_count: 2 })).status).toBe(409);
  const done = await call(owner, 'post', '/prices/bulk', { category: 'Bağlantı', percent: 12, rounding: 0.05, apply: true, expected_count: 3 });
  expect(done.body).toMatchObject({ preview: false, changed: 3 });
  const price = async id => Number((await db.query('SELECT sale_price FROM products WHERE id=$1', [id])).rows[0].sale_price);
  expect(await price(dubel.id)).toBe(0.9); expect(await price(vida.id)).toBe(2.25); expect(await price(civata.id)).toBe(4);
  expect(Number((await db.query("SELECT sale_price FROM product_unit_prices WHERE product_id=$1 AND uom_code='paket'", [dubel.id])).rows[0].sale_price)).toBe(78.4);
  const audit = (await db.query("SELECT details FROM audit_logs WHERE tenant_id=$1 AND action='hardware.bulk_price'", [owner.tenantId])).rows;
  expect(audit.length).toBe(1); expect(JSON.parse(audit[0].details).count).toBe(3);
});

test('kritik stoktan satın alma taslağı: tedarikçiye göre, asgarinin iki katına, pakete yuvarlanır; tedarikçisiz atlanır', async () => {
  expect((await call(owner, 'post', '/critical/order', { warehouse_id: w.id })).status).toBe(400);
  const r = await call(owner, 'post', '/critical/order', { warehouse_id: w.id }, 'crit-order-1');
  expect(r.status).toBe(201);
  expect(r.body.orders).toHaveLength(1);
  const lines = r.body.orders[0].lines;
  expect(lines.find(l => l.product_id === dubel.id)).toMatchObject({ quantity: 200, pack: { unit: 'paket', count: 2 } });
  expect(lines.find(l => l.product_id === civata.id)).toMatchObject({ quantity: 80, pack: null });
  expect(r.body.skipped).toEqual([{ product_id: vida.id, name: 'Vida M4x30', reason: 'Tedarikçi tanımlı değil' }]);
  const order = (await db.query('SELECT status,supplier_id FROM purchase_orders WHERE id=$1', [r.body.orders[0].order_id])).rows[0];
  expect(order).toMatchObject({ status: 'draft' });
  expect(Number((await db.query('SELECT COALESCE(SUM(quantity),0) q FROM stock_records WHERE product_id=$1', [dubel.id])).rows[0].q)).toBe(0);
  // Aynı anahtarla tekrar gönderim yeni sipariş açmaz.
  const again = await call(owner, 'post', '/critical/order', { warehouse_id: w.id }, 'crit-order-1');
  expect(again.body.orders[0].order_id).toBe(r.body.orders[0].order_id);
});
