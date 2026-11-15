process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.SHOP_READ_MAX = '100000'; process.env.SHOP_ORDER_MINUTE_MAX = '100000'; process.env.SHOP_ORDER_HOUR_MAX = '100000';
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');

// Vitrin sayfaları: sunucu HTML'e başlık, açıklama, paylaşım ve yapılandırılmış veri ekler; kapalı mağaza ve sepet/sipariş sayfaları dizine alınmaz.
const dist = path.join(__dirname, '../../frontend/dist/index.html');
const maybe = fs.existsSync(dist) ? test : test.skip;
let owner, product;

beforeAll(async () => {
  owner = await createTenant();
  const w = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [w.id]);
  const wh = Number((await db.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [owner.tenantId])).rows[0].id);
  product = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,category,module_type) VALUES($1,'SEO-1',$2,'SEO-1','adet',99.9,'Mutfak','NORMAL') RETURNING *", [owner.tenantId, 'Seramik <b>kupa</b> "özel"'])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,10)', [owner.tenantId, wh, product.id]);
  await db.query('INSERT INTO online_product_settings (tenant_id,product_id,published,description) VALUES ($1,$2,1,$3)', [owner.tenantId, product.id, 'El yapımı kupa. <script>alert(1)</script>']);
  await db.query("INSERT INTO online_stores (tenant_id,slug,name,tagline,warehouse_id,published,accepting_orders) VALUES ($1,'seo-magaza',$2,'Güzel eşyalar',$3,1,1)", [owner.tenantId, 'Seo "Mağaza" <i>x</i>', wh]);
  await db.query("INSERT INTO online_stores (tenant_id,slug,name,published) VALUES ($1,'kapali-magaza','Kapalı',0)", [(await createTenant()).tenantId]);
});

maybe('mağaza ana sayfası: başlık, açıklama, kanonik adres, paylaşım ve Store verisi eklenir; HTML kaçışlıdır', async () => {
  const r = await request(app).get('/magaza/seo-magaza');
  expect(r.status).toBe(200);
  expect(r.text).toContain('<title>Seo &quot;Mağaza&quot; &lt;i&gt;x&lt;/i&gt;</title>');
  expect(r.text).toContain('content="Güzel eşyalar"');
  expect(r.text).toMatch(/<link rel="canonical" href="https?:\/\/[^"]+\/magaza\/seo-magaza">/);
  expect(r.text).toContain('index, follow');
  expect(r.text).toMatch(/og:title" content="Seo &quot;Mağaza&quot;/);
  const ld = r.text.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  expect(JSON.parse(ld[1])).toMatchObject({ '@type': 'Store', name: 'Seo "Mağaza" <i>x</i>' });
  expect(ld[1]).not.toContain('<i>');
  expect(r.text).not.toContain('<i>x</i>');
});

maybe('ürün sayfası: Product verisi, fiyat ve stok durumu; açıklamadaki betik kaçışlanır', async () => {
  const r = await request(app).get(`/magaza/seo-magaza/urun/${product.id}`);
  expect(r.status).toBe(200);
  const ld = JSON.parse(r.text.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  expect(ld).toMatchObject({ '@type': 'Product', category: 'Mutfak', offers: { priceCurrency: 'TRY', price: '99.90', availability: 'https://schema.org/InStock' } });
  expect(r.text).not.toContain('<script>alert(1)</script>');
  expect(r.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect((await request(app).get('/magaza/seo-magaza/urun/99999999')).status).toBe(404);
});

maybe('kapalı ve olmayan mağaza 404 ve noindex; sepet ve sipariş sayfaları noindex', async () => {
  for (const url of ['/magaza/kapali-magaza', '/magaza/yok-boyle-magaza', '/magaza/kapali-magaza/urun/1']) {
    const r = await request(app).get(url);
    expect(r.status).toBe(404); expect(r.text).toContain('noindex');
  }
  const cart = await request(app).get('/magaza/seo-magaza/sepet');
  expect(cart.status).toBe(200); expect(cart.text).toContain('noindex'); expect(cart.text).not.toContain('application/ld+json');
  expect((await request(app).get('/magaza/seo-magaza/siparis/abcdefghijklmnopqrst')).text).toContain('noindex');
});

test('site haritası: yalnız yayındaki mağazanın yayındaki ürünleri; kapalı mağaza 404', async () => {
  const r = await request(app).get('/magaza/seo-magaza/sitemap.xml');
  expect(r.status).toBe(200); expect(r.headers['content-type']).toMatch(/xml/);
  expect(r.text).toContain('/magaza/seo-magaza</loc>'); expect(r.text).toContain(`/magaza/seo-magaza/urun/${product.id}</loc>`);
  expect((await request(app).get('/magaza/kapali-magaza/sitemap.xml')).status).toBe(404);
  expect((await request(app).get('/magaza/yok/sitemap.xml')).status).toBe(404);
});
