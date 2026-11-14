process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser, openTestShift } = require('./factories');
const { breakdown } = require('../src/services/productUnits');

// Hırdavat birim dönüşümü: koli/paket/makara tanımı, koli barkoduyla mal kabul ve kasada satış, metreyle küsuratlı satış,
// stokun "6 koli + 50 adet" gösterimi.
let owner, other, w, cashier, vida, kablo;
const call = (who, method, url, body, key) => { const r = request(app)[method](url).set('Authorization', 'Bearer ' + who.token); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
const qty = async id => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [id])).rows[0].q);
const product = async (sku, name, unit, price) => (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,purchase_price,module_type) VALUES($1,$2,$3,$4,$5,$6,$7,'NORMAL') RETURNING *", [owner.tenantId, sku, name, sku, unit, price, price / 2])).rows[0];

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  w = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [w.id]);
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'hardware')", [owner.tenantId]);
  const c = await createUser(owner.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: c.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
  vida = await product('8690000000011', 'Vida M4x30', 'adet', 2);
  kablo = await product('8690000000028', 'NYA kablo 2,5 mm', 'metre', 12);
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [owner.tenantId, w.id, vida.id, 1250]);
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [owner.tenantId, w.id, kablo.id, 230]);
});

test('stok gösterimi en büyük birimden başlar; küsurat ve birimsiz durum', () => {
  const units = [{ unit: 'paket', factor: 50 }, { unit: 'koli', factor: 200 }];
  expect(breakdown(1250, 'adet', units)).toBe('6 koli + 1 paket');
  expect(breakdown(1270, 'adet', units)).toBe('6 koli + 1 paket + 20 adet');
  expect(breakdown(30, 'adet', units)).toBeNull();
  expect(breakdown(230.5, 'metre', [{ unit: 'makara', factor: 100 }])).toBe('2 makara + 30,5 metre');
  expect(breakdown(0, 'adet', units)).toBeNull();
  expect(breakdown(-5, 'adet', units)).toBeNull();
});

test('birim tanımı: yalnız yönetici; temel birim, tekrar, 1 çarpanı ve çakışan barkod reddedilir', async () => {
  const url = `/api/sector/hardware/products/${vida.id}/units`;
  expect((await call(cashier, 'put', url, { units: [{ unit: 'koli', factor: 200 }] })).status).toBe(403);
  expect((await call(owner, 'put', url, { units: [{ unit: 'adet', factor: 10 }] })).status).toBe(400);
  expect((await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200 }, { unit: 'Koli', factor: 100 }] })).status).toBe(400);
  expect((await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 1 }] })).status).toBe(400);
  expect((await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 0 }] })).status).toBe(400);
  const clash = await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200, barcode: kablo.barcode }] });
  expect(clash.status).toBe(409); expect(clash.body.error).toMatch(/NYA kablo/);
  const ok = await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200, barcode: '8690000000035' }, { unit: 'paket', factor: '50' }] });
  expect(ok.status).toBe(200);
  expect(ok.body.units).toEqual([{ unit: 'paket', factor: 50, barcode: null, price: 100, custom_price: null, list_price: 100 }, { unit: 'koli', factor: 200, barcode: '8690000000035', price: 400, custom_price: null, list_price: 400 }]);
  // Başka ürünün birimi aynı barkodu alamaz.
  expect((await call(owner, 'put', `/api/sector/hardware/products/${kablo.id}/units`, { units: [{ unit: 'makara', factor: 100, barcode: '8690000000035' }] })).status).toBe(409);
  expect((await call(owner, 'put', `/api/sector/hardware/products/${kablo.id}/units`, { units: [{ unit: 'makara', factor: 100, barcode: '8690000000042' }] })).status).toBe(200);
  // Başka işletme göremez ve değiştiremez.
  expect((await call(other, 'get', url)).status).toBe(403);
  const audit = (await db.query("SELECT details FROM audit_logs WHERE tenant_id=$1 AND action='product.units_updated' AND entity_id=$2", [owner.tenantId, vida.id])).rows;
  expect(audit.length).toBe(1);
});

