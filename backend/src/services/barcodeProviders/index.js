// Barkod sağlayıcı katmanı: sağlayıcılar eklenebilir, değiştirilebilir, açılıp kapatılabilir.
// - Sıra ve etkinlik: ortamdan VENIUX_BARCODE_PROVIDERS="shared,off,barcodelookup" (varsayılan "shared,off"); platform yöneticisi veritabanından
//   (barcode_provider_settings) sıra/etkinliği değiştirebilir ve kayıt ortam varsayılanını geçersiz kılar. Anahtarı olmayan ücretli sağlayıcı hiçbir durumda etkin sayılmaz.
// - Her sağlayıcının kendi önbelleği, hız sınırı (sunucu ve işletme başına), yeniden deneme ve kullanım sayaçları vardır.
// - Birincisi bulamaz ya da hata verirse sıradaki denenir (yedek). Hepsi başarısızsa kullanıcı elle girişe düşer; ürün oluşturma asla engellenmez.
// - Önbellek ve anlık sayaçlar bellektedir; kullanım (gün/sağlayıcı/işletme) ayrıca persistence.js ile kalıcı tabloya yazılır.
// - 'shared' (ortak katalog) yerel veritabanıdır: ağ isteği, hız sınırı ve önbellek uygulanmaz.
// Hiçbir sağlayıcıya işletme/kullanıcı bilgisi gönderilmez; yalnız barkod gider.
const persistence = require('./persistence');
const REGISTRY = [require('./shared'), require('./openFoodFacts'), require('./barcodeLookup')];
const DEFAULT_ORDER = 'shared,off';

const caches = new Map();     // sağlayıcı -> Map(anahtar -> { at, ttl, value })
const inflight = new Map();   // sağlayıcı:anahtar -> Promise
const windows = new Map();    // sağlayıcı -> { global: [], tenants: Map }
const stats = new Map();      // sağlayıcı -> sayaçlar
const MAX_CACHE = 5000;

const blankStats = () => ({ requests: 0, found: 0, missing: 0, errors: 0, limited: 0, cache_hits: 0, retries: 0, last_ok_at: null, last_error_at: null, last_error: null, since: new Date().toISOString() });
const statOf = id => { let s = stats.get(id); if (!s) stats.set(id, s = blankStats()); return s; };
const cacheOf = id => { let c = caches.get(id); if (!c) caches.set(id, c = new Map()); return c; };
const windowOf = id => { let w = windows.get(id); if (!w) windows.set(id, w = { global: [], tenants: new Map() }); return w; };

function reset() { caches.clear(); inflight.clear(); windows.clear(); stats.clear(); persistence._reset(); }

function allow(list, limit, now) {
  while (list.length && now - list[0] >= 60e3) list.shift();
  if (list.length >= limit) return false;
  list.push(now); return true;
}

