// Barkod sağlayıcı katmanı: sağlayıcılar eklenebilir, değiştirilebilir, açılıp kapatılabilir.
// - Sıra ve etkinlik ortamdan: VENIUX_BARCODE_PROVIDERS="off,barcodelookup" (varsayılan "off"). Anahtarı olmayan ücretli sağlayıcı etkin sayılmaz.
// - Her sağlayıcının kendi önbelleği, hız sınırı (sunucu ve işletme başına), yeniden deneme ve kullanım sayaçları vardır.
// - Birincisi bulamaz ya da hata verirse sıradaki denenir (yedek). Hepsi başarısızsa kullanıcı elle girişe düşer; ürün oluşturma asla engellenmez.
// - Sayaçlar ve önbellek bellektedir (sunucu yeniden başlayınca sıfırlanır); kalıcı kullanım kaydı şema değişikliği gerektirir ve yapılmadı.
// Hiçbir sağlayıcıya işletme/kullanıcı bilgisi gönderilmez; yalnız barkod gider.
const REGISTRY = [require('./openFoodFacts'), require('./barcodeLookup')];

const caches = new Map();     // sağlayıcı -> Map(anahtar -> { at, ttl, value })
const inflight = new Map();   // sağlayıcı:anahtar -> Promise
const windows = new Map();    // sağlayıcı -> { global: [], tenants: Map }
const stats = new Map();      // sağlayıcı -> sayaçlar
const MAX_CACHE = 5000;

const blankStats = () => ({ requests: 0, found: 0, missing: 0, errors: 0, limited: 0, cache_hits: 0, retries: 0, last_ok_at: null, last_error_at: null, last_error: null, since: new Date().toISOString() });
const statOf = id => { let s = stats.get(id); if (!s) stats.set(id, s = blankStats()); return s; };
const cacheOf = id => { let c = caches.get(id); if (!c) caches.set(id, c = new Map()); return c; };
const windowOf = id => { let w = windows.get(id); if (!w) windows.set(id, w = { global: [], tenants: new Map() }); return w; };

function reset() { caches.clear(); inflight.clear(); windows.clear(); stats.clear(); }

function allow(list, limit, now) {
  while (list.length && now - list[0] >= 60e3) list.shift();
  if (list.length >= limit) return false;
  list.push(now); return true;
}

// Etkin sağlayıcılar, ayarlanan sırayla. Bilinmeyen ad yok sayılır.
function enabledProviders(env = process.env) {
  const order = String(env.VENIUX_BARCODE_PROVIDERS || 'off').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  return order.map(id => REGISTRY.find(p => p.id === id)).filter(p => p && !seen.has(p.id) && seen.add(p.id) && p.configured(env) && !p.disabledByEnv(env));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Tek sağlayıcıda tek barkod. Dönüş: { state:'found'|'missing'|'limited'|'error'|'skipped', suggestion?, cached? }
async function runProvider(provider, tenantId, code, { fetchImpl = globalThis.fetch, now = Date.now(), env = process.env, retryDelayMs = 200 } = {}) {
  if (typeof fetchImpl !== 'function' || !provider.accepts(code)) return { state: 'skipped' };
  const key = provider.cacheKey(code), cache = cacheOf(provider.id), st = statOf(provider.id);
  const hit = cache.get(key);
  if (hit && now - hit.at < hit.ttl) { st.cache_hits++; return hit.value ? { state: 'found', suggestion: hit.value, cached: true } : { state: 'missing', cached: true }; }
  const flightKey = provider.id + ':' + key;
  if (inflight.has(flightKey)) return inflight.get(flightKey);
  const w = windowOf(provider.id);
  let tenant = w.tenants.get(tenantId); if (!tenant) w.tenants.set(tenantId, tenant = []);
  if (!allow(tenant, provider.limits.tenant, now) || !allow(w.global, provider.limits.global, now)) { st.limited++; return { state: 'limited' }; }
  const job = (async () => {
    st.requests++;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), provider.timeoutMs);
      try {
        const res = await provider.fetch(key, { fetchImpl, signal: ctl.signal, env });
        const suggestion = res.found ? res.suggestion : null;
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(key, { at: now, ttl: suggestion ? provider.hitTtl : provider.missTtl, value: suggestion });
        st.last_ok_at = new Date().toISOString();
        if (suggestion) { st.found++; return { state: 'found', suggestion }; }
        st.missing++; return { state: 'missing' };
      } catch (error) {
        lastError = error;
        const status = error && error.httpStatus;
        if (status === 429) { st.limited++; return { state: 'limited' }; }   // sağlayıcı kotası doldu: tekrar deneme yok
        if (status === 401 || status === 403) break;                          // anahtar/yetki sorunu: tekrar denemek işe yaramaz
        if (attempt === 0) { st.retries++; await sleep(retryDelayMs); }
      } finally { clearTimeout(timer); }
    }
    st.errors++; st.last_error_at = new Date().toISOString();
    const s = lastError && lastError.httpStatus;
    st.last_error = s === 401 || s === 403 ? 'yetki/anahtar reddedildi' : s ? 'sunucu hatası (http ' + s + ')' : lastError && lastError.name === 'AbortError' ? 'zaman aşımı' : 'ağ hatası';
    return { state: 'error' };   // geçici hatalar önbelleğe yazılmaz
  })().finally(() => inflight.delete(flightKey));
  inflight.set(flightKey, job);
  return job;
}

const PRECEDENCE = ['limited', 'error', 'missing', 'skipped'];

// Etkin sağlayıcıları sırayla dener. Dönüş: { state, provider?, suggestion?, cached?, tried:[{id,state}] }
async function resolve(tenantId, code, options = {}) {
  const env = options.env || process.env;
  const tried = [];
  for (const provider of enabledProviders(env)) {
    const r = await runProvider(provider, tenantId, code, options);
    tried.push({ id: provider.id, state: r.state });
    if (r.state === 'found') return { state: 'found', provider, suggestion: r.suggestion, cached: !!r.cached, tried };
  }
  const state = PRECEDENCE.find(s => tried.some(t => t.state === s)) || 'skipped';
  return { state, tried };
}

// Yönetim görünümü: anahtar değeri hiçbir zaman dönmez, yalnız tanımlı olup olmadığı.
function status(env = process.env) {
  const enabled = enabledProviders(env).map(p => p.id);
  return REGISTRY.map(p => ({
    id: p.id, name: p.name, free: p.free, needs_key: p.needsKey,
    configured: p.configured(env), enabled: enabled.includes(p.id), order: enabled.indexOf(p.id) + 1 || null,
    limits_per_minute: p.limits, stats: { ...statOf(p.id) }
  }));
}

module.exports = { REGISTRY, enabledProviders, runProvider, resolve, status, reset };
