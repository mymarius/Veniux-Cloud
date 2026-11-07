const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const service = require('../src/services/accountingExportService');
const { createTenant } = require('./factories/index');

let owner, other, n = 0;
const auth = user => ({ Authorization: 'Bearer ' + user.token });
const actor = user => ({ userId: user.userId, tenantId: user.tenantId, email: 'a@example.com', role: 'admin', accessScope: { mode: 'company' } });
let month = 0, range, day;
async function sale(user, name = 'Kahve', date = day, vat = 20) {
  n += 1;
  const wh = (await db.query("INSERT INTO warehouses (tenant_id,name,type,location) VALUES ($1,'D','MAIN','A') RETURNING id", [user.tenantId])).rows[0].id;
  const pos = (await db.query("INSERT INTO pos_sales (tenant_id,receipt_no,total_amount,discount_amount,net_amount,payment_method,status) VALUES ($1,$2,120,0,120,'cash','completed') RETURNING id", [user.tenantId, 'FIS-T' + Date.now() + n])).rows[0].id;
  const snapshot = { receipt_no: 'FIS-' + n, status: 'completed', payments: { cash: 12000 }, items: [{ id: 1, name, unit: 'adet', quantity: 1, net_cents: 12000, net_ex_vat_cents: vat === null ? null : 10000, vat_rate: vat }] };
  await db.query('INSERT INTO retail_sales (sale_id,tenant_id,warehouse_id,user_id,business_date,snapshot_json) VALUES ($1,$2,$3,$4,$5,$6)', [pos, user.tenantId, wh, user.userId, date, JSON.stringify(snapshot)]);
  return pos;
}
beforeAll(async () => { owner = await createTenant(); other = await createTenant(); });
beforeEach(() => { month += 1; const m = String(month).padStart(2, '0'); range = { type: 'sales', from: `2025-${m}-01`, to: `2025-${m}-28` }; day = `2025-${m}-10`; });

test('hesap kodu eksikse paket oluşmaz, eşleşince doğru CSV üretilir', async () => {
  await sale(owner);
  const preview = await service.preview(actor(owner), range);
  expect(preview.missing_accounts).toEqual(['sale:vat:20']);
  await expect(service.create(actor(owner), range)).rejects.toMatchObject({ status: 409 });
  await service.saveMaps(actor(owner), { maps: { 'sale:vat:20': '600.01' } });
  const made = await service.create(actor(owner), range);
  const file = await service.file(actor(owner), made.id);
  expect(file.content.startsWith('﻿fis_no;tarih;urun')).toBe(true);
  expect(file.content).toContain(';Kahve;1;adet;100,00;20;20,00;120,00;600.01\r\n');
});

test('aynı kayıt ikinci pakete girmez, iptal sonrası yeniden aktarılır', async () => {
  await sale(owner);
  await service.saveMaps(actor(owner), { maps: { 'sale:vat:20': '600' } });
  const first = await service.create(actor(owner), range);
  expect((await service.preview(actor(owner), range)).already_exported).toBe(1);
  await expect(service.create(actor(owner), range)).rejects.toMatchObject({ status: 409 });
  await service.cancel(actor(owner), first.id);
  expect((await service.create(actor(owner), range)).row_count).toBe(1);
});

test('içe alınan paket hedefte geri alındığı onaylanmadan iptal edilmez', async () => {
  await sale(owner);
  await service.saveMaps(actor(owner), { maps: { 'sale:vat:20': '600' } });
  const made = await service.create(actor(owner), range);
  await service.markImported(actor(owner), made.id);
  await expect(service.cancel(actor(owner), made.id, {})).rejects.toMatchObject({ status: 409 });
  expect((await service.cancel(actor(owner), made.id, { reverted_in_target: true })).status).toBe('cancelled');
});

test('KDV bilgisi eksik satış paketi durdurur', async () => {
  await sale(owner, 'Eski', day, null);
  const preview = await service.preview(actor(owner), range);
  expect(preview.issue_count).toBe(1);
  await expect(service.create(actor(owner), range)).rejects.toMatchObject({ status: 409 });
});

test('Excel formülü metin olarak yazılır', async () => {
  const csv = service.toCsv(['a'], [['=HYPERLINK("x")'], ['-1+1'], [service.number('-5,00')]]);
  expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  expect(csv).toContain("'-1+1");
  expect(csv).toContain('\r\n-5,00\r\n');
});

test('başka işletme paketi göremez, kasiyer ve sınırlı yönetici giremez', async () => {
  await sale(owner, 'Gizli');
  await service.saveMaps(actor(owner), { maps: { 'sale:vat:20': '600' } });
  const made = await service.create(actor(owner), range);
  await expect(service.file(actor(other), made.id)).rejects.toMatchObject({ status: 404 });
  expect((await service.preview(actor(other), range)).record_count).toBe(0);
  await expect(service.list({ ...actor(owner), role: 'cashier' })).rejects.toMatchObject({ status: 403 });
  await expect(service.list({ ...actor(owner), accessScope: { mode: 'restricted' } })).rejects.toMatchObject({ status: 403 });
});

test('API dosyayı indirir ve geçersiz tarihi reddeder', async () => {
  await sale(owner);
  await request(app).put('/api/accounting-exports/maps').set(auth(owner)).send({ maps: { 'sale:vat:20': '600' } }).expect(200);
  const made = await request(app).post('/api/accounting-exports').set(auth(owner)).send(range).expect(200);
  const file = await request(app).get('/api/accounting-exports/' + made.body.id + '/file').set(auth(owner)).expect(200);
  expect(file.headers['content-type']).toContain('text/csv');
  expect(file.headers['content-disposition']).toContain('.csv');
  await request(app).post('/api/accounting-exports/preview').set(auth(owner)).send({ ...range, from: '2026-13-01' }).expect(400);
});
