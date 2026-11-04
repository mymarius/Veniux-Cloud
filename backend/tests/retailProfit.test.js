const request = require('supertest'),
  crypto = require('crypto'),
  app = require('../src/index'),
  db = require('../src/config/database');
const {
  createTenant,
  createUser
} = require('./factories');
const daily = require('../src/services/retailDailyService');
let owner, other, cashier, wh, bin, product;
const post = (url, body, u = owner, key = crypto.randomUUID()) => request(app).post('/api/' + url).set('Authorization', 'Bearer ' + u.token).set('Idempotency-Key', key).send(body);
const get = (url, u = owner) => request(app).get('/api/' + url).set('Authorization', 'Bearer ' + u.token);
const report = (extra = '') => get('scanner/gross-profit?warehouse_id=' + wh.id + '&product_id=' + product.id + extra);
const sell = async (count = 2, discount = 0) => {
  const r = await post('scanner/sale', {
    warehouse_id: wh.id,
    payment_method: 'cash',
    discount_amount: discount,
    items: [{
      barcode: product.barcode,
      count
    }]
  });
  expect(r.status).toBe(201);
  return r.body.sale_id;
};
const reverse = (id, quantity, disposition = 'saleable', kind = 'return') => post('scanner/sales/' + id + '/' + kind, {
  reason: 'Gerçek SQLite kâr senaryosu',
  items: [{
    id: 1,
    quantity,
    disposition
  }]
});
async function receive(lot, quantity, price) {
  const r = await post('wms/inbound/receipts', {
    warehouse_id: wh.id,
    items: [{
      product_id: product.id,
      expected_qty: quantity,
      lot_number: lot,
      expiry_date: lot.endsWith('1') ? '2099-01-01' : '2099-02-01',
      unit_purchase_price: price
    }]
  });
  expect(r.status).toBe(201);
  expect((await post('wms/inbound/putaway', {
    receipt_id: r.body.id,
    item_id: r.body.items[0].id,
    quantity,
    actual_location_id: bin.id
  })).status).toBe(200);
}
test('kabul katalog fiyatını değiştirirken alış KDV temelini karıştırmaz', async () => {
  for (const [basis, rate, expected] of [['inclusive', 20, 'inclusive'], ['exclusive', 10, null]]) {
    const receipt = await post('wms/inbound/receipts', { warehouse_id: wh.id, items: [{ product_id: product.id, expected_qty: 1, unit_purchase_price: 24, purchase_price_tax_basis: basis, purchase_vat_rate: rate }] });
    expect(receipt.status).toBe(201);
    expect((await post('wms/inbound/putaway', { receipt_id: receipt.body.id, item_id: receipt.body.items[0].id, quantity: 1, actual_location_id: bin.id })).status).toBe(200);
    const p = (await db.query('SELECT purchase_price,purchase_price_tax_basis FROM products WHERE id=$1', [product.id])).rows[0];
    expect(p.purchase_price).toBe(24);
    expect(p.purchase_price_tax_basis).toBe(expected);
  }
});
beforeAll(async () => {
  owner = await createTenant();
  other = await createTenant();
  const u = await createUser(owner.tenantId, 'cashier');
  cashier = {
    token: (await request(app).post('/api/auth/login').send({
      email: u.email,
      password: 'password123'
    })).body.token
  };
  wh = (await db.query('SELECT * FROM warehouses WHERE tenant_id=$1 LIMIT 1', [owner.tenantId])).rows[0];
  bin = (await db.query('SELECT * FROM warehouse_locations WHERE warehouse_id=$1 AND tenant_id=$2 LIMIT 1', [wh.id, owner.tenantId])).rows[0];
  await require('./factories').openTestShift(owner,wh.id);
});
beforeEach(async () => {
  product = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,category,unit,purchase_price,purchase_price_tax_basis,sale_price,kdv_orani,module_type) VALUES ($1,$2,'Kâr ürünü',$3,'Gıda','adet',20,'exclusive',120,20,'NORMAL') RETURNING *", [owner.tenantId, crypto.randomUUID(), '000' + crypto.randomUUID()])).rows[0];
  await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,10)', [owner.tenantId, wh.id, product.id]);
});
test('indirimli satış: satış/indirim/KDV/maliyet aynı temelde, alış fiyatı sonradan değişse de geçmiş korunur', async () => {
  await sell(2, 24);
  await db.query("UPDATE products SET purchase_price=999,kdv_orani=10,category='Değişti' WHERE id=$1", [product.id]);
  const r = (await report()).body;
  expect(r.summary).toMatchObject({
    sales_inc_vat_cents: 24000,
    sales_ex_vat_cents: 20000,
    discount_inc_vat_cents: 2400,
    discount_ex_vat_cents: 2000,
    net_inc_vat_cents: 21600,
    net_ex_vat_cents: 18000,
    cost_ex_vat_cents: 4000,
    cost_inc_vat_cents: 4800,
    gross_profit_ex_vat_cents: 14000,
    gross_profit_inc_vat_cents: 16800
  });
  expect(r.rows[0].category).toBe('Gıda');
});
test('farklı maliyetli lotlar: FEFO ile seçilen gerçek lot maliyetleri ve lot bazlı kısmi iade', async () => {
  await db.query('DELETE FROM stock_records WHERE product_id=$1', [product.id]);
  await receive('PROFIT-LOT-1', 1, 20);
  await receive('PROFIT-LOT-2', 1, 40);
  const id = await sell();
  expect((await report()).body.summary.cost_ex_vat_cents).toBe(6000);
  expect((await reverse(id, 1)).status).toBe(200);
  expect((await report()).body.summary).toMatchObject({
    net_ex_vat_cents: 10000,
    cost_ex_vat_cents: 4000,
    gross_profit_ex_vat_cents: 6000
  });
  await db.query('UPDATE wms_inbound_items SET unit_purchase_price=999 WHERE product_id=$1', [product.id]);
  expect((await report()).body.summary.cost_ex_vat_cents).toBe(4000);
});
test('aynı lotta farklı kabullerin miktar ağırlıklı maliyeti satış anında sabitlenir', async () => {
  await db.query('DELETE FROM stock_records WHERE product_id=$1', [product.id]);
  await receive('WEIGHTED-1', 1, 20);
  await receive('WEIGHTED-1', 3, 40);
  await sell();
  const r = (await report()).body;
  expect(r.summary.cost_ex_vat_cents).toBe(7000);
  expect(r.rows[0].methods).toContain('lot_receipt_weighted_average');
});
test('KDV dahil alış fiyatı doğru hariç maliyete dönüştürülür', async () => {
  await db.query("UPDATE products SET purchase_price=24,purchase_price_tax_basis='inclusive' WHERE id=$1", [product.id]);
  await sell(1);
  expect((await report()).body.summary).toMatchObject({
    cost_inc_vat_cents: 2400,
    cost_ex_vat_cents: 2000,
    gross_profit_ex_vat_cents: 8000
  });
});
test('üç kısmi iade indirimli kuruşları ve maliyeti tam sıfırlar; tekrar iade reddedilir', async () => {
  const id = await sell(3, 0.01);
  for (let n = 0; n < 3; n++) expect((await reverse(id, 1)).status).toBe(200);
  const r = (await report()).body;
  expect(r.summary).toMatchObject({
    net_inc_vat_cents: 0,
    net_ex_vat_cents: 0,
    cost_ex_vat_cents: 0,
    gross_profit_ex_vat_cents: 0,
    returns_inc_vat_cents: 35999
  });
  expect((await reverse(id, 1)).status).toBe(409);
});
test('hasarlı ve karantina iadeleri maliyeti geri kazanılmış saymaz ve satışa kapalı tutar', async () => {
  const id = await sell();
  expect((await reverse(id, 1, 'damaged')).status).toBe(200);
  expect((await reverse(id, 1, 'quarantine')).status).toBe(200);
  expect((await report()).body.summary).toMatchObject({
    net_ex_vat_cents: 0,
    cost_ex_vat_cents: 4000,
    blocked_return_cost_ex_vat_cents: 4000,
    gross_profit_ex_vat_cents: -4000
  });
  expect((await db.query('SELECT SUM(quantity) q FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2', [owner.tenantId, product.id])).rows[0].q).toBe(2);
});
test('iptal edilmiş satış gelire ve maliyete girmez; eski dönem de güncel iptal durumunu yansıtır', async () => {
  const id = await sell();
  expect((await reverse(id, 2, 'saleable', 'cancel')).status).toBe(200);
  const r = (await report()).body;
  expect(r.cancelled_sales_excluded).toBe(1);
  expect(r.summary).toMatchObject({
    sales_inc_vat_cents: 0,
    cost_ex_vat_cents: 0,
    gross_profit_ex_vat_cents: 0
  });
});
test('maliyetin veya alış KDV temelinin eksikliği sıfır maliyet/kâr olarak sunulmaz', async () => {
  await db.query('UPDATE products SET purchase_price_tax_basis=NULL,purchase_price=0 WHERE id=$1', [product.id]);
  await sell();
  const s = (await report()).body.summary;
  expect(s.has_unknown_cost).toBe(true);
  expect(s.cost_ex_vat_cents).toBeNull();
  expect(s.gross_profit_ex_vat_cents).toBeNull();
  expect(s.net_ex_vat_cents).toBe(20000);
});
test('doğrulanmış sıfır alış maliyeti bilinmeyen maliyetten ayrılır', async () => {
  await db.query('UPDATE products SET purchase_price=0 WHERE id=$1', [product.id]);
  await sell();
  expect((await report()).body.summary).toMatchObject({
    has_unknown_cost: false,
    cost_ex_vat_cents: 0,
    gross_profit_ex_vat_cents: 20000
  });
});
test('eski satışlara güncel fiyat/KDV geriye dönük doldurulmaz', async () => {
  const id = await sell(),
    row = (await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1', [id])).rows[0],
    s = JSON.parse(row.snapshot_json);
  for (const l of s.items) for (const k of ['cost_snapshot', 'vat_rate', 'gross_ex_vat_cents', 'net_ex_vat_cents', 'discount_ex_vat_cents', 'category']) delete l[k];
  await db.query('UPDATE retail_sales SET snapshot_json=$1 WHERE sale_id=$2', [JSON.stringify(s), id]);
  expect((await report()).body.summary).toMatchObject({
    has_unknown_cost: true,
    has_unknown_vat: true,
    gross_profit_ex_vat_cents: null,
    net_ex_vat_cents: null,
    net_inc_vat_cents: 24000
  });
});
test('önceki gün satışı bugünkü iade raporuna negatif net satış ve geri kazanılan maliyetle girer', async () => {
  let id;
  jest.useFakeTimers({doNotFake:['nextTick','setImmediate','setTimeout','setInterval']});
  jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  try { id = await sell(); } finally { jest.useRealTimers(); }
  await reverse(id, 1);
  expect((await report()).body.summary).toMatchObject({
    sales_inc_vat_cents: 0,
    returns_inc_vat_cents: 12000,
    net_ex_vat_cents: -10000,
    cost_ex_vat_cents: -2000,
    gross_profit_ex_vat_cents: -8000
  });
  expect((await report('&from=2026-01-01&to=2026-01-01')).body.summary.net_ex_vat_cents).toBe(20000);
});
test('haftalık/aralık, ürün/kategori/kasiyer filtreleri ve geçersiz tarihler', async () => {
  await sell();
  expect((await report('&period=week')).body.from).toBe(new Date(Date.parse(daily.businessDate()) - 6 * 86400000).toISOString().slice(0, 10));
  expect((await report('&category=Gıda&cashier_id=' + owner.userId)).body.rows).toHaveLength(1);
  expect((await report('&category=Başka')).body.rows).toHaveLength(0);
  expect((await report('&from=2026-02-30')).status).toBe(400);
  expect((await report('&from=2099-01-01&to=2026-01-01')).status).toBe(400);
});
test('CSV/Excel aynı tutarları taşır; metinler formül olarak çalışmaz', async () => {
  await db.query("UPDATE products SET name='=SUM(1,1)' WHERE id=$1", [product.id]);
  await sell();
  const csv = await report('&format=csv');
  expect(csv.status).toBe(200);
  expect(csv.text).toContain("'=SUM(1,1)");
  expect(csv.text).toContain('Brüt kâr');
  const x = await report('&format=xlsx').buffer(true).parse((res, done) => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });
  expect(x.status).toBe(200);
  const X = require('xlsx'),
    book = X.read(x.body, {
      type: 'buffer'
    });
  expect(book.Sheets['Brüt kâr'].B2).toMatchObject({
    t: 's',
    v: '=SUM(1,1)'
  });
  expect(book.Sheets['Brüt kâr'].B2.f).toBeUndefined();
});
test('rapor ve dışa aktarım sunucuda yetkili; diğer işletmenin deposuna erişilemez', async () => {
  await sell();
  expect((await get('scanner/gross-profit', cashier)).status).toBe(403);
  expect((await get('scanner/gross-profit?format=xlsx', cashier)).status).toBe(403);
  expect((await get('scanner/gross-profit?format=csv', cashier)).status).toBe(403);
  expect((await get('scanner/gross-profit?warehouse_id=' + wh.id, other)).status).toBe(404);
  expect((await request(app).get('/api/scanner/gross-profit')).status).toBe(401);
  for (const format of ['csv', 'xlsx']) expect((await request(app).get('/api/scanner/gross-profit?format=' + format)).status).toBe(401);
});

