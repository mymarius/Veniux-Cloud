const request = require('supertest'), app = require('../src/index');
const { createTenant } = require('./factories');
const svc = require('../src/services/barcodeLookupService');
const providers = require('../src/services/barcodeProviders');
let owner;
const user = t => ({ tenantId: t.tenantId });
const CODE = '8690000012345';
const offOk = { status: 1, product: { product_name: 'Çay', brands: 'Marka', quantity: '500 g', product_quantity: '500', product_quantity_unit: 'g' } };
const blOk = { products: [{ title: 'Kahve', brand: 'Marka B', category: 'Gıda', size: '250 g', images: ['https://cdn.example.com/a.jpg'] }] };
const resp = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
// URL'ye bakarak sağlayıcıya göre yanıt veren sahte ağ
const router = (handlers, calls = []) => async url => { calls.push(url); const key = url.includes('barcodelookup') ? 'bl' : 'off'; const h = handlers[key]; if (typeof h === 'function') return h(); return h; };
const ENV = extra => ({ ...process.env, ...extra });
beforeAll(async () => { owner = await createTenant(); });
beforeEach(() => svc.reset());

test('varsayılan: yalnız Open Food Facts etkin; ücretli sağlayıcı anahtarsız etkin sayılmaz', () => {
  expect(providers.enabledProviders(ENV({ VENIUX_BARCODE_PROVIDERS: undefined, VENIUX_BARCODELOOKUP_KEY: undefined })).map(p => p.id)).toEqual(['off']);
  expect(providers.enabledProviders(ENV({ VENIUX_BARCODE_PROVIDERS: 'barcodelookup,off', VENIUX_BARCODELOOKUP_KEY: undefined })).map(p => p.id)).toEqual(['off']);
  expect(providers.enabledProviders(ENV({ VENIUX_BARCODE_PROVIDERS: 'barcodelookup,off', VENIUX_BARCODELOOKUP_KEY: 'abcdefgh1234' })).map(p => p.id)).toEqual(['barcodelookup', 'off']);
  expect(providers.enabledProviders(ENV({ VENIUX_BARCODE_PROVIDERS: 'yok,off,off' })).map(p => p.id)).toEqual(['off']);
  expect(providers.enabledProviders(ENV({ VENIUX_OFF_DISABLED: '1' }))).toEqual([]);
});

test('sıra ve yedek: birincisi bulamazsa ikincisi denenir; bulan sağlayıcı yanıtta görünür', async () => {
  const calls = [];
  const env = ENV({ VENIUX_BARCODE_PROVIDERS: 'barcodelookup,off', VENIUX_BARCODELOOKUP_KEY: 'abcdefgh1234' });
  const r = await svc.suggest(user(owner), CODE, { env, fetchImpl: router({ bl: resp({}, 404), off: resp(offOk) }, calls) });
  expect(r).toMatchObject({ source: 'off', provider: { id: 'off' }, review_required: true });
  expect(calls).toHaveLength(2);
  expect(calls[0]).toContain('barcodelookup');
  svc.reset();
  const first = await svc.suggest(user(owner), CODE, { env, fetchImpl: router({ bl: resp(blOk), off: resp(offOk) }) });
  expect(first).toMatchObject({ source: 'barcodelookup', suggestion: { name: 'Kahve', brand: 'Marka B', category: 'Gıda', suggested_name: 'Marka B Kahve 250 g', image_url: null } });
  expect(first.attribution.text).toBe('Veri: Barcode Lookup');
});

