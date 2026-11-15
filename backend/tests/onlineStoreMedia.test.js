process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.SHOP_READ_MAX = '100000'; process.env.SHOP_ORDER_MINUTE_MAX = '100000'; process.env.SHOP_ORDER_HOUR_MAX = '100000';
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { PNG } = require('pngjs');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');
const media = require('../src/services/onlineStoreMedia');

// Ürün görselleri: bayt imzası ve boyut doğrulama, sınırlar, işletme ayrımı, silme ve sıralama, vitrinde sunum.
let owner, other, cashier, p1, p2, otherProduct, tempDir, previousDir;
const png = (w = 120, h = 90) => PNG.sync.write(new PNG({ width: w, height: h }));
const jpeg = (w = 200, h = 100) => {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0]), sof, Buffer.alloc(40)]);
};
const webp = (w = 300, h = 200) => {
  const head = Buffer.alloc(30); head.write('RIFF', 0); head.writeUInt32LE(22, 4); head.write('WEBPVP8X', 8); head.writeUInt32LE(10, 16); head.writeUIntLE(w - 1, 24, 3); head.writeUIntLE(h - 1, 27, 3);
  return head;
};
const as = who => ({
  upload: (id, body, type = 'image/png', query = '') => request(app).post(`/api/online-store/products/${id}/media${query}`).set('Authorization', 'Bearer ' + who.token).set('Content-Type', type).send(body),
  get: url => request(app).get('/api/online-store' + url).set('Authorization', 'Bearer ' + who.token),
  del: url => request(app).delete('/api/online-store' + url).set('Authorization', 'Bearer ' + who.token),
  put: (url, body) => request(app).put('/api/online-store' + url).set('Authorization', 'Bearer ' + who.token).send(body),
  patch: (url, body) => request(app).patch('/api/online-store' + url).set('Authorization', 'Bearer ' + who.token).send(body)
});
const product = async (tenant, sku, name) => (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,$3,$4,'adet',50,'NORMAL') RETURNING *", [tenant, sku, name, sku])).rows[0];

beforeAll(async () => {
  previousDir = process.env.VENIUX_DATA_DIR;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-media-'));
  process.env.VENIUX_DATA_DIR = tempDir;
  owner = await createTenant(); other = await createTenant();
  const c = await createUser(owner.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: c.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
  p1 = await product(owner.tenantId, 'MD-1', 'Görselli ürün'); p2 = await product(owner.tenantId, 'MD-2', 'İkinci ürün'); otherProduct = await product(other.tenantId, 'MD-3', 'Başkası');
  for (const t of [owner, other]) await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'online_store')", [t.tenantId]);
});
afterAll(() => { process.env.VENIUX_DATA_DIR = previousDir; if (previousDir === undefined) delete process.env.VENIUX_DATA_DIR; fs.rmSync(tempDir, { recursive: true, force: true }); });