test('çıktı filtreleri, Türkçe metin, barkod sıfırları, tarihler ve ekran toplamları aynıdır', async () => {
  const name = 'Şeftali çğöşüİ; "özel"\nürün';
  product.barcode = '0012345678905';
  await db.query('UPDATE products SET name=$1,barcode=$2 WHERE id=$3', [name, product.barcode, product.id]);
  await sell(2, 24);
  const end = daily.businessDate(), start = new Date(Date.parse(end) - 86400000).toISOString().slice(0, 10);
  const query = '&period=range&from=' + start + '&to=' + end + '&category=' + encodeURIComponent('Gıda') + '&cashier_id=' + owner.userId;
  const screen = (await report(query)).body;
  const csv = await report(query + '&format=csv&report_fingerprint=' + screen.fingerprint);
  expect(csv.status).toBe(200);
  expect(csv.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
  expect(csv.headers['content-disposition']).toContain(`brut-kar_${start}_${end}.csv`);
  expect(csv.headers['x-report-fingerprint']).toBe(screen.fingerprint);
  const rows = require('papaparse').parse(csv.text, {delimiter:';'}).data;
  expect(rows[1].slice(0,5)).toEqual([end,name,product.barcode,'Gıda',owner.email]);
  const total = rows.find(r => r[0] === 'TOPLAM');
  const amount = (r, h) => Math.round(Number(r[rows[0].indexOf(h)].replace(',', '.')) * 100);
  expect(amount(total, 'Net satış KDV hariç')).toBe(screen.summary.net_ex_vat_cents);
  expect(amount(total, 'Maliyet KDV hariç')).toBe(screen.summary.cost_ex_vat_cents);
  expect(amount(total, 'Brüt kâr KDV hariç')).toBe(screen.summary.gross_profit_ex_vat_cents);
  expect(rows.find(r=>r[0]==='Başlangıç tarihi')[1]).toBe(start);
  expect(rows.find(r=>r[0]==='Kategori filtresi')[1]).toBe('Gıda');
  expect(rows.find(r=>r[0]==='Kasiyer filtresi')[1]).toContain(String(owner.userId));
  const excel = await report(query + '&format=xlsx&report_fingerprint=' + screen.fingerprint).buffer(true).parse((res,done)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>done(null,Buffer.concat(chunks)));});
  expect(excel.status).toBe(200);
  expect(excel.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(excel.headers['content-disposition']).toContain(`brut-kar_${start}_${end}.xlsx`);
  const X=require('xlsx'),sheet=X.read(excel.body,{type:'buffer'}).Sheets['Brüt kâr'], xr=X.utils.sheet_to_json(sheet,{header:1});
  expect(sheet.A2).toMatchObject({t:'s',v:end});
  expect(sheet.C2).toMatchObject({t:'s',v:product.barcode});
  const xt=xr.find(r=>r[0]==='TOPLAM');
  for(const [heading, key] of [['Net satış KDV hariç','net_ex_vat_cents'],['Maliyet KDV hariç','cost_ex_vat_cents'],['Brüt kâr KDV hariç','gross_profit_ex_vat_cents']])expect(Math.round(xt[xr[0].indexOf(heading)]*100)).toBe(screen.summary[key]);
});