test('hırdavat araması stoku ve birim fiyatlarını birimli verir', async () => {
  const r = await call(owner, 'get', '/api/sector/hardware/search?q=M4');
  const item = r.body.items.find(i => i.id === vida.id);
  expect(item.stock_text).toBe('6 koli + 1 paket');
  expect(item.units.map(u => [u.unit, u.price])).toEqual([['paket', 100], ['koli', 400]]);
  const k = (await call(owner, 'get', '/api/sector/hardware/search?q=kablo')).body.items.find(i => i.id === kablo.id);
  expect(k.stock_text).toBe('2 makara + 30 metre');
});

test('mal kabul: koli barkodu ürünü bulur, 3 koli stoğa 600 adet girer; ad ile de kabul edilir', async () => {
  const look = await call(owner, 'get', '/api/retail/lookup?barcode=8690000000035');
  expect(look.body.product.id).toBe(vida.id); expect(look.body.pack).toEqual({ unit: 'koli', factor: 200 });
  const before = await qty(vida.id);
  const r = await call(owner, 'post', '/api/retail/receive', { warehouse_id: w.id, product_id: vida.id, barcode: '8690000000035', quantity: 3 }, 'unit-recv-1');
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({ quantity: 600, pack: { unit: 'koli', count: 3, factor: 200 } });
  expect(await qty(vida.id)).toBe(before + 600);
  const byName = await call(owner, 'post', '/api/retail/receive', { warehouse_id: w.id, product_id: vida.id, pack_unit: 'paket', quantity: 2 }, 'unit-recv-2');
  expect(byName.body.quantity).toBe(100);
  expect((await call(owner, 'post', '/api/retail/receive', { warehouse_id: w.id, product_id: vida.id, pack_unit: 'çuval', quantity: 1 }, 'unit-recv-3')).status).toBe(404);
  expect((await call(owner, 'post', '/api/retail/receive', { warehouse_id: w.id, product_id: vida.id, barcode: '8690000000035', pack_unit: 'paket', quantity: 1 }, 'unit-recv-4')).status).toBe(409);
  const move = (await db.query("SELECT change_amount FROM stock_movements WHERE product_id=$1 AND source='retail_quick_add' ORDER BY id DESC LIMIT 1", [vida.id])).rows[0];
  expect(Number(move.change_amount)).toBe(100);
});

test('kasa: koli barkodu 200 adet düşer ve 200 x birim fiyatla satılır; metre küsuratlı satılır, koli elle miktar alamaz', async () => {
  await openTestShift(owner, w.id, 100);
  const vidaBefore = await qty(vida.id), kabloBefore = await qty(kablo.id);
  const sale = await call(owner, 'post', '/api/scanner/sale', { warehouse_id: w.id, payment_method: 'cash', items: [{ barcode: '8690000000035', count: 1 }, { barcode: kablo.barcode, count: 1, quantity: '2,5' }] }, 'unit-sale-1');
  expect(sale.status).toBe(201);
  expect(await qty(vida.id)).toBe(vidaBefore - 200);
  expect(await qty(kablo.id)).toBeCloseTo(kabloBefore - 2.5, 6);
  const detail = (await call(owner, 'get', '/api/scanner/sales/' + sale.body.sale_id)).body;
  const total = JSON.stringify(detail);
  expect(total).toContain('"variant":"koli"');
  const lines = (detail.items || detail.sale?.items || []);
  if (lines.length) {
    expect(lines.find(l => l.product_id === vida.id).quantity).toBe(200);
    expect(lines.find(l => l.product_id === kablo.id).quantity).toBe(2.5);
  }
  expect((await call(owner, 'post', '/api/scanner/sale', { warehouse_id: w.id, payment_method: 'cash', items: [{ barcode: '8690000000035', count: 1, quantity: '1,5' }] }, 'unit-sale-2')).status).toBe(400);
});

