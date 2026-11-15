const request = require('supertest');
const zlib = require('zlib');
const app = require('../src/index');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createUser } = require('./factories');

// İşletmenin marka adı ve logosu: doğrulama, yetki, işletme ayrımı.
let a, b, cashier;
const api = (who, method, body) => request(app)[method]('/api/branding').set('Authorization', 'Bearer ' + who.token).send(body);
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return buf => { let c = 0xffffffff; for (const x of buf) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(body)); return Buffer.concat([len, body, c]); };
const png = (w, h) => { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h, 0x80); return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
const url = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;

beforeAll(async () => {
  a = await createTenant(); b = await createTenant();
  const u = await createUser(a.tenantId, 'cashier');
  cashier = { token: jwt.sign({ userId: u.id, tenantId: a.tenantId, role: 'cashier' }, JWT_SECRET) };
});

test('başlangıçta boş; kasiyer okuyabilir ama yazamaz', async () => {
  expect((await api(a, 'get')).body).toMatchObject({ brand_name: '', logo: null });
  expect((await api(cashier, 'get')).status).toBe(200);
  expect((await api(cashier, 'put', { brand_name: 'X' })).status).toBe(403);
});
test('marka adı temizlenir, uzunluk sınırı vardır, boş değer siler', async () => {
  const r = await api(a, 'put', { brand_name: '  Güneş   <b>Market</b>\u0007 ' });
  expect(r.status).toBe(200); expect(r.body.brand_name).toBe('Güneş bMarket/b');
  expect((await api(a, 'put', { brand_name: 'x'.repeat(61) })).body.code).toBe('BAD_NAME');
  expect((await api(a, 'put', { brand_name: '' })).body.brand_name).toBe('');
});
test('logo: geçerli PNG kaydolur, geri döner; işletme ayrımı', async () => {
  const ok = await api(a, 'put', { brand_name: 'Güneş Market', logo_data_url: url(png(64, 64)) });
  expect(ok.status).toBe(200); expect(ok.body.logo).toMatch(/^data:image\/png;base64,/); expect(ok.body).toMatchObject({ logo_width: 64, logo_height: 64, brand_name: 'Güneş Market' });
  expect((await api(a, 'get')).body.logo).toBeTruthy();
  expect((await api(b, 'get')).body).toMatchObject({ brand_name: '', logo: null });
});
test('logo reddedilenler: tür uyuşmazlığı, SVG, metin, çok küçük/büyük, aşırı boyut', async () => {
  expect((await api(a, 'put', { logo_data_url: url(png(64, 64), 'image/jpeg') })).body.code).toBe('BAD_LOGO');
  expect((await api(a, 'put', { logo_data_url: 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64') })).body.code).toBe('BAD_LOGO');
  expect((await api(a, 'put', { logo_data_url: url(Buffer.from('MZ-not-an-image-at-all-just-text-padding')) })).body.code).toBe('BAD_LOGO');
  expect((await api(a, 'put', { logo_data_url: url(png(16, 16)) })).body.code).toBe('BAD_LOGO_SIZE');
  expect((await api(a, 'put', { logo_data_url: url(png(2000, 40)) })).body.code).toBe('BAD_LOGO_SIZE');
  expect((await api(a, 'put', { logo_data_url: 'data:image/png;base64,' + 'A'.repeat(300000) })).status).toBe(413);
  expect((await api(a, 'put', { logo_data_url: 123 })).status).toBeGreaterThanOrEqual(400);
});
test('logo kaldırılır; işlemler denetim kaydına yazılır', async () => {
  const r = await api(a, 'put', { remove_logo: true });
  expect(r.body.logo).toBeNull(); expect(r.body.brand_name).toBe('Güneş Market');
  expect(Number((await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE tenant_id=$1 AND action='branding.updated'", [a.tenantId])).rows[0].n)).toBeGreaterThanOrEqual(3);
});
