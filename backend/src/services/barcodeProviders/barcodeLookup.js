// Barcode Lookup (barcodelookup.com) ücretli API. Anahtar yalnız sunucu ortamından okunur (VENIUX_BARCODELOOKUP_KEY),
// istemciye, günlüklere ve hata mesajlarına hiçbir zaman yazılmaz.
// UYARI: Bu sağlayıcı gerçek anahtarla ve gerçek yanıtla DENENMEDİ; yanıt biçimi yayımlanmış belgeye göre yazıldı ve yalnız sahte yanıtla test edildi.
// Anahtar girildiğinde önce birkaç bilinen barkodla elle doğrulayın. Ticari kullanım ve görsel hakları sözleşmeye bağlıdır;
// bu yüzden görseller varsayılan olarak ÖNERİLMEZ (VENIUX_BARCODELOOKUP_IMAGES=1 ile açılır).
const { clean, safeImage, suggestion, httpError } = require('./common');

module.exports = {
  id: 'barcodelookup',
  name: 'Barcode Lookup',
  free: false,
  needsKey: true,
  keyEnv: 'VENIUX_BARCODELOOKUP_KEY',
  limits: { global: 30, tenant: 10 },
  hitTtl: 30 * 24 * 3600e3,   // ücretli sorgu: sonucu uzun süre önbellekte tut
  missTtl: 24 * 3600e3,
  timeoutMs: 8000,
  accepts: code => /^\d{8}$|^\d{12,14}$/.test(code),
  cacheKey: code => (code.length === 14 && code[0] === '0' ? code.slice(1) : code),
  configured: env => typeof env.VENIUX_BARCODELOOKUP_KEY === 'string' && env.VENIUX_BARCODELOOKUP_KEY.trim().length >= 8,
  disabledByEnv: () => false,
  attribution: code => ({ source: 'Barcode Lookup', license: 'Ticari API sözleşmesi', url: 'https://www.barcodelookup.com/', text: 'Veri: Barcode Lookup', product_url: null }),
  toSuggestion(p, env = process.env) {
    if (!p || typeof p !== 'object') return null;
    const images = Array.isArray(p.images) ? p.images : [];
    return suggestion({
      name: p.title || p.product_name,
      brand: p.brand,
      quantityText: p.size,
      category: p.category,
      image: env.VENIUX_BARCODELOOKUP_IMAGES === '1' ? safeImage(images[0], /./) : ''
    });
  },
  async fetch(code, { fetchImpl, signal, env }) {
    const url = 'https://api.barcodelookup.com/v3/products?barcode=' + encodeURIComponent(code) + '&formatted=y&key=' + encodeURIComponent(env.VENIUX_BARCODELOOKUP_KEY.trim());
    const r = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
    if (r.status === 404) return { found: false };
    if (!r.ok) throw httpError(r.status);   // adres (anahtarı içerir) hataya girmez
    const body = await r.json();
    const first = body && Array.isArray(body.products) ? body.products[0] : null;
    const s = first ? module.exports.toSuggestion(first, env) : null;
    return s ? { found: true, suggestion: s } : { found: false };
  }
};
void clean;
