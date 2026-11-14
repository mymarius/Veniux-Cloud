process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser, openTestShift } = require('./factories');

// Züccaciye derinleştirme: takımı kasada tek barkodla satmak, kırık/fire kaydı, çeyiz-düğün listesi.
let owner, w, cashier, bardak, tabak, kase, setId;
const call = (who, method, url, body, key) => { const r = request(app)[method](url).set('Authorization', 'Bearer ' + who.token); if (key) r.set('Idempotency-Key', key); return body ? r.send(body) : r; };
const qty = async id => Number((await db.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1', [id])).rows[0].q);
const product = async (sku, name, price, stock) => {
  const p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,purchase_price,category,module_type) VALUES($1,$2,$3,$4,'adet',$5,$6,'Züccaciye','NORMAL') RETURNING *", [owner.tenantId, sku, name, sku, price, price / 2])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,$4)', [owner.tenantId, w.id, p.id, stock]);
  return p;
};

beforeAll(async () => {
  owner = await createTenant();
  w = await createWarehouse(owner.tenantId);
  await db.query("UPDATE warehouses SET warehouse_type='NORMAL' WHERE id=$1", [w.id]);
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'tableware')", [owner.tenantId]);
  const c = await createUser(owner.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: c.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
  bardak = await product('8690001000011', 'Çay bardağı', 20, 60);
  tabak = await product('8690001000028', 'Çay tabağı', 15, 60);
  kase = await product('8690001000035', 'Şekerlik', 70, 10);
  const set = await call(owner, 'post', '/api/sector/tableware/sets', { name: '6 kişilik çay takımı', target_sets: 2, items: [{ product_id: bardak.id, quantity: 6 }, { product_id: tabak.id, quantity: 6 }, { product_id: kase.id, quantity: 1 }] });
  setId = set.body.id;
  await openTestShift(owner, w.id, 100);
});

test('takım barkodu: doğrulanır, çakışma reddedilir, liste fiyatı ve takım fiyatı görünür', async () => {
  const url = `/api/sector/tableware/sets/${setId}/sale`;
  expect((await call(cashier, 'put', url, { barcode: '8690001999999', price: 250 })).status).toBe(403);
  expect((await call(owner, 'put', url, { barcode: bardak.barcode, price: 250 })).status).toBe(409);
  expect((await call(owner, 'put', url, { barcode: '8690001999999', price: '0' })).status).toBe(400);
  expect((await call(owner, 'put', url, { barcode: '8690001999999', price: '249,90' })).body).toMatchObject({ barcode: '8690001999999', sale_price: 249.9 });
  const s = (await call(owner, 'get', '/api/sector/tableware/sets')).body.sets.find(x => x.id === setId);
  expect(s).toMatchObject({ barcode: '8690001999999', sale_price: 249.9, list_price: 280 });
});

test('kasa barkod sorgusu takım barkodunu tanır: takım adı, takım fiyatı ve kaç takımlık stok', async () => {
  const r = await call(owner, 'post', '/api/scanner/lookup', { barcode: '8690001999999', warehouse_id: w.id });
  expect(r.status).toBe(200);
  expect(r.body.product).toMatchObject({ name: '6 kişilik çay takımı', unit: 'takım', module_type: 'NORMAL' });
  expect(r.body).toMatchObject({ unit_price: 249.9, line_total: 249.9, quantity: 1, stock: 10 }); // bardak 60/6, tabak 60/6, şekerlik 10/1: en az 10 takım
  const none = await call(owner, 'post', '/api/scanner/lookup', { barcode: '0000000000000', warehouse_id: w.id });
  expect(none.body.product).toBeNull();
});

test('kasada takım barkodu: parçalara açılır, stok her parçadan düşer, toplam takım fiyatıdır; iade parça bazında', async () => {
  const quote = await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: '8690001999999', count: 2 }, { barcode: bardak.barcode, count: 1 }] });
  expect(quote.status).toBe(200);
  expect(quote.body.gross).toBe(519.8); // 2 x 249,90 + 20
  const before = [await qty(bardak.id), await qty(tabak.id), await qty(kase.id)];
  const sale = await call(owner, 'post', '/api/scanner/sale', { warehouse_id: w.id, payment_method: 'cash', items: [{ barcode: '8690001999999', count: 1 }] }, 'set-sale-1');
  expect(sale.status).toBe(201);
  expect([await qty(bardak.id), await qty(tabak.id), await qty(kase.id)]).toEqual([before[0] - 6, before[1] - 6, before[2] - 1]);
  const detail = JSON.stringify((await call(owner, 'get', '/api/scanner/sales/' + sale.body.sale_id)).body);
  expect(detail).toContain('6 kişilik çay takımı');
  expect(detail).toContain('"gross_cents"');
  // Takım satırında fiyat ya da miktar değiştirilemez.
  expect((await call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: [{ barcode: '8690001999999', count: 1, price_override: 1 }] })).status).toBe(400);
  // Bir bardak kırık çıktı: yalnız o parça iade edilir.
  const ret = await call(owner, 'post', '/api/scanner/sales/' + sale.body.sale_id + '/return', { reason: 'Bardak çatlak', items: [{ id: 1, quantity: 1 }] }, 'set-return-1');
  expect(ret.status).toBeLessThan(300);
  expect(await qty(bardak.id)).toBe(before[0] - 5);
});

