const request = require('supertest'), crypto = require('crypto'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
const analysis = require('../src/services/profitAnalysisService');
let owner, cashier, wh;
const get = (url, u = owner) => request(app).get('/api/' + url).set('Authorization', 'Bearer ' + u.token);
const post = (url, body) => request(app).post('/api/' + url).set('Authorization', 'Bearer ' + owner.token).set('Idempotency-Key', crypto.randomUUID()).send(body);
async function product(name, category, purchase, sale, basis = 'exclusive') {
  const code = '000' + crypto.randomUUID();
  const p = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,category,unit,purchase_price,purchase_price_tax_basis,sale_price,kdv_orani,module_type) VALUES ($1,$2,$3,$4,$5,'adet',$6,$7,$8,20,'NORMAL') RETURNING *", [owner.tenantId, crypto.randomUUID(), name, code, category, purchase, basis, sale])).rows[0];
  await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,100)', [owner.tenantId, wh.id, p.id]);
  return p;
}
const sell = async (p, count) => expect((await post('scanner/sale', { warehouse_id: wh.id, payment_method: 'cash', items: [{ barcode: p.barcode, count }] })).status).toBe(201);
let kar, zarar, bilinmeyen;
beforeAll(async () => {
  owner = await f.createTenant();
  const u = await f.createUser(owner.tenantId, 'cashier');
  cashier = { token: (await request(app).post('/api/auth/login').send({ email: u.email, password: 'password123' })).body.token };
  wh = (await db.query('SELECT * FROM warehouses WHERE tenant_id=$1 LIMIT 1', [owner.tenantId])).rows[0];
  await f.openTestShift(owner, wh.id);
  kar = await product('Kârlı ürün', 'Gıda', 20, 120);       // KDV hariç satış 100, maliyet 20 → kâr 80
  zarar = await product('Zararlı ürün', 'Temizlik', 150, 120); // satış 100, maliyet 150 → zarar 50
  bilinmeyen = await product('Maliyetsiz ürün', 'Gıda', 0, 60, null);
  await sell(kar, 3); await sell(zarar, 1); await sell(bilinmeyen, 1);
});

test('ürün bazında kâr, marj ve sıralama; maliyeti bilinmeyen ürün kâra katılmaz', async () => {
  const r = (await get('scanner/profit-analysis?group_by=product')).body;
  const k = r.groups.find(g => g.label === 'Kârlı ürün'), z = r.groups.find(g => g.label === 'Zararlı ürün'), b = r.groups.find(g => g.label === 'Maliyetsiz ürün');
  expect(k).toMatchObject({ net_ex_vat_cents: 30000, cost_ex_vat_cents: 6000, gross_profit_ex_vat_cents: 24000, margin_percent: 80 });
  expect(z).toMatchObject({ net_ex_vat_cents: 10000, cost_ex_vat_cents: 15000, gross_profit_ex_vat_cents: -5000, margin_percent: -50 });
  expect(b).toMatchObject({ gross_profit_ex_vat_cents: 0, incomplete_rows: 1, margin_percent: null });
  expect(r.groups.map(g => g.label)).toEqual(['Kârlı ürün', 'Maliyetsiz ürün', 'Zararlı ürün']);
  expect(r.top_profitable.map(p => p.label)).toEqual(['Kârlı ürün']);
  expect(r.top_loss.map(p => p.label)).toEqual(['Zararlı ürün']);
  expect(r.unknown_cost_products.map(p => p.product)).toEqual(['Maliyetsiz ürün']);
  expect(r.summary).toMatchObject({ net_ex_vat_cents: 40000, cost_ex_vat_cents: 21000, gross_profit_ex_vat_cents: 19000, margin_percent: 47.5, incomplete_rows: 1 });
  expect(r.summary.excluded_net_inc_vat_cents).toBeGreaterThan(0);
});

test('kategori ve dönem (gün/hafta/ay) gruplaması aynı toplamı verir', async () => {
  const cat = (await get('scanner/profit-analysis?group_by=category')).body;
  expect(cat.groups.map(g => [g.label, g.gross_profit_ex_vat_cents])).toEqual([['Gıda', 24000], ['Temizlik', -5000]]);
  for (const by of ['day', 'week', 'month']) {
    const r = (await get('scanner/profit-analysis?group_by=' + by)).body;
    expect(r.groups.length).toBe(1);
    expect(r.groups[0].gross_profit_ex_vat_cents).toBe(19000);
  }
  const week = (await get('scanner/profit-analysis?group_by=week')).body.groups[0].key;
  expect(new Date(week + 'T00:00:00Z').getUTCDay()).toBe(1);
});

test('tarih aralığı süzer; geçersiz aralık ve gruplama reddedilir', async () => {
  const past = (await get('scanner/profit-analysis?from=2020-01-01&to=2020-01-31')).body;
  expect(past.groups).toEqual([]);
  expect(past.summary.margin_percent).toBeNull();
  expect((await get('scanner/profit-analysis?from=2026-02-01&to=2026-01-01')).status).toBe(400);
  expect((await get('scanner/profit-analysis?from=2020-01-01&to=2026-01-01')).status).toBe(400);
  expect((await get('scanner/profit-analysis?group_by=satici')).status).toBe(400);
  const cat = (await get('scanner/profit-analysis?category=Temizlik')).body;
  expect(cat.groups.map(g => g.label)).toEqual(['Zararlı ürün']);
});

test('CSV dışa aktarma: BOM, noktalı virgül, TL tutarları, formül enjeksiyonuna karşı kaçış', async () => {
  const res = await get('scanner/profit-analysis?group_by=product&format=csv');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/csv/);
  expect(res.headers['content-disposition']).toMatch(/kar-analizi_product_/);
  const text = res.text.replace(/^﻿/, '');
  const lines = text.split('\r\n');
  expect(lines[0]).toBe('"Ürün";"Net satış KDV hariç";"Maliyet KDV hariç";"Brüt kâr KDV hariç";"Kâr marjı %";"Maliyeti bilinmeyen kayıt"');
  expect(lines[1]).toBe('"Kârlı ürün";"300,00";"60,00";"240,00";"80,00";"0"'.replace('"0"', '"0,00"'));
  expect(lines.find(l => l.startsWith('"TOPLAM"'))).toContain('"190,00"');
  expect((await get('scanner/profit-analysis?format=xlsx')).status).toBe(400);
  const evil = await product('=cmd|x', 'Gıda', 10, 60);
  await sell(evil, 1);
  const again = (await get('scanner/profit-analysis?group_by=product&format=csv')).text;
  expect(again).toContain(`"'=cmd|x"`);
  expect(analysis.GROUPS).toContain('week');
});

test('yalnız yönetici/müdür görür: kasiyer 403, kimliksiz 401', async () => {
  expect((await get('scanner/profit-analysis', cashier)).status).toBe(403);
  expect((await request(app).get('/api/scanner/profit-analysis')).status).toBe(401);
});
