const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');
const svc = require('../src/services/barcodeLookupService');
const providers = require('../src/services/barcodeProviders');
const persistence = providers.persistence;
let a, b, c, platform;
const auth = t => ({ Authorization: 'Bearer ' + t.token });
const receive = (t, wh, body, key) => request(app).post('/api/retail/receive/batch').set(auth(t)).set('Idempotency-Key', key).send({ warehouse_id: wh.id, lines: [body] });
const neu = (code, name, extra = {}) => ({ barcode: code, name, unit: 'adet', purchase_price: 5, sale_price: 9.5, quantity: 1, ...extra });
const NO_NET = { env: { ...process.env, VENIUX_BARCODE_PROVIDERS: 'shared' } };
let whA, whB, whC;

beforeAll(async () => {
  a = await createTenant(); b = await createTenant(); c = await createTenant();
  whA = await createWarehouse(a.tenantId); whB = await createWarehouse(b.tenantId); whC = await createWarehouse(c.tenantId);
  platform = await createTenant();
  await db.query('UPDATE users SET is_platform_admin=1 WHERE id=$1', [platform.userId]).catch(() => {});
});
beforeEach(() => svc.reset());

test('ortak katalog: tek işletme yayımlanmaz; ikinci farklı işletme aynı barkodu girince yayımlanır, fiyat/işletme saklanmaz', async () => {
  const code = '8690000500015';
  expect((await receive(a, whA, neu(code, 'Ortak Çay 500 g'), 'sc-a1')).status).toBe(201);
  expect((await db.query('SELECT COUNT(*) c FROM shared_catalog_products WHERE barcode=$1', [code])).rows[0].c).toBe(0);
  // yayımlanmadan öneri yok
  expect((await svc.suggest({ tenantId: c.tenantId }, code, NO_NET)).lookup_state).toBe('missing');
  expect((await receive(b, whB, neu(code, 'ortak çay 500 g', { sale_price: 12 }), 'sc-b1')).status).toBe(201);
  const pub = (await db.query('SELECT * FROM shared_catalog_products WHERE barcode=$1', [code])).rows[0];
  expect(pub).toMatchObject({ barcode: code, tenants_count: 2 });
  // yayımlanan satırda fiyat ve işletme kimliği alanı yok
  expect(Object.keys(pub).sort()).toEqual(['barcode', 'brand', 'category', 'created_at', 'name', 'tenants_count', 'unit', 'updated_at']);
  // üçüncü işletme öneri alır (ağ yok: yalnız ortak katalog)
  const r = await svc.suggest({ tenantId: c.tenantId }, code, NO_NET);
  expect(r).toMatchObject({ source: 'shared', provider: { id: 'shared' }, review_required: true, suggestion: { name: expect.stringMatching(/çay 500 g/i) } });
  expect(r.attribution.text).toMatch(/ortak katalog/i);
});

test('katkıyı kapatan işletme oy vermez; ürün kaydı yine başarılı', async () => {
  const code = '8690000500022';
  await db.query('UPDATE tenants SET catalog_sharing=0 WHERE id=$1', [a.tenantId]);
  expect((await receive(a, whA, neu(code, 'Kapalı Katkı'), 'sc-off-a')).status).toBe(201);
  expect((await db.query('SELECT COUNT(*) c FROM shared_catalog_votes WHERE barcode=$1', [code])).rows[0].c).toBe(0);
  await db.query('UPDATE tenants SET catalog_sharing=1 WHERE id=$1', [a.tenantId]);
});

test('barkodsuz ve standart dışı barkodlar katkı sayılmaz; en çok oy alan ad yayımlanır', async () => {
  expect((await receive(a, whA, neu(undefined, 'Barkodsuz'), 'sc-nocode')).status).toBe(201);
  expect((await db.query("SELECT COUNT(*) c FROM shared_catalog_votes WHERE name='Barkodsuz'")).rows[0].c).toBe(0);
  const code = '8690000500039';
  await receive(a, whA, neu(code, 'Yanlış Ad'), 'sc-v-a');
  await receive(b, whB, neu(code, 'Doğru Ad'), 'sc-v-b');
  await receive(c, whC, neu(code, 'doğru ad'), 'sc-v-c');
  expect((await db.query('SELECT name,tenants_count FROM shared_catalog_products WHERE barcode=$1', [code])).rows[0]).toMatchObject({ name: 'Doğru Ad', tenants_count: 3 });
});

