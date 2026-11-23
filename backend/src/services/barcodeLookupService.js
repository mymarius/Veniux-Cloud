// Akıllı barkod arama: 1) işletmenin kendi ürün/koli kataloğu, 2) etkin dış sağlayıcılar sırayla (barcodeProviders/), 3) elle giriş.
// Bulunan dış veri yalnız "öneri"dir; bu servis hiçbir kayıt yazmaz. Kayıt, kullanıcı formu onaylayınca mevcut /retail/receive ile olur.
// Sağlayıcı seçimi, önbellek, hız sınırı, yeniden deneme ve sayaçlar barcodeProviders/index.js içindedir.
const db = require('../config/database');
const providers = require('./barcodeProviders');

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

function reset() { providers.reset(); }

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

// Open Food Facts sağlayıcısında tek sorgu (eski çağıranlar ve testler için). Dönüş: { state, suggestion?, cached? }
async function offLookup(tenantId, code, options = {}) {
  const env = options.env || process.env;
  const off = providers.REGISTRY.find(p => p.id === 'off');
  if (off.disabledByEnv(env)) return { state: 'skipped' };
  return providers.runProvider(off, tenantId, code, options);
}

const NOTES = {
  missing: 'Dış katalogda kayıt bulunamadı. Bilgileri elle girin.',
  limited: 'Dış katalog sorgu sınırına ulaşıldı; bir dakika sonra tekrar deneyin veya elle girin.',
  error: 'Dış katalog şu an yanıt vermiyor. Bilgileri elle girin.',
  skipped: 'Bu barkod türü dış katalogda aranmadı. Bilgileri elle girin.'
};

async function suggest(user, rawBarcode, options = {}) {
  const code = typeof rawBarcode === 'string' ? rawBarcode.trim() : '';
  if (!code || code.length > 128 || /[\x00-\x1f]/.test(code)) fail('Geçerli bir barkod girin.');
  const base = { barcode: code, checksum_ok: checksumOk(code) };
  const own = await ownCatalog(user.tenantId, code);
  if (own) return { ...base, source: 'catalog', product: own.product, pack: own.pack, suggestion: null, manual: false };
  const found = await providers.resolve(user.tenantId, code, options);
  if (found.state === 'found') {
    const p = found.provider;
    // source: sağlayıcı kimliği ('off', 'barcodelookup', ...). Arayüz bunu "kayıttan değil, dış öneri" olarak ele alır.
    return { ...base, source: p.id, provider: { id: p.id, name: p.name }, product: null, pack: null, suggestion: found.suggestion, attribution: p.attribution(code), manual: false, review_required: true, cached: found.cached };
  }
  return { ...base, source: 'none', product: null, pack: null, suggestion: null, lookup_state: found.state, message: NOTES[found.state], manual: true };
}

const OFF = providers.REGISTRY.find(p => p.id === 'off');
const ATTRIBUTION = OFF.attribution('');
const GLOBAL_PER_MIN = OFF.limits.global;

module.exports = { suggest, offLookup, ownCatalog, checksumOk, variants, reset, status: providers.status, statusAsync: providers.statusAsync, providers, ATTRIBUTION, GLOBAL_PER_MIN };
