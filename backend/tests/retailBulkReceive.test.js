const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database');
const { createTenant, createUser, createWarehouse } = require('./factories');
let owner, other, warehouse, foreignWarehouse, viewer;
const auth = (t = owner.token) => ({ Authorization: 'Bearer ' + t });
const batch = (body, key, token) => request(app).post('/api/retail/receive/batch').set(auth(token)).set('Idempotency-Key', key).send(body);
const stockOf = async (tenantId, productId) => Number((await db.query('SELECT COALESCE(SUM(quantity),0) q FROM stock_records WHERE tenant_id=$1 AND product_id=$2', [tenantId, productId])).rows[0].q);
const productByCode = async (tenantId, code) => (await db.query('SELECT * FROM products WHERE tenant_id=$1 AND barcode=$2', [tenantId, code])).rows[0];
const neu = (code, name, quantity, extra = {}) => ({ barcode: code, name, unit: 'adet', purchase_price: 5, sale_price: 8, quantity, ...extra });

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  warehouse = await createWarehouse(owner.tenantId); foreignWarehouse = await createWarehouse(other.tenantId);
  const u = await createUser(owner.tenantId);
  viewer = (await request(app).post('/api/auth/login').send({ email: u.email, password: 'password123' })).body.token;
});

test('karışık toplu kabul: yeni ve mevcut ürün, koli, aynı barkodun tekrarı; tek işlemde, toplamlar doğru', async () => {
  const existing = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,purchase_price,sale_price,category,module_type) VALUES ($1,'BR-EX-1','Mevcut Ürün','8690000100019','adet',3,6,'x','NORMAL') RETURNING *", [owner.tenantId])).rows[0];
  await db.query("INSERT INTO product_uoms (tenant_id,product_id,uom_code,barcode,conversion_factor) VALUES ($1,$2,'koli','8690000100026',12)", [owner.tenantId, existing.id]);
  const body = {
    warehouse_id: warehouse.id,
    lines: [
      neu('8690000200010', 'Yeni A', 10),
      { product_id: existing.id, barcode: '8690000100019', quantity: 5 },
      neu('8690000200010', 'Yeni A', 3),                                    // aynı yeni ürün tekrar: eklenir, ikinci ürün oluşmaz
      { product_id: existing.id, barcode: '8690000100026', quantity: 2 }     // 2 koli × 12
    ]
  };
  const r = await batch(body, 'bulk-1');
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({ line_count: 4, total_units: 10 + 5 + 3 + 24, new_products: 1 });
  expect(r.body.lines[3].pack).toMatchObject({ unit: 'koli', count: 2, factor: 12 });
  const a = await productByCode(owner.tenantId, '8690000200010');
  expect(await stockOf(owner.tenantId, a.id)).toBe(13);
  expect(await stockOf(owner.tenantId, existing.id)).toBe(29);
  expect((await db.query('SELECT COUNT(*) c FROM products WHERE tenant_id=$1 AND barcode=$2', [owner.tenantId, '8690000200010'])).rows[0].c).toBe(1);
  // hareket ve denetim kayıtları: satır başına bir hareket, toplu kabul için bir özet kaydı
  expect((await db.query("SELECT COUNT(*) c FROM stock_movements WHERE tenant_id=$1 AND source='retail_bulk_receive'", [owner.tenantId])).rows[0].c).toBe(4);
  expect((await db.query("SELECT COUNT(*) c FROM audit_logs WHERE tenant_id=$1 AND action='retail.receive_batch'", [owner.tenantId])).rows[0].c).toBe(1);
  // aynı anahtar ve aynı gövde: ikinci kez stok eklenmez
  const again = await batch(body, 'bulk-1');
  expect(again.status).toBe(200); expect(again.body.batch_id).toBe(r.body.batch_id); expect(again.body.replayed).toBe(true);
  expect(await stockOf(owner.tenantId, existing.id)).toBe(29);
  // aynı anahtar başka gövde: çakışma
  expect((await batch({ ...body, lines: [neu('8690000200027', 'Başka', 1)] }, 'bulk-1')).status).toBe(409);
});

test('hepsi ya da hiçbiri: ortadaki satır DB aşamasında hata verirse önceki satırlar da geri alınır, satır numarası söylenir', async () => {
  const body = { warehouse_id: warehouse.id, lines: [neu('8690000300011', 'Geri Alınacak', 7), { product_id: 99999999, quantity: 1 }, neu('8690000300028', 'Hiç Gelmez', 2)] };
  const r = await batch(body, 'bulk-rollback');
  expect(r.status).toBe(404);
  expect(r.body.line_index).toBe(1); expect(r.body.error).toMatch(/Satır 2/);
  expect(await productByCode(owner.tenantId, '8690000300011')).toBeUndefined();
  expect(await productByCode(owner.tenantId, '8690000300028')).toBeUndefined();
});

test('biçim hataları tüm satırlar için tek yanıtta toplanır ve hiçbir şey yazılmaz', async () => {
  const r = await batch({ warehouse_id: warehouse.id, lines: [neu('8690000400010', 'Geçerli', 1), neu('8690000400027', 'Kesirli', 1.5), neu('8690000400034', 'Eksi', -2), { quantity: 1, barcode: 'x'.repeat(200) }] }, 'bulk-format');
  expect(r.status).toBe(400);
  expect(r.body.line_errors.map(e => e.index)).toEqual([1, 2, 3]);
  expect(await productByCode(owner.tenantId, '8690000400010')).toBeUndefined();
});

test('sınırlar ve yetki: 500 satır üstü, boş liste, anahtarsız, yetkisiz rol, başka işletmenin deposu', async () => {
  const many = Array.from({ length: 501 }, (_, i) => neu('8690' + String(5000000 + i).padStart(9, '0'), 'N' + i, 1));
  expect((await batch({ warehouse_id: warehouse.id, lines: many }, 'bulk-many')).status).toBe(400);
  expect((await batch({ warehouse_id: warehouse.id, lines: [] }, 'bulk-empty')).status).toBe(400);
  expect((await request(app).post('/api/retail/receive/batch').set(auth()).send({ warehouse_id: warehouse.id, lines: [neu('8690000600013', 'x', 1)] })).status).toBe(400);
  expect((await batch({ warehouse_id: warehouse.id, lines: [neu('8690000600013', 'x', 1)] }, 'bulk-viewer', viewer)).status).toBe(403);
  expect((await batch({ warehouse_id: foreignWarehouse.id, lines: [neu('8690000600013', 'x', 1)] }, 'bulk-foreign')).status).toBe(404);
  expect(await productByCode(owner.tenantId, '8690000600013')).toBeUndefined();
});

test('yüzlerce satır: 300 yeni ürün tek istekte kabul edilir', async () => {
  const lines = Array.from({ length: 300 }, (_, i) => neu('8691' + String(7000000 + i).padStart(9, '0'), 'Toplu ' + i, (i % 9) + 1));
  const r = await batch({ warehouse_id: warehouse.id, lines }, 'bulk-300');
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({ line_count: 300, new_products: 300 });
  expect(r.body.total_units).toBe(lines.reduce((s, l) => s + l.quantity, 0));
}, 60000);