test('kırık/fire: stoktan düşer, stoktan fazlası reddedilir, maliyetiyle raporlanır', async () => {
  const before = await qty(kase.id);
  expect((await call(cashier, 'post', '/api/sector/tableware/breakage', { product_id: kase.id, warehouse_id: w.id, quantity: 1, reason: 'yok' })).status).toBe(400);
  expect((await call(cashier, 'post', '/api/sector/tableware/breakage', { product_id: kase.id, warehouse_id: w.id, quantity: 500, reason: 'kirik' })).status).toBe(409);
  const r = await call(cashier, 'post', '/api/sector/tableware/breakage', { product_id: kase.id, warehouse_id: w.id, quantity: 2, reason: 'musteri', note: 'Raf önünde düştü' });
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({ quantity: 2, reason: 'Müşteri kırdı', cost: 70 });
  await call(owner, 'post', '/api/sector/tableware/breakage', { product_id: bardak.id, warehouse_id: w.id, quantity: 3, reason: 'kirik' });
  expect(await qty(kase.id)).toBe(before - 2);
  expect((await call(cashier, 'get', '/api/sector/tableware/breakage')).status).toBe(403);
  const report = (await call(owner, 'get', '/api/sector/tableware/breakage?days=7')).body;
  expect(report.total_cost).toBe(100);
  expect(report.reasons.map(x => [x.reason, x.quantity, x.cost])).toEqual([['Müşteri kırdı', 2, 70], ['Kırık', 3, 30]]);
  expect(report.products[0]).toMatchObject({ name: 'Şekerlik', cost: 70 });
});

