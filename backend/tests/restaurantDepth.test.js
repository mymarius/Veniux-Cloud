process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');

// Pide/restoran derinleştirme: ürün seçenekleri, çok katlı reçete, ikram/indirim/servis, masa taşıma/birleştirme,
// hesap bölme ve paket servis bilgisi.
let owner, other, w, manager, waiter;
const as = who => ({
  get: (url, q) => request(app).get('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).query(q || {}),
  post: (url, body) => request(app).post('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  put: (url, body) => request(app).put('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  patch: (url, body) => request(app).patch('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  del: url => request(app).delete('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token)
});
const product = async (tenant, sku, name, price = 10, unit = 'adet') => (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,$3,$4,$5,$6,'NORMAL') RETURNING *", [tenant, sku, name, sku, unit, price])).rows[0];
const stock = (tenant, productId, q) => db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [tenant, w.id, productId, q]);
const qty = async productId => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [productId])).rows[0].q);
let pide, ayran, kasar, hamur, un, t1, t2, t3;

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  w = await createWarehouse(owner.tenantId);
  for (const t of [owner.tenantId, other.tenantId]) await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'restaurant')", [t]);
  const m = await createUser(owner.tenantId, 'manager'), c = await createUser(owner.tenantId, 'cashier');
  manager = { token: jwt.sign({ userId: m.id, tenantId: owner.tenantId, role: 'manager' }, JWT_SECRET) };
  waiter = { token: jwt.sign({ userId: c.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
  pide = await product(owner.tenantId, 'PIDE', 'Kıymalı pide', 100);
  ayran = await product(owner.tenantId, 'AYRAN', 'Ayran', 20);
  kasar = await product(owner.tenantId, 'KASAR', 'Kaşar', 0, 'kg');
  hamur = await product(owner.tenantId, 'HAMUR', 'Pide hamuru', 0);
  un = await product(owner.tenantId, 'UN', 'Un', 0, 'kg');
  await stock(owner.tenantId, kasar.id, 5); await stock(owner.tenantId, un.id, 10); await stock(owner.tenantId, ayran.id, 50);
  // Çok katlı reçete: pide -> 1 hamur -> 0,2 kg un
  expect((await as(manager).put('/recipes/' + pide.id, { ingredients: [{ ingredient_id: hamur.id, quantity: 1 }] })).status).toBe(200);
  expect((await as(manager).put('/recipes/' + hamur.id, { ingredients: [{ ingredient_id: un.id, quantity: 0.2 }] })).status).toBe(200);
  t1 = (await as(manager).post('/tables', { name: 'D1' })).body; t2 = (await as(manager).post('/tables', { name: 'D2' })).body; t3 = (await as(manager).post('/tables', { name: 'D3' })).body;
});

const order = (table, items) => as(waiter).post('/orders', { order_type: 'masa', table_id: table.id, warehouse_id: w.id, items });
const findOrder = async id => (await as(waiter).get('/orders')).body.items.find(o => o.id === id);

test('ürün seçenekleri: yalnız yönetici tanımlar, fiyat sunucudan gelir, malzeme stoktan düşer', async () => {
  expect((await as(waiter).put(`/menu/${pide.id}/options`, { options: [{ name: 'Kaşarlı', price: 20 }] })).status).toBe(403);
  expect((await as(manager).put(`/menu/${pide.id}/options`, { options: [{ name: 'Kaşarlı', price: 20 }, { name: 'kaşarlı', price: 5 }] })).status).toBe(400);
  const set = await as(manager).put(`/menu/${pide.id}/options`, { options: [{ name: 'Kaşarlı', price: 20, ingredient_id: kasar.id, ingredient_qty: 0.1 }, { name: 'Acılı', price: 0 }] });
  expect(set.status).toBe(200);
  const menu = (await as(waiter).get('/menu')).body.items.find(i => i.id === pide.id);
  expect(menu.options).toEqual([{ name: 'Kaşarlı', price: 20 }, { name: 'Acılı', price: 0 }]);
  expect(menu.options[0].ingredient_id).toBeUndefined();
  expect((await order(t1, [{ product_id: pide.id, quantity: 1, options: ['Peynirli'] }])).status).toBe(400);
  const r = await order(t1, [{ product_id: pide.id, quantity: 2, options: ['Kaşarlı', 'Acılı'] }]);
  expect(r.status).toBe(201);
  expect(r.body.total).toBe(240); // 2 x (100 + 20)
  expect(await qty(kasar.id)).toBeCloseTo(4.8, 6); // 2 x 0,1 kg
  expect(await qty(un.id)).toBeCloseTo(9.6, 6); // çok katlı reçete: 2 hamur x 0,2 kg
  const o = await findOrder(r.body.order_id);
  expect(o.items[0].options).toEqual([{ name: 'Kaşarlı', price: 20 }, { name: 'Acılı', price: 0 }]);
  // İptal seçenek malzemesini ve alt reçeteyi geri verir.
  const cancel = await as(waiter).patch(`/orders/${r.body.order_id}/items/${r.body.items[0].id}`, { status: 'cancelled' });
  expect(cancel.status).toBe(200);
  expect(await qty(kasar.id)).toBeCloseTo(5, 6);
  expect(await qty(un.id)).toBeCloseTo(10, 6);
  await as(waiter).post(`/orders/${r.body.order_id}/close`, { payment_method: 'cash' });
});

test('reçete döngüsü reddedilir', async () => {
  await as(manager).put('/recipes/' + un.id, { ingredients: [{ ingredient_id: pide.id, quantity: 1 }] });
  const r = await order(t2, [{ product_id: pide.id, quantity: 1 }]);
  expect(r.status).toBe(409);
  await as(manager).put('/recipes/' + un.id, { ingredients: [] });
});

test('ikram, indirim ve servis ücreti: yalnız yönetici, açıklama zorunlu, toplam doğru hesaplanır', async () => {
  const r = await order(t2, [{ product_id: pide.id, quantity: 1 }, { product_id: ayran.id, quantity: 2 }]); // 100 + 40
  const id = r.body.order_id, ayranItem = r.body.items[1].id;
  expect((await as(waiter).post(`/orders/${id}/adjustments`, { kind: 'discount', percent: 10, reason: 'x' })).status).toBe(403);
  expect((await as(manager).post(`/orders/${id}/adjustments`, { kind: 'comp', item_id: ayranItem })).status).toBe(400);
  const comp = await as(manager).post(`/orders/${id}/adjustments`, { kind: 'comp', item_id: ayranItem, reason: 'Sürekli müşteri' });
  expect(comp.body).toMatchObject({ gross: 140, comp: 40, total: 100 });
  expect((await as(manager).post(`/orders/${id}/adjustments`, { kind: 'comp', item_id: ayranItem, reason: 'tekrar' })).status).toBe(409);
  const disc = await as(manager).post(`/orders/${id}/adjustments`, { kind: 'discount', percent: 10, reason: 'Kampanya' });
  expect(disc.body).toMatchObject({ discount: 10, total: 90 });
  const service = await as(manager).post(`/orders/${id}/adjustments`, { kind: 'service', percent: 10 });
  expect(service.body).toMatchObject({ service: 9, total: 99 });
  expect((await as(manager).post(`/orders/${id}/adjustments`, { kind: 'service', percent: 50 })).status).toBe(400);
  const o = await findOrder(id);
  expect(o.total).toBe(99);
  expect(o.comped).toEqual([ayranItem]);
  expect(o.adjustments.map(a => a.kind)).toEqual(['comp', 'discount', 'service']);
  // Düzeltmeyi kaldırmak toplamı geri alır; tüm işlemler denetim kaydına yazılır.
  const removed = await as(manager).del(`/orders/${id}/adjustments/${service.body.id}`);
  expect(removed.body.total).toBe(90);
  const audits = (await db.query("SELECT action FROM audit_logs WHERE tenant_id=$1 AND entity_type='restaurant_order' AND entity_id=$2 ORDER BY id", [owner.tenantId, id])).rows.map(r => r.action);
  expect(audits).toEqual(['restaurant.comp', 'restaurant.discount', 'restaurant.service', 'restaurant.adjustment_removed']);
  // Tutar indirimi adisyonu eksiye düşüremez.
  expect((await as(manager).post(`/orders/${id}/adjustments`, { kind: 'discount', amount: 500, reason: 'hata' })).body.total).toBe(0);
  await as(manager).post(`/orders/${id}/close`, { payment_method: 'cash' });
});

test('masa taşıma boş masaya; dolu masaya birleştirme; başka işletme erişemez', async () => {
  const a = await order(t1, [{ product_id: ayran.id, quantity: 1 }]);
  const moved = await as(waiter).post(`/orders/${a.body.order_id}/move`, { table_id: t3.id });
  expect(moved.body).toMatchObject({ table: 'D3' });
  const b = await order(t1, [{ product_id: ayran.id, quantity: 2 }]);
  expect((await as(waiter).post(`/orders/${b.body.order_id}/move`, { table_id: t3.id })).status).toBe(409);
  const merged = await as(waiter).post(`/orders/${b.body.order_id}/merge`, { target_order_id: a.body.order_id });
  expect(merged.body).toMatchObject({ order_id: a.body.order_id, total: 60 });
  const tables = (await as(waiter).get('/tables')).body.items;
  expect(tables.find(t => t.id === t1.id).open_order_id).toBeNull();
  expect(tables.find(t => t.id === t3.id).open_total).toBe(60);
  const outsider = { token: other.token };
  expect((await as(outsider).post(`/orders/${a.body.order_id}/move`, { table_id: t2.id })).status).toBe(404);
  await as(waiter).post(`/orders/${a.body.order_id}/close`, { payment_method: 'card' });
});

test('hesap bölme: seçilen kalemler ayrı ödenir, kalan masada açık kalır', async () => {
  const r = await order(t1, [{ product_id: pide.id, quantity: 1 }, { product_id: ayran.id, quantity: 1 }, { product_id: ayran.id, quantity: 1 }]);
  const id = r.body.order_id, [p, a1] = r.body.items;
  expect((await as(waiter).post(`/orders/${id}/pay-items`, { item_ids: r.body.items.map(i => i.id), payment_method: 'cash' })).status).toBe(400);
  expect((await as(waiter).post(`/orders/${id}/pay-items`, { item_ids: [a1.id], payments: { cash: 5, card: 5 } })).status).toBe(400);
  const paid = await as(waiter).post(`/orders/${id}/pay-items`, { item_ids: [p.id, a1.id], payment_method: 'card' });
  expect(paid.status).toBe(200);
  expect(paid.body).toMatchObject({ total: 120, card: 120, split_from: id, remaining_total: 20 });
  const open = await findOrder(id);
  expect(open.items.map(i => i.name)).toEqual(['Ayran']);
  // İndirimli adisyon bölünmez (indirimin hangi kısma düşeceği belirsiz).
  await as(manager).post(`/orders/${id}/adjustments`, { kind: 'discount', amount: 5, reason: 'x' });
  expect((await as(waiter).post(`/orders/${id}/pay-items`, { item_ids: [open.items[0].id], payment_method: 'cash' })).status).toBe(409);
  await as(waiter).post(`/orders/${id}/close`, { payment_method: 'cash' });
});

test('paket servis: müşteri ve adres bilgisi, motor için adres zorunlu, teslim edilmeyen önce listelenir', async () => {
  const p = await as(waiter).post('/orders', { order_type: 'paket', warehouse_id: w.id, items: [{ product_id: ayran.id, quantity: 1 }] });
  const m = await as(waiter).post('/orders', { order_type: 'motor', warehouse_id: w.id, items: [{ product_id: ayran.id, quantity: 1 }] });
  expect((await as(waiter).put(`/orders/${m.body.order_id}/delivery`, { customer_name: 'Ali', phone: '0555 111 22 33' })).status).toBe(400);
  expect((await as(waiter).put(`/orders/${m.body.order_id}/delivery`, { address: 'Ev', phone: 'abc' })).status).toBe(400);
  expect((await as(waiter).put(`/orders/${m.body.order_id}/delivery`, { customer_name: 'Ali <b>', phone: '0555 111 22 33', address: 'Cumhuriyet Mah. 5/2', courier: 'Mehmet', status: 'on_way' })).body).toMatchObject({ customer_name: 'Ali b', status: 'on_way' });
  await as(waiter).put(`/orders/${p.body.order_id}/delivery`, { customer_name: 'Ayşe', status: 'delivered' });
  const t = await order(t2, [{ product_id: ayran.id, quantity: 1 }]);
  expect((await as(waiter).put(`/orders/${t.body.order_id}/delivery`, { address: 'x' })).status).toBe(400);
  const list = (await as(waiter).get('/deliveries')).body.items;
  expect(list.map(o => o.id)).toEqual([m.body.order_id, p.body.order_id]);
  expect(list[0].delivery).toMatchObject({ courier: 'Mehmet', address: 'Cumhuriyet Mah. 5/2' });
});

test('gün sonu ürün cirosu seçenek fiyatlarını içerir, ikram kalemi adette sayılır ama ciroya girmez', async () => {
  const before = (await as(manager).get('/summary')).body.products;
  const was = id => before.find(p => p.product_id === id) || { quantity: 0, revenue: 0 };
  const pideWas = was(pide.id), ayranWas = was(ayran.id);
  const r = await order(t3, [{ product_id: pide.id, quantity: 1, options: ['Kaşarlı'] }, { product_id: ayran.id, quantity: 1 }]);
  await as(manager).post(`/orders/${r.body.order_id}/adjustments`, { kind: 'comp', item_id: r.body.items[1].id, reason: 'ikram' });
  await as(waiter).post(`/orders/${r.body.order_id}/close`, { payment_method: 'cash' });
  const after = (await as(manager).get('/summary')).body.products;
  const pideNow = after.find(p => p.product_id === pide.id), ayranNow = after.find(p => p.product_id === ayran.id);
  expect(pideNow.revenue - pideWas.revenue).toBe(120);
  expect(ayranNow.quantity - ayranWas.quantity).toBe(1);
  expect(ayranNow.revenue - ayranWas.revenue).toBe(0);
});
