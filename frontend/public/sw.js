/* Veniux kasa: uygulama kabuğu önbelleği (internet yokken sayfa yenilense de kasa açılır).
 * Önbelleğe yalnız uygulamanın kendi sayfası ve statik dosyaları (JS, CSS, yazı tipi, görsel) girer.
 * API, sağlık, güncelleme ve başka kaynaklı hiçbir istek önbelleğe alınmaz; fiyat, stok ve oturum verisi sunucudan gelir.
 * Sayfa (HTML) her zaman önce sunucudan denenir; sunucu yanıt vermezse son görülen sayfa kullanılır. */
const SHELL = 'veniux-shell-v2', ASSETS = 'veniux-assets-v2', MAX_ASSETS = 300, NAV_TIMEOUT_MS = 4000;
// Önbellekte dosya ararken Vary başlığı (Accept-Encoding, Origin) yok sayılır: dosya kaydedilirken ve istenirken bu başlıklar
// farklı olabiliyor ve eşleşme kaçıyordu (çevrimdışı yenilemede beyaz sayfa). Dosya adları içerik özetli, sürüm karışması olmaz.
const MATCH = { ignoreVary: true };
const NEVER = [/^\/api\//, /^\/health$/, /^\/updates\//, /^\/integrations\//, /^\/sw\.js$/];
const STATIC_FILE = /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico)$/;

// 'skip' | 'navigate' | 'asset-immutable' (derleme çıktısı, adı içerik özetli) | 'asset-fresh' (adı sabit statik dosya)
function strategyFor(url, request, origin) {
  if (request.method !== 'GET') return 'skip';
  if (url.origin !== origin) return 'skip';
  if (NEVER.some(re => re.test(url.pathname))) return 'skip';
  if (request.mode === 'navigate') return 'navigate';
  if (/^\/assets\//.test(url.pathname)) return 'asset-immutable';
  if (STATIC_FILE.test(url.pathname)) return 'asset-fresh';
  return 'skip';
}
// Boş gövdeli yanıt (kesilmiş indirme) önbelleğe girmesin; sonra gerçek dosyanın yerini tutup sayfayı bozar.
async function hasBody(response) { try { return (await response.clone().arrayBuffer()).byteLength > 0; } catch { return false; } }
const isHtml = response => /text\/html/i.test(response.headers.get('content-type') || '');
const withTimeout = (promise, ms) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('zaman aşımı')), ms); promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); }); });

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}
async function navigate(request) {
  const cache = await caches.open(SHELL), cached = await cache.match('/index.html', MATCH);
  try {
    const response = cached ? await withTimeout(fetch(request), NAV_TIMEOUT_MS) : await fetch(request);
    if (response.ok && isHtml(response)) { if (await hasBody(response)) await cache.put('/index.html', response.clone()); return response; }
    if (!response.ok && response.status >= 500 && cached) return cached;
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}
async function assetImmutable(request) {
  const cache = await caches.open(ASSETS), cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic' && await hasBody(response)) { await cache.put(request, response.clone()); await trim(cache); }
  return response;
}
async function assetFresh(request) {
  const cache = await caches.open(ASSETS);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && await hasBody(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, MATCH);
    if (cached) return cached;
    throw error;
  }
}
const handlers = { navigate, 'asset-immutable': assetImmutable, 'asset-fresh': assetFresh };

// Sayfa kabuğu önbellekte yoksa (yeni kurulum veya sürüm yükseltmesi sonrası) bir uygulama adresini kendisi indirip saklar;
// böylece kullanıcı çevrimiçi bir yenileme yapmadan ağı kaybetse de ilk çevrimdışı açılış çalışır. Hata olursa sessizce geçer.
async function ensureShell() {
  try {
    const cache = await caches.open(SHELL);
    if (await cache.match('/index.html', MATCH)) return;
    const response = await fetch('/login');
    if (response.ok && isHtml(response) && await hasBody(response)) await cache.put('/index.html', response);
  } catch { /* ağ yoksa sonraki çevrimiçi gezintide dolar */ }
}

// Sayfa, ilk yüklemede SW devralmadan önce indirdiği dosyaların adresini gönderir; yalnız aynı kaynak ve izinli yollar alınır.
async function cacheUrls(urls) {
  const cache = await caches.open(ASSETS);
  for (const raw of (Array.isArray(urls) ? urls : []).slice(0, 400)) {
    let url; try { url = new URL(raw); } catch { continue; }
    const kind = strategyFor(url, { method: 'GET', mode: 'cors' }, self.location.origin);
    if (kind !== 'asset-immutable' && kind !== 'asset-fresh') continue;
    if (await cache.match(url.href, MATCH)) continue;
    try { const response = await fetch(url.href); if (response.ok && response.type === 'basic' && await hasBody(response)) await cache.put(url.href, response); } catch { /* ağ yoksa bu dosya atlanır */ }
  }
  await trim(cache);
}

self.addEventListener('install', event => { event.waitUntil(Promise.all([self.skipWaiting(), ensureShell()])); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('veniux-') && name !== SHELL && name !== ASSETS) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const strategy = strategyFor(new URL(event.request.url), event.request, self.location.origin);
  if (strategy !== 'skip') event.respondWith(handlers[strategy](event.request));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'cache-urls') event.waitUntil(ensureShell().then(() => cacheUrls(event.data.urls)));
});
self.__veniuxSw = { strategyFor, handlers, cacheUrls, ensureShell, SHELL, ASSETS };
