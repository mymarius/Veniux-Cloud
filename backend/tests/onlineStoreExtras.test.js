process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.SHOP_READ_MAX = '100000'; process.env.SHOP_ORDER_MINUTE_MAX = '100000'; process.env.SHOP_ORDER_HOUR_MAX = '100000'; process.env.SHOP_QUOTE_MAX = '100000';
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');

// Online mağaza: indirim kodları, kargo kuralları, sepet özeti, iptalde kod iadesi, kargo takibi.
let owner, w, p;
const admin = (method, url, body) => request(app)[method]('/api/online-store' + url).set('Authorization', 'Bearer ' + owner.token).send(body);
const shop = (method, url, body, key) => { const r = request(app)[method]('/api/public/shop/ekstra-magaza' + url); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
let n = 0; const key = () => 'ekstra-key-' + Date.now() + '-' + (++n);
const cart = (qty = 1, over = {}) => ({ delivery_method: 'delivery', city: 'İstanbul', items: [{ product_id: p.id, quantity: qty }], ...over });
const order = (over = {}) => ({ payment_method: 'cod', customer_name: 'Ayşe Demir', phone: '0532 123 45 67', address: 'Atatürk Mah. 12. Sok. No 5 Kadıköy', consent: true, ...cart(1), ...over });

beforeAll(async () => {
  owner = await createTenant();
  const wh = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [wh.id]);
  const wid = Number((await db.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [owner.tenantId])).rows[0].id);
  p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,category,module_type) VALUES($1,'EX-1','Fincan',NULL,'adet',100,'Genel','NORMAL') RETURNING id", [owner.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [owner.tenantId, wid, p.id]);
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [owner.tenantId]);
  await admin('put', `/products/${p.id}`, { published: true });
  const saved = await admin('put', '/settings', { slug: 'ekstra-magaza', name: 'Ekstra', cod_enabled: true, transfer_enabled: true, transfer_note: 'TR00 0000 0000 0000 0000 0000 00', pickup_enabled: true, delivery_fee: 30, free_delivery_over: 500, min_order: 0, warehouse_id: wid, published: true });
  expect(saved.status).toBe(200);
});

describe('kargo kuralları', () => {
  test('doğrulama: il adı, ad, ücret', async () => {
    expect((await admin('post', '/shipping-rules', { name: 'X', cities: 'Atlantis', fee: 10 })).status).toBe(400);
    expect((await admin('post', '/shipping-rules', { name: '', cities: '*', fee: 10 })).status).toBe(400);
    expect((await admin('post', '/shipping-rules', { name: 'X', cities: '*', fee: -1 })).status).toBe(400);
  });
  test('il kuralı varsayılanı ezer; ilk eşleşen kazanır; ücretsiz eşik', async () => {
    const r1 = await admin('post', '/shipping-rules', { name: 'Marmara', cities: 'istanbul, KOCAELİ', fee: 15, free_over: 200 });
    expect(r1.status).toBe(200); expect(r1.body.items[0].cities).toEqual(['İstanbul', 'Kocaeli']);
    await admin('post', '/shipping-rules', { name: 'Tüm Türkiye', cities: '*', fee: 60 });
    const ist = (await shop('post', '/quote', cart(1))).body;
    expect(ist).toMatchObject({ subtotal: 100, delivery_fee: 15, total: 115, shipping_rule: 'Marmara', city: 'İstanbul' });
    expect((await shop('post', '/quote', cart(2))).body).toMatchObject({ delivery_fee: 0, total: 200 });
    expect((await shop('post', '/quote', cart(1, { city: 'Van' }))).body).toMatchObject({ delivery_fee: 60, shipping_rule: 'Tüm Türkiye' });
    expect((await shop('post', '/quote', cart(1, { delivery_method: 'pickup', city: undefined }))).body.delivery_fee).toBe(0);
  });
  test('kural varken adreste il zorunlu; geçersiz il reddedilir; vitrin il listesini verir', async () => {
    expect((await shop('post', '/orders', order({ city: undefined }), key())).body.code).toBe('CITY_REQUIRED');
    expect((await shop('post', '/orders', order({ city: 'Atlantis' }), key())).body.code).toBe('BAD_CITY');
    expect((await shop('get', '')).body.provinces.length).toBe(81);
  });
  test('sipariş kural ücretiyle oluşur ve şehir kaydedilir', async () => {
    const o = await shop('post', '/orders', order(), key());
    expect(o.status).toBe(201); expect(o.body).toMatchObject({ delivery_fee: 15, total: 115 });
    const row = (await db.query('SELECT x.city,x.shipping_rule FROM online_order_extras x JOIN online_orders o ON o.id=x.order_id WHERE o.public_code=$1', [o.body.code])).rows[0];
    expect(row).toMatchObject({ city: 'İstanbul', shipping_rule: 'Marmara' });
  });
  test('silme', async () => {
    const list = (await admin('get', '/shipping-rules')).body.items;
    for (const r of list) await admin('delete', `/shipping-rules/${r.id}`);
    expect((await admin('get', '/shipping-rules')).body.items.length).toBe(0);
    expect((await shop('post', '/quote', cart(1, { city: undefined }))).body.delivery_fee).toBe(30);
  });
});