test('hata, hız sınırı ve yetki: yedeğe geçilir; hata önbelleğe yazılmaz; son durum en önemli neden', async () => {
  const env = ENV({ VENIUX_BARCODE_PROVIDERS: 'barcodelookup,off', VENIUX_BARCODELOOKUP_KEY: 'abcdefgh1234' });
  // ücretli 500 (yeniden denenir), ücretsiz bulur
  let n = 0;
  const flaky = () => { n++; return resp({}, 500); };
  const r = await svc.suggest(user(owner), CODE, { env, retryDelayMs: 1, fetchImpl: router({ bl: flaky, off: resp(offOk) }) });
  expect(r.source).toBe('off'); expect(n).toBe(2);
  // her ikisi 429 → limited; yetki reddi tekrar denenmez
  svc.reset();
  const both = await svc.suggest(user(owner), CODE, { env, retryDelayMs: 1, fetchImpl: router({ bl: resp({}, 429), off: resp({}, 429) }) });
  expect(both).toMatchObject({ source: 'none', lookup_state: 'limited', manual: true });
  svc.reset();
  let auth = 0;
  const denied = await svc.suggest(user(owner), CODE, { env: ENV({ VENIUX_BARCODE_PROVIDERS: 'barcodelookup', VENIUX_BARCODELOOKUP_KEY: 'abcdefgh1234' }), retryDelayMs: 1, fetchImpl: router({ bl: () => { auth++; return resp({}, 403); } }) });
  expect(denied.lookup_state).toBe('error'); expect(auth).toBe(1);
  const st = providers.status(ENV({ VENIUX_BARCODE_PROVIDERS: 'barcodelookup', VENIUX_BARCODELOOKUP_KEY: 'abcdefgh1234' })).find(p => p.id === 'barcodelookup');
  expect(st.stats.last_error).toMatch(/yetki/);
  // hata önbelleğe yazılmadı: sonraki çağrı yeniden sorar
  const again = await svc.suggest(user(owner), CODE, { env: ENV({ VENIUX_BARCODE_PROVIDERS: 'off' }), fetchImpl: router({ off: resp(offOk) }) });
  expect(again.source).toBe('off');
});

test('hiçbir sağlayıcı etkin değilse elle girişe düşer, istek yapılmaz', async () => {
  const calls = [];
  const r = await svc.suggest(user(owner), CODE, { env: ENV({ VENIUX_OFF_DISABLED: '1' }), fetchImpl: router({ off: resp(offOk) }, calls) });
  expect(r).toMatchObject({ source: 'none', lookup_state: 'skipped', manual: true });
  expect(calls).toHaveLength(0);
});

test('önbellek sağlayıcı başına; sayaçlar bulunan/önbellek/istek sayısını izler', async () => {
  const env = ENV({ VENIUX_BARCODE_PROVIDERS: 'off' });
  const calls = [];
  await svc.suggest(user(owner), CODE, { env, fetchImpl: router({ off: resp(offOk) }, calls) });
  const second = await svc.suggest(user(owner), CODE, { env, fetchImpl: router({ off: resp(offOk) }, calls) });
  expect(second.cached).toBe(true); expect(calls).toHaveLength(1);
  const s = providers.status(env).find(p => p.id === 'off').stats;
  expect(s).toMatchObject({ requests: 1, found: 1, cache_hits: 1, errors: 0 });
});

test('ücretli sağlayıcı: anahtar adrese girer ama hata/duruma ve yanıta sızmaz; görsel varsayılan kapalı, açılabilir', async () => {
  const key = 'gizli-anahtar-1234';
  const env = ENV({ VENIUX_BARCODE_PROVIDERS: 'barcodelookup', VENIUX_BARCODELOOKUP_KEY: key });
  const r = await svc.suggest(user(owner), CODE, { env, fetchImpl: router({ bl: resp({}, 500) }), retryDelayMs: 1 });
  expect(JSON.stringify(r)).not.toContain(key);
  expect(JSON.stringify(providers.status(env))).not.toContain(key);
  svc.reset();
  const withImage = await svc.suggest(user(owner), CODE, { env: ENV({ ...env, VENIUX_BARCODELOOKUP_IMAGES: '1' }), fetchImpl: router({ bl: resp(blOk) }) });
  expect(withImage.suggestion.image_url).toBe('https://cdn.example.com/a.jpg');
});

test('uç nokta: sağlayıcı durumu yalnız platform yöneticisine; anahtar değeri dönmez', async () => {
  const res = await request(app).get('/api/retail/lookup/providers').set('Authorization', 'Bearer ' + owner.token);
  expect([401, 403]).toContain(res.status);
  expect(JSON.stringify(res.body)).not.toMatch(/abcdefgh/);
});
