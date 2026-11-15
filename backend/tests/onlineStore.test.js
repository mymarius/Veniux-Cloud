process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.SHOP_READ_MAX = '100000'; process.env.SHOP_ORDER_MINUTE_MAX = '100000'; process.env.SHOP_ORDER_HOUR_MAX = '100000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');
const svc = require('../src/services/onlineStoreService');

// Online mağaza (ayrı paket online_store): ayar, yayın, vitrin, sipariş, stok, iptal, işletme ayrımı.
let owner, other, w, manager, cashier, a, b, kg, otherProduct;
const admin = (who, method, url, body) => request(app)[method]('/api/online-store' + url).set('Authorization', 'Bearer ' + who.token).send(body);
const shop = (method, url, body, key) => { const r = request(app)[method]('/api/public/shop/' + url); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
const product = async (tenant, sku, name, price, unit = 'adet', category = 'Genel') => (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,category,module_type) VALUES($1,$2,$3,$4,$5,$6,$7,'NORMAL') RETURNING *", [tenant, sku, name, sku, unit, price, category])).rows[0];
const stock = (tenant, warehouse, productId, q) => db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [tenant, warehouse, productId, q]);
const qty = async id => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [id])).rows[0].q);
let keyCount = 0;
const key = () => 'test-key-' + Date.now() + '-' + (++keyCount);
const order = (over = {}) => ({ delivery_method: 'delivery', payment_method: 'cod', customer_name: 'Ayşe Demir', phone: '0532 123 45 67', address: 'Atatürk Mah. 12. Sok. No 5 Kadıköy', consent: true, items: [{ product_id: a.id, quantity: 2 }], ...over });
const settings = { slug: 'deneme-magaza', name: 'Deneme Mağaza', cod_enabled: true, transfer_enabled: true, transfer_note: 'TR00 0000 0000 0000 0000 0000 00', pickup_enabled: true, delivery_fee: 30, free_delivery_over: 500, min_order: 50 };

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  w = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [w.id]);
  w = { id: Number((await db.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [owner.tenantId])).rows[0].id) };
  const m = await createUser(owner.tenantId, 'manager'), c = await createUser(owner.tenantId, 'cashier');
  manager = { token: jwt.sign({ userId: m.id, tenantId: owner.tenantId, role: 'manager' }, JWT_SECRET) };
  cashier = { token: jwt.sign({ userId: c.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
  a = await product(owner.tenantId, 'OM-A', 'Çay bardağı seti', 120.5, 'adet', 'Züccaciye'); await stock(owner.tenantId, w.id, a.id, 100);
  b = await product(owner.tenantId, 'OM-B', 'Tabak', 35, 'adet', 'Züccaciye'); await stock(owner.tenantId, w.id, b.id, 1);
  kg = await product(owner.tenantId, 'OM-KG', 'Tartılı ürün', 90, 'kg', 'Gıda'); await stock(owner.tenantId, w.id, kg.id, 50);
  const ow = await createWarehouse(other.tenantId); await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [ow.id]);
  otherProduct = await product(other.tenantId, 'OT-1', 'Başka işletme ürünü', 10); await stock(other.tenantId, ow.id, otherProduct.id, 5);
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [owner.tenantId]);
});

describe('paket ve yetki', () => {
  test('paket yokken yönetici uçları 403 PACK_REQUIRED; paket işletmeye özel; /packs/me gösterir', async () => {
    expect((await admin(other, 'get', '/settings')).body.code).toBe('PACK_REQUIRED');
    expect((await admin(other, 'get', '/orders')).status).toBe(403);
    expect((await admin(owner, 'get', '/settings')).status).toBe(200);
    const mine = (await request(app).get('/api/sector/packs/me').set('Authorization', 'Bearer ' + owner.token)).body.packs;
    expect(mine.online_store).toBe(true);
  });
  test('kasiyer ayar ve ürün yayını yapamaz, siparişleri görebilir', async () => {
    expect((await admin(cashier, 'put', '/settings', settings)).status).toBe(403);
    expect((await admin(cashier, 'put', `/products/${a.id}`, { published: true })).status).toBe(403);
    expect((await admin(cashier, 'get', '/orders')).status).toBe(200);
  });
});

