const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');

// Kalıcı test veritabanında (MySQL) SKU'lar tekil olmalı: her koşuda sonek.
const R = Date.now().toString(36);
const SKU = Object.fromEntries(['H1', 'L1', 'O1', 'X1', 'N1'].map(k => [k, k + '-' + R]));
const auth = o => ({ Authorization: 'Bearer ' + o.token });
const product = (t, sku, extra = {}) => db.query(
  "INSERT INTO products(tenant_id,sku,name,category,unit,sale_price,purchase_price,min_stock_level,max_stock_level,module_type) VALUES($1,$2,$3,$4,'adet',$5,$6,$7,$8,'NORMAL')",
  [t, sku, 'Urun ' + sku, extra.category ?? 'Gida', extra.sale ?? 20, extra.cost ?? 10, extra.min ?? 0, extra.max ?? 0]).then(() => db.query('SELECT id FROM products WHERE tenant_id=$1 AND sku=$2', [t, sku])).then(r => r.rows[0].id);
const stock = (t, w, p, q) => db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [t, w, p, q]);

describe('GET /api/stock/dashboard-summary ve analytics', () => {
  let owner, other, w1, w2;
  beforeAll(async () => {
    await db.ready;
    owner = await createTenant(); other = await createTenant();
    // Fabrika varsayılan örnek ürün açar; sayıları kesin sınamak için temizlenir.
    for (const t of [owner.tenantId, other.tenantId]) { await db.query('DELETE FROM stock_records WHERE tenant_id=$1', [t]); await db.query('DELETE FROM products WHERE tenant_id=$1', [t]); }
    w1 = await createWarehouse(owner.tenantId); w2 = await createWarehouse(owner.tenantId);
    const healthy = await product(owner.tenantId, SKU.H1, { min: 5, max: 100 });
    const low = await product(owner.tenantId, SKU.L1, { min: 10, category: 'Icecek' });
    const gone = await product(owner.tenantId, SKU.O1, { min: 3 });
    const over = await product(owner.tenantId, SKU.X1, { max: 50 });
    await product(owner.tenantId, SKU.N1); // hiç stok kaydı yok → tükendi
    await stock(owner.tenantId, w1.id, healthy, 40); await stock(owner.tenantId, w2.id, healthy, 10);
    await stock(owner.tenantId, w1.id, low, 4);
    await stock(owner.tenantId, w1.id, gone, 0);
    await stock(owner.tenantId, w2.id, over, 80);
    const alien = await product(other.tenantId, 'ALIEN-' + R);
    const aw = await createWarehouse(other.tenantId);
    await stock(other.tenantId, aw.id, alien, 999);
  });

  test('tüm depolar: sayılar tek tek hesaplanan değerlerle aynı', async () => {
    const r = await request(app).get('/api/stock/dashboard-summary').set(auth(owner));
    expect(r.status).toBe(200);
    expect(r.body.product_count).toBe(5);
    expect(r.body.units).toBe(134);
    expect(r.body.value).toBe(1340);
    expect(r.body.sale_value).toBe(2680);
    expect(r.body.health).toEqual({ out: 2, critical: 1, excess: 1, healthy: 1 });
    expect(r.body.attention.map(a => a.sku)).toEqual([SKU.O1, SKU.N1, SKU.L1]);
    expect(r.body.top_by_value[0]).toMatchObject({ sku: SKU.X1, qty: 80, value: 800 });
    expect(r.body.top_by_qty[0].sku).toBe(SKU.X1);
    expect(r.body.categories[0][0]).toBe('Gida');
    expect(JSON.stringify(r.body)).not.toContain('ALIEN');
    expect(r.body.by_warehouse).toHaveLength(2);
  });

  test('depo filtresi: yalnız o depoda kaydı olan ürünler ve o depodaki miktar', async () => {
    const r = await request(app).get('/api/stock/dashboard-summary?warehouse_id=' + w2.id).set(auth(owner));
    expect(r.status).toBe(200);
    expect(r.body.product_count).toBe(2);
    expect(r.body.units).toBe(90);
    expect(r.body.health).toEqual({ out: 0, critical: 0, excess: 1, healthy: 1 });
    expect(r.body.by_warehouse).toHaveLength(2); // depo kırılımı filtreden bağımsız
  });

  test('geçersiz veya başka kiracının deposu reddedilir', async () => {
    expect((await request(app).get('/api/stock/dashboard-summary?warehouse_id=abc').set(auth(owner))).status).toBeGreaterThanOrEqual(400);
    const aw = (await db.query('SELECT id FROM warehouses WHERE tenant_id=$1', [other.tenantId])).rows[0].id;
    const r = await request(app).get('/api/stock/dashboard-summary?warehouse_id=' + aw).set(auth(owner));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.body)).not.toContain('ALIEN');
  });

  test('analytics: özet, kategori ve depo dağılımı yalnız kendi kiracısı', async () => {
    const r = await request(app).get('/api/stock/analytics').set(auth(owner));
    expect(r.status).toBe(200);
    expect(r.body.summary).toMatchObject({ total_products: 5, total_units_stored: 134, total_valuation: 1340, critical_stock_count: 2, out_of_stock_count: 2, total_warehouses: 2 });
    expect(r.body.top_value_products[0].sku).toBe(SKU.X1);
    const ids = r.body.warehouse_distribution.map(w => w.id);
    const mine = (await db.query('SELECT id FROM warehouses WHERE tenant_id=$1', [owner.tenantId])).rows.map(x => x.id);
    expect(ids.sort()).toEqual(mine.sort());
    expect(ids).toEqual(expect.arrayContaining([w1.id, w2.id]));
    expect(JSON.stringify(r.body)).not.toContain('ALIEN');
  });

  test('analytics trend: son 14 günün hareketleri tarih sırasıyla, eski kayıtlar dışarıda', async () => {
    const pid = (await db.query('SELECT id FROM products WHERE tenant_id=$1 AND sku=$2', [owner.tenantId, SKU.H1])).rows[0].id;
    const ins = (d, a) => db.query("INSERT INTO stock_movements(tenant_id,product_id,warehouse_id,change_amount,movement_type,source,created_at) VALUES($1,$2,$3,$4,'adjustment','test',$5)", [owner.tenantId, pid, w1.id, a, d]);
    const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10) + ' 12:00:00';
    await ins(day(400), 7); await ins(day(2), 5); await ins(day(1), -3); await ins(day(1), 2);
    const r = await request(app).get('/api/stock/analytics').set(auth(owner));
    const t = r.body.movements_trend;
    expect(t.map(x => x.date)).toEqual([day(2).slice(0, 10), day(1).slice(0, 10)]);
    expect([Number(t[1].inbound), Number(t[1].outbound)]).toEqual([2, 3]); // MySQL DECIMAL metin döner
  });
});

