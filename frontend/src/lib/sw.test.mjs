import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// public/sw.js klasik bir betik: sahte ortamda çalıştırıp kurallarını (self.__veniuxSw) test ederiz.
const source = fs.readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://app.veniux.com';

function makeResponse(body, { status = 200, type = 'basic', contentType = 'text/html; charset=utf-8' } = {}) {
  return { ok: status >= 200 && status < 300, status, type, body, async arrayBuffer() { return { byteLength: String(body).length }; }, headers: { get: n => (n.toLowerCase() === 'content-type' ? contentType : null) }, clone() { return makeResponse(body, { status, type, contentType }); } };
}
function makeCaches() {
  const stores = new Map(), matchOptions = [];
  const open = async name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name), keyOf = r => (typeof r === 'string' ? r : r.url || r);
    return { match: async (r, o) => { matchOptions.push(o); return store.get(keyOf(r)); }, put: async (r, v) => { store.set(keyOf(r), v); }, delete: async r => store.delete(keyOf(r)), keys: async () => [...store.keys()] };
  };
  return { stores, matchOptions, open, keys: async () => [...stores.keys()], delete: async name => stores.delete(name), match: async () => undefined };
}
function load({ fetchImpl }) {
  const listeners = {}, caches = makeCaches();
  const self = { location: { origin: ORIGIN }, addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
  const context = { self, caches, fetch: (...args) => fetchImpl(...args), URL, setTimeout, clearTimeout, Promise, Array, Map, Set, RegExp, Error, console };
  vm.runInNewContext(source, context);
  return { sw: self.__veniuxSw, caches, listeners };
}
const req = (path, { method = 'GET', mode = 'cors' } = {}) => ({ url: ORIGIN + path, method, mode });
const strategy = (sw, path, opts) => sw.strategyFor(new URL(ORIGIN + path), req(path, opts), ORIGIN);

test('kurallar: yalnız GET ve aynı kaynak; API, sağlık ve güncelleme asla önbelleğe alınmaz', () => {
  const { sw } = load({ fetchImpl: async () => makeResponse('x') });
  for (const path of ['/api/scanner/sale', '/api/products', '/health', '/updates/latest.yml', '/integrations/x', '/sw.js']) assert.equal(strategy(sw, path), 'skip', path);
  assert.equal(strategy(sw, '/api/x', { method: 'POST' }), 'skip');
  assert.equal(sw.strategyFor(new URL('https://baska.com/assets/a.js'), req('/assets/a.js'), ORIGIN), 'skip');
});

test('kurallar: sayfa gezintisi, içerik özetli dosyalar ve sabit adlı statik dosyalar', () => {
  const { sw } = load({ fetchImpl: async () => makeResponse('x') });
  assert.equal(strategy(sw, '/magaza/kasa', { mode: 'navigate' }), 'navigate');
  assert.equal(strategy(sw, '/', { mode: 'navigate' }), 'navigate');
  assert.equal(strategy(sw, '/assets/index-Dl3a9GEi.js'), 'asset-immutable');
  assert.equal(strategy(sw, '/appearance-boot.js'), 'asset-fresh');
  assert.equal(strategy(sw, '/veniux-logo.png'), 'asset-fresh');
  assert.equal(strategy(sw, '/baska/veri'), 'skip');
});

test('sayfa: sunucu yanıt verirse sayfa önbelleğe girer ve döner', async () => {
  const page = makeResponse('<html>yeni</html>');
  const { sw, caches } = load({ fetchImpl: async () => page });
  const result = await sw.handlers.navigate(req('/magaza/kasa', { mode: 'navigate' }));
  assert.equal(result.body, '<html>yeni</html>');
  assert.equal((await (await caches.open(sw.SHELL)).match('/index.html')).body, '<html>yeni</html>');
});

test('sayfa: ağ yoksa son görülen sayfa verilir; hiç önbellek yoksa hata fırlar', async () => {
  let online = true;
  const { sw, caches } = load({ fetchImpl: async () => { if (!online) throw new TypeError('ağ yok'); return makeResponse('<html>kabuk</html>'); } });
  await assert.rejects(async () => { online = false; await sw.handlers.navigate(req('/', { mode: 'navigate' })); }, /ağ yok/);
  online = true; await sw.handlers.navigate(req('/', { mode: 'navigate' }));
  online = false;
  assert.equal((await sw.handlers.navigate(req('/magaza/kasa', { mode: 'navigate' }))).body, '<html>kabuk</html>');
  assert.equal((await caches.keys()).includes(sw.SHELL), true);
});

test('sayfa: sunucu 502/503 verirse ve önbellek varsa kabuk kullanılır; 404 gibi cevaplar olduğu gibi döner; HTML olmayan cevap kabuğu ezmez', async () => {
  let next = makeResponse('<html>kabuk</html>');
  const { sw, caches } = load({ fetchImpl: async () => next });
  await sw.handlers.navigate(req('/', { mode: 'navigate' }));
  next = makeResponse('hata', { status: 503 });
  assert.equal((await sw.handlers.navigate(req('/', { mode: 'navigate' }))).body, '<html>kabuk</html>');
  next = makeResponse('yok', { status: 404 });
  assert.equal((await sw.handlers.navigate(req('/yok', { mode: 'navigate' }))).status, 404);
  next = makeResponse('{"a":1}', { contentType: 'application/json' });
  await sw.handlers.navigate(req('/x', { mode: 'navigate' }));
  assert.equal((await (await caches.open(sw.SHELL)).match('/index.html')).body, '<html>kabuk</html>');
});

test('içerik özetli dosya: önbellekte varsa ağa gidilmez; yoksa indirilip saklanır; hatalı cevap saklanmaz', async () => {
  let calls = 0, response = makeResponse('js-1', { contentType: 'text/javascript' });
  const { sw, caches } = load({ fetchImpl: async () => { calls++; return response; } });
  const a = req('/assets/app-abc.js');
  assert.equal((await sw.handlers['asset-immutable'](a)).body, 'js-1'); assert.equal(calls, 1);
  assert.equal((await sw.handlers['asset-immutable'](a)).body, 'js-1'); assert.equal(calls, 1);
  response = makeResponse('hata', { status: 500 });
  await sw.handlers['asset-immutable'](req('/assets/bozuk.js'));
  assert.equal(await (await caches.open(sw.ASSETS)).match(ORIGIN + '/assets/bozuk.js'), undefined);
});

test('sabit adlı dosya: önce ağ (güncel gelir), ağ yoksa önbellekten', async () => {
  let online = true, body = 'v1';
  const { sw } = load({ fetchImpl: async () => { if (!online) throw new TypeError('ağ yok'); return makeResponse(body, { contentType: 'text/javascript' }); } });
  const r = req('/appearance-boot.js');
  assert.equal((await sw.handlers['asset-fresh'](r)).body, 'v1');
  body = 'v2'; assert.equal((await sw.handlers['asset-fresh'](r)).body, 'v2');
  online = false; assert.equal((await sw.handlers['asset-fresh'](r)).body, 'v2');
});

test('sayfadan gelen adres listesi: yalnız aynı kaynak ve izinli yollar önbelleğe alınır', async () => {
  const fetched = [];
  const { sw, caches } = load({ fetchImpl: async url => { fetched.push(url); return makeResponse('d', { contentType: 'text/javascript' }); } });
  await sw.cacheUrls([ORIGIN + '/assets/a-1.js', ORIGIN + '/api/products', 'https://baska.com/assets/x.js', ORIGIN + '/health', 'bozuk adres', ORIGIN + '/appearance-boot.js']);
  assert.deepEqual(fetched.sort(), [ORIGIN + '/appearance-boot.js', ORIGIN + '/assets/a-1.js'].sort());
  assert.equal(((await (await caches.open(sw.ASSETS)).keys())).length, 2);
});

test('eski sürüm önbellekleri etkinleşmede silinir, başka uygulamaların önbelleğine dokunulmaz', async () => {
  const { sw, caches, listeners } = load({ fetchImpl: async () => makeResponse('x') });
  await caches.open('veniux-shell-v0'); await caches.open(sw.SHELL); await caches.open('baska-uygulama');
  let done; listeners.activate({ waitUntil: p => { done = p; } });
  await done;
  assert.deepEqual((await caches.keys()).sort(), [sw.SHELL, 'baska-uygulama'].sort());
});

test('önbellekte arama Vary başlığını yok sayar (çevrimdışı yenilemede beyaz sayfa hatası)', async () => {
  let online = true;
  const { sw, caches } = load({ fetchImpl: async () => { if (!online) throw new TypeError('ağ yok'); return makeResponse('<html>kabuk</html>'); } });
  await sw.handlers.navigate(req('/', { mode: 'navigate' }));
  await sw.handlers['asset-immutable'](req('/assets/a-1.js'));
  await sw.handlers['asset-immutable'](req('/assets/a-1.js'));
  online = false;
  await sw.handlers.navigate(req('/magaza/kasa', { mode: 'navigate' }));
  assert.ok(caches.matchOptions.length >= 4);
  assert.ok(caches.matchOptions.every(o => o && o.ignoreVary === true));
});

test('boş gövdeli yanıt önbelleğe girmez; sayfa ve dosya için ayrı ayrı', async () => {
  const { sw, caches } = load({ fetchImpl: async () => makeResponse('', { contentType: 'text/javascript' }) });
  await sw.handlers['asset-immutable'](req('/assets/bos.js'));
  await sw.handlers['asset-fresh'](req('/appearance-boot.js'));
  assert.equal(await (await caches.open(sw.ASSETS)).match(ORIGIN + '/assets/bos.js'), undefined);
  assert.equal(await (await caches.open(sw.ASSETS)).match(ORIGIN + '/appearance-boot.js'), undefined);
  const html = load({ fetchImpl: async () => makeResponse('') });
  await html.sw.handlers.navigate(req('/', { mode: 'navigate' }));
  assert.equal(await (await html.caches.open(html.sw.SHELL)).match('/index.html'), undefined);
});

test('eski v1 önbellekleri etkinleşmede silinir', async () => {
  const { sw, caches, listeners } = load({ fetchImpl: async () => makeResponse('x') });
  await caches.open('veniux-shell-v1'); await caches.open('veniux-assets-v1'); await caches.open(sw.SHELL);
  let done; listeners.activate({ waitUntil: p => { done = p; } });
  await done;
  assert.deepEqual((await caches.keys()).sort(), [sw.SHELL].sort());
});
