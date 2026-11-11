process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');

let owner, other, w, manager, waiter;
const as = who => ({
  get: (url, q) => request(app).get('/api/sector' + url).set('Authorization', 'Bearer ' + who.token).query(q || {}),
  post: (url, body, h = {}) => request(app).post('/api/sector' + url).set('Authorization', 'Bearer ' + who.token).set(h).send(body),
  put: (url, body) => request(app).put('/api/sector' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  patch: (url, body) => request(app).patch('/api/sector' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  del: url => request(app).delete('/api/sector' + url).set('Authorization', 'Bearer ' + who.token)
});
const grant = (tenant, ...packs) => Promise.all(packs.map(p => db.query('INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,$2)', [tenant, p])));
const product = async (tenant, sku, name, extra = {}) => (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,category,min_stock_level,module_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'NORMAL') RETURNING *", [tenant, sku, name, extra.barcode || sku, extra.unit || 'adet', extra.price ?? 10, extra.category || null, extra.min ?? 0])).rows[0];
const stock = (tenant, warehouse, productId, q) => db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [tenant, warehouse, productId, q]);
const qty = async (productId) => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [productId])).rows[0].q);

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  w = await createWarehouse(owner.tenantId);
  const m = await createUser(owner.tenantId, 'manager'), c = await createUser(owner.tenantId, 'cashier');
  manager = { token: jwt.sign({ userId: m.id, tenantId: owner.tenantId, role: 'manager' }, JWT_SECRET) };
  waiter = { token: jwt.sign({ userId: c.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
});

describe('paket yetkisi', () => {
  test('paket yokken üç sektör de 403 ve PACK_REQUIRED döner; paket işletmeye özel açılır', async () => {
    for (const url of ['/hardware/critical', '/tableware/sets', '/restaurant/tables']) {
      const r = await as(owner).get(url);
      expect([url, r.status, r.body.code]).toEqual([url, 403, 'PACK_REQUIRED']);
    }
    expect((await as(owner).get('/packs/me')).body.packs).toEqual({ hardware: false, tableware: false, restaurant: false });
    await grant(owner.tenantId, 'hardware');
    expect((await as(owner).get('/hardware/critical')).status).toBe(200);
    expect((await as(owner).get('/tableware/sets')).status).toBe(403);
    expect((await as(other).get('/hardware/critical')).status).toBe(403);
    expect((await as(owner).get('/packs/me')).body.packs).toEqual({ hardware: true, tableware: false, restaurant: false });
  });

  test('paketi yalnız platform yöneticisi verir', async () => {
    const r = await request(app).put('/api/sector/packs/admin/' + other.tenantId).set('Authorization', 'Bearer ' + owner.token).send({ packs: ['hardware'] });
    expect(r.status).toBe(403);
  });
});

describe('hırdavat', () => {
  let v3, v4, dubel, loc;
  beforeAll(async () => {
    v3 = await product(owner.tenantId, 'V-M3', 'Vida M3x20 galvaniz', { category: 'Vida', min: 100 });
    v4 = await product(owner.tenantId, 'V-M4', 'Vida M4x30 galvaniz', { category: 'Vida', min: 50 });
    dubel = await product(owner.tenantId, 'D-8', 'Dübel 8 mm', { category: 'Dübel', min: 10 });
    await product(other.tenantId, 'X-M3', 'Vida M3x20 başkası');
    await stock(owner.tenantId, w.id, v3.id, 40); await stock(owner.tenantId, w.id, v4.id, 500); await stock(owner.tenantId, w.id, dubel.id, 0);
    loc = (await db.query("INSERT INTO warehouse_locations(tenant_id,warehouse_id,location_code,zone_name,aisle_code,rack_number,shelf_tier,bin_position) VALUES($1,$2,'A-03-2-1','Vida bölümü','A',3,2,1) RETURNING id", [owner.tenantId, w.id])).rows[0];
    await db.query('INSERT INTO product_bin_records(tenant_id,location_id,product_id,quantity) VALUES($1,$2,$3,$4)', [owner.tenantId, loc.id, v3.id, 40]);
  });

  test('"3 numara vida" yalnız M3 vidayı bulur; koridor/raf ve stok görünür; başka işletmenin ürünü görünmez', async () => {
    const r = await as(owner).get('/hardware/search', { q: '3 numara vida' });
    expect(r.status).toBe(200);
    expect(r.body.items.map(i => i.sku)).toEqual(['V-M3']);
    const item = r.body.items[0];
    expect(item.stock_total).toBe(40);
    expect(item.locations[0]).toMatchObject({ location_code: 'A-03-2-1', aisle: 'A', rack: 3, shelf: 2, quantity: 40 });
    expect((await as(owner).get('/hardware/search', { q: 'vida' })).body.items.map(i => i.sku).sort()).toEqual(['V-M3', 'V-M4']);
    expect((await as(owner).get('/hardware/search', { q: 'başkası' })).body.items).toEqual([]);
  });

  test('ölçü özelliği verilince tek dokunuşluk ölçü filtresi çalışır; kategori düğmeleri sayar; kasiyer özellik değiştiremez', async () => {
    expect((await as(waiter).put('/hardware/products/' + v3.id + '/attributes', { size: 'M3' })).status).toBe(403);
    expect((await as(manager).put('/hardware/products/' + v3.id + '/attributes', { size: 'M3' })).status).toBe(200);
    await as(manager).put('/hardware/products/' + v4.id + '/attributes', { size: 'M4' });
    const f = await as(owner).get('/hardware/facets', { q: 'vida' });
    expect(f.body.sizes.map(s => s.value).sort()).toEqual(['M3', 'M4']);
    expect(f.body.categories).toEqual([{ value: 'Vida', count: 2 }]);
    expect((await as(owner).get('/hardware/search', { q: 'vida', size: 'm4' })).body.items.map(i => i.sku)).toEqual(['V-M4']);
    expect((await as(manager).put('/hardware/products/999999/attributes', { size: 'x' })).status).toBe(404);
    expect((await as(manager).put('/hardware/products/' + v3.id + '/attributes', { size: 'x'.repeat(50) })).status).toBe(400);
  });

  test('kritik stok: asgari düzeyin altındaki ürünler "bitiyor, toptancıya yaz" iletisiyle gelir, biten önce', async () => {
    const c = await as(owner).get('/hardware/critical');
    expect(c.status).toBe(200);
    const names = c.body.items.map(i => i.name);
    expect(names[0]).toBe('Dübel 8 mm');
    expect(c.body.items[0].empty).toBe(true);
    const vida = c.body.items.find(i => i.name.includes('M3x20'));
    expect(vida.message).toContain('bitiyor');
    expect(vida.message).toContain('toptancıya yaz');
    expect(names.some(n => n.includes('M4x30'))).toBe(false); // 500 > 50
  });
});

describe('züccaciye', () => {
  let bicak, catal, kasik, locA, locB;
  beforeAll(async () => {
    await grant(owner.tenantId, 'tableware');
    bicak = await product(owner.tenantId, 'ZB', 'Yemek bıçağı'); catal = await product(owner.tenantId, 'ZC', 'Yemek çatalı'); kasik = await product(owner.tenantId, 'ZK', 'Yemek kaşığı');
    await stock(owner.tenantId, w.id, bicak.id, 16); await stock(owner.tenantId, w.id, catal.id, 18); await stock(owner.tenantId, w.id, kasik.id, 18);
    const ins = code => db.query("INSERT INTO warehouse_locations(tenant_id,warehouse_id,location_code,zone_name,aisle_code,rack_number,shelf_tier,bin_position) VALUES($1,$2,$3,'Porselen','B',1,1,1) RETURNING id", [owner.tenantId, w.id, code]).then(r => r.rows[0]);
    locA = await ins('B-1-ALT'); locB = await ins('B-1-VIT');
  });

  test('6 kişilik takım: eksik parça "tekli sat veya takviye yap" uyarısı verir', async () => {
    const created = await as(manager).post('/tableware/sets', { name: '6 kişilik yemek takımı', target_sets: 3, items: [{ product_id: bicak.id, quantity: 6 }, { product_id: catal.id, quantity: 6 }, { product_id: kasik.id, quantity: 6 }] });
    expect(created.status).toBe(201);
    const s = await as(waiter).get('/tableware/sets');
    expect(s.body.sets).toHaveLength(1);
    const set = s.body.sets[0];
    expect(set.complete_sets).toBe(2); // 16/6 = 2 tam takım
    expect(set.ok).toBe(false);
    expect(s.body.alerts).toHaveLength(1);
    expect(s.body.alerts[0].message).toContain('Yemek bıçağı');
    expect(s.body.alerts[0].message).toContain('2');
    expect(s.body.alerts[0].message).toContain('tekli sat veya takviye yap');
    await db.query('UPDATE stock_records SET quantity=quantity+2 WHERE product_id=$1 AND warehouse_id=$2', [bicak.id, w.id]);
    expect((await as(waiter).get('/tableware/sets')).body.alerts).toEqual([]);
  });

  test('takım doğrulaması: kasiyer oluşturamaz, tekrar eden/olmayan parça ve boş liste reddedilir', async () => {
    expect((await as(waiter).post('/tableware/sets', { name: 'x', items: [] })).status).toBe(403);
    expect((await as(manager).post('/tableware/sets', { name: 'Takım', items: [] })).status).toBe(400);
    expect((await as(manager).post('/tableware/sets', { name: 'Takım', items: [{ product_id: bicak.id, quantity: 1 }, { product_id: bicak.id, quantity: 2 }] })).status).toBe(400);
    expect((await as(manager).post('/tableware/sets', { name: 'Takım', items: [{ product_id: 999999, quantity: 1 }] })).status).toBe(404);
    expect((await as(manager).post('/tableware/sets', { name: 'Takım', items: [{ product_id: bicak.id, quantity: 0 }] })).status).toBe(400);
  });

  test('kırılgan ürün yanlış rafa konursa uyarı verilir; doğru rafta uyarı yoktur', async () => {
    await as(manager).put('/hardware/products/' + bicak.id + '/attributes', { fragile: '1' }).catch(() => {});
    await db.query("INSERT INTO product_attributes(tenant_id,product_id,attr_key,attr_value) VALUES($1,$2,'fragile','1')", [owner.tenantId, catal.id]);
    expect((await as(manager).put('/tableware/locations/' + locA.id + '/tags', { tags: ['Alt raf'] })).status).toBe(200);
    expect((await as(manager).put('/tableware/locations/' + locB.id + '/tags', { tags: ['Vitrin', 'Kırılgan bölge'] })).status).toBe(200);
    const bad = await as(waiter).get('/tableware/placement-check', { product_id: catal.id, location_id: locA.id });
    expect(bad.body.ok).toBe(false);
    expect(bad.body.warnings.join(' ')).toContain('alt rafa');
    expect((await as(waiter).get('/tableware/placement-check', { product_id: catal.id, location_id: locB.id })).body).toMatchObject({ ok: true, warnings: [] });
    const plain = await as(waiter).get('/tableware/placement-check', { product_id: kasik.id, location_id: locB.id });
    expect(plain.body.ok).toBe(false);
    expect((await as(manager).put('/tableware/locations/' + locA.id + '/tags', { tags: Array(9).fill('a') })).status).toBe(400);
    expect((await as(manager).put('/tableware/locations/999999/tags', { tags: ['Vitrin'] })).status).toBe(404);
    expect((await as(owner).get('/tableware/locations')).body.items.find(l => l.id === Number(locB.id)).tags.sort()).toEqual(['Kırılgan bölge', 'Vitrin']);
  });

  test('fiyat güncelleme: değişen fiyat yazılır ve denetlenir, aynı fiyat değişiklik sayılmaz', async () => {
    const r = await as(manager).post('/tableware/price-label', { product_id: catal.id, price: 149.9 });
    expect(r.body).toMatchObject({ price: 149.9, changed: true, previous_price: 10 });
    expect((await as(manager).post('/tableware/price-label', { product_id: catal.id, price: 149.9 })).body.changed).toBe(false);
    expect((await as(waiter).post('/tableware/price-label', { product_id: catal.id, price: 1 })).status).toBe(403);
    expect((await as(manager).post('/tableware/price-label', { product_id: catal.id, price: -1 })).status).toBe(400);
    expect(Number((await db.query('SELECT sale_price FROM products WHERE id=$1', [catal.id])).rows[0].sale_price)).toBe(149.9);
  });
});

describe('pide ve restoran', () => {
  let pide, hamur, kasar, ayran, table;
  beforeAll(async () => {
    await grant(owner.tenantId, 'restaurant');
    pide = await product(owner.tenantId, 'PIDE-K', 'Kıymalı pide', { price: 120, category: 'Pide' });
    ayran = await product(owner.tenantId, 'AYR', 'Ayran', { price: 25, category: 'İçecek' });
    hamur = await product(owner.tenantId, 'HMR', 'Hamur', { unit: 'kg', price: 1 });
    kasar = await product(owner.tenantId, 'KSR', 'Kaşar', { unit: 'kg', price: 1 });
    await stock(owner.tenantId, w.id, hamur.id, 1); await stock(owner.tenantId, w.id, kasar.id, 0.3); await stock(owner.tenantId, w.id, ayran.id, 10);
    table = (await as(manager).post('/restaurant/tables', { name: 'Masa 1' })).body;
  });

  test('masa ve reçete tanımı; masa adı tekrar edemez; kasiyer tanımlayamaz', async () => {
    expect(table.name).toBe('Masa 1');
    expect((await as(manager).post('/restaurant/tables', { name: 'Masa 1' })).status).toBe(409);
    expect((await as(waiter).post('/restaurant/tables', { name: 'Masa 9' })).status).toBe(403);
    expect((await as(manager).put('/restaurant/recipes/' + pide.id, { ingredients: [{ ingredient_id: hamur.id, quantity: 0.25 }, { ingredient_id: kasar.id, quantity: 0.1 }] })).status).toBe(200);
    expect((await as(manager).put('/restaurant/recipes/' + pide.id, { ingredients: [{ ingredient_id: pide.id, quantity: 1 }] })).status).toBe(400);
    expect((await as(manager).get('/restaurant/recipes')).body.items[0].ingredients).toHaveLength(2);
    await as(manager).put('/restaurant/menu/' + pide.id, { menu: true }); await as(manager).put('/restaurant/menu/' + ayran.id, { menu: true });
    const m = await as(waiter).get('/restaurant/menu');
    expect(m.body.items.map(i => i.name).sort()).toEqual(['Ayran', 'Kıymalı pide']);
  });

  test('garson sipariş girer: reçeteye göre stoktan anında düşer, eksik malzeme işaretlenir, stok eksiye inmez', async () => {
    const r = await as(waiter).post('/restaurant/orders', { order_type: 'masa', table_id: table.id, warehouse_id: w.id, items: [{ product_id: pide.id, quantity: 2, note: 'bol kaşarlı' }, { product_id: ayran.id, quantity: 1 }] });
    expect(r.status).toBe(201);
    expect(r.body.total).toBe(265);
    expect(await qty(hamur.id)).toBe(0.5); // 2 pide × 0.25
    expect(await qty(kasar.id)).toBe(0.1); // 0.3 - 0.2
    expect(await qty(ayran.id)).toBe(9);
    // üçüncü pide: kaşar 0.1 yeter (0.1), hamur 0.25 yeter
    const second = await as(waiter).post('/restaurant/orders', { table_id: table.id, warehouse_id: w.id, items: [{ product_id: pide.id, quantity: 2 }] });
    expect(second.body.appended).toBe(true);
    expect(second.body.order_id).toBe(r.body.order_id); // aynı masa: aynı adisyon
    expect(second.body.shortages).toHaveLength(1);
    expect(second.body.shortages[0].missing[0].name).toBe('Kaşar');
    expect(await qty(kasar.id)).toBe(0); // eksiye düşmedi
    expect(await qty(hamur.id)).toBe(0);
    const ledger = (await db.query("SELECT COUNT(*) AS c FROM inventory_transactions WHERE tenant_id=$1 AND reference_type='restaurant_order'", [owner.tenantId])).rows[0];
    expect(Number(ledger.c)).toBeGreaterThan(0);
  });

  test('mutfak ekranı hazırlanacakları listeler; kalem hazır olunca kuyruktan çıkar; iptal stoğu geri verir', async () => {
    const k = await as(waiter).get('/restaurant/orders', { status: 'kitchen' });
    expect(k.body.items).toHaveLength(1);
    const order = k.body.items[0];
    expect(order.table).toBe('Masa 1');
    expect(order.items.map(i => i.name)).toEqual(['Kıymalı pide', 'Ayran', 'Kıymalı pide']);
    const ayranItem = order.items.find(i => i.name === 'Ayran');
    expect((await as(waiter).patch(`/restaurant/orders/${order.id}/items/${ayranItem.id}`, { status: 'ready' })).status).toBe(200);
    expect((await as(waiter).get('/restaurant/orders', { status: 'kitchen' })).body.items[0].items).toHaveLength(2);
    const before = await qty(ayran.id);
    expect((await as(waiter).patch(`/restaurant/orders/${order.id}/items/${ayranItem.id}`, { status: 'cancelled' })).status).toBe(409); // hazırlanmış kalem iptal edilmez
    const second = order.items.filter(i => i.name === 'Kıymalı pide')[1];
    expect((await as(waiter).patch(`/restaurant/orders/${order.id}/items/${second.id}`, { status: 'cancelled' })).status).toBe(200);
    expect(await qty(hamur.id)).toBe(0.5); // 2 pidelik hamur geri döndü
    expect(await qty(ayran.id)).toBe(before);
    expect((await as(waiter).patch(`/restaurant/orders/${order.id}/items/${second.id}`, { status: 'ready' })).status).toBe(409);
    expect((await as(waiter).patch(`/restaurant/orders/${order.id}/items/${second.id}`, { status: 'sahte' })).status).toBe(400);
  });

  test('paket ve motor siparişi masasız açılır; esnaf akışı yeni siparişleri bildirir; gün sonu özeti pide ve motor sayısını verir', async () => {
    const start = (await as(manager).get('/restaurant/feed')).body.latest_id;
    const motor = await as(waiter).post('/restaurant/orders', { order_type: 'motor', warehouse_id: w.id, items: [{ product_id: pide.id, quantity: 1 }], note: 'Kurye: Ali' });
    expect(motor.status).toBe(201);
    const feed = await as(manager).get('/restaurant/feed', { after_id: start });
    expect(feed.body.items).toHaveLength(1);
    expect(feed.body.items[0]).toMatchObject({ type: 'motor', text: '1× Kıymalı pide' });
    expect(feed.body.latest_id).toBeGreaterThan(start);
    expect((await as(manager).get('/restaurant/feed', { after_id: feed.body.latest_id })).body.items).toEqual([]);
    const open = (await as(waiter).get('/restaurant/orders', { status: 'open' })).body.items;
    const tableOrder = open.find(o => o.table === 'Masa 1');
    expect((await as(waiter).post(`/restaurant/orders/${tableOrder.id}/close`, { payment_method: 'card' })).status).toBe(200);
    expect((await as(waiter).post(`/restaurant/orders/${tableOrder.id}/close`, {})).status).toBe(409);
    const day = await as(manager).get('/restaurant/summary');
    expect(day.status).toBe(200);
    const pides = day.body.products.find(p => p.name === 'Kıymalı pide');
    expect(pides.quantity).toBe(3); // masa: 2 (biri iptal) + motor: 1 = 3 → iptal edilen sayılmaz
    expect(day.body.by_type.find(t => t.type === 'motor')).toMatchObject({ orders: 1, revenue: 120 });
    expect((await as(waiter).get('/restaurant/summary')).status).toBe(403);
  });

  test('doğrulama: boş sipariş, geçersiz adet, olmayan masa/ürün ve başka işletmenin masası reddedilir', async () => {
    const o = body => as(waiter).post('/restaurant/orders', body);
    expect((await o({ table_id: table.id, items: [] })).status).toBe(400);
    expect((await o({ table_id: table.id, items: [{ product_id: pide.id, quantity: 0 }] })).status).toBe(400);
    expect((await o({ table_id: 999999, items: [{ product_id: pide.id, quantity: 1 }] })).status).toBe(404);
    expect((await o({ table_id: table.id, items: [{ product_id: 999999, quantity: 1 }] })).status).toBe(404);
    expect((await as(other).post('/restaurant/orders', { table_id: table.id, items: [{ product_id: pide.id, quantity: 1 }] })).status).toBe(403); // diğer işletmede paket yok
    await grant(other.tenantId, 'restaurant');
    expect((await as(other).post('/restaurant/orders', { table_id: table.id, items: [{ product_id: pide.id, quantity: 1 }] })).status).toBe(404); // masa başkasının
  });
});
