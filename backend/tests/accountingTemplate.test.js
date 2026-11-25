const request = require('supertest');
const XLSX = require('xlsx');
const app = require('../src/index');
const db = require('../src/config/database');
const service = require('../src/services/accountingExportService');
const templates = require('../src/services/accountingTemplateService');
const { createTenant } = require('./factories/index');

// Gerçek Logo/Mikro/Paraşüt şablonları elde yok: motor, uydurma ama gerçekçi şablonlarla denenir.
let owner, other, n = 0;
const auth = user => ({ Authorization: 'Bearer ' + user.token });
const actor = user => ({ userId: user.userId, tenantId: user.tenantId, email: 'a@example.com', role: 'admin', accessScope: { mode: 'company' } });

async function packageWithSale(user, name = 'Kahve', date = '2025-03-10') {
  n += 1;
  const wh = (await db.query("INSERT INTO warehouses (tenant_id,name,type,location) VALUES ($1,'D','MAIN','A') RETURNING id", [user.tenantId])).rows[0].id;
  const pos = (await db.query("INSERT INTO pos_sales (tenant_id,receipt_no,total_amount,discount_amount,net_amount,payment_method,status) VALUES ($1,$2,120,0,120,'cash','completed') RETURNING id", [user.tenantId, 'FIS-T' + n])).rows[0].id;
  const snapshot = { receipt_no: 'FIS-T' + n, status: 'completed', payments: { cash: 12000 }, items: [{ id: 1, name, unit: 'adet', quantity: 1, net_cents: 12000, net_ex_vat_cents: 10000, vat_rate: 20, vat_cents: 2000 }] };
  await db.query('INSERT INTO retail_sales (sale_id,tenant_id,warehouse_id,user_id,business_date,snapshot_json) VALUES ($1,$2,$3,$4,$5,$6)', [pos, user.tenantId, wh, user.userId, date, JSON.stringify(snapshot)]);
  await service.saveMaps(actor(user), { maps: { 'sale:vat:20': '600.01' } });
  const created = await service.create(actor(user), { type: 'sales', from: '2025-03-01', to: '2025-03-28' });
  return created.id || (await service.list(actor(user)))[0].id;
}
const csvTemplate = (headers, delimiter = ';') => Buffer.from('﻿' + headers.join(delimiter) + '\r\n', 'utf8');
const xlsxTemplate = headers => {
  const sheet = XLSX.utils.aoa_to_sheet([['Fatura aktarım şablonu'], headers]);
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Fatura');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
};
const post = async (id, body) => { const r = await request(app).post(`/api/accounting-exports/${id}/template`).set(auth(owner)).buffer(true).parse((res, done) => { const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => done(null, Buffer.concat(chunks))); }).send(body); r.text = r.body.toString('utf8'); return r; };

beforeAll(async () => { owner = await createTenant(); other = await createTenant(); });

test('şablon başlıkları okunur: CSV ayracı kendiliğinden bulunur, Excel\'de başlık satırı başlığın üstündeki satırdan sonra gelir', async () => {
  const csv = templates.readTemplate('s.csv', csvTemplate(['Cari Kodu', 'Stok Adı', 'Miktar', 'Tutar'], ','));
  expect(csv).toMatchObject({ kind: 'csv', delimiter: ',', headers: ['Cari Kodu', 'Stok Adı', 'Miktar', 'Tutar'] });
  const xlsx = templates.readTemplate('s.xlsx', xlsxTemplate(['Belge No', 'Ürün', 'Tutar']));
  expect(xlsx).toMatchObject({ kind: 'xlsx', headerRow: 1, headerRowNumber: 2, headers: ['Belge No', 'Ürün', 'Tutar'] });
  const route = await request(app).post('/api/accounting-exports/template/headers').set(auth(owner))
    .send({ filename: 's.csv', type: 'sales', data: csvTemplate(['A', 'B']).toString('base64') });
  expect(route.status).toBe(200);
  expect(route.body.fields).toContain('urun');
});

test('CSV şablon doldurulur: eşlenen sütunlar paketten gelir, sabit değer yazılır, eşlenmeyen boş kalır, ayraç korunur', async () => {
  const id = await packageWithSale(owner, 'Filtre kahve');
  const res = await post(id, {
    filename: 'sablon.csv', data: csvTemplate(['Belge No', 'Stok Adı', 'Tutar', 'Not', 'Para Birimi'], ',').toString('base64'),
    mapping: { 'Belge No': { field: 'fis_no' }, 'Stok Adı': { field: 'urun' }, Tutar: { field: 'toplam', as: 'number' }, 'Para Birimi': { value: 'TL' } }
  });
  expect(res.status).toBe(200);
  const text = res.text.replace(/^﻿/, '').trim().split(/\r?\n/);
  expect(text[0]).toBe('Belge No,Stok Adı,Tutar,Not,Para Birimi');
  const row = text[1].split(',');
  expect(row[1]).toBe('Filtre kahve');
  expect(row[2]).toMatch(/^120/);
  expect(row[3]).toBe('');
  expect(row[4]).toBe('TL');
});

test('Excel şablon doldurulur: başlığın altına satırlar yazılır, tutar sayı olur, üstteki başlık satırı korunur', async () => {
  const id = await packageWithSale(owner, 'Çay');
  const res = await post(id, {
    filename: 'sablon.xlsx', data: xlsxTemplate(['Belge No', 'Ürün', 'Tutar']).toString('base64'),
    mapping: { 'Belge No': { field: 'fis_no' }, Ürün: { field: 'urun' }, Tutar: { field: 'toplam', as: 'number' } }
  });
  expect(res.status).toBe(200);
  const book = XLSX.read(res.body, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 });
  expect(rows[0][0]).toBe('Fatura aktarım şablonu');
  expect(rows[1]).toEqual(['Belge No', 'Ürün', 'Tutar']);
  expect(rows[2][1]).toBe('Çay');
  expect(typeof rows[2][2]).toBe('number');
  expect(rows[2][2]).toBe(120);
});

test('formül gibi başlayan metin Excel dosyasında formül olmaz', async () => {
  const id = await packageWithSale(owner, '=CMD("x")');
  const res = await post(id, { filename: 's.xlsx', header_row: 2, data: xlsxTemplate(['Ürün']).toString('base64'), mapping: { Ürün: { field: 'urun' } } });
  expect(res.status).toBe(200);
  const book = XLSX.read(res.body, { type: 'buffer', cellFormula: true });
  const cell = book.Sheets[book.SheetNames[0]].A3;
  expect(cell.f).toBeUndefined();
  expect(cell.t).toBe('s');
  expect(cell.v).toBe('=CMD("x")');
});

test('hatalı istekler reddedilir; başka işletme paketini şablonlayamaz', async () => {
  const id = await packageWithSale(owner);
  const good = { filename: 's.csv', data: csvTemplate(['A']).toString('base64') };
  expect((await post(id, { ...good, mapping: { A: { field: 'yok_boyle_alan' } } })).status).toBe(400);
  expect((await post(id, { ...good, mapping: {} })).status).toBe(400);
  expect((await post(id, { ...good, filename: 's.pdf', mapping: { A: { field: 'urun' } } })).status).toBe(400);
  expect((await post(id, { filename: 's.csv', data: '***', mapping: { A: { field: 'urun' } } })).status).toBe(400);
  const stranger = await request(app).post(`/api/accounting-exports/${id}/template`).set(auth(other)).send({ ...good, mapping: { A: { field: 'urun' } } });
  expect(stranger.status).toBeGreaterThanOrEqual(400);
});