describe('indirim kodları', () => {
  let pct, amt, free;
  test('doğrulama', async () => {
    for (const bad of [{ code: 'a', kind: 'percent', value: 10 }, { code: 'ABC', kind: 'percent', value: 101 }, { code: 'ABC', kind: 'amount', value: 0 }, { code: 'ABC', kind: 'x', value: 5 }, { code: 'ABC', kind: 'percent', value: 5, starts_at: '2030-01-02', ends_at: '2030-01-01' }]) expect((await admin('post', '/discount-codes', bad)).status).toBe(400);
  });
  test('oluşturma ve aynı kodun tekrarı', async () => {
    pct = (await admin('post', '/discount-codes', { code: 'yuzde10', kind: 'percent', value: 10, min_order: 150, max_uses: 2 })).body.items[0];
    expect(pct.code).toBe('YUZDE10');
    amt = (await admin('post', '/discount-codes', { code: 'TL50', kind: 'amount', value: 500 })).body.items[0];
    free = (await admin('post', '/discount-codes', { code: 'KARGOBEDAVA', kind: 'free_shipping' })).body.items[0];
    expect((await admin('post', '/discount-codes', { code: 'TL50', kind: 'amount', value: 5 })).body.code).toBe('CODE_TAKEN');
  });
  test('sepet özeti: yüzde, tutar (sepeti aşamaz), kargo bedava, minimum', async () => {
    expect((await shop('post', '/quote', cart(2, { discount_code: 'yuzde10' }))).body).toMatchObject({ subtotal: 200, discount: 20, delivery_fee: 30, total: 210 });
    expect((await shop('post', '/quote', cart(1, { discount_code: 'tl50' }))).body).toMatchObject({ discount: 100, total: 30 });
    expect((await shop('post', '/quote', cart(1, { discount_code: 'KARGOBEDAVA' }))).body).toMatchObject({ discount: 0, delivery_fee: 0, total: 100 });
    expect((await shop('post', '/quote', cart(1, { discount_code: 'YUZDE10' }))).body.code).toBe('CODE_MIN_ORDER');
    expect((await shop('post', '/quote', cart(1, { discount_code: 'YOKBOYLE' }))).body.code).toBe('BAD_CODE');
  });
  test('kullanım sınırı: sipariş kodu tüketir, iptal geri verir, sınırda ikinci kişi reddedilir', async () => {
    const o1 = await shop('post', '/orders', order({ ...cart(2), discount_code: 'yuzde10' }), key());
    expect(o1.status).toBe(201); expect(o1.body).toMatchObject({ discount: 20, total: 210 });
    const o2 = await shop('post', '/orders', order({ ...cart(2), discount_code: 'YUZDE10' }), key());
    expect(o2.status).toBe(201);
    const o3 = await shop('post', '/orders', order({ ...cart(2), discount_code: 'YUZDE10' }), key());
    expect(o3.status).toBe(422); expect(o3.body.code).toBe('CODE_USED_UP');
    const stockBefore = Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [p.id])).rows[0].q);
    expect((await db.query('SELECT used_count FROM online_discount_codes WHERE id=$1', [pct.id])).rows[0].used_count).toBe(2);
    const id = (await db.query('SELECT id FROM online_orders WHERE public_code=$1', [o2.body.code])).rows[0].id;
    expect((await admin('patch', `/orders/${id}/status`, { status: 'cancelled' })).status).toBe(200);
    expect(Number((await db.query('SELECT used_count FROM online_discount_codes WHERE id=$1', [pct.id])).rows[0].used_count)).toBe(1);
    expect(Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [p.id])).rows[0].q)).toBe(stockBefore + 2);
    expect((await shop('post', '/orders', order({ ...cart(2), discount_code: 'YUZDE10' }), key())).status).toBe(201);
  });
  test('tekrar gönderim kodu bir kez tüketir', async () => {
    const k = key();
    const before = Number((await db.query('SELECT used_count FROM online_discount_codes WHERE id=$1', [amt.id])).rows[0].used_count);
    await shop('post', '/orders', order({ ...cart(1), discount_code: 'TL50' }), k); await shop('post', '/orders', order({ ...cart(1), discount_code: 'TL50' }), k);
    expect(Number((await db.query('SELECT used_count FROM online_discount_codes WHERE id=$1', [amt.id])).rows[0].used_count)).toBe(before + 1);
  });
  test('süre ve pasif kod', async () => {
    await admin('put', `/discount-codes/${amt.id}`, { ends_at: '2020-01-01 00:00:00' });
    expect((await shop('post', '/quote', cart(1, { discount_code: 'TL50' }))).body.code).toBe('CODE_EXPIRED');
    await admin('put', `/discount-codes/${amt.id}`, { ends_at: null, starts_at: '2099-01-01 00:00:00' });
    expect((await shop('post', '/quote', cart(1, { discount_code: 'TL50' }))).body.code).toBe('CODE_NOT_STARTED');
    await admin('put', `/discount-codes/${amt.id}`, { starts_at: null, active: false });
    expect((await shop('post', '/quote', cart(1, { discount_code: 'TL50' }))).body.code).toBe('BAD_CODE');
  });
  test('silme; başka işletme koduna erişilemez', async () => {
    const other = await createTenant();
    await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [other.tenantId]);
    const res = await request(app).delete(`/api/online-store/discount-codes/${free.id}`).set('Authorization', 'Bearer ' + other.token);
    expect(res.status).toBe(404);
    expect((await admin('delete', `/discount-codes/${free.id}`)).body.items.some(c => c.id === free.id)).toBe(false);
  });
});

