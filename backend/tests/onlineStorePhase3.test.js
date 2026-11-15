process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.SHOP_READ_MAX = '100000'; process.env.SHOP_ORDER_MINUTE_MAX = '100000'; process.env.SHOP_ORDER_HOUR_MAX = '100000'; process.env.SHOP_QUOTE_MAX = '100000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');
const payments = require('../src/services/onlineStorePayments');
const extras = require('../src/services/onlineStoreExtras');

// Online mağaza: kargo takip bağlantıları, vitrin teması, kartla ödeme (iyzico, sahte taşıma katmanıyla).
let owner, p, wid, calls;
const admin = (method, url, body) => request(app)[method]('/api/online-store' + url).set('Authorization', 'Bearer ' + owner.token).send(body);
const shop = (method, url, body, key) => { const r = request(app)[method]('/api/public/shop/faz3-magaza' + url); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
let n = 0; const key = () => 'faz3-key-' + Date.now() + '-' + (++n);
const order = (over = {}) => ({ delivery_method: 'pickup', payment_method: 'card', customer_name: 'Ayşe Demir', phone: '0532 123 45 67', email: 'ayse@example.com', consent: true, items: [{ product_id: p.id, quantity: 2 }], ...over });
const stockOf = async () => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [p.id])).rows[0].q);
// İyzico sahte yanıtları: başlatma token verir; sorgulama sahne durumuna göre döner.
let detail = null;
const realTransport = payments.transport.post;
beforeAll(async () => {
  payments.transport.post = async (url, headers, body) => {
    const b = JSON.parse(body); calls.push({ url, headers, body: b });
    if (url.includes('/initialize/')) return { status: 200, json: { status: 'success', token: 'tok-' + b.conversationId + '-' + calls.length, paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=abc' } };
    if (url.includes('/detail')) return { status: 200, json: typeof detail === 'function' ? detail(b) : detail };
    if (url.includes('/payment/cancel')) return { status: 200, json: { status: 'success' } };
    return { status: 404, json: {} };
  };
  owner = await createTenant();
  const wh = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [wh.id]);
  wid = Number((await db.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [owner.tenantId])).rows[0].id);
  p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,category,module_type) VALUES($1,'F3-1','Fincan',NULL,'adet',100,'Genel','NORMAL') RETURNING id", [owner.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,50)', [owner.tenantId, wid, p.id]);
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [owner.tenantId]);
  await admin('put', `/products/${p.id}`, { published: true });
  expect((await admin('put', '/settings', { slug: 'faz3-magaza', name: 'Faz3', cod_enabled: true, pickup_enabled: true, delivery_fee: 0, min_order: 0, warehouse_id: wid, published: true })).status).toBe(200);
});
afterAll(() => { payments.transport.post = realTransport; });
beforeEach(() => { calls = []; });

describe('kargo firmaları', () => {
  test('bilinen firmada takip bağlantısı üretilir, bilinmeyende boş kalır', () => {
    expect(extras.trackingUrl('Yurtiçi Kargo', 'AB 12')).toBe('https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=AB%2012');
    expect(extras.trackingUrl('ups', '1Z999')).toMatch(/ups\.com\/track\?tracknum=1Z999/);
    expect(extras.trackingUrl('MNG Kargo', '12345')).toBe('');
    expect(extras.trackingUrl('Bilinmeyen', '12345')).toBe('');
    expect(extras.trackingUrl('ups', '')).toBe('');
  });
  test('kargo listesi ve sipariş sayfasında bağlantı', async () => {
    expect((await admin('get', '/carriers')).body.items.some(c => c.key === 'aras' && c.has_link)).toBe(true);
    const o = await shop('post', '/orders', order({ payment_method: 'pickup' }), key());
    const id = (await db.query('SELECT id FROM online_orders WHERE public_code=$1', [o.body.code])).rows[0].id;
    await admin('patch', `/orders/${id}/status`, { status: 'confirmed' });
    await admin('put', `/orders/${id}/shipping`, { carrier: 'Aras Kargo', tracking_no: 'ARAS123456' });
    expect((await shop('get', `/orders/${o.body.code}`)).body.tracking_url).toBe('https://kargotakip.araskargo.com.tr/mainpage.aspx?code=ARAS123456');
  });
});

describe('vitrin teması', () => {
  test('varsayılan, doğrulama, kontrast ve vitrine yansıma', async () => {
    expect((await admin('get', '/theme')).body.theme).toMatchObject({ color: '#b23f04', layout: 'grid', font: 'modern', hero: 'plain' });
    expect((await admin('put', '/theme', { color: 'kırmızı' })).body.code).toBe('BAD_COLOR');
    expect((await admin('put', '/theme', { color: '#ffee99' })).body.code).toBe('LOW_CONTRAST');
    expect((await admin('put', '/theme', { layout: 'x' })).body.code).toBe('BAD_THEME');
    const ok = await admin('put', '/theme', { color: '#0f766e', layout: 'list', font: 'classic', hero: 'bold', banner: '  Kargo   bedava  ' });
    expect(ok.body.theme).toMatchObject({ color: '#0f766e', layout: 'list', banner: 'Kargo bedava', ink: '#ffffff' });
    expect((await shop('get', '')).body.theme).toMatchObject({ color: '#0f766e', hero: 'bold', ink: '#ffffff' });
  });
  test('koyu renkte yazı beyaz, açık ama yeterli kontrastta uygun ton seçilir', () => {
    const t = require('../src/services/onlineStoreTheme');
    expect(t.inkFor('#1d4ed8')).toBe('#ffffff');
    expect(t.ratio('#b23f04', '#ffffff')).toBeGreaterThan(3);
  });
});