describe('ayarlar ve yayın', () => {
  test('mağaza adresi kuralları: geçersiz, ayrılmış, çakışan', async () => {
    for (const slug of ['ab', 'Bad Slug', '-bas', 'son-', 'a'.repeat(41)]) expect((await admin(owner, 'put', '/settings', { ...settings, slug })).status).toBe(409);
    expect((await admin(owner, 'put', '/settings', { ...settings, slug: 'admin' })).status).toBe(409);
    expect((await admin(owner, 'get', '/slug-check?slug=magaza')).body.available).toBe(false);
    expect((await admin(owner, 'get', '/slug-check?slug=yeni-ad')).body.available).toBe(true);
  });
  test('yayınlamak için depo ve en az bir yayında ürün gerekir; kaydedilir; adres başka işletmede kullanılamaz', async () => {
    expect((await admin(owner, 'put', '/settings', { ...settings, published: true })).status).toBe(400);
    expect((await admin(owner, 'put', '/settings', { ...settings, warehouse_id: w.id, published: true })).body.error).toMatch(/ürün/);
    const ok = await admin(owner, 'put', '/settings', { ...settings, warehouse_id: w.id });
    expect(ok.status).toBe(200); expect(ok.body.store).toMatchObject({ slug: 'deneme-magaza', published: false, delivery_fee: 30 });
    await db.query("INSERT INTO online_stores (tenant_id,slug,name) VALUES ($1,'baska-magaza','Başka')", [other.tenantId]);
    expect((await admin(owner, 'put', '/settings', { ...settings, slug: 'baska-magaza', warehouse_id: w.id })).body.code).toBe('SLUG_TAKEN');
  });
  test('havale açıksa IBAN notu şart; başka işletmenin deposu seçilemez', async () => {
    expect((await admin(owner, 'put', '/settings', { ...settings, warehouse_id: w.id, transfer_note: '' })).status).toBe(400);
    const foreign = Number((await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 LIMIT 1', [other.tenantId])).rows[0].id);
    expect((await admin(owner, 'put', '/settings', { ...settings, warehouse_id: foreign })).status).toBe(404);
  });
  test('ürün yayını: tartılı ürün reddedilir, açıklama kaydedilir, toplu yayın tartılıyı atlar, başka işletmenin ürünü bulunamaz', async () => {
    expect((await admin(owner, 'put', `/products/${kg.id}`, { published: true })).body.code).toBe('MEASURED_UNIT');
    expect((await admin(owner, 'put', `/products/${otherProduct.id}`, { published: true })).status).toBe(404);
    const r = await admin(owner, 'put', `/products/${a.id}`, { published: true, description: 'Altı kişilik\nçay seti', max_per_order: 6, sort_order: 1 });
    expect(r.body).toMatchObject({ published: true, max_per_order: 6 });
    const bulk = await admin(owner, 'put', '/products/bulk', { product_ids: [b.id, kg.id], published: true });
    expect(bulk.body).toMatchObject({ changed: 1, skipped_measured: [kg.id] });
    const list = (await admin(owner, 'get', '/products?published=1')).body;
    expect(list.items.map(i => i.sku).sort()).toEqual(['OM-A', 'OM-B']);
    expect(list.items.find(i => i.sku === 'OM-A')).toMatchObject({ stock: 100, description: 'Altı kişilik\nçay seti' });
  });
  test('yayına al: depo ve ürün varken yayınlanır', async () => {
    const r = await admin(owner, 'put', '/settings', { ...settings, warehouse_id: w.id, published: true });
    expect(r.status).toBe(200); expect(r.body.store).toMatchObject({ published: true, accepting_orders: true });
  });
});

describe('vitrin (herkese açık)', () => {
  test('olmayan mağaza ve kapalı mağaza aynı 404 verir; yayında olan açılır', async () => {
    expect((await shop('get', 'yok-boyle-magaza')).status).toBe(404);
    expect((await shop('get', 'baska-magaza')).status).toBe(404);
    const r = await shop('get', 'deneme-magaza');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: 'Deneme Mağaza', accepting_orders: true, min_order: 50, free_delivery_over: 500 });
    expect(r.body.categories).toEqual([{ name: 'Züccaciye', count: 2 }]);
  });
  test('ürün listesi yalnız yayındakileri, stok durumunu (sayısını değil) ve başka işletmeninkini göstermez', async () => {
    const r = await shop('get', 'deneme-magaza/products');
    expect(r.body.total).toBe(2);
    const names = r.body.items.map(i => i.name);
    expect(names).toContain('Çay bardağı seti'); expect(names).not.toContain('Tartılı ürün'); expect(names).not.toContain('Başka işletme ürünü');
    const item = r.body.items.find(i => i.name === 'Çay bardağı seti');
    expect(item).toMatchObject({ price: 120.5, stock_state: 'ok', max_per_order: 6 });
    expect(JSON.stringify(r.body)).not.toMatch(/"stock":|quantity|tenant|sku|purchase/);
    expect(r.body.items.find(i => i.name === 'Tabak').stock_state).toBe('low');
    expect((await shop('get', 'deneme-magaza/products?q=tabak')).body.total).toBe(1);
    expect((await shop('get', 'deneme-magaza/products?category=Yok')).body.total).toBe(0);
    expect((await shop('get', `deneme-magaza/products/${otherProduct.id}`)).status).toBe(404);
    expect((await shop('get', `deneme-magaza/products/${a.id}`)).body.name).toBe('Çay bardağı seti');
  });
  test('işletmenin lisansı bitmişse mağaza kapanır, yenilenince açılır', async () => {
    const before = (await db.query('SELECT license_key,expires_at FROM licenses WHERE tenant_id=$1', [owner.tenantId])).rows;
    await db.query("UPDATE licenses SET expires_at='2020-01-01 00:00:00' WHERE tenant_id=$1", [owner.tenantId]);
    expect((await shop('get', 'deneme-magaza')).status).toBe(404);
    expect((await shop('post', 'deneme-magaza/orders', order(), key())).status).toBe(404);
    await db.query("UPDATE licenses SET expires_at='2099-01-01 00:00:00' WHERE tenant_id=$1", [owner.tenantId]);
    expect((await shop('get', 'deneme-magaza')).status).toBe(200);
    expect(before.length).toBeGreaterThanOrEqual(0);
  });
});

