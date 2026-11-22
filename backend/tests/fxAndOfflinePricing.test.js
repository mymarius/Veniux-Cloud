const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
let owner, wh;
const auth = r => r.set('Authorization', 'Bearer ' + owner.token);
const post = (route, body, headers = {}) => auth(request(app).post('/api/scanner/' + route)).set('Idempotency-Key', crypto.randomUUID()).set(headers).send(body);
async function product(price) {
  const code = 'FX-' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$3,$4,'adet',$5,10,'NORMAL') RETURNING id,barcode", [owner.tenantId, code, code, 'Dvz ' + code, price])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)', [owner.tenantId, wh.id, p.id]);
  return p;
}
const snapshot = async id => JSON.parse((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1 AND tenant_id=$2', [id, owner.tenantId])).rows[0].snapshot_json);
let seq = 0;
const offlineHeader = () => ({ 'x-veniux-offline': 'ETST-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(++seq + Math.floor(Math.random() * 1000) * 10).padStart(5, '0').slice(-5) + '|' + new Date().toISOString() });
beforeAll(async () => { owner = await f.createTenant(); wh = await f.createWarehouse(owner.tenantId); await f.openTestShift(owner, wh.id); await auth(request(app).put('/api/products/currency-rates')).send({ USD: 40 }); });

test('kasiyer kurları okur; döviz seçilen satışta kur ve karşılık kayda ve fişe yazılır', async () => {
  const fx = await auth(request(app).get('/api/scanner/fx'));
  expect(fx.status).toBe(200);
  expect(fx.body.rates.USD.rate).toBe(40);
  const p = await product(100);
  const body = { warehouse_id: wh.id, payment_method: 'cash', items: [{ barcode: p.barcode, count: 1 }] };
  const sold = await post('sale', { ...body, currency: 'USD' });
  expect(sold.status).toBe(201);
  expect((await snapshot(sold.body.sale_id)).payment_currency).toEqual({ currency: 'USD', rate: 40, amount: 2.5 });
  const receipt = await auth(request(app).get(`/api/scanner/sales/${sold.body.sale_id}/receipt?width=80`));
  expect(receipt.text).toContain('Döviz karşılığı: 2,50 USD');
  const tl = await post('sale', body);
  expect((await snapshot(tl.body.sale_id)).payment_currency).toBeUndefined();
  expect((await post('sale', { ...body, currency: 'EUR' })).status).toBe(400);
  expect((await post('sale', { ...body, currency: 'XXX' })).status).toBe(400);
});

test('katalog pricing=1 ile kademe ve döviz fiyatlarını getirir', async () => {
  const p = await product(50);
  await auth(request(app).put(`/api/products/${p.id}/price-tiers`)).send({ tier2: 40 });
  await auth(request(app).put(`/api/products/${p.id}/currency-price`)).send({ currency: 'USD', price: 2 });
  const plain = await auth(request(app).get('/api/scanner/pro/catalog?q=' + p.barcode));
  expect(plain.body.items[0].tiers).toBeUndefined();
  const priced = await auth(request(app).get('/api/scanner/pro/catalog?pricing=1&q=' + p.barcode));
  expect(priced.body.items[0]).toMatchObject({ tiers: { 2: 40 }, fx: { currency: 'USD', price: 2 } });
});

test('çevrimdışı satış: tutar uyuşursa kayıt temiz, uyuşmazsa sunucu fiyatıyla kaydolur ve uyuşmazlık yazılır', async () => {
  const p = await product(100);
  const body = { warehouse_id: wh.id, payment_method: 'cash', payments: [{ method: 'cash', amount: 100 }], cash_received: 100, items: [{ barcode: p.barcode, count: 1 }], offline_total_cents: 10000 };
  const ok = await post('sale', body, offlineHeader());
  expect(ok.status).toBe(201);
  expect((await db.query("SELECT COUNT(*) n FROM pos_offline_conflicts WHERE sale_id=$1 AND kind='price_mismatch'", [ok.body.sale_id])).rows[0].n).toBe(0);
  const bad = await post('sale', { ...body, offline_total_cents: 9000, payments: [{ method: 'cash', amount: 90 }], cash_received: 100 }, offlineHeader());
  expect(bad.status).toBe(201);
  expect(bad.body.total).toBe(100);
  const conflict = (await db.query("SELECT note FROM pos_offline_conflicts WHERE sale_id=$1 AND kind='price_mismatch'", [bad.body.sale_id])).rows[0];
  expect(conflict.note).toContain('90,00 TL gösterildi');
  expect(conflict.note).toContain('100,00 TL hesapladı');
  // çevrimiçi satışta aynı alan yok sayılır; ödeme tutarsızsa eskisi gibi reddedilir
  expect((await post('sale', { ...body, offline_total_cents: 9000, payments: [{ method: 'cash', amount: 90 }] })).status).toBe(400);
});
