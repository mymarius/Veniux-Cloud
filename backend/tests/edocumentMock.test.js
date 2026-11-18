const service = require('../src/services/edocumentService');
const mock = require('../src/integrations/mockEdocumentProvider');
const db = require('../src/config/database');
const { createTenant } = require('./factories/index');

let owner, other;
const actor = user => ({ userId: user.userId, tenantId: user.tenantId, role: 'admin', accessScope: { mode: 'company' } });
let saleNo = 0;
const draft = (user, vkn) => service.createDraft(actor(user), { sale_id: 'M' + (++saleNo), document_type: 'E_ARSIV', draft: { lines: [] }, receiver: vkn ? { vkn } : null });
const year = new Date().getUTCFullYear();

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  process.env.VENIUX_EDOCUMENT_PROVIDER = 'mock';
  for (const user of [owner, other]) await service.saveConnection(actor(user), { username: 'deneme', password: 'deneme-parola' });
});
beforeEach(() => { mock._reset(); process.env.VENIUX_EDOCUMENT_LIVE = '1'; service.setProvider(mock); });
afterAll(() => { delete process.env.VENIUX_EDOCUMENT_LIVE; delete process.env.VENIUX_EDOCUMENT_PROVIDER; service.setProvider(null); });

test('sahte sağlayıcı: gönderim kabul edilir ve resmî numara serisi ardışık verilir', async () => {
  const a = await draft(owner, '1234567890'), b = await draft(owner, '1234567891');
  const first = await service.send(actor(owner), a.id), second = await service.send(actor(owner), b.id);
  expect(first.status).toBe('sent');
  expect(first.number).toMatch(/^[A-Z]{3}\d{4}\d{9}$/);
  expect(first.number.slice(3, 7)).toBe(String(year));
  const seq = n => Number(n.slice(-9));
  expect(seq(second.number)).toBe(seq(first.number) + 1);
  expect(mock._received().get(a.id).number).toBe(first.number);
});

test('numara başka işletmeyle karışmaz; her işletmenin serisi 1\'den başlar', async () => {
  const c = await draft(other, '5555555555');
  const sent = await service.send(actor(other), c.id);
  expect(Number(sent.number.slice(-9))).toBe(1);
});

test('aynı belgeye her zaman aynı numara verilir (yeniden gönderimde değişmez)', async () => {
  const doc = await draft(owner, '1111111222'); // yanıt kaybolur, belge ulaşmadı
  const first = await service.send(actor(owner), doc.id);
  expect(first.status).toBe('unknown');
  const number = first.number;
  expect(number).toBeTruthy();
  expect((await service.refresh(actor(owner), doc.id)).status).toBe('retry');
  const again = await service.send(actor(owner), doc.id);
  expect(again.number).toBe(number);
  expect(await service.assignNumber(owner.tenantId, doc.id)).toBe(number);
});

test('entegratör reddederse belge reddedilir, aynı satışa yeni belge açılabilir ve numara boşa gitmez', async () => {
  const doc = await draft(owner, '9999999000');
  const result = await service.send(actor(owner), doc.id);
  expect(result.status).toBe('rejected');
  const retry = await service.createDraft(actor(owner), { sale_id: doc.sale_id, document_type: 'E_ARSIV', draft: { lines: [] }, receiver: { vkn: '9999999001' } });
  const sent = await service.send(actor(owner), retry.id);
  expect(sent.status).toBe('sent');
  expect(Number(sent.number.slice(-9))).toBeGreaterThan(Number(result.number.slice(-9)));
});

test('yanıt kaybolur ama belge ulaştıysa durum sorgusu tamamlar ve tekrar gönderilmez', async () => {
  const doc = await draft(owner, '2222222111');
  expect((await service.send(actor(owner), doc.id)).status).toBe('unknown');
  expect((await service.refresh(actor(owner), doc.id)).status).toBe('sent');
  await expect(service.send(actor(owner), doc.id)).rejects.toMatchObject({ status: 409 });
  expect(mock._received().size).toBe(1);
});

test('liste numarayı gösterir; numarasız taslakta null döner', async () => {
  const pending = await draft(owner, '3333333333');
  const rows = await service.list(actor(owner));
  expect(rows.find(r => r.id === pending.id).number).toBeNull();
  expect(rows.some(r => r.number && /^[A-Z]{3}\d{13}$/.test(r.number))).toBe(true);
});

test('eş zamanlı gönderimler çift numara üretmez', async () => {
  const docs = await Promise.all(Array.from({ length: 5 }, (_, i) => draft(owner, '70000000' + String(10 + i))));
  const results = await Promise.all(docs.map(d => service.send(actor(owner), d.id)));
  const numbers = results.map(r => r.number);
  expect(new Set(numbers).size).toBe(5);
  const rows = (await db.query('SELECT number FROM edocument_numbers WHERE tenant_id=$1', [owner.tenantId])).rows.map(r => r.number);
  expect(new Set(rows).size).toBe(rows.length);
});

test('mükellef sorgusu: son hane çiftse e-Fatura, tekse e-Arşiv önerilir', async () => {
  expect((await service.checkTaxpayer(actor(owner), '1234567890')).suggested_type).toBe('E_FATURA');
  expect((await service.checkTaxpayer(actor(owner), '1234567891')).suggested_type).toBe('E_ARSIV');
});

test('üretimde sahte sağlayıcı seçilemez', async () => {
  const before = { provider: process.env.VENIUX_EDOCUMENT_PROVIDER, node: process.env.NODE_ENV };
  try {
    process.env.VENIUX_EDOCUMENT_PROVIDER = 'mock'; process.env.NODE_ENV = 'production';
    service.setProvider(null);
    expect((await service.status(actor(owner))).provider).toBe('uyumsoft');
    process.env.NODE_ENV = 'test';
    service.setProvider(null);
    expect((await service.status(actor(owner))).provider).toBe('sahte');
  } finally {
    process.env.NODE_ENV = before.node; process.env.VENIUX_EDOCUMENT_PROVIDER = before.provider;
    service.setProvider(mock);
  }
});
