process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createWarehouse, createUser } = require('./factories');

const IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
let owner, cashier, w;
const post = (path, body, token = owner.token) => request(app).post('/api/scanner/pro/vision/' + path).set('Authorization', 'Bearer ' + token).send(body);
const gemini = payload => jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] } }] }) });

beforeAll(async () => {
  owner = await createTenant();
  w = await createWarehouse(owner.tenantId);
  for (const [sku, name, barcode, price] of [['V-1', 'Pınar Süt 1 L', '8690001112223', 42.5], ['V-2', 'Ülker Çikolatalı Gofret', '8690004445556', 12]]) {
    await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,$3,$4,'adet',$5,'NORMAL')", [owner.tenantId, sku, name, barcode, price]);
  }
  const u = await createUser(owner.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: u.id, tenantId: owner.tenantId, role: 'cashier' }, JWT_SECRET) };
});
afterEach(() => { jest.restoreAllMocks(); process.env.GEMINI_API_KEY = 'test-key'; });
beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key'; });

test('anahtar tanımlı değilse açık bir "yapılandırılmamış" cevabı döner', async () => {
  delete process.env.GEMINI_API_KEY;
  const r = await post('product', { image_data: IMAGE }, cashier.token);
  expect(r.status).toBe(503);
  expect(r.body.error).toContain('GEMINI_API_KEY');
});

test('ürün tanıma: ambalajdaki barkod işletmenin ürünüyle birebir eşleşir; fiyat yapay zekâdan değil kendi listeden gelir', async () => {
  gemini({ name: 'Süt', brand: 'Pınar', barcode: '8690001112223', confidence: 0.9, price: 999 });
  const r = await post('product', { image_data: IMAGE }, cashier.token);
  expect(r.status).toBe(200);
  expect(r.body.exact).toBe(true);
  expect(r.body.matches).toHaveLength(1);
  expect(r.body.matches[0]).toMatchObject({ name: 'Pınar Süt 1 L', sale_price: 42.5 });
});

test('ürün tanıma: barkod yoksa marka ve ad sözcükleriyle aday listesi çıkar; eşleşme yoksa boş liste', async () => {
  gemini({ name: 'Çikolatalı gofret', brand: 'Ülker', barcode: null, confidence: 0.7 });
  const found = (await post('product', { image_data: IMAGE }, cashier.token)).body;
  expect(found.exact).toBe(false);
  expect(found.matches[0].name).toBe('Ülker Çikolatalı Gofret');
  jest.restoreAllMocks();
  gemini({ name: 'Zeytinyağı', brand: 'Marka', barcode: null, confidence: 0.6 });
  expect((await post('product', { image_data: IMAGE }, cashier.token)).body.matches).toEqual([]);
});

test('fotoğraf doğrulaması: biçim ve boyut denetlenir; okunamayan yanıt 422 verir', async () => {
  expect((await post('product', { image_data: 'data:text/plain;base64,AAAA' }, cashier.token)).status).toBe(400);
  expect((await post('product', { image_data: 'data:image/jpeg;base64,' + 'A'.repeat(2100000) }, cashier.token)).status).toBe(413);
  gemini('bu json değil');
  expect((await post('product', { image_data: IMAGE }, cashier.token)).status).toBe(422);
  jest.restoreAllMocks();
  gemini({ name: null, brand: null, barcode: null, confidence: 0 });
  expect((await post('product', { image_data: IMAGE }, cashier.token)).status).toBe(422);
});

test('fatura taslağı: yalnız yönetici; satırlar ürünlerle eşlenir, stoğa hiçbir şey yazılmaz', async () => {
  expect((await post('invoice', { image_data: IMAGE }, cashier.token)).status).toBe(403);
  const before = (await db.query('SELECT COUNT(*) AS c FROM stock_records WHERE tenant_id=$1', [owner.tenantId])).rows[0].c;
  gemini({ supplier: 'Örnek Toptan', invoice_no: 'A-123', date: '2026-11-10', lines: [
    { name: 'Pinar Sut 1L', barcode: '8690001112223', quantity: 24, unit_price: 30 },
    { name: 'Bilinmeyen ürün', barcode: null, quantity: 2.5, unit_price: null },
    { name: '', quantity: 3 }, { name: 'Eksi', quantity: -1 },
  ] });
  const r = await post('invoice', { image_data: IMAGE });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ supplier: 'Örnek Toptan', invoice_no: 'A-123', date: '2026-11-10' });
  expect(r.body.lines).toHaveLength(2);
  expect(r.body.lines[0]).toMatchObject({ exact: true, quantity: 24 });
  expect(r.body.lines[0].candidates[0].name).toBe('Pınar Süt 1 L');
  expect(r.body.lines[1].candidates).toEqual([]);
  expect(r.body.warnings.length).toBe(1);
  expect((await db.query('SELECT COUNT(*) AS c FROM stock_records WHERE tenant_id=$1', [owner.tenantId])).rows[0].c).toBe(before);
});
