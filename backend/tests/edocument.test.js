const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const service = require('../src/services/edocumentService');
const { createTenant } = require('./factories/index');

let owner, other, sends;
const auth = user => ({ Authorization: 'Bearer ' + user.token });
const actor = user => ({ userId: user.userId, tenantId: user.tenantId, role: 'admin', accessScope: { mode: 'company' } });
const fake = overrides => ({ name: 'fake', test: async () => ({}), taxpayer: async () => ({ Value: 'true' }), send: async () => { sends += 1; return { state: 'accepted' }; }, status: async () => ({ state: 'accepted' }), ...overrides });
let saleNo = 0;
const draft = user => service.createDraft(actor(user), { sale_id: 'S' + (++saleNo), document_type: 'E_ARSIV', draft: { lines: [] } });

beforeAll(async () => { owner = await createTenant(); other = await createTenant(); });
beforeEach(() => { sends = 0; process.env.VENIUX_EDOCUMENT_LIVE = '1'; service.setProvider(fake()); });
afterAll(() => { delete process.env.VENIUX_EDOCUMENT_LIVE; service.setProvider(null); });

test('hesap parolası şifreli saklanır ve API yanıtında dönmez', async () => {
  const secret = 'gizli-parola-' + Date.now();
  const saved = await request(app).put('/api/edocuments/connection').set(auth(owner)).send({ username: 'firma', password: secret });
  expect(saved.status).toBe(200);
  expect(saved.body.connected).toBe(true);
  expect(JSON.stringify(saved.body)).not.toContain(secret);
  const row = (await db.query('SELECT credentials_enc FROM edocument_connections WHERE tenant_id=$1', [owner.tenantId])).rows[0];
  expect(row.credentials_enc).not.toContain(secret);
  const elsewhere = await request(app).get('/api/edocuments/connection').set(auth(other));
  expect(elsewhere.body.connected).toBe(false);
});

test('canlı gönderim kapalıyken belge gönderilemez', async () => {
  delete process.env.VENIUX_EDOCUMENT_LIVE;
  const doc = await draft(owner);
  await expect(service.send(actor(owner), doc.id)).rejects.toMatchObject({ status: 503 });
  expect(sends).toBe(0);
});

test('varsayılan sağlayıcıda gönderim işlemi yoktur', async () => {
  service.setProvider(null);
  const doc = await draft(owner);
  await expect(service.send(actor(owner), doc.id)).rejects.toMatchObject({ status: 503 });
});

test('aynı satışa ikinci belge açılamaz, red sonrası açılabilir', async () => {
  const input = { sale_id: 'TEK-' + Date.now(), document_type: 'E_ARSIV', draft: {} };
  const first = await service.createDraft(actor(owner), input);
  await expect(service.createDraft(actor(owner), input)).rejects.toMatchObject({ status: 409 });
  service.setProvider(fake({ send: async () => ({ state: 'rejected', detail: 'hata' }) }));
  expect((await service.send(actor(owner), first.id)).status).toBe('rejected');
  expect((await service.createDraft(actor(owner), input)).status).toBe('draft');
});

test('zaman aşımı belirsiz kalır, sorgulanmadan yeniden gönderilmez', async () => {
  service.setProvider(fake({ send: async () => { sends += 1; throw Error('timeout'); } }));
  const doc = await draft(owner);
  expect((await service.send(actor(owner), doc.id)).status).toBe('unknown');
  await expect(service.send(actor(owner), doc.id)).rejects.toMatchObject({ status: 409 });
  expect(sends).toBe(1);
});

test('belge ulaştıysa sorgu tekrar göndermeden tamamlar', async () => {
  service.setProvider(fake({ send: async () => { sends += 1; throw Error('timeout'); }, status: async () => ({ state: 'accepted' }) }));
  const doc = await draft(owner);
  await service.send(actor(owner), doc.id);
  expect((await service.refresh(actor(owner), doc.id)).status).toBe('sent');
  await expect(service.send(actor(owner), doc.id)).rejects.toMatchObject({ status: 409 });
  expect(sends).toBe(1);
});

test('entegratör belgeyi almadıysa aynı kimlikle yeniden gönderilir', async () => {
  const seen = [];
  service.setProvider(fake({ send: async doc => { seen.push(doc.uuid); if (seen.length === 1) throw Error('timeout'); return { state: 'accepted' }; }, status: async () => ({ state: 'not_found' }) }));
  const doc = await draft(owner);
  await service.send(actor(owner), doc.id);
  expect((await service.refresh(actor(owner), doc.id)).status).toBe('retry');
  expect((await service.send(actor(owner), doc.id)).status).toBe('sent');
  expect(seen).toEqual([doc.id, doc.id]);
});

test('başka işletmenin belgesine erişilemez', async () => {
  const doc = await draft(owner);
  await expect(service.refresh(actor(other), doc.id)).rejects.toMatchObject({ status: 404 });
  expect((await service.list(actor(other))).some(row => row.id === doc.id)).toBe(false);
});

test('depo yetkisi sınırlı yönetici e-belgeye erişemez', async () => {
  await expect(service.list({ ...actor(owner), accessScope: { mode: 'restricted' } })).rejects.toMatchObject({ status: 403 });
});

test('açık yanıt yoksa mükellef sonucu tahmin edilmez', () => {
  expect(service.readTaxpayer({ Value: 'true' })).toBe(true);
  expect(service.readTaxpayer({ Value: 'false' })).toBe(false);
  expect(service.readTaxpayer({})).toBe(null);
});