describe('kartla ödeme', () => {
  const keys = { api_key: 'sandbox-api-key-123', secret_key: 'sandbox-secret-key-456', sandbox: true, enabled: true };
  test('anahtarlar kaydedilir ama geri okunamaz; kapalıyken kart seçilemez', async () => {
    expect((await shop('post', '/orders', order(), key())).body.code).toBe('CARD_DISABLED');
    expect((await admin('put', '/payment', { api_key: 'a b', secret_key: 'x' })).body.code).toBe('BAD_KEYS');
    const saved = await admin('put', '/payment', keys);
    expect(saved.body).toMatchObject({ enabled: true, sandbox: true, has_keys: true, key_hint: '-123' });
    expect(JSON.stringify(saved.body)).not.toContain('secret-key');
    const raw = (await db.query('SELECT secrets FROM online_payment_settings WHERE tenant_id=$1', [owner.tenantId])).rows[0].secrets;
    expect(raw).not.toContain('sandbox-secret'); expect(raw).not.toContain('sandbox-api');
    expect((await shop('get', '')).body.payment.card).toBe(true);
  });
  test('e-posta zorunlu; sipariş ödeme sayfası adresi döner; istek imzalı ve tutarlar doğru', async () => {
    expect((await shop('post', '/orders', order({ email: undefined }), key())).body.code).toBe('EMAIL_REQUIRED');
    const o = await shop('post', '/orders', order({ items: [{ product_id: p.id, quantity: 3 }] }), key());
    expect(o.status).toBe(201); expect(o.body.payment_url).toBe('https://sandbox-cpp.iyzipay.com?token=abc');
    const init = calls.find(c => c.url.includes('/initialize/'));
    expect(init.url.startsWith('https://sandbox-api.iyzipay.com/')).toBe(true);
    expect(init.body).toMatchObject({ price: '300.00', paidPrice: '300.00', currency: 'TRY' });
    expect(init.body.basketItems.reduce((s, i) => s + Number(i.price), 0)).toBeCloseTo(300, 2);
    expect(init.body.buyer.gsmNumber).toBe('+905321234567');
    expect(init.body.callbackUrl).toMatch(/\/api\/public\/shop\/faz3-magaza\/payment\/callback$/);
    const auth = Buffer.from(init.headers.Authorization.replace('IYZWSv2 ', ''), 'base64').toString();
    const m = auth.match(/^apiKey:(.+)&randomKey:(.+)&signature:(.+)$/);
    expect(m[1]).toBe('sandbox-api-key-123');
    expect(m[3]).toBe(crypto.createHmac('sha256', 'sandbox-secret-key-456').update(m[2] + '/payment/iyzipos/checkoutform/initialize/auth/ecom' + JSON.stringify(init.body)).digest('hex'));
    expect(JSON.stringify(init.body)).not.toMatch(/cardNumber|cvc/i);
  });
  test('ödeme alınmadan sipariş onaylanamaz; işletmeye bildirim yok; liste durumu gösterir', async () => {
    const id = (await db.query("SELECT o.id FROM online_orders o JOIN online_payments p ON p.order_id=o.id WHERE o.tenant_id=$1 AND p.status='pending' ORDER BY o.id DESC LIMIT 1", [owner.tenantId])).rows[0].id;
    expect((await admin('patch', `/orders/${id}/status`, { status: 'confirmed' })).body.code).toBe('PAYMENT_PENDING');
    const row = (await admin('get', '/orders')).body.items.find(i => i.id === id);
    expect(row.payment_status).toBe('pending');
  });
  test('geri çağırma: tutar ve sipariş eşleşirse ödendi olur; sonuç istekteki değere değil sorguya göre belirlenir', async () => {
    const o = await shop('post', '/orders', order(), key());
    const pay = (await db.query('SELECT p.token,o.number,p.amount FROM online_payments p JOIN online_orders o ON o.id=p.order_id WHERE o.public_code=$1', [o.body.code])).rows[0];
    detail = () => ({ status: 'success', paymentStatus: 'SUCCESS', paidPrice: '1.00', basketId: 'S-' + String(pay.number).padStart(6, '0'), paymentId: 'P1' });
    const wrongAmount = await request(app).post('/api/public/shop/faz3-magaza/payment/callback').type('form').send({ token: pay.token, status: 'success' });
    expect(wrongAmount.status).toBe(303);
    expect((await shop('get', `/orders/${o.body.code}`)).body.status).toBe('cancelled');
    const stockAfter = await stockOf();
    const o2 = await shop('post', '/orders', order(), key());
    const pay2 = (await db.query('SELECT p.token,o.number FROM online_payments p JOIN online_orders o ON o.id=p.order_id WHERE o.public_code=$1', [o2.body.code])).rows[0];
    expect(await stockOf()).toBe(stockAfter - 2);
    detail = () => ({ status: 'success', paymentStatus: 'SUCCESS', paidPrice: '200.00', basketId: 'S-' + String(pay2.number).padStart(6, '0'), paymentId: 'P2' });
    const good = await request(app).post('/api/public/shop/faz3-magaza/payment/callback').type('form').send({ token: pay2.token });
    expect(good.headers.location).toBe(`/magaza/faz3-magaza/siparis/${o2.body.code}`);
    expect((await shop('get', `/orders/${o2.body.code}`)).body.payment.status).toBe('paid');
    // aynı token tekrar gelirse etkisiz
    await request(app).post('/api/public/shop/faz3-magaza/payment/callback').type('form').send({ token: pay2.token });
    expect(await stockOf()).toBe(stockAfter - 2);
    const id = (await db.query('SELECT id FROM online_orders WHERE public_code=$1', [o2.body.code])).rows[0].id;
    expect((await admin('patch', `/orders/${id}/status`, { status: 'confirmed' })).status).toBe(200);
  });
  test('başarısız ödeme siparişi iptal eder, stok ve indirim kodu geri gelir', async () => {
    await admin('post', '/discount-codes', { code: 'KART10', kind: 'percent', value: 10, max_uses: 1 });
    const before = await stockOf();
    const o = await shop('post', '/orders', order({ discount_code: 'KART10' }), key());
    expect(o.body.total).toBe(180);
    expect(calls.find(c => c.url.includes('/initialize/')).body.basketItems.reduce((s, i) => s + Number(i.price), 0)).toBeCloseTo(180, 2);
    const pay = (await db.query('SELECT token FROM online_payments p JOIN online_orders o ON o.id=p.order_id WHERE o.public_code=$1', [o.body.code])).rows[0];
    detail = { status: 'failure', paymentStatus: 'FAILURE', errorMessage: 'Kart reddedildi' };
    await request(app).post('/api/public/shop/faz3-magaza/payment/callback').type('form').send({ token: pay.token });
    expect((await shop('get', `/orders/${o.body.code}`)).body.status).toBe('cancelled');
    expect(await stockOf()).toBe(before);
    expect(Number((await db.query("SELECT used_count FROM online_discount_codes WHERE tenant_id=$1 AND code='KART10'", [owner.tenantId])).rows[0].used_count)).toBe(0);
  });
  test('ödeme sayfası açılamazsa sipariş oluşmaz (stok geri gelir)', async () => {
    const before = await stockOf();
    const keep = payments.transport.post;
    payments.transport.post = async () => ({ status: 200, json: { status: 'failure', errorMessage: 'hata' } });
    const r = await shop('post', '/orders', order(), key());
    payments.transport.post = keep;
    expect(r.status).toBe(502); expect(r.body.code).toBe('PAYMENT_UNAVAILABLE');
    expect(JSON.stringify(r.body)).not.toContain('hata');
    expect(await stockOf()).toBe(before);
  });
  test('süresi dolan bekleyen ödeme iptal olur; ödenmiş siparişin iptalinde iade istenir', async () => {
    const before = await stockOf();
    const o = await shop('post', '/orders', order(), key());
    expect(await stockOf()).toBe(before - 2);
    await db.query("UPDATE online_payments SET created_at='2020-01-01 00:00:00' WHERE order_id=(SELECT id FROM online_orders WHERE public_code=$1)", [o.body.code]);
    expect(await payments.expirePending(owner.tenantId)).toBe(1);
    expect((await shop('get', `/orders/${o.body.code}`)).body.status).toBe('cancelled');
    expect(await stockOf()).toBe(before);
    const o2 = await shop('post', '/orders', order(), key());
    const row = (await db.query('SELECT p.token,o.id,o.number FROM online_payments p JOIN online_orders o ON o.id=p.order_id WHERE o.public_code=$1', [o2.body.code])).rows[0];
    detail = () => ({ status: 'success', paymentStatus: 'SUCCESS', paidPrice: '200.00', basketId: 'S-' + String(row.number).padStart(6, '0'), paymentId: 'P9' });
    await request(app).post('/api/public/shop/faz3-magaza/payment/callback').type('form').send({ token: row.token });
    calls = [];
    const cancel = await admin('patch', `/orders/${row.id}/status`, { status: 'cancelled' });
    expect(cancel.body.refund).toBe('done');
    expect(calls.find(c => c.url.endsWith('/payment/cancel')).body.paymentId).toBe('P9');
  });
  test('geçersiz token reddedilir; yanlış işletmenin ödemesi karışmaz', async () => {
    expect((await request(app).post('/api/public/shop/faz3-magaza/payment/callback').type('form').send({ token: '!!' })).status).toBe(400);
    expect((await request(app).post('/api/public/shop/faz3-magaza/payment/callback').type('form').send({ token: 'yok-boyle-token-12345' })).status).toBe(404);
  });
});