test('ekrandan sonra rapor veya filtre değişirse eski toplamlarla dosya üretilmez', async () => {
  await sell();
  const screen = (await report()).body;
  await sell(1);
  const stale = await report('&format=csv&report_fingerprint=' + screen.fingerprint);
  expect(stale.status).toBe(409);
  expect(stale.headers['content-type']).toMatch(/application\/json/);
  expect(stale.headers['content-disposition']).toBeUndefined();
  const fresh = (await report()).body;
  expect((await report('&format=xlsx&category=Başka&report_fingerprint=' + fresh.fingerprint)).status).toBe(409);
});

test('CSV kullanıcı metnindeki boşluk, formül, tırnak ve satır sonlarını güvenli taşır', async () => {
  for(const name of ['  =SUM(1,1)', '\t+SUM(1,1)', '@SUM(1,1)', '-2+3']){
    await db.query('UPDATE products SET name=$1 WHERE id=$2',[name,product.id]);
    await sell(1);
  }
  const csv=await report('&format=csv');
  const rows=require('papaparse').parse(csv.text,{delimiter:';'}).data;
  // All current-name variants share a product/barcode/day; the earliest snapshot
  // remains the row label, which must be escaped as text rather than a formula.
  expect(rows[1][1]).toBe("'  =SUM(1,1)");
});

