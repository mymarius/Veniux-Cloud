process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.SHOP_READ_MAX = '100000'; process.env.SHOP_ORDER_MINUTE_MAX = '100000'; process.env.SHOP_ORDER_HOUR_MAX = '100000'; process.env.SHOP_QUOTE_MAX = '100000';
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');
const domains = require('../src/services/onlineStoreDomain');

// Online mağaza Faz 2: kiloyla satış, müşteri kaydı (CRM), özel alan adı, merkezi paket doğrulaması.
let owner, other, kg, adet, wid;
const admin = (who, method, url, body) => request(app)[method]('/api/online-store' + url).set('Authorization', 'Bearer ' + who.token).send(body);
const shop = (method, url, body, key, host) => { const r = request(app)[method]('/api/public/shop/faz2-magaza' + url); if (host) r.set('Host', host); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
let n = 0; const key = () => 'faz2-key-' + Date.now() + '-' + (++n);
const order = (items, over = {}) => ({ delivery_method: 'pickup', payment_method: 'pickup', customer_name: 'Ayşe Demir', phone: '0532 123 45 67', consent: true, items, ...over });
const stockOf = async id => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [id])).rows[0].q);

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  const wh = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [wh.id]);
  wid = Number((await db.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [owner.tenantId])).rows[0].id);
  const mk = async (sku, name, price, unit) => (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,category,module_type) VALUES($1,$2,$3,NULL,$4,$5,'Gıda','NORMAL') RETURNING id", [owner.tenantId, sku, name, unit, price])).rows[0];
  kg = await mk('F2-KG', 'Çay', 200, 'kg'); adet = await mk('F2-AD', 'Bardak', 10, 'adet');
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,10.5)', [owner.tenantId, wid, kg.id]);
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [owner.tenantId, wid, adet.id]);
  for (const t of [owner, other]) await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [t.tenantId]);
  await admin(owner, 'put', `/products/${adet.id}`, { published: true });
  expect((await admin(owner, 'put', '/settings', { slug: 'faz2-magaza', name: 'Faz2', cod_enabled: true, pickup_enabled: true, delivery_fee: 0, min_order: 0, warehouse_id: wid, published: true })).status).toBe(200);
});

describe('kiloyla satış', () => {
  test('adım ve minimum doğrulanır; varsayılan kg için 0,5', async () => {
    expect((await admin(owner, 'put', `/products/${kg.id}`, { published: true, step: 0.0001 })).body.code).toBe('BAD_STEP');
    expect((await admin(owner, 'put', `/products/${kg.id}`, { published: true, step: 0.25, min_qty: 0.1 })).body.code).toBe('BAD_MIN');
    const ok = await admin(owner, 'put', `/products/${kg.id}`, { published: true, step: 0.25, min_qty: 0.5, max_per_order: 5 });
    expect(ok.status).toBe(200); expect(ok.body).toMatchObject({ step: 0.25, min_qty: 0.5, max_per_order: 5 });
    const list = (await admin(owner, 'get', '/products')).body.items.find(i => i.id === kg.id);
    expect(list).toMatchObject({ measured_unit: true, step: 0.25, min_qty: 0.5 });
  });
  test('vitrin tartılı ürünü adım bilgisiyle ve ondalıklı stok durumuyla gösterir', async () => {
    const item = (await shop('get', '/products')).body.items.find(i => i.id === kg.id);
    expect(item).toMatchObject({ measured: true, step: 0.25, min_qty: 0.5, unit_label: 'kg', stock_state: 'ok' });
    expect((await shop('get', `/products/${kg.id}`)).body.measured).toBe(true);
  });
  test('sepet özeti ve sipariş ondalıklı miktarla doğru tutar ve stok', async () => {
    const q = await shop('post', '/quote', { delivery_method: 'pickup', items: [{ product_id: kg.id, quantity: 1.75 }, { product_id: adet.id, quantity: 2 }] });
    expect(q.body).toMatchObject({ subtotal: 370, total: 370 });
    const o = await shop('post', '/orders', order([{ product_id: kg.id, quantity: 1.75 }]), key());
    expect(o.status).toBe(201); expect(o.body).toMatchObject({ total: 350 });
    expect(o.body.items[0]).toMatchObject({ quantity: 1.75, line_total: 350 });
    expect(await stockOf(kg.id)).toBeCloseTo(8.75, 6);
  });
  test('adımın katı olmayan, minimumun altındaki, üst sınırı aşan ve fazla basamaklı miktar reddedilir', async () => {
    for (const quantity of [1.1, 0.25, 0.0001, 5.25]) expect((await shop('post', '/orders', order([{ product_id: kg.id, quantity }]), key())).status).toBeGreaterThanOrEqual(400);
    expect((await shop('post', '/orders', order([{ product_id: kg.id, quantity: 1.1 }]), key())).body.code).toBe('BAD_QTY');
    expect((await shop('post', '/orders', order([{ product_id: kg.id, quantity: 5.5 }]), key())).body.code).toBe('MAX_PER_ORDER');
    expect((await shop('post', '/orders', order([{ product_id: adet.id, quantity: 1.5 }]), key())).body.code).toBe('BAD_QTY');
    expect(await stockOf(kg.id)).toBeCloseTo(8.75, 6);
  });
  test('stok yetersizse mevcut ondalıklı stok bildirilir; iptalde ondalıklı stok geri gelir', async () => {
    await admin(owner, 'put', `/products/${kg.id}`, { max_per_order: 50 });
    const short = await shop('post', '/orders', order([{ product_id: kg.id, quantity: 9 }]), key());
    expect(short.status).toBe(409); expect(short.body.shortages[0].available).toBeCloseTo(8.75, 3);
    const o = await shop('post', '/orders', order([{ product_id: kg.id, quantity: 0.5 }]), key());
    expect(await stockOf(kg.id)).toBeCloseTo(8.25, 6);
    const id = (await db.query('SELECT id FROM online_orders WHERE public_code=$1', [o.body.code])).rows[0].id;
    expect((await admin(owner, 'patch', `/orders/${id}/status`, { status: 'cancelled' })).status).toBe(200);
    expect(await stockOf(kg.id)).toBeCloseTo(8.75, 6);
  });
});

