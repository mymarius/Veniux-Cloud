process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');

// Firma ayrımı: B işletmesi (üç paket açık, yönetici) A işletmesinin ürün, takım, liste, adisyon, masa, depo kimliklerini
// tahmin ederek yeni uçlardan okumayı/değiştirmeyi dener. Hiçbiri başarılı olmamalı ve A'nın verisi değişmemeli.
let A, B, wA, wB, bossB, p, set, reg, regItem, table, order, item;
const api = (who, method, url, body, key) => { const r = request(app)[method]('/api/sector' + url).set('Authorization', 'Bearer ' + who.token); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
const bad = res => expect([400, 403, 404, 409]).toContain(res.status);
const val = async (sql, params) => (await db.query(sql, params)).rows[0];

beforeAll(async () => {
  A = await createTenant(); B = await createTenant();
  wA = await createWarehouse(A.tenantId); wB = await createWarehouse(B.tenantId);
  for (const t of [A.tenantId, B.tenantId]) { await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE tenant_id=$1", [t]); for (const pack of ['hardware', 'tableware', 'restaurant']) await db.query('INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,$2)', [t, pack]); }
  const m = await createUser(B.tenantId, 'manager');
  bossB = { token: jwt.sign({ userId: m.id, tenantId: B.tenantId, role: 'manager' }, JWT_SECRET) };
  p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,purchase_price,category,min_stock_level,module_type) VALUES($1,'A-P1','A ürünü','A-BARKOD','adet',10,5,'Gizli',50,'NORMAL') RETURNING *", [A.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [A.tenantId, wA.id, p.id]);
  set = (await api(A, 'post', '/tableware/sets', { name: 'A takımı', items: [{ product_id: p.id, quantity: 2 }] })).body;
  reg = (await api(A, 'post', '/tableware/registries', { title: 'A listesi' })).body;
  regItem = (await api(A, 'post', `/tableware/registries/${reg.id}/items`, { product_id: p.id, wanted: 3 })).body;
  table = (await api(A, 'post', '/restaurant/tables', { name: 'A masası' })).body;
  order = (await api(A, 'post', '/restaurant/orders', { order_type: 'masa', table_id: table.id, warehouse_id: wA.id, items: [{ product_id: p.id, quantity: 1 }] })).body;
  item = order.items[0];
});

test('hırdavat: B, A ürününün birimlerini okuyamaz/yazamaz; arama ve toplu zam A ürününe değmez', async () => {
  bad(await api(bossB, 'get', `/hardware/products/${p.id}/units`));
  bad(await api(bossB, 'put', `/hardware/products/${p.id}/units`, { units: [{ unit: 'koli', factor: 10, price: 1 }] }));
  bad(await api(bossB, 'put', `/hardware/products/${p.id}/attributes`, { material: 'x' }));
  expect((await api(bossB, 'get', '/hardware/search?q=A')).body.items.map(i => i.id)).not.toContain(p.id);
  const bulk = await api(bossB, 'post', '/hardware/prices/bulk', { category: 'Gizli', percent: 50, apply: true, expected_count: 1 });
  expect([400, 409]).toContain(bulk.status);
  expect(Number((await val('SELECT sale_price FROM products WHERE id=$1', [p.id])).sale_price)).toBe(10);
  const order2 = await api(bossB, 'post', '/hardware/critical/order', { warehouse_id: wA.id }, 'iso-1');
  bad(order2);
  expect(Number((await val('SELECT COUNT(*) n FROM purchase_orders WHERE tenant_id=$1', [A.tenantId])).n)).toBe(0);
});

test('züccaciye: B, A takımı, listesi, kalemi, ürünü ve deposu üzerinde işlem yapamaz', async () => {
  bad(await api(bossB, 'put', `/tableware/sets/${set.id}/sale`, { barcode: 'ISO-1', price: 1 }));
  bad(await api(bossB, 'post', '/tableware/breakage', { product_id: p.id, warehouse_id: wB.id, quantity: 1, reason: 'kirik' }));
  bad(await api(bossB, 'post', '/tableware/breakage', { product_id: p.id, warehouse_id: wA.id, quantity: 1, reason: 'kirik' }));
  expect(Number((await val('SELECT SUM(quantity) q FROM stock_records WHERE product_id=$1', [p.id])).q)).toBe(99); // 100 - A'nın hazırlıktaki kendi siparişi
  bad(await api(bossB, 'get', `/tableware/registries/${reg.id}`));
  bad(await api(bossB, 'put', `/tableware/registries/${reg.id}`, { title: 'ele geçirildi', status: 'closed' }));
  bad(await api(bossB, 'post', `/tableware/registries/${reg.id}/items`, { product_id: p.id }));
  bad(await api(bossB, 'post', `/tableware/registries/${reg.id}/items/${regItem.id}/bought`, { quantity: 1 }));
  bad(await api(bossB, 'delete', `/tableware/registries/${reg.id}/items/${regItem.id}`));
  expect((await api(bossB, 'get', '/tableware/registries')).body.items.map(r => r.id)).not.toContain(reg.id);
  // B kendi listesine A'nın ürününü/takımını ekleyemez.
  const own = (await api(bossB, 'post', '/tableware/registries', { title: 'B listesi' })).body;
  bad(await api(bossB, 'post', `/tableware/registries/${own.id}/items`, { product_id: p.id }));
  bad(await api(bossB, 'post', `/tableware/registries/${own.id}/items`, { set_id: set.id }));
  expect((await val('SELECT title,status FROM gift_registries WHERE id=$1', [reg.id]))).toMatchObject({ title: 'A listesi', status: 'open' });
  expect(Number((await val('SELECT bought FROM gift_registry_items WHERE id=$1', [regItem.id])).bought)).toBe(0);
});

test('restoran: B, A adisyonunu taşıyamaz, birleştiremez, bölemez, düzeltemez, iade/teslimat yazamaz', async () => {
  const tB = (await api(bossB, 'post', '/restaurant/tables', { name: 'B masası' })).body;
  const orderB = (await api(bossB, 'post', '/restaurant/orders', { order_type: 'masa', table_id: tB.id, warehouse_id: wB.id, items: [{ product_id: (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'B-P1','B ürünü','B-BARKOD','adet',5,'NORMAL') RETURNING id", [B.tenantId])).rows[0].id, quantity: 1 }] })).body;
  bad(await api(bossB, 'post', `/restaurant/orders/${order.order_id}/move`, { table_id: tB.id }));
  bad(await api(bossB, 'post', `/restaurant/orders/${orderB.order_id}/move`, { table_id: table.id }));
  bad(await api(bossB, 'post', `/restaurant/orders/${orderB.order_id}/merge`, { target_order_id: order.order_id }));
  bad(await api(bossB, 'post', `/restaurant/orders/${order.order_id}/merge`, { target_order_id: orderB.order_id }));
  bad(await api(bossB, 'post', `/restaurant/orders/${order.order_id}/pay-items`, { item_ids: [item.id], payment_method: 'cash' }));
  bad(await api(bossB, 'post', `/restaurant/orders/${orderB.order_id}/pay-items`, { item_ids: [item.id], payment_method: 'cash' }));
  bad(await api(bossB, 'post', `/restaurant/orders/${order.order_id}/adjustments`, { kind: 'discount', percent: 100, reason: 'iso' }));
  bad(await api(bossB, 'post', `/restaurant/orders/${orderB.order_id}/adjustments`, { kind: 'comp', item_id: item.id, reason: 'iso' }));
  bad(await api(bossB, 'put', `/restaurant/orders/${order.order_id}/delivery`, { address: 'x' }));
  bad(await api(bossB, 'post', `/restaurant/orders/${order.order_id}/refund`, { method: 'cash', reason: 'isolation', amount: 1 }));
  bad(await api(bossB, 'post', `/restaurant/orders/${order.order_id}/close`, { payment_method: 'cash' }));
  bad(await api(bossB, 'patch', `/restaurant/orders/${order.order_id}/items/${item.id}`, { status: 'cancelled' }));
  expect((await api(bossB, 'get', '/restaurant/orders')).body.items.map(o => o.id)).not.toContain(order.order_id);
  expect((await api(bossB, 'get', '/restaurant/closed-today')).body.items.map(o => o.id)).not.toContain(order.order_id);
  expect((await val('SELECT status,table_id,total_amount FROM restaurant_orders WHERE id=$1', [order.order_id]))).toMatchObject({ status: 'open', table_id: table.id });
  expect(Number((await val('SELECT COUNT(*) n FROM restaurant_order_adjustments WHERE tenant_id=$1', [A.tenantId])).n)).toBe(0);
  expect(Number((await val('SELECT SUM(quantity) q FROM stock_records WHERE product_id=$1', [p.id])).q)).toBe(99); // yalnız A'nın kendi siparişi düştü
});

test('rol sınırları: izleyici (viewer) sektör uçlarının hiçbirine yazamaz; kasiyer yönetici işlemlerini yapamaz', async () => {
  const v = await createUser(A.tenantId, 'viewer'), c = await createUser(A.tenantId, 'cashier');
  const viewer = { token: jwt.sign({ userId: v.id, tenantId: A.tenantId, role: 'viewer' }, JWT_SECRET) };
  const cashier = { token: jwt.sign({ userId: c.id, tenantId: A.tenantId, role: 'cashier' }, JWT_SECRET) };
  for (const [m, u, b] of [['post', '/tableware/breakage', { product_id: p.id, warehouse_id: wA.id, quantity: 1, reason: 'kirik' }], ['post', '/restaurant/orders', { order_type: 'paket', items: [{ product_id: p.id, quantity: 1 }] }], ['post', '/hardware/prices/bulk', { category: 'Gizli', percent: 10 }]]) bad(await api(viewer, m, u, b));
  for (const [m, u, b] of [['post', '/hardware/prices/bulk', { category: 'Gizli', percent: 10 }], ['post', '/hardware/critical/order', { warehouse_id: wA.id }], ['put', `/tableware/sets/${set.id}/sale`, { barcode: 'C-1', price: 5 }], ['post', `/restaurant/orders/${order.order_id}/refund`, { method: 'cash', reason: 'kasiyer', amount: 1 }], ['post', `/restaurant/orders/${order.order_id}/adjustments`, { kind: 'discount', percent: 10, reason: 'kasiyer' }], ['post', '/tableware/registries', { title: 'kasiyer' }]]) bad(await api(cashier, m, u, b, 'cash-1'));
  expect(Number((await val('SELECT sale_price FROM products WHERE id=$1', [p.id])).sale_price)).toBe(10);
});

test('girdi güvenliği: HTML/betik içeren metinler temizlenir veya reddedilir, SQL metni etkisizdir', async () => {
  const payload = "<img src=x onerror=alert(1)>'; DROP TABLE products;--";
  const r = await api(bossB, 'post', '/tableware/registries', { title: payload, owner_name: payload });
  expect(r.status).toBe(201);
  expect(r.body.title).not.toMatch(/[<>]/);
  const l = await api(bossB, 'post', '/restaurant/orders', { order_type: 'paket', warehouse_id: wB.id, items: [{ product_id: (await val("SELECT id FROM products WHERE tenant_id=$1 AND sku='B-P1'", [B.tenantId])).id, quantity: 1 }] });
  const d = await api(bossB, 'put', `/restaurant/orders/${l.body.order_id}/delivery`, { customer_name: payload, address: payload, phone: '0532 000 00 00' });
  expect(d.status).toBe(200); expect(JSON.stringify(d.body)).not.toMatch(/[<>]/);
  bad(await api(bossB, 'put', `/restaurant/menu/${(await val("SELECT id FROM products WHERE tenant_id=$1 AND sku='B-P1'", [B.tenantId])).id}/options`, { options: [{ name: payload, price: 1 }] }));
  // B'nin hiçbir kaydı A'ya yazılmadı (fabrikanın varsayılan "Test Product"ı hariç A'da yalnız kendi ürünü var).
  const names = (await db.query('SELECT name FROM products WHERE tenant_id=$1', [A.tenantId])).rows.map(r => r.name);
  expect(names).not.toContain('B ürünü'); expect(names.some(n => /DROP TABLE|onerror/.test(n))).toBe(false);
  expect((await db.query('SELECT 1 FROM restaurant_deliveries WHERE tenant_id=$1', [A.tenantId])).rows).toHaveLength(0);
});