test('sonuç bulunmayan filtre geçerli sıfır toplamlı dosya üretir; geçersiz biçim dosya değildir', async () => {
  await sell();
  const csv=await report('&category=Yok&format=csv');
  expect(csv.status).toBe(200);
  expect(require('papaparse').parse(csv.text,{delimiter:';'}).data.find(r=>r[0]==='TOPLAM')[11]).toBe('0,00');
  const invalid=await report('&format=pdf');
  expect(invalid.status).toBe(400);
  expect(invalid.headers['content-disposition']).toBeUndefined();
});
test('eski lot kabulünün eksik KDV temeli sonradan ürün kartıyla doldurulmaz', async () => {
  await db.query('DELETE FROM stock_records WHERE product_id=$1', [product.id]);
  await db.query('UPDATE products SET purchase_price_tax_basis=NULL WHERE id=$1', [product.id]);
  await receive('UNKNOWN-1', 2, 20);
  await db.query("UPDATE products SET purchase_price_tax_basis='exclusive',purchase_price=99 WHERE id=$1", [product.id]);
  await sell();
  expect((await report()).body.summary).toMatchObject({
    has_unknown_cost: true,
    cost_ex_vat_cents: null,
    gross_profit_ex_vat_cents: null
  });
});
test('ürün kartı alış KDV temeli ve oranını sunucuda saklar, geçersiz temeli reddeder', async () => {
  const body = {
    sku: crypto.randomUUID(),
    name: 'Doğrulanmış maliyet',
    purchase_price: 24,
    purchase_price_tax_basis: 'inclusive',
    sale_price: 120,
    kdv_orani: 20,
    module_type: 'NORMAL'
  };
  const r = await post('products', body);
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({
    purchase_price_tax_basis: 'inclusive',
    kdv_orani: 20
  });
  const bad = await request(app).put('/api/products/' + r.body.id).set('Authorization', 'Bearer ' + owner.token).send({
    ...body,
    purchase_price_tax_basis: 'guess'
  });
  expect(bad.status).toBe(400);
});
