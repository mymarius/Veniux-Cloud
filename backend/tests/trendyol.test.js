process.env.AUTH_RATE_LIMIT_MAX = '1000';
const http = require('http');
const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createTenant } = require('./factories/index');
const service = require('../src/services/marketplaceService');

const fake = { packages: [], stockBodies: [], headers: [], unauthorized: false, batch: null, orderQueries: [] };
let server, A, B;
const auth = (t, r) => r.set('Authorization', 'Bearer ' + t.token);
beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      fake.headers.push(req.headers);
      const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (fake.unauthorized) return send(401, {});
      if (req.url.includes('/v2/orders')) { fake.orderQueries.push(req.url); return send(200, { totalPages: 1, content: fake.packages }); }
      if (req.url.includes('/price-and-inventory')) { fake.stockBodies.push(JSON.parse(raw)); return send(200, { batchRequestId: 'b-1' }); }
      if (req.url.includes('/batch-requests/')) return send(200, fake.batch || { status: 'COMPLETED', failedItemCount: 0, items: [] });
      if (req.url.includes('/approved/inventory-and-price')) return send(200, { totalElements: 3, content: [] });
      send(404, {});
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.TRENDYOL_TEST_BASE_URL = 'http://127.0.0.1:' + server.address().port;
  A = await setup('a'); B = await setup('b');
});
afterAll(async () => { delete process.env.TRENDYOL_TEST_BASE_URL; await new Promise(r => server.close(r)); });

