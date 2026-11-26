import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// public/sw.js tarayıcı yerine sahte self/caches/fetch ile çalıştırılır: çevrimdışı açılış, önbellek kuralları, sürüm temizliği.
const SOURCE = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/sw.js'), 'utf8');
const ORIGIN = 'https://app.test';

function res(body = 'x', { ok = true, status = 200, type = 'basic', contentType = 'application/javascript' } = {}) {
  const make = () => ({ ok, status, type, headers: new Headers({ 'content-type': contentType }), clone: make, arrayBuffer: async () => new TextEncoder().encode(body).buffer, text: async () => body });
  return make();
}
const keyOf = request => (typeof request === 'string' ? request : request.url || request.href);

function boot() {
  const stores = new Map(), listeners = {}, log = { fetched: [], skipWaiting: 0, claim: 0 };
  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return { match: async r => map.get(keyOf(r)), put: async (r, v) => { map.set(keyOf(r), v); }, keys: async () => [...map.keys()].map(url => ({ url })), delete: async r => map.delete(keyOf(r)) };
  };
  const caches = { open: async name => cacheFor(name), keys: async () => [...stores.keys()], delete: async name => stores.delete(name) };
  const state = { online: true, responder: () => res('net') };
  const fetchFn = async request => {
    const url = typeof request === 'string' ? request : request.url;
    log.fetched.push(url);
    if (!state.online) throw new TypeError('Failed to fetch');
    return state.responder(url, request);
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => { log.skipWaiting += 1; },
    clients: { claim: async () => { log.claim += 1; }, matchAll: async () => [], openWindow: async () => null },
    registration: { showNotification: async () => {} },
  };
  const context = vm.createContext({ self, caches, fetch: fetchFn, URL, Headers, TextEncoder, console, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)), clearTimeout, Promise, Array, Object, JSON, Math, Number, String });
  vm.runInContext(SOURCE, context);
  return { sw: self.__veniuxSw, self, caches, stores, listeners, state, log };
}
const req = (path, extra = {}) => ({ url: ORIGIN + path, method: 'GET', mode: 'cors', ...extra });

test('strateji: yalnız aynı kaynağın sayfa ve statik dosyaları; API, sağlık, güncelleme, POST ve dış kaynak asla', () => {
  const { sw } = boot();
  const kind = (p, extra) => sw.strategyFor(new URL(ORIGIN + p), req(p, extra), ORIGIN);
  assert.equal(kind('/magaza/kasa', { mode: 'navigate' }), 'navigate');
  assert.equal(kind('/assets/index-abc123.js'), 'asset-immutable');
  assert.equal(kind('/pwa-192.png'), 'asset-fresh');
  for (const p of ['/api/scanner/sale', '/api/auth/me', '/health', '/updates/windows.json', '/integrations/x', '/sw.js']) assert.equal(kind(p), 'skip', p);
  assert.equal(kind('/assets/a.js', { method: 'POST' }), 'skip');
  assert.equal(sw.strategyFor(new URL('https://baska.site/a.js'), req('/a.js'), ORIGIN), 'skip');
  assert.equal(kind('/veri.json'), 'skip');
});

test('çevrimdışı açılış: sayfa çevrimiçiyken kaydedilir; internet kesilince önbellekten gelir; sunucu 5xx verirse de', async () => {
  const { sw, state } = boot();
  state.responder = () => res('<html>kasa</html>', { contentType: 'text/html; charset=utf-8' });
  const online = await sw.handlers.navigate(req('/magaza/kasa', { mode: 'navigate' }));
  assert.equal(await online.text(), '<html>kasa</html>');
  state.online = false;
  const offline = await sw.handlers.navigate(req('/magaza/kasa', { mode: 'navigate' }));
  assert.equal(await offline.text(), '<html>kasa</html>');
  state.online = true; state.responder = () => res('hata', { ok: false, status: 502, contentType: 'text/html' });
  assert.equal(await (await sw.handlers.navigate(req('/', { mode: 'navigate' }))).text(), '<html>kasa</html>');
});

test('sayfa önbelleği yokken ve internet yokken hata verilir (sessizce boş sayfa yok); 5xx önbelleğe girmez', async () => {
  const { sw, state, stores } = boot();
  state.online = false;
  await assert.rejects(() => sw.handlers.navigate(req('/', { mode: 'navigate' })));
  state.online = true; state.responder = () => res('hata', { ok: false, status: 500, contentType: 'text/html' });
  const r = await sw.handlers.navigate(req('/', { mode: 'navigate' }));
  assert.equal(r.status, 500);
  assert.equal((stores.get(sw.SHELL) || new Map()).size, 0);
});

test('yavaş sunucu: önbellekli sayfada zaman aşımında önbellek kullanılır', async () => {
  const { sw, state } = boot();
  state.responder = () => res('<html>eski</html>', { contentType: 'text/html' });
  await sw.handlers.navigate(req('/', { mode: 'navigate' }));
  state.responder = () => new Promise(() => {}); // hiç dönmez
  const r = await sw.handlers.navigate(req('/', { mode: 'navigate' }));
  assert.equal(await r.text(), '<html>eski</html>');
});