describe('sipariş', () => {
  test('başarılı sipariş: toplam, teslimat ücreti, stok düşümü, sipariş numarası ve kod', async () => {
    const before = await qty(a.id);
    const r = await shop('post', 'deneme-magaza/orders', order(), key());
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ number: 'S-000001', status: 'new', subtotal: 241, delivery_fee: 30, total: 271 });
    expect(r.body.code).toHaveLength(20);
    expect(await qty(a.id)).toBe(before - 2);
    const mv = (await db.query("SELECT change_amount,source FROM stock_movements WHERE product_id=$1 AND source='online_store'", [a.id])).rows;
    expect(mv).toHaveLength(1); expect(Number(mv[0].change_amount)).toBe(-2);
  });
  test('aynı Idempotency-Key aynı siparişi döner, ikinci stok düşümü olmaz', async () => {
    const k = key(); const before = await qty(a.id);
    const first = await shop('post', 'deneme-magaza/orders', order(), k);
    const again = await shop('post', 'deneme-magaza/orders', order(), k);
    expect(first.status).toBe(201); expect(again.status).toBe(200);
    expect(again.body.number).toBe(first.body.number);
    expect(await qty(a.id)).toBe(before - 2);
  });
  test('ücretsiz teslimat eşiği, mağazadan teslim ve minimum sepet', async () => {
    const free = await shop('post', 'deneme-magaza/orders', order({ items: [{ product_id: a.id, quantity: 5 }] }), key());
    expect(free.body).toMatchObject({ subtotal: 602.5, delivery_fee: 0, total: 602.5 });
    const pickup = await shop('post', 'deneme-magaza/orders', order({ delivery_method: 'pickup', payment_method: 'pickup', address: '' }), key());
    expect(pickup.body).toMatchObject({ delivery_fee: 0, total: 241 });
    const small = await shop('post', 'deneme-magaza/orders', order({ items: [{ product_id: b.id, quantity: 1 }] }), key());
    expect(small.status).toBe(422); expect(small.body.code).toBe('MIN_ORDER');
  });
  test('doğrulamalar: onay, telefon, adres, ödeme/teslimat uyumu, kalem sınırları, anahtar', async () => {
    const cases = [
      [order({ consent: false }), 400], [order({ phone: '123' }), 400], [order({ address: 'kısa' }), 400], [order({ customer_name: 'A' }), 400],
      [order({ delivery_method: 'pickup', payment_method: 'cod' }), 400], [order({ payment_method: 'pickup' }), 400], [order({ items: [] }), 400],
      [order({ items: [{ product_id: a.id, quantity: 0 }] }), 400], [order({ items: [{ product_id: a.id, quantity: 1.5 }] }), 400], [order({ items: [{ product_id: a.id, quantity: 51 }] }), 400],
      [order({ items: [{ product_id: a.id, quantity: 7 }] }), 422], [order({ email: 'bozuk' }), 400]
    ];
    for (const [body, status] of cases) expect((await shop('post', 'deneme-magaza/orders', body, key())).status).toBe(status);
    expect((await shop('post', 'deneme-magaza/orders', order(), key())).status).toBe(201);
    expect((await shop('post', 'deneme-magaza/orders', order(), undefined)).body.code).toBe('NO_KEY');
    expect((await shop('post', 'deneme-magaza/orders', order({ consent: false }), key())).body.code).toBe('NO_CONSENT');
    expect((await shop('post', 'deneme-magaza/orders', order({ items: [{ product_id: a.id, quantity: 7 }] }), key())).body.code).toBe('MAX_PER_ORDER');
  });
  test('yayında olmayan, başka işletmenin ve tartılı ürün siparişe girmez', async () => {
    for (const id of [otherProduct.id, kg.id]) expect((await shop('post', 'deneme-magaza/orders', order({ items: [{ product_id: id, quantity: 1 }] }), key())).body.code).toBe('PRODUCT_UNAVAILABLE');
  });
  test('bal küpü alanı doluysa kayıt açılmaz, stok düşmez', async () => {
    const before = await qty(a.id); const count = Number((await db.query('SELECT COUNT(*) AS n FROM online_orders WHERE tenant_id=$1', [owner.tenantId])).rows[0].n);
    const r = await shop('post', 'deneme-magaza/orders', order({ website: 'http://spam.example' }), key());
    expect(r.status).toBe(201); expect(r.body.ignored).toBe(true);
    expect(await qty(a.id)).toBe(before);
    expect(Number((await db.query('SELECT COUNT(*) AS n FROM online_orders WHERE tenant_id=$1', [owner.tenantId])).rows[0].n)).toBe(count);
  });
  test('fiyat değiştiyse 409 PRICE_CHANGED ve yeni fiyat gelir; stok düşmez', async () => {
    const before = await qty(a.id);
    const r = await shop('post', 'deneme-magaza/orders', order({ items: [{ product_id: a.id, quantity: 1, expected_price: 100 }] }), key());
    expect(r.status).toBe(409); expect(r.body.code).toBe('PRICE_CHANGED'); expect(r.body.changed[0]).toMatchObject({ product_id: a.id, price: 120.5 });
    expect(await qty(a.id)).toBe(before);
  });
  test('stok yetersizse 409 OUT_OF_STOCK ve kısmi düşüm olmaz (karışık sepet)', async () => {
    const bBefore = await qty(b.id), aBefore = await qty(a.id);
    const r = await shop('post', 'deneme-magaza/orders', order({ items: [{ product_id: a.id, quantity: 1 }, { product_id: b.id, quantity: 3 }] }), key());
    expect(r.status).toBe(409); expect(r.body.code).toBe('OUT_OF_STOCK');
    expect(r.body.shortages).toEqual([{ product_id: b.id, name: 'Tabak', available: 1 }]);
    expect(await qty(a.id)).toBe(aBefore); expect(await qty(b.id)).toBe(bBefore);
  });
  test('son ürün için eşzamanlı iki sipariş: yalnız biri alır, stok eksiye düşmez', async () => {
    await db.query('UPDATE stock_records SET quantity=1 WHERE product_id=$1', [b.id]);
    const body = order({ items: [{ product_id: b.id, quantity: 1 }, { product_id: a.id, quantity: 2 }] });
    const results = await Promise.all([shop('post', 'deneme-magaza/orders', body, key()), shop('post', 'deneme-magaza/orders', body, key())]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await qty(b.id)).toBe(0);
  });
  test('havale seçeneği kapalıyken seçilemez; mağaza sipariş almayı bıraktıysa 409', async () => {
    await db.query('UPDATE online_stores SET transfer_enabled=0 WHERE tenant_id=$1', [owner.tenantId]);
    expect((await shop('post', 'deneme-magaza/orders', order({ payment_method: 'transfer' }), key())).status).toBe(400);
    await db.query('UPDATE online_stores SET transfer_enabled=1,accepting_orders=0 WHERE tenant_id=$1', [owner.tenantId]);
    expect((await shop('post', 'deneme-magaza/orders', order(), key())).body.code).toBe('NOT_ACCEPTING');
    await db.query('UPDATE online_stores SET accepting_orders=1 WHERE tenant_id=$1', [owner.tenantId]);
  });
});