test('çeyiz listesi: liste, kalem, alındı işareti, fazla alım reddi, paylaşım metni, kapalı liste', async () => {
  expect((await call(owner, 'post', '/api/sector/tableware/registries', { title: 'x' })).status).toBe(400);
  const reg = await call(owner, 'post', '/api/sector/tableware/registries', { title: 'Ayşe & Mehmet çeyiz', owner_name: 'Ayşe Demir', phone: '0532 000 00 00', event_date: '2027-05-20' });
  expect(reg.status).toBe(201);
  const id = reg.body.id;
  expect((await call(cashier, 'post', `/api/sector/tableware/registries/${id}/items`, { product_id: kase.id })).status).toBe(403);
  const it1 = (await call(owner, 'post', `/api/sector/tableware/registries/${id}/items`, { set_id: setId, wanted: 2 })).body;
  const it2 = (await call(owner, 'post', `/api/sector/tableware/registries/${id}/items`, { product_id: kase.id, wanted: 1 })).body;
  expect((await call(owner, 'post', `/api/sector/tableware/registries/${id}/items`, { product_id: kase.id, wanted: 2 })).body.merged).toBe(true);
  expect((await call(cashier, 'post', `/api/sector/tableware/registries/${id}/items/${it1.id}/bought`, { quantity: 1, buyer: 'Teyze' })).body).toMatchObject({ bought: 1, wanted: 2 });
  expect((await call(cashier, 'post', `/api/sector/tableware/registries/${id}/items/${it1.id}/bought`, { quantity: 5 })).status).toBe(409);
  const detail = (await call(cashier, 'get', `/api/sector/tableware/registries/${id}`)).body;
  expect(detail.items.map(i => [i.name, i.wanted, i.bought, i.price])).toEqual([['6 kişilik çay takımı', 2, 1, 249.9], ['Şekerlik', 3, 0, 70]]);
  expect(detail.remaining_total).toBe(459.9);
  expect(detail.share_text).toContain('6 kişilik çay takımı: 1 adet');
  expect(detail.share_text).toContain('20.05.2027');
  expect((await call(owner, 'delete', `/api/sector/tableware/registries/${id}/items/${it1.id}`)).status).toBe(409);
  expect((await call(owner, 'delete', `/api/sector/tableware/registries/${id}/items/${it2.id}`)).status).toBe(200);
  const list = (await call(cashier, 'get', '/api/sector/tableware/registries')).body.items;
  expect(list.find(r => r.id === id)).toMatchObject({ items: 1, completed: 0 });
  await call(owner, 'put', `/api/sector/tableware/registries/${id}`, { title: 'Ayşe & Mehmet çeyiz', status: 'closed' });
  expect((await call(cashier, 'post', `/api/sector/tableware/registries/${id}/items/${it1.id}/bought`, { quantity: 1 })).status).toBe(409);
});

test('kampanya takım fiyatının üstüne binmez: takım parçaları muaf, aynı ürünün tek satışı kampanyalı', async () => {
  await db.query("INSERT INTO retail_campaigns (tenant_id,name,kind,product_id,percent,starts_on,ends_on,requires_approval,active,created_by) VALUES ($1,'Tabak %50','percent',$2,50,'2000-01-01','2099-12-31',0,1,1)", [owner.tenantId, tabak.id]);
  const quote = body => call(owner, 'post', '/api/scanner/sale-quote', { warehouse_id: w.id, items: body });
  const set = await quote([{ barcode: '8690001999999', count: 1 }]);
  expect(set.body).toMatchObject({ gross: 249.9, campaign_discount: 0, total: 249.9 });
  const single = await quote([{ barcode: tabak.barcode, count: 2 }]);
  expect(single.body).toMatchObject({ gross: 30, campaign_discount: 15, total: 15 });
  await db.query('DELETE FROM retail_campaigns WHERE tenant_id=$1', [owner.tenantId]);
});

test('toplu zam takım fiyatını değiştirmez ama etkilenen takımı uyarı olarak döner', async () => {
  await db.query("INSERT INTO sector_packs (tenant_id,pack) VALUES ($1,'hardware')", [owner.tenantId]);
  const r = await call(owner, 'post', '/api/sector/hardware/prices/bulk', { category: 'Züccaciye', percent: 10, rounding: 0.5 });
  expect(r.status).toBe(200);
  expect(r.body.sets_to_review).toEqual([{ id: setId, name: '6 kişilik çay takımı', set_price: 249.9, parts_total_after: 308 }]);
  const applied = await call(owner, 'post', '/api/sector/hardware/prices/bulk', { category: 'Züccaciye', percent: 10, rounding: 0.5, apply: true, expected_count: r.body.changed });
  expect(applied.body.sets_to_review).toHaveLength(1);
  const s = (await call(owner, 'get', '/api/sector/tableware/sets')).body.sets.find(x => x.id === setId);
  expect(s.sale_price).toBe(249.9);
});
