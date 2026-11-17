process.env.AUTH_RATE_LIMIT_MAX = '1000';
const http = require('http');
const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createTenant } = require('./factories/index');

const fake = { hbOrders: [], n11Packages: [], headers: [], bodies: [], urls: [], reject: false };
let server, T, warehouseId, productId;
const auth = r => r.set('Authorization', 'Bearer ' + T.token);
beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      fake.headers.push(req.headers); fake.urls.push(req.url);
      const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (fake.reject) return send(401, {});
      if (req.url.startsWith('/orders/merchantid/')) return send(200, { totalCount: fake.hbOrders.length, items: fake.hbOrders });
      if (req.url.includes('/inventory-uploads')) { fake.bodies.push(JSON.parse(raw)); return send(200, { id: 'up-1' }); }
      if (req.url.startsWith('/rest/delivery/v1/shipmentPackages')) return send(200, { totalPages: 1, totalElements: fake.n11Packages.length, content: fake.n11Packages });
      if (req.url.includes('/price-stock-update')) { fake.bodies.push(JSON.parse(raw)); return send(200, { id: 'task-9' }); }
      send(404, {});
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  process.env.HEPSIBURADA_TEST_BASE_URL = base; process.env.N11_TEST_BASE_URL = base;
  T = await createTenant();
  const wh = await auth(request(app).post('/api/warehouses')).send({ name: 'PZ Depo', type: 'main', location: 'X', capacity: 100 });
  warehouseId = wh.body.id || wh.body.warehouse?.id;
  const p = await auth(request(app).post('/api/products')).send({ sku: 'PZ1', name: 'PZ Ürün', barcode: 'PZ-111', category: 'A', purchase_price: 1, sale_price: 5, unit: 'adet' });
  productId = p.body.id || p.body.product?.id;
  expect((await auth(request(app).post('/api/stock/movement')).send({ product_id: productId, warehouse_id: warehouseId, change_amount: 10, movement_type: 'inbound' })).status).toBe(201);
});
afterAll(async () => { delete process.env.HEPSIBURADA_TEST_BASE_URL; delete process.env.N11_TEST_BASE_URL; await new Promise(r => server.close(r)); });
const stock = async () => Number((await pool.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id=$2', [T.tenantId, productId])).rows[0].q);

test('pazaryeri listesi üç sağlayıcıyı ve deneme durumunu gösterir; bilinmeyen ad 404', async () => {
  const r = await auth(request(app).get('/api/marketplace'));
  expect(r.body.providers.map(p => [p.id, p.experimental])).toEqual([['trendyol', false], ['hepsiburada', true], ['n11', true]]);
  expect((await auth(request(app).get('/api/marketplace/yok'))).status).toBe(404);
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) expect((await auth(request(app).get('/api/marketplace/' + name))).status).toBe(404);
});

describe('Hepsiburada', () => {
  const connect = extra => auth(request(app).put('/api/marketplace/hepsiburada')).send({ seller_id: 'abcd1234-aaaa-bbbb-cccc-1234567890ab', api_key: 'gelistirici-adi', api_secret: 'gizli-servis-anahtari', environment: 'test', warehouse_id: warehouseId, ...extra });
  test('denenmemiş sağlayıcı kapalı kaydedilir, anahtar şifreli saklanır ve dönmez', async () => {
    expect((await auth(request(app).put('/api/marketplace/hepsiburada')).send({ seller_id: '!', environment: 'test', warehouse_id: warehouseId })).status).toBe(400);
    const r = await connect();
    expect(r.status).toBe(200);
    expect(r.body.enabled).toBe(false);
    expect(r.body.experimental).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain('gizli');
    const row = (await pool.query("SELECT credentials_enc FROM marketplace_connections WHERE tenant_id=$1 AND provider='hepsiburada'", [T.tenantId])).rows[0];
    expect(row.credentials_enc).not.toContain('gizli');
  });
  test('bağlantı testi Basic kimlik ve geliştirici adıyla gider; reddedilince anlaşılır hata verir', async () => {
    fake.headers.length = 0;
    expect((await auth(request(app).post('/api/marketplace/hepsiburada/test'))).body.ok).toBe(true);
    expect(fake.headers[0].authorization).toBe('Basic ' + Buffer.from('abcd1234-aaaa-bbbb-cccc-1234567890ab:gizli-servis-anahtari').toString('base64'));
    expect(fake.headers[0]['user-agent']).toBe('gelistirici-adi');
    fake.reject = true;
    const bad = await auth(request(app).post('/api/marketplace/hepsiburada/test'));
    fake.reject = false;
    expect(bad.status).toBe(502); expect(bad.body.error).toContain('Hepsiburada');
  });
  test('sipariş stoktan düşer, tekrar çekilince çift düşmez, iptal stoğu geri verir; stok pazaryerine gider', async () => {
    const before = await stock();
    fake.hbOrders = [{ orderNumber: 'HB1', status: 'Open', items: [{ merchantSku: 'PZ-111', quantity: 2 }] }];
    const first = await auth(request(app).post('/api/marketplace/hepsiburada/sync'));
    expect(first.status).toBe(200); expect(first.body.orders.deducted).toBe(1);
    expect(await stock()).toBe(before - 2);
    expect(first.body.stock_sent).toBeGreaterThan(0);
    expect(fake.bodies.at(-1)[0]).toMatchObject({ merchantSku: 'PZ-111', availableStock: before - 2 });
    expect((await auth(request(app).post('/api/marketplace/hepsiburada/sync'))).body.orders.seen).toBe(1);
    expect(await stock()).toBe(before - 2);
    fake.hbOrders = [{ orderNumber: 'HB1', status: 'Cancelled', items: [{ merchantSku: 'PZ-111', quantity: 2 }] }];
    expect((await auth(request(app).post('/api/marketplace/hepsiburada/sync'))).body.orders.restored).toBe(1);
    expect(await stock()).toBe(before);
  });
});

describe('N11', () => {
  test('yalnız canlı ortam; appkey/appsecret başlığı; paket stoktan düşer, stok gönderilir', async () => {
    const bad = await auth(request(app).put('/api/marketplace/n11')).send({ seller_id: 'Magaza', api_key: 'k', api_secret: 's', environment: 'test', warehouse_id: warehouseId });
    expect(bad.status).toBe(400);
    const ok = await auth(request(app).put('/api/marketplace/n11')).send({ seller_id: 'Magaza', api_key: 'n11-anahtar', api_secret: 'n11-gizli', environment: 'live', warehouse_id: warehouseId });
    expect(ok.status).toBe(200); expect(ok.body.enabled).toBe(false);
    fake.headers.length = 0;
    expect((await auth(request(app).post('/api/marketplace/n11/test'))).body.ok).toBe(true);
    expect(fake.headers[0].appkey).toBe('n11-anahtar'); expect(fake.headers[0].appsecret).toBe('n11-gizli');
    const before = await stock();
    fake.n11Packages = [{ id: 501, orderNumber: 'N1', shipmentPackageStatus: 'Created', lines: [{ stockCode: 'PZ-111', quantity: 3 }] }];
    const r = await auth(request(app).post('/api/marketplace/n11/sync'));
    expect(r.body.orders.deducted).toBe(1);
    expect(await stock()).toBe(before - 3);
    expect(fake.bodies.at(-1).payload.skus[0]).toMatchObject({ stockCode: 'PZ-111', quantity: before - 3 });
  });
  test('stokta olmayan sipariş incelemeye kalır, stok eksiye düşmez', async () => {
    const before = await stock();
    fake.n11Packages = [{ id: 502, orderNumber: 'N2', shipmentPackageStatus: 'Created', lines: [{ stockCode: 'PZ-111', quantity: 9999 }] }];
    const r = await auth(request(app).post('/api/marketplace/n11/sync'));
    expect(r.body.orders.needs_review).toBe(1);
    expect(await stock()).toBe(before);
  });
});

test('etkin olmayan (kapalı) bağlantı zamanlayıcıyla eşitlenmez', async () => {
  const service = require('../src/services/marketplaceService');
  const before = fake.urls.length;
  await service.syncAll();
  expect(fake.urls.slice(before).filter(u => u.includes('/orders/merchantid/') || u.includes('/shipmentPackages'))).toEqual([]);
});
