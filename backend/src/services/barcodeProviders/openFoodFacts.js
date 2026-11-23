// Open Food Facts: ücretsiz, anahtarsız, ODbL. Barkodun kendisi dışında hiçbir bilgi gönderilmez.
const { clean, safeImage, suggestion, httpError } = require('./common');

const FIELDS = 'code,product_name,product_name_tr,generic_name,brands,quantity,product_quantity,product_quantity_unit,image_front_small_url,image_front_url';
const USER_AGENT = 'Veniux-Barkod/1.0 (stok programi; https://veniux.com)';
const HOST = /(^|\.)openfoodfacts\.(org|net)$/;

function toSuggestion(p) {
  if (!p || typeof p !== 'object') return null;
  const name = clean(p.product_name_tr, 200) || clean(p.product_name, 200) || clean(p.generic_name, 200);
  const quantity = clean(p.quantity, 40).replace(/(\d\s*(?:g|kg|ml|cl|l))\s+e$/i, '$1'); // OFF "400 g e" sonundaki e = tahmini ağırlık işareti
  const amount = Number(p.product_quantity);
  return suggestion({
    name,
    brand: String(p.brands || '').split(',')[0],
    quantityText: quantity,
    size: { value: amount, unit: clean(p.product_quantity_unit, 8) },
    image: safeImage(p.image_front_small_url, HOST) || safeImage(p.image_front_url, HOST)
  });
}

module.exports = {
  id: 'off',
  name: 'Open Food Facts',
  free: true,
  needsKey: false,
  // Open Food Facts ürün okuma sınırı IP başına dakikada 100; biz sunucu başına 15 ile çok altında kalırız.
  limits: { global: 15, tenant: 10 },
  hitTtl: 7 * 24 * 3600e3,
  missTtl: 6 * 3600e3,
  timeoutMs: 6000,
  accepts: code => /^\d{8}$|^\d{12,14}$/.test(code),
  cacheKey: code => (code.length === 14 && code[0] === '0' ? code.slice(1) : code),
  configured: () => true,
  disabledByEnv: env => env.VENIUX_OFF_DISABLED === '1',
  attribution: code => ({
    source: 'Open Food Facts',
    license: 'ODbL 1.0 (veri), CC BY-SA (görseller)',
    url: 'https://world.openfoodfacts.org/',
    text: 'Veri: Open Food Facts (ODbL), görsel CC BY-SA',
    product_url: 'https://world.openfoodfacts.org/product/' + encodeURIComponent(code)
  }),
  toSuggestion,
  async fetch(code, { fetchImpl, signal, env }) {
    const base = env.VENIUX_OFF_URL || 'https://world.openfoodfacts.org/api/v2/product/';
    const r = await fetchImpl(base + encodeURIComponent(code) + '.json?fields=' + FIELDS, { signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (r.status === 404) return { found: false };
    if (!r.ok) throw httpError(r.status);
    const body = await r.json();
    const s = body && body.status === 1 && body.product ? toSuggestion(body.product) : null;
    return s ? { found: true, suggestion: s } : { found: false };
  }
};
