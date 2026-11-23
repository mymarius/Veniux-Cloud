// Ortak katalog sağlayıcısı: ağ isteği yok, yalnız yerel veritabanı. Yalnız en az 2 işletmenin aynı barkoda verdiği ad yayımlanır (sharedCatalogService).
const { suggestion } = require('./common');

module.exports = {
  id: 'shared',
  name: 'Veniux ortak katalog',
  free: true,
  needsKey: false,
  local: true,                       // runProvider ağ sınırı/önbellek uygulamaz; yalnız sayaç tutar
  limits: { global: Infinity, tenant: Infinity },
  hitTtl: 0, missTtl: 0, timeoutMs: 0,
  accepts: code => /^\d{8}$|^\d{12,14}$/.test(code),
  cacheKey: code => (code.length === 14 && code[0] === '0' ? code.slice(1) : code),
  configured: () => true,
  disabledByEnv: env => env.VENIUX_SHARED_CATALOG_DISABLED === '1',
  attribution: () => ({ source: 'Veniux ortak katalog', license: 'Diğer Veniux işletmelerinin onayladığı kayıtlar', url: null, text: 'Veri: Veniux ortak katalog (diğer işletmelerin girdiği ad)', product_url: null }),
  async lookupLocal(code) {
    const row = await require('../sharedCatalogService').find(code);
    if (!row) return { found: false };
    const s = suggestion({ name: row.name, brand: row.brand, category: row.category });
    if (!s) return { found: false };
    if (row.unit) s.suggested_unit = ['adet', 'paket', 'kutu', 'kg', 'litre', 'metre'].includes(row.unit) ? row.unit : 'adet';
    return { found: true, suggestion: s };
  }
};
