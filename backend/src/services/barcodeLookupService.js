// Akıllı barkod arama: 1) işletmenin kendi ürün/koli kataloğu, 2) Open Food Facts (sunucu önbellekli), 3) elle giriş.
// Bulunan dış veri yalnız "öneri"dir; bu servis hiçbir kayıt yazmaz. Kayıt, kullanıcı formu onaylayınca mevcut /retail/receive ile olur.
// Önbellek bellektedir (şema değişikliği gerekmez); sunucu yeniden başlarsa boşalır ve OFF'a yeniden sorulur.
const db = require('../config/database');

const OFF_URL = process.env.VENIUX_OFF_URL || 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'code,product_name,product_name_tr,generic_name,brands,quantity,product_quantity,product_quantity_unit,image_front_small_url,image_front_url';
const USER_AGENT = 'Veniux-Barkod/1.0 (stok programi; https://veniux.com)';
const TIMEOUT_MS = 6000;
const HIT_TTL = 7 * 24 * 3600e3, MISS_TTL = 6 * 3600e3, MAX_CACHE = 5000;
// Open Food Facts ürün okuma sınırı IP başına dakikada 100; biz sunucu başına 15 ile çok altında kalırız.
const GLOBAL_PER_MIN = 15, TENANT_PER_MIN = 10;
const ATTRIBUTION = { source: 'Open Food Facts', license: 'ODbL 1.0 (veri), CC BY-SA (görseller)', url: 'https://world.openfoodfacts.org/' };

const cache = new Map();            // kod -> { at, ttl, value }
const inflight = new Map();         // kod -> Promise
const hits = { global: [], tenants: new Map() };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function reset() { cache.clear(); inflight.clear(); hits.global = []; hits.tenants.clear(); }

function allow(list, limit, now) {
  while (list.length && now - list[0] >= 60e3) list.shift();
  if (list.length >= limit) return false;
  list.push(now); return true;
}

// EAN-8/UPC-A/EAN-13/GTIN-14 sağlama basamağı. Geçersizse yine aranır ama kullanıcıya uyarı verilir.
function checksumOk(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split('').map(Number), last = d.pop();
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === last;
}

// Aynı ürünün olası yazılışları: baştaki sıfırlı/sıfırsız GTIN eşdeğerleri.
function variants(code) {
  const out = new Set([code]);
  if (/^\d+$/.test(code)) {
    const bare = code.replace(/^0+/, '');
    for (const len of [8, 12, 13, 14]) if (bare.length <= len && bare.length >= 6) out.add(bare.padStart(len, '0'));
  }
  return [...out];
}

async function ownCatalog(tenantId, code) {
  const list = variants(code);
  const marks = list.map((_, i) => '$' + (i + 2)).join(',');
  const own = (await db.query(`SELECT id,name,barcode,unit,purchase_price,sale_price FROM products WHERE tenant_id=$1 AND module_type='NORMAL' AND barcode IN (${marks})`, [tenantId, ...list])).rows;
  if (own.length > 1) fail('Bu barkod birden fazla ürüne atanmış. Ürün kataloğundan düzeltin.', 409);
  if (own[0]) return { product: own[0], pack: null };
  const packs = (await db.query(`SELECT p.id,p.name,p.barcode,p.unit,p.purchase_price,p.sale_price,u.uom_code,u.conversion_factor FROM product_uoms u JOIN products p ON p.id=u.product_id AND p.tenant_id=u.tenant_id WHERE u.tenant_id=$1 AND u.barcode IN (${marks}) AND p.module_type='NORMAL'`, [tenantId, ...list])).rows;
  if (packs.length > 1) fail('Bu koli barkodu birden fazla ürüne atanmış. Ürün birimlerini düzeltin.', 409);
  const pk = packs[0];
  if (!pk) return null;
  return { product: { id: pk.id, name: pk.name, barcode: pk.barcode, unit: pk.unit, purchase_price: pk.purchase_price, sale_price: pk.sale_price }, pack: { unit: pk.uom_code, factor: Number(pk.conversion_factor) } };
}

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const safeUrl = v => { try { const u = new URL(v); return u.protocol === 'https:' && /(^|\.)openfoodfacts\.(org|net)$/.test(u.hostname) ? u.href : ''; } catch { return ''; } };