describe('kargo takibi', () => {
  test('onaylanmamış siparişe girilmez; onaydan sonra kaydedilir ve müşteri sayfasında görünür', async () => {
    const o = await shop('post', '/orders', order({ city: 'İstanbul' }), key());
    const id = (await db.query('SELECT id FROM online_orders WHERE public_code=$1', [o.body.code])).rows[0].id;
    expect((await admin('put', `/orders/${id}/shipping`, { carrier: 'Yurtiçi', tracking_no: 'YK123456' })).body.code).toBe('BAD_STATUS');
    await admin('patch', `/orders/${id}/status`, { status: 'confirmed' });
    expect((await admin('put', `/orders/${id}/shipping`, { carrier: 'Yurtiçi Kargo', tracking_no: '<b>' })).status).toBe(400);
    expect((await admin('put', `/orders/${id}/shipping`, { carrier: 'Yurtiçi Kargo', tracking_no: 'YK123456' })).status).toBe(200);
    const pub = (await shop('get', `/orders/${o.body.code}`)).body;
    expect(pub).toMatchObject({ carrier: 'Yurtiçi Kargo', tracking_no: 'YK123456' });
    const det = (await admin('get', `/orders/${id}`)).body;
    expect(det).toMatchObject({ carrier: 'Yurtiçi Kargo', tracking_no: 'YK123456', city: 'İstanbul' });
    expect(det.shipped_at).toBeTruthy();
  });
});
