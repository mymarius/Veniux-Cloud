const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database');
const { createTenant, createUser } = require('./factories');
const svc = require('../src/services/barcodeLookupService');
let owner, other;
const auth = (t = owner) => ({ Authorization: 'Bearer ' + t.token });
const user = t => ({ tenantId: t.tenantId });
const CODE = '5449000000996';
const offBody = { status: 1, product: { code: CODE, product_name: 'Coca-Cola', brands: 'Coca-Cola, Diğer', quantity: '330 ml', product_quantity: '330', product_quantity_unit: 'ml', image_front_small_url: 'https://images.openfoodfacts.org/x.jpg' } };
const okFetch = (calls = []) => async url => { calls.push(url); return { ok: true, status: 200, json: async () => offBody }; };
beforeAll(async () => { owner = await createTenant(); other = await createTenant(); });
beforeEach(() => svc.reset());

test('sağlama basamağı ve GTIN eşdeğerleri', () => {
  expect(svc.checksumOk(CODE)).toBe(true);
  expect(svc.checksumOk('5449000000997')).toBe(false);
  expect(svc.variants('0' + CODE)).toContain(CODE);
});

test('önce kendi katalog: bulunursa dış servise gidilmez', async () => {
  await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,purchase_price,sale_price,category,module_type) VALUES ($1,'LK-1','Kendi Kola',$2,'adet',5,8,'x','NORMAL')", [owner.tenantId, CODE]);
  const calls = [];
  const r = await svc.suggest(user(owner), CODE, { fetchImpl: okFetch(calls) });
  expect(r).toMatchObject({ source: 'catalog', product: { name: 'Kendi Kola' }, manual: false });
  expect(calls).toHaveLength(0);
  // başka işletmenin kataloğu görünmez
  expect((await svc.suggest(user(other), CODE, { fetchImpl: okFetch() })).source).toBe('off');
});

test('OFF önerisi: ad, marka, gramaj, görsel, ODbL atfı; kayıt yazılmaz; ikinci sorgu önbellekten', async () => {
  const before = (await db.query('SELECT COUNT(*) c FROM products WHERE tenant_id=$1', [other.tenantId])).rows[0].c;
  const calls = [];
  const r = await svc.suggest(user(other), '8690000099991', { fetchImpl: okFetch(calls) });
  expect(r.source).toBe('off'); expect(r.review_required).toBe(true);
  expect(r.suggestion).toMatchObject({ name: 'Coca-Cola', brand: 'Coca-Cola', quantity_text: '330 ml', size: { value: 330, unit: 'ml' }, suggested_name: 'Coca-Cola 330 ml', image_url: 'https://images.openfoodfacts.org/x.jpg' });
  expect(r.attribution.license).toMatch(/ODbL/);
  const again = await svc.suggest(user(other), '8690000099991', { fetchImpl: okFetch(calls) });
  expect(again.cached).toBe(true); expect(calls).toHaveLength(1);
  expect((await db.query('SELECT COUNT(*) c FROM products WHERE tenant_id=$1', [other.tenantId])).rows[0].c).toBe(before);
});

test('bulunamayan, hata ve sayısal olmayan barkod elle girişe düşer; hata önbelleğe yazılmaz', async () => {
  const miss = await svc.suggest(user(owner), '4006381333931', { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status: 0 }) }) });
  expect(miss).toMatchObject({ source: 'none', manual: true, lookup_state: 'missing' });
  svc.reset();
  const boom = await svc.suggest(user(owner), '4006381333931', { fetchImpl: async () => { throw new Error('ağ'); } });
  expect(boom.lookup_state).toBe('error');
  expect((await svc.suggest(user(owner), '4006381333931', { fetchImpl: okFetch() })).source).toBe('off');
  const alpha = await svc.suggest(user(owner), 'ABC-12', { fetchImpl: okFetch() });
  expect(alpha).toMatchObject({ source: 'none', lookup_state: 'skipped' });
});

test('sunucu başına dakikada 15 dış istek sınırı aşılınca sorgu yapılmaz', async () => {
  const calls = []; const t0 = Date.now();
  const tenants = [];
  for (let i = 0; i < 3; i++) tenants.push({ tenantId: 900 + i });
  let n = 0, limited = 0;
  for (let i = 0; i < 20; i++) {
    const r = await svc.offLookup(tenants[i % 3].tenantId, String(1000000000000 + i), { fetchImpl: okFetch(calls), now: t0 });
    n++; if (r.state === 'limited') limited++;
  }
  expect(calls).toHaveLength(15); expect(limited).toBe(5); expect(n).toBe(20);
  const later = await svc.offLookup(900, '2000000000000', { fetchImpl: okFetch(calls), now: t0 + 61e3 });
  expect(later.state).toBe('found');
});

test('uç nokta: yalnız yönetici/müdür, barkod doğrulanır', async () => {
  process.env.VENIUX_OFF_DISABLED = '1';
  try {
    const ok = await request(app).get('/api/retail/lookup/suggest').query({ barcode: CODE }).set(auth());
    expect(ok.status).toBe(200); expect(ok.body.source).toBe('catalog');
    expect((await request(app).get('/api/retail/lookup/suggest').set(auth())).status).toBe(400);
    expect((await request(app).get('/api/retail/lookup/suggest').query({ barcode: CODE })).status).toBe(401);
  } finally { delete process.env.VENIUX_OFF_DISABLED; }
});