describe('sipariş yönetimi', () => {
  let firstId;
  test('liste ve ayrıntı yalnız kendi işletmesinin siparişlerini gösterir', async () => {
    const list = (await admin(owner, 'get', '/orders')).body;
    expect(list.total).toBeGreaterThan(2);
    const first = list.items[list.items.length - 1]; firstId = first.id;
    expect(first.number).toBe('S-000001');
    expect((await admin(owner, 'get', `/orders/${firstId}`)).body).toMatchObject({ customer_name: 'Ayşe Demir', phone: '05321234567', items: [{ name: 'Çay bardağı seti', quantity: 2 }] });
    expect((await admin(owner, 'get', '/orders?q=Ayşe')).body.total).toBeGreaterThan(0);
    await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [other.tenantId]);
    expect((await admin(other, 'get', `/orders/${firstId}`)).status).toBe(404);
    expect((await admin(other, 'get', '/orders')).body.total).toBe(0);
    expect((await admin(other, 'patch', `/orders/${firstId}/status`, { status: 'confirmed' })).status).toBe(404);
  });
  test('durum makinesi: geçerli geçişler çalışır, atlama ve geri dönüş reddedilir; kasiyer de durum değiştirebilir', async () => {
    expect((await admin(cashier, 'patch', `/orders/${firstId}/status`, { status: 'delivered' })).body.code).toBe('BAD_TRANSITION');
    for (const s of ['confirmed', 'preparing', 'ready', 'delivered']) expect((await admin(cashier, 'patch', `/orders/${firstId}/status`, { status: s })).status).toBe(200);
    expect((await admin(owner, 'patch', `/orders/${firstId}/status`, { status: 'cancelled' })).body.code).toBe('BAD_TRANSITION');
    expect((await admin(owner, 'patch', `/orders/${firstId}/status`, { status: 'x' })).status).toBe(400);
    const events = (await admin(owner, 'get', `/orders/${firstId}`)).body.events.map(e => e.to_status);
    expect(events).toEqual(['new', 'confirmed', 'preparing', 'ready', 'delivered']);
  });
  test('iptal stoğu geri verir, hareket kaydı düşer, ikinci iptal olmaz', async () => {
    const r = await shop('post', 'deneme-magaza/orders', order({ items: [{ product_id: a.id, quantity: 3 }] }), key());
    const id = Number((await db.query('SELECT id FROM online_orders WHERE tenant_id=$1 AND public_code=$2', [owner.tenantId, r.body.code])).rows[0].id);
    const before = await qty(a.id);
    expect((await admin(owner, 'patch', `/orders/${id}/status`, { status: 'cancelled', reason: 'Müşteri vazgeçti' })).status).toBe(200);
    expect(await qty(a.id)).toBe(before + 3);
    expect((await admin(owner, 'get', `/orders/${id}`)).body.cancel_reason).toBe('Müşteri vazgeçti');
    expect((await admin(owner, 'patch', `/orders/${id}/status`, { status: 'cancelled' })).status).toBe(409);
    expect(await qty(a.id)).toBe(before + 3);
    expect(Number((await db.query("SELECT COUNT(*) AS n FROM stock_movements WHERE source='online_store' AND movement_type='return' AND product_id=$1", [a.id])).rows[0].n)).toBe(1);
  });
  test('müşteri durum sorgusu: kişisel veri maskeli, yanlış kod 404, başka mağazanın kodu bulunmaz', async () => {
    const r = await shop('post', 'deneme-magaza/orders', order({ payment_method: 'transfer' }), key());
    const got = await shop('get', `deneme-magaza/orders/${r.body.code}`);
    expect(got.status).toBe(200);
    expect(got.body).toMatchObject({ customer_name: 'Ayşe', phone: '0532 *** ** 67', status: 'new' });
    expect(got.body.transfer_note).toMatch(/TR00/);
    expect(JSON.stringify(got.body)).not.toMatch(/Atatürk|05321234567|demir/i);
    expect((await shop('get', 'deneme-magaza/orders/' + 'x'.repeat(20))).status).toBe(404);
    expect((await shop('get', 'baska-magaza/orders/' + r.body.code)).status).toBe(404);
  });
  test('özet açık ve toplam durumları sayar', async () => {
    const s = (await admin(owner, 'get', '/summary')).body;
    expect(s.by_status.delivered).toBe(1); expect(s.by_status.cancelled).toBe(1); expect(s.open).toBeGreaterThan(0); expect(s.today_orders).toBeGreaterThan(0);
  });
});