test('koliye özel fiyat: doğrulanır, aramada görünür, kasada satır tutarı koli fiyatıdır', async () => {
  const url = `/api/sector/hardware/products/${vida.id}/units`;
  expect((await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200, barcode: '8690000000035', price: '0' }] })).status).toBe(400);
  expect((await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200, barcode: '8690000000035', price: '360,555' }] })).status).toBe(400);
  const set = await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200, barcode: '8690000000035', price: '360' }, { unit: 'paket', factor: 50 }] });
  expect(set.status).toBe(200);
  expect(set.body.units.find(u => u.unit === 'koli')).toMatchObject({ price: 360, custom_price: 360, list_price: 400 });
  const item = (await call(owner, 'get', '/api/sector/hardware/search?q=M4')).body.items.find(i => i.id === vida.id);
  expect(item.units.find(u => u.unit === 'koli').price).toBe(360);
  const quote = await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: '8690000000035', count: 2 }, { barcode: vida.barcode, count: 3 }] });
  expect(quote.status).toBe(200);
  expect(quote.body.gross).toBe(726); // 2 koli x 360 + 3 adet x 2
  const before = await qty(vida.id);
  const sale = await call(owner, 'post', '/api/scanner/sale', { warehouse_id: w.id, payment_method: 'cash', items: [{ barcode: '8690000000035', count: 1 }] }, 'unit-sale-price-1');
  expect(sale.status).toBe(201);
  expect(await qty(vida.id)).toBe(before - 200);
  const detail = JSON.stringify((await call(owner, 'get', '/api/scanner/sales/' + sale.body.sale_id)).body);
  expect(detail).toContain('"gross_cents":36000');
  // Özel fiyat kaldırılınca liste fiyatına döner.
  await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200, barcode: '8690000000035' }] });
  const back = await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: '8690000000035', count: 1 }] });
  expect(back.body.gross).toBe(400);
});


test('adet stoklu vida kiloyla satılır: 0,4 kg = 100 adet düşer, kilo fiyatıyla; katalog ölçü birimini bildirir; iade küsuratlı yapılır', async () => {
  const url = `/api/sector/hardware/products/${vida.id}/units`;
  expect((await call(owner, 'put', url, { units: [{ unit: 'koli', factor: 200, barcode: '8690000000035' }, { unit: 'kg', factor: 250, price: '420' }] })).status).toBe(200);
  const cat = await call(owner, 'get', '/api/scanner/pro/catalog?q=Vida');
  expect(cat.body.items.find(i => i.id === vida.id).measure_unit).toEqual({ unit: 'kg', factor: 250, price: 420 });
  const quote = await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: vida.barcode, count: 1, quantity: '0,4', sell_unit: 'kg' }] });
  expect(quote.status).toBe(200); expect(quote.body.gross).toBe(168);
  const before = await qty(vida.id);
  const sale = await call(owner, 'post', '/api/scanner/sale', { warehouse_id: w.id, payment_method: 'cash', items: [{ barcode: vida.barcode, count: 1, quantity: '0,4', sell_unit: 'kg' }] }, 'unit-kg-sale-1');
  expect(sale.status).toBe(201);
  expect(await qty(vida.id)).toBe(before - 100);
  // Tanımsız birim, koli barkoduyla ölçü ve fiyat değiştirerek satış reddedilir.
  expect((await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: vida.barcode, count: 1, quantity: '1', sell_unit: 'metre' }] })).status).toBe(404);
  expect((await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: '8690000000035', count: 1, quantity: '1', sell_unit: 'kg' }] })).status).toBe(400);
  expect((await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: vida.barcode, count: 1, quantity: '1', sell_unit: 'kg', price_override: 1 }] })).status).toBe(400);
  // Kısmi iade: 0,1 kg'lık kısmı yani 25 adet geri alınır.
  expect(JSON.stringify((await call(owner, 'get', '/api/scanner/sales/' + sale.body.sale_id)).body)).toContain('"variant":"kg"');
  expect((await call(owner, 'post', '/api/scanner/sales/' + sale.body.sale_id + '/return', { reason: 'Küsurat', items: [{ id: 1, quantity: 0.5 }] }, 'unit-kg-return-0')).status).toBeLessThan(300);
  const ret = await call(owner, 'post', '/api/scanner/sales/' + sale.body.sale_id + '/return', { reason: 'Fazla tartıldı', items: [{ id: 1, quantity: 24.5 }] }, 'unit-kg-return-1');
  expect(ret.status).toBeLessThan(300);
  expect(await qty(vida.id)).toBe(before - 75);
});
