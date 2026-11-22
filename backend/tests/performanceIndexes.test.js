const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');
let owner, warehouse;
const auth = r => r.set('Authorization', 'Bearer ' + owner.token);

beforeAll(async () => {
  owner = await createTenant(); warehouse = await createWarehouse(owner.tenantId);
  for (let i = 1; i <= 7; i++) {
    const p = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,gtin,unit,sale_price,module_type) VALUES ($1,$2,$3,$4,$5,'adet',10,'NORMAL') RETURNING id", [owner.tenantId, 'PI-' + Date.now() + '-' + i, 'Sayfa ' + i, '9990000' + i, i === 3 ? '08690000000033' : null])).rows[0];
    await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,5)', [owner.tenantId, warehouse.id, p.id]);
  }
});

test('064: sık okunan tablolarda performans indeksleri kurulu', async () => {
  const names = (await db.query("SELECT name FROM sqlite_master WHERE type='index'")).rows.map(r => r.name);
  for (const n of ['idx_retail_sales_tenant_date', 'idx_pos_sale_items_sale', 'idx_pos_sales_tenant_created', 'idx_stock_movements_tenant_created', 'idx_audit_logs_tenant_created', 'idx_stock_records_tenant_updated', 'idx_products_tenant_gtin', 'idx_product_uoms_barcode']) expect(names).toContain(n);
});

test('kasa en-çok-satan sorgusu tarih indeksini kullanır; hareket/denetim listeleri sıralamayı indeksle yapar', async () => {
  const plan = async sql => (await db.query('EXPLAIN QUERY PLAN ' + sql)).rows.map(r => r.detail).join(' | ');
  expect(await plan("SELECT warehouse_id,snapshot_json FROM retail_sales WHERE tenant_id=1 AND business_date>='2026-01-01'")).toMatch(/idx_retail_sales_tenant_date/);
  expect(await plan('SELECT * FROM pos_sale_items WHERE sale_id=1')).toMatch(/idx_pos_sale_items_sale/);
  expect(await plan('SELECT * FROM audit_logs WHERE tenant_id=1 ORDER BY created_at DESC LIMIT 50')).not.toMatch(/TEMP B-TREE/);
  expect(await plan('SELECT * FROM stock_movements WHERE tenant_id=1 ORDER BY created_at DESC LIMIT 100')).not.toMatch(/TEMP B-TREE/);
});

test('/products: limit yoksa tüm liste (eski davranış); limit/offset sayfalar, geçersiz sınır 400', async () => {
  const all = await auth(request(app).get('/api/products?search=Sayfa'));
  expect(all.status).toBe(200); expect(all.body.length).toBe(7);
  const first = await auth(request(app).get('/api/products?limit=3&search=Sayfa'));
  const second = await auth(request(app).get('/api/products?limit=3&offset=3&search=Sayfa'));
  const last = await auth(request(app).get('/api/products?limit=3&offset=6&search=Sayfa'));
  expect([first.body.length, second.body.length, last.body.length]).toEqual([3, 3, 1]);
  expect(new Set([...first.body, ...second.body, ...last.body].map(p => p.id)).size).toBe(7);
  for (const bad of ['limit=0', 'limit=1001', 'limit=abc', 'limit=5&offset=-1']) expect((await auth(request(app).get('/api/products?' + bad))).status).toBe(400);
});

test('/stock/records: isteğe bağlı sayfalama', async () => {
  expect((await auth(request(app).get('/api/stock/records?search=Sayfa'))).body.length).toBe(7);
  const page = await auth(request(app).get('/api/stock/records?limit=2&offset=2&search=Sayfa'));
  expect(page.status).toBe(200); expect(page.body.length).toBe(2);
  expect((await auth(request(app).get('/api/stock/records?limit=0'))).status).toBe(400);
});

test('barkod okutma: barkod, GTIN ve stok kodu ile bulunur; bilinmeyen kodda ürün dönmez', async () => {
  const scan = code => auth(request(app).post('/api/scanner/lookup').send({ barcode: code, warehouse_id: warehouse.id }));
  expect((await scan('99900002')).body.product.name).toBe('Sayfa 2');
  expect((await scan('08690000000033')).body.product.name).toBe('Sayfa 3');
  const sku = (await db.query("SELECT sku FROM products WHERE tenant_id=$1 AND name='Sayfa 5'", [owner.tenantId])).rows[0].sku;
  expect((await scan(sku)).body.product.name).toBe('Sayfa 5');
  const pid = (await db.query("SELECT id FROM products WHERE tenant_id=$1 AND name='Sayfa 6'", [owner.tenantId])).rows[0].id;
  await db.query("INSERT INTO product_uoms (tenant_id,product_id,uom_code,conversion_factor,barcode) VALUES ($1,$2,'KOLI',12,'KOLI-9999')", [owner.tenantId, pid]);
  expect((await scan('KOLI-9999')).body.product.name).toBe('Sayfa 6');
  const missing = await scan('YOK-123456');
  expect(missing.body.product ?? null).toBeNull();
});