// Etkin sağlayıcılar, ayarlanan sırayla. Bilinmeyen ad yok sayılır.
function enabledProviders(env = process.env, rows = []) {
  const order = String(env.VENIUX_BARCODE_PROVIDERS || DEFAULT_ORDER).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  const byEnv = order.map(id => REGISTRY.find(p => p.id === id)).filter(p => p && !seen.has(p.id) && seen.add(p.id));
  // Veritabanı kaydı (platform yöneticisi) ortam varsayılanını geçersiz kılar: kaydı olan sağlayıcı kendi sıra/etkinliğini kullanır.
  const row = id => rows.find(r => r.id === id);
  const candidates = REGISTRY.filter(p => (row(p.id) ? row(p.id).enabled : byEnv.includes(p)));
  const pos = p => (row(p.id) ? row(p.id).position : (byEnv.indexOf(p) + 1) * 10);
  return candidates.sort((a, b) => pos(a) - pos(b) || REGISTRY.indexOf(a) - REGISTRY.indexOf(b)).filter(p => p.configured(env) && !p.disabledByEnv(env));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Tek sağlayıcıda tek barkod. Dönüş: { state:'found'|'missing'|'limited'|'error'|'skipped', suggestion?, cached? }
async function runProvider(provider, tenantId, code, { fetchImpl = globalThis.fetch, now = Date.now(), env = process.env, retryDelayMs = 200 } = {}) {
  if (provider.local) {
    if (!provider.accepts(code)) return { state: 'skipped' };
    const st0 = statOf(provider.id); st0.requests++;
    persistence.record(provider.id, tenantId, 'requests', now);
    try {
      const res = await provider.lookupLocal(code);
      st0.last_ok_at = new Date().toISOString();
      if (res.found) { st0.found++; persistence.record(provider.id, tenantId, 'found', now); return { state: 'found', suggestion: res.suggestion }; }
      st0.missing++; persistence.record(provider.id, tenantId, 'missing', now); return { state: 'missing' };
    } catch { st0.errors++; st0.last_error_at = new Date().toISOString(); st0.last_error = 'veritabanı hatası'; persistence.record(provider.id, tenantId, 'errors', now); return { state: 'error' }; }
  }
  if (typeof fetchImpl !== 'function' || !provider.accepts(code)) return { state: 'skipped' };
  const key = provider.cacheKey(code), cache = cacheOf(provider.id), st = statOf(provider.id);
  const hit = cache.get(key);
  if (hit && now - hit.at < hit.ttl) { st.cache_hits++; persistence.record(provider.id, tenantId, 'cache_hits', now); return hit.value ? { state: 'found', suggestion: hit.value, cached: true } : { state: 'missing', cached: true }; }
  const flightKey = provider.id + ':' + key;
  if (inflight.has(flightKey)) return inflight.get(flightKey);
  const w = windowOf(provider.id);
  let tenant = w.tenants.get(tenantId); if (!tenant) w.tenants.set(tenantId, tenant = []);
  if (!allow(tenant, provider.limits.tenant, now) || !allow(w.global, provider.limits.global, now)) { st.limited++; persistence.record(provider.id, tenantId, 'limited', now); return { state: 'limited' }; }
  const job = (async () => {
    st.requests++; persistence.record(provider.id, tenantId, 'requests', now);
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), provider.timeoutMs);
      try {
        const res = await provider.fetch(key, { fetchImpl, signal: ctl.signal, env });
        const suggestion = res.found ? res.suggestion : null;
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(key, { at: now, ttl: suggestion ? provider.hitTtl : provider.missTtl, value: suggestion });
        st.last_ok_at = new Date().toISOString();
        if (suggestion) { st.found++; persistence.record(provider.id, tenantId, 'found', now); return { state: 'found', suggestion }; }
        st.missing++; persistence.record(provider.id, tenantId, 'missing', now); return { state: 'missing' };
      } catch (error) {
        lastError = error;
        const status = error && error.httpStatus;
        if (status === 429) { st.limited++; persistence.record(provider.id, tenantId, 'limited', now); return { state: 'limited' }; }   // sağlayıcı kotası doldu: tekrar deneme yok
        if (status === 401 || status === 403) break;                          // anahtar/yetki sorunu: tekrar denemek işe yaramaz
        if (attempt === 0) { st.retries++; await sleep(retryDelayMs); }
      } finally { clearTimeout(timer); }
    }
    st.errors++; persistence.record(provider.id, tenantId, 'errors', now); st.last_error_at = new Date().toISOString();
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
  const rows = options.settingsRows || await persistence.settings();
  for (const provider of enabledProviders(env, rows)) {
    const r = await runProvider(provider, tenantId, code, options);
    tried.push({ id: provider.id, state: r.state });
    if (r.state === 'found') return { state: 'found', provider, suggestion: r.suggestion, cached: !!r.cached, tried };
  }
  const state = PRECEDENCE.find(s => tried.some(t => t.state === s)) || 'skipped';
  return { state, tried };
}

// Yönetim görünümü: anahtar değeri hiçbir zaman dönmez, yalnız tanımlı olup olmadığı.
async function statusAsync(env = process.env) {
  const rows = await persistence.settings(true), base = status(env, rows), usage = await persistence.usage(30);
  return base.map(p => ({ ...p, usage_30d: usage.find(u => u.provider_id === p.id) || null }));
}
function status(env = process.env, rows = []) {
  const enabled = enabledProviders(env, rows).map(p => p.id);
  return REGISTRY.map(p => ({
    id: p.id, name: p.name, free: p.free, needs_key: p.needsKey,
    configured: p.configured(env), enabled: enabled.includes(p.id), order: enabled.indexOf(p.id) + 1 || null,
    local: !!p.local, limits_per_minute: p.local ? null : p.limits, stats: { ...statOf(p.id) }
  }));
}

module.exports = { REGISTRY, enabledProviders, runProvider, resolve, status, statusAsync, reset, persistence };