async function setup(prefix) {
  const t = await createTenant();
  const wh = await auth(t, request(app).post('/api/warehouses')).send({ name: prefix + ' Depo', type: 'main', location: 'X', capacity: 100 });
  const warehouseId = wh.body.id || wh.body.warehouse?.id;
  const product = async (barcode, qty) => {
    const r = await auth(t, request(app).post('/api/products')).send({ sku: prefix + barcode, name: prefix + barcode, barcode, category: 'A', purchase_price: 1, sale_price: 2, unit: 'adet' });
    const id = r.body.id || r.body.product?.id;
    if (qty) expect((await auth(t, request(app).post('/api/stock/movement')).send({ product_id: id, warehouse_id: warehouseId, change_amount: qty, movement_type: 'inbound' })).status).toBe(201);
    return id;
  };
  const connect = () => auth(t, request(app).put('/api/marketplace/trendyol')).send({ seller_id: '4321', api_key: 'gizli-anahtar', api_secret: 'gizli-parola', environment: 'test', warehouse_id: warehouseId });
  const stock = async id => Number((await pool.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id=$2', [t.tenantId, id])).rows[0].q);
  const sync = () => auth(t, request(app).post('/api/marketplace/trendyol/sync'));
  return { t, warehouseId, product, connect, stock, sync };
}
const pack = (id, barcode, quantity, status = 'Created') => ({ shipmentPackageId: id, orderNumber: 'O' + id, shipmentPackageStatus: status, lines: [{ barcode, quantity }] });

test('anahtarlar şifreli saklanır, yanıtta dönmez, kayıtta seller kimliği denetlenir', async () => {
  expect((await auth(A.t, request(app).put('/api/marketplace/trendyol')).send({ seller_id: 'x', environment: 'test', warehouse_id: A.warehouseId })).status).toBe(400);
  const r = await A.connect();
  expect(r.status).toBe(200);
  expect(JSON.stringify(r.body)).not.toContain('gizli');
  const row = (await pool.query('SELECT credentials_enc FROM marketplace_connections WHERE tenant_id=$1', [A.t.tenantId])).rows[0];
  expect(row.credentials_enc).not.toContain('gizli');
  expect(JSON.stringify((await auth(A.t, request(app).get('/api/marketplace/trendyol'))).body)).not.toContain('gizli');
  expect((await auth(A.t, request(app).post('/api/marketplace/trendyol/test'))).body.approved_products).toBe(3);
  const h = fake.headers.at(-1);
  expect(h['user-agent']).toBe('4321 - SelfIntegration');
  expect(Buffer.from(h.authorization.split(' ')[1], 'base64').toString()).toBe('gizli-anahtar:gizli-parola');
});

test('başka firmanın deposu bağlanamaz', async () => {
  expect((await auth(A.t, request(app).put('/api/marketplace/trendyol')).send({ seller_id: '1', api_key: 'k', api_secret: 's', environment: 'test', warehouse_id: B.warehouseId })).status).toBe(404);
});

test('paket bir kez düşülür, iptalde bir kez geri eklenir, değişmeyen stok tekrar gönderilmez', async () => {
  const id = await A.product('111', 10);
  fake.packages = [pack(1, '111', 3)];
  fake.stockBodies = [];
  expect((await A.sync()).status).toBe(200);
  expect(await A.stock(id)).toBe(7);
  expect(fake.stockBodies.at(-1).items).toContainEqual({ barcode: '111', quantity: 7 });
  fake.stockBodies = [];
  await A.sync();
  expect(await A.stock(id)).toBe(7);
  expect(fake.stockBodies).toHaveLength(0);
  fake.packages = [pack(1, '111', 3, 'Cancelled')];
  await A.sync();await A.sync();
  expect(await A.stock(id)).toBe(10);
  expect(fake.stockBodies.at(-1).items).toEqual([{ barcode: '111', quantity: 10 }]);
  const moves = (await pool.query("SELECT change_amount FROM stock_movements WHERE product_id=$1 AND source='trendyol' ORDER BY id", [id])).rows.map(r => Number(r.change_amount));
  expect(moves).toEqual([-3, 3]);
});

test('hiç düşülmemiş iptal paketi stoğu artırmaz', async () => {
  const id = await A.product('222', 5);
  fake.packages = [pack(2, '222', 2, 'Cancelled')];
  await A.sync();
  expect(await A.stock(id)).toBe(5);
});

test('yetersiz stok veya bilinmeyen barkodda paket tümden düşülmez ve yöneticiye uyarı gider', async () => {
  const ok = await A.product('333', 5), low = await A.product('444', 1);
  fake.packages = [{ shipmentPackageId: 3, shipmentPackageStatus: 'Created', lines: [{ barcode: '333', quantity: 2 }, { barcode: '444', quantity: 2 }] }, pack(4, 'yok', 1)];
  await A.sync();
  expect(await A.stock(ok)).toBe(5);
  expect(await A.stock(low)).toBe(1);
  const alerts = (await pool.query("SELECT message FROM alerts WHERE tenant_id=$1 AND alert_type='marketplace_order'", [A.t.tenantId])).rows;
  expect(alerts).toHaveLength(2);
  fake.packages = [pack(3, '333', 2, 'Cancelled')];
  await A.sync();
  expect(await A.stock(ok)).toBe(5);
  expect((await auth(A.t, request(app).get('/api/marketplace/trendyol'))).body.orders.find(o => o.package_id === '3').stock_state).toBe('needs_review');
});

test('sipariş sorgusu v2 kullanır, bağlantı anından eskiye gitmez, firmalar karışmaz', async () => {
  await B.connect();
  const mine = await B.product('111', 4);
  fake.orderQueries = []; fake.packages = [pack(1, '111', 1)];
  await B.sync();
  expect(await B.stock(mine)).toBe(3);
  const since = (await pool.query('SELECT orders_since FROM marketplace_connections WHERE tenant_id=$1', [B.t.tenantId])).rows[0].orders_since;
  const start = Number(/startDate=(\d+)/.exec(fake.orderQueries[0])[1]);
  expect(start).toBe(Date.parse(String(since).replace(' ', 'T') + 'Z'));
  expect(fake.orderQueries[0]).toContain('/integration/order/sellers/4321/v2/orders');
});

test('reddedilen API bilgisi hata olarak kaydedilir, reddedilen stok satırı bildirilir', async () => {
  fake.unauthorized = true;
  const failed = await A.sync();
  fake.unauthorized = false;
  expect(failed.status).toBe(502);
  expect((await auth(A.t, request(app).get('/api/marketplace/trendyol'))).body.last_error).toContain('reddedildi');
  fake.packages = [];
  await pool.query("UPDATE marketplace_connections SET last_batch_id='b-9' WHERE tenant_id=$1", [A.t.tenantId]);
  fake.batch = { status: 'COMPLETED', failedItemCount: 1, items: [{ status: 'FAILED', failureReasons: ['Barkod bulunamadı'] }] };
  const r = await A.sync();
  fake.batch = null;
  expect(r.body.warning).toContain('Barkod bulunamadı');
});

test('yalnız yönetici erişir, zamanlanmış eşitleme kapalı bağlantıyı atlar', async () => {
  expect((await request(app).get('/api/marketplace/trendyol')).status).toBe(401);
  await pool.query('UPDATE marketplace_connections SET enabled=0 WHERE tenant_id=$1', [B.t.tenantId]);
  const id = await B.product('555', 2);
  fake.packages = [pack(9, '555', 1)];
  await service.syncAll();
  expect(await B.stock(id)).toBe(2);
  fake.packages = [];
});