// OFF yanıtını form önerisine çevirir. Ad yoksa öneri yoktur (boş kayıt önerilmez).
function toSuggestion(p) {
  if (!p || typeof p !== 'object') return null;
  const name = clean(p.product_name_tr, 200) || clean(p.product_name, 200) || clean(p.generic_name, 200);
  if (!name) return null;
  const brand = clean(String(p.brands || '').split(',')[0], 80);
  const quantity = clean(p.quantity, 40).replace(/(\d\s*(?:g|kg|ml|cl|l))\s+e$/i, '$1'); // OFF "400 g e" sonundaki e = tahmini ağırlık işareti
  const amount = Number(p.product_quantity);
  const unit = clean(p.product_quantity_unit, 8).toLowerCase();
  const nameHasBrand = brand && name.toLocaleLowerCase('tr').includes(brand.toLocaleLowerCase('tr'));
  const nameHasQty = quantity && name.toLocaleLowerCase('tr').replace(/\s/g, '').includes(quantity.toLocaleLowerCase('tr').replace(/\s/g, ''));
  return {
    name,
    brand: brand || null,
    quantity_text: quantity || null,
    size: Number.isFinite(amount) && amount > 0 && unit ? { value: amount, unit } : null,
    image_url: safeUrl(p.image_front_small_url) || safeUrl(p.image_front_url) || null,
    suggested_name: [nameHasBrand ? '' : brand, name, nameHasQty ? '' : quantity].filter(Boolean).join(' ').slice(0, 200),
    suggested_unit: 'adet'
  };
}

async function download(code, fetchImpl) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(OFF_URL + encodeURIComponent(code) + '.json?fields=' + FIELDS, { signal: ctl.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (r.status === 404) return { found: false };
    if (!r.ok) throw new Error('OFF ' + r.status);
    const body = await r.json();
    return body && body.status === 1 && body.product ? { found: true, product: body.product } : { found: false };
  } finally { clearTimeout(timer); }
}

// Dönüş: { state:'found'|'missing'|'limited'|'error'|'skipped', suggestion?, cached? }
async function offLookup(tenantId, code, { fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  if (process.env.VENIUX_OFF_DISABLED === '1' || typeof fetchImpl !== 'function') return { state: 'skipped' };
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return { state: 'skipped' };
  const key = code.length === 14 && code[0] === '0' ? code.slice(1) : code;
  const hit = cache.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.value ? { state: 'found', suggestion: hit.value, cached: true } : { state: 'missing', cached: true };
  if (inflight.has(key)) return inflight.get(key);
  let tenant = hits.tenants.get(tenantId); if (!tenant) hits.tenants.set(tenantId, tenant = []);
  if (!allow(tenant, TENANT_PER_MIN, now) || !allow(hits.global, GLOBAL_PER_MIN, now)) return { state: 'limited' };
  const job = (async () => {
    try {
      const res = await download(key, fetchImpl);
      const suggestion = res.found ? toSuggestion(res.product) : null;
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
      cache.set(key, { at: now, ttl: suggestion ? HIT_TTL : MISS_TTL, value: suggestion });
      return suggestion ? { state: 'found', suggestion } : { state: 'missing' };
    } catch { return { state: 'error' }; }   // geçici hatalar önbelleğe yazılmaz
    finally { inflight.delete(key); }
  })();
  inflight.set(key, job);
  return job;
}

async function suggest(user, rawBarcode, options = {}) {
  const code = typeof rawBarcode === 'string' ? rawBarcode.trim() : '';
  if (!code || code.length > 128 || /[\x00-\x1f]/.test(code)) fail('Geçerli bir barkod girin.');
  const base = { barcode: code, checksum_ok: checksumOk(code) };
  const own = await ownCatalog(user.tenantId, code);
  if (own) return { ...base, source: 'catalog', product: own.product, pack: own.pack, suggestion: null, manual: false };
  const off = await offLookup(user.tenantId, code, options);
  if (off.state === 'found') return { ...base, source: 'off', product: null, pack: null, suggestion: off.suggestion, attribution: { ...ATTRIBUTION, product_url: 'https://world.openfoodfacts.org/product/' + encodeURIComponent(code) }, manual: false, review_required: true, cached: !!off.cached };
  const notes = { missing: 'Open Food Facts kaydı bulunamadı. Bilgileri elle girin.', limited: 'Dış katalog sorgu sınırına ulaşıldı; bir dakika sonra tekrar deneyin veya elle girin.', error: 'Dış katalog şu an yanıt vermiyor. Bilgileri elle girin.', skipped: 'Bu barkod türü dış katalogda aranmadı. Bilgileri elle girin.' };
  return { ...base, source: 'none', product: null, pack: null, suggestion: null, lookup_state: off.state, message: notes[off.state], manual: true };
}

module.exports = { suggest, offLookup, ownCatalog, toSuggestion, checksumOk, variants, reset, ATTRIBUTION, GLOBAL_PER_MIN };