describe('paket kalkınca', () => {
  test('paket hesaptan kalkarsa işletmenin bir sonraki paket sorgusunda mağaza kapanır, veri kalır; paket dönünce yeniden yayınlanabilir', async () => {
    expect((await shop('get', 'deneme-magaza')).status).toBe(200);
    await db.query("DELETE FROM sector_packs WHERE tenant_id=$1 AND pack='online_store'", [owner.tenantId]);
    const mine = (await request(app).get('/api/sector/packs/me').set('Authorization', 'Bearer ' + owner.token)).body.packs;
    expect(mine.online_store).toBe(false);
    expect((await shop('get', 'deneme-magaza')).status).toBe(404);
    expect((await shop('post', 'deneme-magaza/orders', order(), key())).status).toBe(404);
    expect(Number((await db.query('SELECT COUNT(*) AS n FROM online_orders WHERE tenant_id=$1', [owner.tenantId])).rows[0].n)).toBeGreaterThan(0);
    await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [owner.tenantId]);
    expect((await admin(owner, 'put', '/settings', { ...settings, warehouse_id: w.id, published: true })).body.store.published).toBe(true);
    expect((await shop('get', 'deneme-magaza')).status).toBe(200);
  });
});

describe('yardımcılar', () => {
  test('telefon biçimleri tek biçime çevrilir', () => {
    for (const p of ['0532 123 45 67', '+90 532 123 45 67', '5321234567', '(0532) 123-45-67']) expect(svc.normalizePhone(p)).toBe('05321234567');
    for (const p of ['', '123', '0212 123 45 67', 'abc']) expect(svc.normalizePhone(p)).toBeNull();
  });
});