test('imza okuyucu: PNG, JPEG ve WebP türü ve boyutu; bozuk ve yabancı içerik null', () => {
  expect(media.inspect(png(120, 90))).toEqual({ mime: 'image/png', width: 120, height: 90 });
  expect(media.inspect(jpeg(200, 100))).toEqual({ mime: 'image/jpeg', width: 200, height: 100 });
  expect(media.inspect(webp(300, 200))).toEqual({ mime: 'image/webp', width: 300, height: 200 });
  expect(media.inspect(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'.padEnd(40)))).toBeNull();
  expect(media.inspect(Buffer.from('GIF89a'.padEnd(40)))).toBeNull();
  expect(media.inspect(Buffer.from('MZ' + 'x'.repeat(60)))).toBeNull();
  expect(media.inspect(Buffer.alloc(10))).toBeNull();
});

test('yükleme: türler kabul edilir, kayıt ve dosya oluşur, sıra artar; kasiyer yükleyemez', async () => {
  const a = await as(owner).upload(p1.id, png(), 'image/png', '?alt=' + encodeURIComponent('Ön görünüm'));
  expect(a.status).toBe(201); expect(a.body).toMatchObject({ position: 0, alt: 'Ön görünüm', width: 120, height: 90, mime: 'image/png' });
  const b = await as(owner).upload(p1.id, jpeg(), 'image/jpeg');
  expect(b.body).toMatchObject({ position: 1, mime: 'image/jpeg' });
  const c = await as(owner).upload(p1.id, webp(), 'image/webp');
  expect(c.body).toMatchObject({ position: 2, mime: 'image/webp' });
  const file = media.pathOf({ tenant_id: owner.tenantId, file_key: a.body.key, mime: 'image/png' });
  expect(fs.existsSync(file)).toBe(true); expect(file.startsWith(tempDir)).toBe(true);
  expect((await as(cashier).upload(p1.id, png())).status).toBe(403);
  const list = (await as(owner).get(`/products/${p1.id}/media`)).body.items;
  expect(list.map(i => i.position)).toEqual([0, 1, 2]);
});

test('reddedilenler: SVG, GIF, metin, imza ile başlık uyuşmazlığı, boyut sınırları, boş gövde, 2 MB üstü', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'.padEnd(60));
  expect((await as(owner).upload(p2.id, svg, 'image/png')).status).toBe(415);
  expect((await as(owner).upload(p2.id, svg, 'image/svg+xml')).status).toBe(415);
  expect((await as(owner).upload(p2.id, Buffer.from('GIF89a'.padEnd(40)), 'image/png')).status).toBe(415);
  expect((await as(owner).upload(p2.id, 'düz metin', 'text/plain')).status).toBe(415);
  expect((await as(owner).upload(p2.id, png(20, 20))).body.code).toBe('BAD_DIMENSIONS');
  expect((await as(owner).upload(p2.id, png(5000, 100))).body.code).toBe('BAD_DIMENSIONS');
  const big = Buffer.concat([png(), Buffer.alloc(media.MAX_BYTES + 10)]);
  expect((await as(owner).upload(p2.id, big)).status).toBe(413);
  expect((await as(owner).get(`/products/${p2.id}/media`)).body.items).toHaveLength(0);
});

test('ürün başına en çok 5 görsel; başka işletmenin ürününe yüklenemez ve görseli görülemez', async () => {
  await as(owner).upload(p1.id, png(110, 90)); await as(owner).upload(p1.id, png(111, 90));
  const sixth = await as(owner).upload(p1.id, png(112, 90));
  expect(sixth.status).toBe(409); expect(sixth.body.code).toBe('TOO_MANY');
  expect((await as(owner).upload(otherProduct.id, png())).status).toBe(404);
  expect((await as(other).get(`/products/${p1.id}/media`)).status).toBe(404);
  const mine = (await as(owner).get(`/products/${p1.id}/media`)).body.items[0];
  expect((await as(other).get('/media/' + mine.key)).status).toBe(404);
  expect((await as(owner).get('/media/' + mine.key)).status).toBe(200);
  expect([403, 404]).toContain((await as(owner).get('/media/..%2F..%2Fetc')).status);
  expect((await as(owner).get('/media/' + 'a'.repeat(20))).status).toBe(404);
});

test('kota dolunca yükleme reddedilir', async () => {
  const rows = (await db.query('SELECT COALESCE(SUM(bytes),0) AS b FROM online_product_media WHERE tenant_id=$1', [owner.tenantId])).rows[0];
  await db.query('UPDATE online_product_media SET bytes=$1 WHERE id=(SELECT MIN(id) FROM online_product_media WHERE tenant_id=$2)', [media.QUOTA_BYTES - Number(rows.b) + 1000 + 1000, owner.tenantId]).catch(() => {});
  await db.query('UPDATE online_product_media SET bytes=bytes+$1 WHERE id=(SELECT MIN(id) FROM online_product_media WHERE tenant_id=$2)', [media.QUOTA_BYTES, owner.tenantId]);
  const r = await as(owner).upload(p2.id, png());
  expect(r.status).toBe(409); expect(r.body.code).toBe('QUOTA');
  await db.query('UPDATE online_product_media SET bytes=1000 WHERE tenant_id=$1', [owner.tenantId]);
});

test('sıralama ve alt metin; geçersiz sıralama listesi reddedilir', async () => {
  const before = (await as(owner).get(`/products/${p1.id}/media`)).body.items;
  const ids = before.map(i => i.id).reverse();
  const after = (await as(owner).put(`/products/${p1.id}/media/order`, { ids })).body.items;
  expect(after.map(i => i.id)).toEqual(ids);
  expect((await as(owner).put(`/products/${p1.id}/media/order`, { ids: ids.slice(1) })).status).toBe(400);
  expect((await as(owner).put(`/products/${p1.id}/media/order`, { ids: [...ids.slice(1), 999999999] })).status).toBe(400);
  const alt = await as(owner).patch(`/products/${p1.id}/media/${ids[0]}`, { alt: 'Yeni açıklama' });
  expect(alt.body.items.find(i => i.id === ids[0]).alt).toBe('Yeni açıklama');
});

test('vitrin: yayındaki mağazada görsel doğru türle ve önbellekle sunulur; yayında değilse 404; ürün verisinde adres görünür', async () => {
  const w = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [w.id]);
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,20)', [owner.tenantId, w.id, p1.id]);
  expect((await as(owner).put('/products/' + p1.id, { published: true })).status).toBe(200);
  const settings = { slug: 'gorsel-magaza', name: 'Görsel Mağaza', warehouse_id: w.id, cod_enabled: true, pickup_enabled: true };
  const first = (await as(owner).get(`/products/${p1.id}/media`)).body.items[0];
  expect((await request(app).get(`/api/public/shop/gorsel-magaza/media/${first.key}`)).status).toBe(404);
  expect((await as(owner).put('/settings', settings)).status).toBe(200);
  expect((await request(app).get(`/api/public/shop/gorsel-magaza/media/${first.key}`)).status).toBe(404);
  expect((await as(owner).put('/settings', { ...settings, published: true })).status).toBe(200);
  const res = await request(app).get(`/api/public/shop/gorsel-magaza/media/${first.key}`).buffer(true).parse((r, cb) => { const chunks = []; r.on('data', d => chunks.push(d)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/^image\//);
  expect(res.headers['cache-control']).toMatch(/immutable/);
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(Buffer.isBuffer(res.body) && res.body.length > 20).toBe(true);
  const products = (await request(app).get('/api/public/shop/gorsel-magaza/products')).body.items;
  expect(products[0].images.length).toBe(5);
  expect(products[0].images[0].url).toMatch(/^\/api\/public\/shop\/gorsel-magaza\/media\//);
  expect((await request(app).get(`/api/public/shop/baska-yok/media/${first.key}`)).status).toBe(404);
});

test('silme: kayıt ve dosya gider, sıra kapanır; ikinci silme 404; başka işletme silemez', async () => {
  const items = (await as(owner).get(`/products/${p1.id}/media`)).body.items;
  const target = items[1];
  const file = media.pathOf({ tenant_id: owner.tenantId, file_key: target.key, mime: target.mime });
  expect(fs.existsSync(file)).toBe(true);
  expect((await as(other).del(`/products/${p1.id}/media/${target.id}`)).status).toBe(404);
  expect((await as(owner).del(`/products/${p1.id}/media/${target.id}`)).status).toBe(200);
  expect(fs.existsSync(file)).toBe(false);
  const after = (await as(owner).get(`/products/${p1.id}/media`)).body.items;
  expect(after).toHaveLength(4); expect(after.map(i => i.position)).toEqual([0, 1, 2, 3]);
  expect((await as(owner).del(`/products/${p1.id}/media/${target.id}`)).status).toBe(404);
});
