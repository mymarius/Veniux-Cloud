process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');

// Restoran ve stok tek çatıda: menüdeki porsiyon durumu (kaç porsiyon çıkar) malzeme stoğundan hesaplanır,
// sipariş anında stok düşer ve menü anında yenilenir, iptalde geri gelir; esnaf özeti tükenenleri ve azalan malzemeyi gösterir.
let owner, w, manager, pide, hamur, un, table;
const as = who => ({
  get: (url, q) => request(app).get('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).query(q || {}),
  post: (url, body) => request(app).post('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  put: (url, body) => request(app).put('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  patch: (url, body) => request(app).patch('/api/sector/restaurant' + url).set('Authorization', 'Bearer ' + who.token).send(body)
});
const product = async (sku, name, price, extra = {}) => (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,min_stock_level,module_type) VALUES($1,$2,$3,$4,'adet',$5,$6,'NORMAL') RETURNING *", [owner.tenantId, sku, name, sku, price, extra.min || 0])).rows[0];
let wh;
const stock = (id, q) => db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [owner.tenantId, wh, id, q]);
const portions = async id => (await as(manager).get('/menu')).body.items.find(i => i.id === id);

beforeAll(async () => {
  owner = await createTenant(); w = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [w.id]);
  wh = Number((await db.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [owner.tenantId])).rows[0].id); // siparişin varsayılan deposu
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'restaurant')", [owner.tenantId]);
  const m = await createUser(owner.tenantId, 'manager');
  manager = { token: jwt.sign({ userId: m.id, tenantId: owner.tenantId, role: 'manager' }, JWT_SECRET) };
  pide = await product('SU-PIDE', 'Pide', 100); hamur = await product('SU-HAMUR', 'Hamur', 0.0001); un = await product('SU-UN', 'Un', 0.0001, { min: 3 });
  await db.query("UPDATE products SET sale_price=0 WHERE id IN ($1,$2)", [hamur.id, un.id]);
  await stock(un.id, 10); await stock(hamur.id, 4);
  await as(manager).put('/recipes/' + pide.id, { ingredients: [{ ingredient_id: hamur.id, quantity: 1 }] });
  await as(manager).put('/recipes/' + hamur.id, { ingredients: [{ ingredient_id: un.id, quantity: 2 }] });
  table = (await as(manager).post('/tables', { name: 'SU1' })).body;
});

test('menüde porsiyon sayısı çok katlı reçeteden hesaplanır (pide → hamur → 2 un; 10 un = 5 porsiyon, az kaldı)', async () => {
  const item = await portions(pide.id);
  expect(item).toMatchObject({ available: 5, stock_state: 'low' });
});

test('sipariş anında stok düşer, menü anında yenilenir; tükenince "out" olur ama sipariş yine alınır ve eksik işaretlenir', async () => {
  const o1 = await as(manager).post('/orders', { order_type: 'masa', table_id: table.id, items: [{ product_id: pide.id, quantity: 3 }] });
  expect(o1.status).toBe(201);
  expect(await portions(pide.id)).toMatchObject({ available: 2, stock_state: 'low' });
  const o2 = await as(manager).post('/orders', { order_type: 'masa', table_id: table.id, items: [{ product_id: pide.id, quantity: 3 }] });
  expect(o2.status).toBe(201);
  expect(o2.body.shortages.length).toBeGreaterThan(0);
  expect(await portions(pide.id)).toMatchObject({ available: 0, stock_state: 'out' });
});

test('esnaf özeti tükenen menü ürününü ve asgari seviyeye inen malzemeyi gösterir', async () => {
  const s = (await as(manager).get('/summary')).body;
  expect(s.stock.out.map(i => i.name)).toContain('Pide');
  expect(s.stock.ingredients_low.map(i => i.name)).toContain('Un');
});

test('kalem iptal edilince stok geri gelir ve menü yeniden "var" der', async () => {
  const orders = (await as(manager).get('/orders', { status: 'kitchen' })).body.items;
  const item = orders.flatMap(o => o.items.map(i => ({ order: o.id, id: i.id, qty: i.quantity }))).find(i => i.qty === 3);
  const r = await as(manager).patch(`/orders/${item.order}/items/${item.id}`, { status: 'cancelled' });
  expect(r.status).toBe(200);
  const back = await portions(pide.id);
  expect(back.available).toBeGreaterThan(0);
});