test('içerik özetli dosya: ilk indirilince saklanır, sonra internetsiz önbellekten gelir; boş ve başka kaynaklı yanıt saklanmaz', async () => {
  const { sw, state, stores } = boot();
  state.responder = () => res('console.log(1)');
  await sw.handlers['asset-immutable'](req('/assets/a-1.js'));
  state.online = false;
  assert.equal(await (await sw.handlers['asset-immutable'](req('/assets/a-1.js'))).text(), 'console.log(1)');
  state.online = true;
  state.responder = () => res('', {}); await sw.handlers['asset-immutable'](req('/assets/bos.js'));
  state.responder = () => res('x', { type: 'cors' }); await sw.handlers['asset-immutable'](req('/assets/dis.js'));
  const keys = [...stores.get(sw.ASSETS).keys()];
  assert.deepEqual(keys, [ORIGIN + '/assets/a-1.js']);
});

test('önbellek boyutu 300 dosyayı aşmaz (en eskiler silinir)', async () => {
  const { sw, state, stores } = boot();
  state.responder = () => res('y');
  for (let i = 0; i < 310; i += 1) await sw.handlers['asset-immutable'](req('/assets/f-' + i + '.js'));
  assert.ok(stores.get(sw.ASSETS).size <= 300);
});

test('sabit adlı statik dosya: çevrimiçi güncellenir, çevrimdışı eskisi gelir; hiç yoksa hata', async () => {
  const { sw, state } = boot();
  state.responder = () => res('v1', { contentType: 'image/png' });
  await sw.handlers['asset-fresh'](req('/pwa-192.png'));
  state.responder = () => res('v2', { contentType: 'image/png' });
  assert.equal(await (await sw.handlers['asset-fresh'](req('/pwa-192.png'))).text(), 'v2');
  state.online = false;
  assert.equal(await (await sw.handlers['asset-fresh'](req('/pwa-192.png'))).text(), 'v2');
  await assert.rejects(() => sw.handlers['asset-fresh'](req('/favicon.ico')));
});

test('sürüm yükseltmesi: etkinleşince eski veniux önbellekleri silinir, başkalarına dokunulmaz', async () => {
  const { self, caches, stores, listeners, sw, log } = boot();
  for (const name of ['veniux-shell-v1', 'veniux-assets-v1', sw.SHELL, sw.ASSETS, 'baska-uygulama']) await caches.open(name);
  let work; listeners.activate({ waitUntil: p => { work = p; } });
  await work;
  assert.deepEqual([...stores.keys()].sort(), ['baska-uygulama', sw.ASSETS, sw.SHELL].sort());
  assert.equal(log.claim, 1);
  assert.ok(self);
});

test('kurulum: sayfa kabuğu yoksa kendisi indirir (ilk çevrimdışı açılış çalışsın); varsa dokunmaz; ağ yoksa hata vermez', async () => {
  const a = boot();
  a.state.responder = () => res('<html>login</html>', { contentType: 'text/html' });
  let work; a.listeners.install({ waitUntil: p => { work = p; } }); await work;
  assert.equal(a.log.skipWaiting, 1);
  assert.ok((await (await a.caches.open(a.sw.SHELL)).match('/index.html')));
  const before = a.log.fetched.length;
  await a.sw.ensureShell();
  assert.equal(a.log.fetched.length, before, 'kabuk varken tekrar indirilmez');
  const b = boot(); b.state.online = false;
  await b.sw.ensureShell(); // fırlatmamalı
});

test('cache-urls mesajı: yalnız aynı kaynak ve izinli yollar saklanır', async () => {
  const { sw, state, stores } = boot();
  state.responder = () => res('ok');
  await sw.cacheUrls([ORIGIN + '/assets/x-1.js', ORIGIN + '/api/gizli', 'https://baska.site/assets/y.js', 'geçersiz url', ORIGIN + '/sayfa.html']);
  assert.deepEqual([...stores.get(sw.ASSETS).keys()], [ORIGIN + '/assets/x-1.js']);
});

test('bildirim hedefi: başka siteye yönlendirme yapılamaz; gövde ve başlık uzunluğu sınırlıdır', () => {
  const { sw } = boot();
  assert.equal(sw.safeTarget('https://kotu.site/giris'), '/m');
  assert.equal(sw.safeTarget('/raporlar?x=1'), '/raporlar?x=1');
  assert.equal(sw.safeTarget(undefined), '/m');
  const message = sw.pushMessage({ json: () => ({ title: 'T'.repeat(500), body: 'B'.repeat(900), url: 'https://kotu.site' }) });
  assert.equal(message.title.length, 80);
  assert.equal(message.body.length, 240);
  assert.equal(message.url, '/m');
});

test('önbelleğe yazılamazsa (disk dolu, bozuk depolama) sayfa ve dosyalar yine sunucudan gelir', async () => {
  const { sw, state, caches } = boot();
  const open = caches.open;
  caches.open = async name => ({ ...(await open(name)), put: async () => { throw new Error('QuotaExceededError'); } });
  state.responder = () => res('<html>kasa</html>', { contentType: 'text/html' });
  assert.equal(await (await sw.handlers.navigate(req('/magaza/kasa', { mode: 'navigate' }))).text(), '<html>kasa</html>');
  state.responder = () => res('js');
  assert.equal(await (await sw.handlers['asset-immutable'](req('/assets/a-1.js'))).text(), 'js');
  assert.equal(await (await sw.handlers['asset-fresh'](req('/pwa-192.png'))).text(), 'js');
});