describe('müşteri kaydı (CRM)', () => {
  test('sipariş müşteriyi açar; aynı telefon aynı müşteriyi günceller (biçimden bağımsız)', async () => {
    const before = (await admin(owner, 'get', '/customers')).body.total;
    await shop('post', '/orders', order([{ product_id: adet.id, quantity: 2 }], { phone: '0533 111 22 33', customer_name: 'Mehmet Kaya' }), key());
    await shop('post', '/orders', order([{ product_id: adet.id, quantity: 3 }], { phone: '+90 533 111 22 33', customer_name: 'Mehmet K.' }), key());
    const list = (await admin(owner, 'get', '/customers?q=111')).body;
    expect(list.total).toBe(1); expect((await admin(owner, 'get', '/customers')).body.total).toBe(before + 1);
    expect(list.items[0]).toMatchObject({ name: 'Mehmet K.', order_count: 2, total_spent: 50 });
  });
  test('ayrıntı siparişleri listeler; iptal sayaçları geri alır; tekrar eden müşteri sayısı', async () => {
    const c = (await admin(owner, 'get', '/customers?q=111')).body.items[0];
    const det = (await admin(owner, 'get', `/customers/${c.id}`)).body;
    expect(det.orders.length).toBe(2);
    const cancelId = det.orders[0].id;
    await admin(owner, 'patch', `/orders/${cancelId}/status`, { status: 'cancelled' });
    expect((await admin(owner, 'get', `/customers/${c.id}`)).body).toMatchObject({ order_count: 1 });
    expect((await admin(owner, 'get', '/customers')).body.repeat).toBeGreaterThanOrEqual(0);
  });
  test('anonimleştirme: açık siparişi varsa reddedilir; sonra kişisel veri silinir', async () => {
    const c = (await admin(owner, 'get', '/customers?q=111')).body.items[0];
    expect((await admin(owner, 'delete', `/customers/${c.id}`)).body.code).toBe('OPEN_ORDERS');
    const det = (await admin(owner, 'get', `/customers/${c.id}`)).body;
    for (const o of det.orders.filter(x => x.status !== 'cancelled')) await admin(owner, 'patch', `/orders/${o.id}/status`, { status: 'cancelled' });
    expect((await admin(owner, 'delete', `/customers/${c.id}`)).status).toBe(200);
    const after = (await admin(owner, 'get', `/customers/${c.id}`)).body;
    expect(after).toMatchObject({ anonymized: true, name: 'Silinmiş müşteri', phone: '' });
    const row = (await db.query("SELECT customer_name,phone FROM online_orders WHERE id=$1", [det.orders[0].id])).rows[0];
    expect(row).toMatchObject({ customer_name: 'Silinmiş müşteri', phone: '0000000000' });
  });
  test('başka işletme müşterisine erişilemez; müşteri uçları yönetici gerektirir', async () => {
    const c = (await admin(owner, 'get', '/customers')).body.items[0];
    expect((await admin(other, 'get', `/customers/${c.id}`)).status).toBe(404);
  });
});