describe('GET /api/stock/records?product_id=', () => {
  test('yalnız istenen ürünün kayıtları gelir (başka ürün ve başka kiracı gelmez)', async () => {
    await db.ready;
    const owner = await createTenant();
    const w = await createWarehouse(owner.tenantId);
    const a = await product(owner.tenantId, 'RA-' + R), b = await product(owner.tenantId, 'RB-' + R);
    await stock(owner.tenantId, w.id, a, 7); await stock(owner.tenantId, w.id, b, 9);
    const r = await request(app).get('/api/stock/records?product_id=' + a).set(auth(owner));
    expect(r.status).toBe(200);
    expect(r.body.map(x => x.product_id)).toEqual([a]);
    expect(Number(r.body[0].quantity)).toBe(7);
    const cat = await request(app).get('/api/stock/records?category=Gida&warehouse_id=' + w.id).set(auth(owner));
    expect(cat.status).toBe(200);
    expect(cat.body.length).toBe(2); // iki ürün de Gida; başka kategori filtresi boş döner
    const none = await request(app).get('/api/stock/records?category=Yok&warehouse_id=' + w.id).set(auth(owner));
    expect(none.body).toEqual([]);
    const both = await request(app).get('/api/stock/records?product_id=' + a + '&warehouse_id=' + w.id).set(auth(owner));
    expect(both.body).toHaveLength(1);
  });
});

describe('GET /api/products?search=&limit= tam eşleşme önceliği', () => {
  test('tam SKU, daha yeni ve çok sayıdaki kısmi eşleşmelerin önüne geçer', async () => {
    await db.ready;
    const owner = await createTenant();
    const base = 'EX' + R;
    await product(owner.tenantId, base);
    for (let i = 0; i < 6; i++) await product(owner.tenantId, base + i);
    const r = await request(app).get('/api/products?limit=3&search=' + base).set(auth(owner));
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(3);
    expect(r.body[0].sku).toBe(base);
  });
});