test('sağlayıcı ayarı: yalnız platform yöneticisi; veritabanı kaydı ortam sırasını geçersiz kılar; doğrulama', async () => {
  const noAuth = await request(app).put('/api/retail/lookup/providers').set(auth(a)).send({ providers: [{ id: 'off', enabled: false, position: 1 }] });
  expect(noAuth.status).toBe(403);
  // doğrulama (platform yöneticisi gerektirmeden servis düzeyinde): bilinmeyen kimlik ve geçersiz konum
  const rows = [{ id: 'off', enabled: false, position: 5 }, { id: 'shared', enabled: true, position: 1 }];
  expect(providers.enabledProviders({ ...process.env, VENIUX_BARCODE_PROVIDERS: 'shared,off' }, rows).map(p => p.id)).toEqual(['shared']);
  expect(providers.enabledProviders({ ...process.env, VENIUX_BARCODE_PROVIDERS: 'shared' }, [{ id: 'off', enabled: true, position: 1 }]).map(p => p.id)).toEqual(['off', 'shared']);
  // anahtarı olmayan ücretli sağlayıcı veritabanında "etkin" olsa bile etkin sayılmaz
  expect(providers.enabledProviders({ ...process.env, VENIUX_BARCODELOOKUP_KEY: undefined }, [{ id: 'barcodelookup', enabled: true, position: 1 }]).map(p => p.id)).not.toContain('barcodelookup');
  // kalıcı ayar yazma/okuma
  await persistence.saveSettings([{ id: 'off', enabled: false, position: 20 }, { id: 'shared', enabled: true, position: 10 }], null);
  expect(await persistence.settings(true)).toEqual(expect.arrayContaining([{ id: 'off', enabled: false, position: 20 }, { id: 'shared', enabled: true, position: 10 }]));
  await persistence.saveSettings([{ id: 'off', enabled: true, position: 20 }], null);
  expect((await persistence.settings(true)).find(r => r.id === 'off').enabled).toBe(true);
  await db.query('DELETE FROM barcode_provider_settings');
});

test('kalıcı kullanım sayacı: aramalar belleğe yazılır, flush ile gün/sağlayıcı/işletme bazında toplanır', async () => {
  const code = '8690000500046';
  await db.query('DELETE FROM barcode_provider_usage');
  await svc.suggest({ tenantId: a.tenantId }, code, NO_NET);        // shared: requests=1, missing=1
  await svc.suggest({ tenantId: a.tenantId }, code, NO_NET);        // shared: requests=2, missing=2
  expect(await persistence.flush()).toBe(1);
  const row = (await db.query("SELECT * FROM barcode_provider_usage WHERE provider_id='shared' AND tenant_id=$1", [a.tenantId])).rows[0];
  expect({ requests: Number(row.requests), missing: Number(row.missing) }).toEqual({ requests: 2, missing: 2 });
  await svc.suggest({ tenantId: a.tenantId }, code, NO_NET);
  await persistence.flush();
  expect(Number((await db.query("SELECT requests FROM barcode_provider_usage WHERE provider_id='shared' AND tenant_id=$1", [a.tenantId])).rows[0].requests)).toBe(3);
  const u = (await persistence.usage(30)).find(x => x.provider_id === 'shared');
  expect(u).toMatchObject({ requests: 3, missing: 3, tenants: 1 });
});

test('ayar ucu: şirket profili katkı tercihi okunur ve değişir', async () => {
  const get = await request(app).get('/api/settings/company').set(auth(b));
  expect(get.status).toBe(200); expect(get.body.catalogSharing).toBe(true);
  expect((await request(app).put('/api/settings/company').set(auth(b)).send({ catalogSharing: false })).status).toBe(200);
  expect((await request(app).get('/api/settings/company').set(auth(b))).body.catalogSharing).toBe(false);
});

test('ürün ekranından (POST /products) eklenen barkodlu ürün de katkı verir; iki işletme olunca yayımlanır', async () => {
  const code = '8690000500053';
  // önceki test işletme B'nin katkısını kapatmıştı
  await db.query('UPDATE tenants SET catalog_sharing=1 WHERE id IN ($1,$2)', [a.tenantId, b.tenantId]);
  const create = (t, sku) => request(app).post('/api/products').set(auth(t)).send({ sku, name: 'Ekran Ürünü 1 L', barcode: code, unit: 'adet', category: 'Gıda', purchase_price: 3, sale_price: 5, module_type: 'NORMAL' });
  const r1 = await create(a, 'SC-EKRAN-A-' + Date.now());
  expect([200, 201]).toContain(r1.status);
  const mid = (await db.query('SELECT COUNT(*) c FROM shared_catalog_products WHERE barcode=$1', [code])).rows[0].c;
  expect(Number(mid)).toBe(0);
  const r2 = await create(b, 'SC-EKRAN-B-' + Date.now());
  expect([200, 201]).toContain(r2.status);
  expect((await db.query('SELECT name FROM shared_catalog_products WHERE barcode=$1', [code])).rows[0].name).toBe('Ekran Ürünü 1 L');
});