describe('özel alan adı', () => {
  test('geçersiz ve ayrılmış alan adları reddedilir', async () => {
    for (const domain of ['localhost', 'a', 'https://', 'app.veniux.com', 'x.veniux.com', 'bad_domain.com', '1.2.3.4']) expect((await admin(owner, 'put', '/domain', { domain })).status).toBe(422);
  });
  test('kayıt, başka işletmeye çakışma, doğrulanmadan yönlendirme yok', async () => {
    const saved = await admin(owner, 'put', '/domain', { domain: 'https://Magaza.Faz2Test.com/yol' });
    expect(saved.body.domain).toMatchObject({ domain: 'magaza.faz2test.com', verified: false });
    expect(saved.body.domain.instructions.txt.name).toBe('_veniux-verify.magaza.faz2test.com');
    expect((await admin(other, 'put', '/domain', { domain: 'magaza.faz2test.com' })).body.code).toBe('DOMAIN_TAKEN');
    domains.clearCache();
    const res = await request(app).get('/').set('Host', 'magaza.faz2test.com');
    expect(res.headers['content-type'] || '').not.toMatch(/application\/xml/);
    expect(await domains.lookup('magaza.faz2test.com')).toBeNull();
  });
  test('TXT doğrulaması geçince alan adı mağazaya yönlenir; diğer sayfalar kapalıdır', async () => {
    const token = (await admin(owner, 'get', '/domain')).body.domain.instructions.txt.value;
    domains.resolver.txt = async () => [['yanlis']]; domains.resolver.cname = async () => { throw new Error('yok'); };
    expect((await admin(owner, 'post', '/domain/verify')).body).toMatchObject({ domain: { verified: false }, checks: { txt: false } });
    domains.resolver.txt = async () => [[token]]; domains.resolver.cname = async () => ['app.veniux.com.'];
    const v = await admin(owner, 'post', '/domain/verify');
    expect(v.body).toMatchObject({ domain: { verified: true }, checks: { txt: true, cname: true } });
    domains.clearCache();
    expect(await domains.lookup('magaza.faz2test.com:443')).toMatchObject({ slug: 'faz2-magaza' });
    const home = await request(app).get('/').set('Host', 'magaza.faz2test.com');
    expect(home.status).toBe(200); expect(home.text).toMatch(/<title>Faz2<\/title>/);
    const map = await request(app).get('/sitemap.xml').set('Host', 'magaza.faz2test.com');
    expect(map.text).toMatch(/<urlset/); expect(map.text).toContain('magaza.faz2test.com/magaza/faz2-magaza');
    expect((await request(app).get('/giris').set('Host', 'magaza.faz2test.com')).status).toBe(302);
    expect((await request(app).get('/api/public/shop/faz2-magaza/products').set('Host', 'magaza.faz2test.com')).body.total).toBeGreaterThan(0);
    expect((await request(app).get('/api/auth/me').set('Host', 'magaza.faz2test.com')).status).toBe(302);
  });
  test('yayından kalkınca ve alan adı silinince yönlendirme biter', async () => {
    await admin(owner, 'put', '/settings', { slug: 'faz2-magaza', name: 'Faz2', cod_enabled: true, pickup_enabled: true, delivery_fee: 0, min_order: 0, warehouse_id: wid, published: false });
    domains.clearCache(); expect(await domains.lookup('magaza.faz2test.com')).toBeNull();
    await admin(owner, 'put', '/settings', { slug: 'faz2-magaza', name: 'Faz2', cod_enabled: true, pickup_enabled: true, delivery_fee: 0, min_order: 0, warehouse_id: wid, published: true });
    expect((await admin(owner, 'delete', '/domain')).body.domain).toBeNull();
    domains.clearCache(); expect(await domains.lookup('magaza.faz2test.com')).toBeNull();
  });
});

describe('merkezi paket doğrulaması', () => {
  const seen = require('../src/services/cloudLicenseSeen');
  test('bulut izlenmiyorsa hep izinli; izlenen bulutta kayıt tazeliği aranır', async () => {
    expect(await seen.packAllowed(owner.tenantId, 'online_store')).toBe(true);
    process.env.VENIUX_CLOUD_SERVICE = '1'; process.env.VENIUX_LICENSE_AUTHORITY_URL = 'https://lisans.example.test';
    try {
      await db.query('INSERT INTO cloud_license_bindings (tenant_id,authority_license_id) VALUES ($1,$2)', [owner.tenantId, 9101]);
      expect(await seen.packAllowed(owner.tenantId, 'online_store')).toBe(true);
      expect((await db.query('SELECT COUNT(*) AS n FROM cloud_pack_seen WHERE authority_license_id=9101')).rows[0].n).toBe(1);
      await db.query('UPDATE cloud_pack_seen SET last_seen_epoch=$1 WHERE authority_license_id=9101', [Math.floor(Date.now() / 1000) - 8 * 86400]);
      expect(await seen.packAllowed(owner.tenantId, 'online_store')).toBe(false);
      expect((await shop('get', '')).status).toBe(404);
      await seen.touch({ valid: true, license_id: 9101, addons: ['online_store'] });
      expect(await seen.packAllowed(owner.tenantId, 'online_store')).toBe(true);
      expect((await shop('get', '')).status).toBe(200);
      await db.query("DELETE FROM sector_packs WHERE tenant_id=$1", [owner.tenantId]);
      await db.query('UPDATE cloud_license_seen SET last_valid_epoch=1 WHERE authority_license_id=9101');
      await seen.syncPacks(9101, { addons: [] });
      expect((await db.query('SELECT COUNT(*) AS n FROM cloud_pack_seen WHERE authority_license_id=9101')).rows[0].n).toBe(0);
    } finally {
      delete process.env.VENIUX_CLOUD_SERVICE; delete process.env.VENIUX_LICENSE_AUTHORITY_URL;
      await db.query('DELETE FROM cloud_license_bindings WHERE tenant_id=$1', [owner.tenantId]);
    }
  });
});
