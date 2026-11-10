// Çevrimdışı okuma önbelleği: kasanın açılışta ihtiyaç duyduğu birkaç GET isteğinin (hesap, depo, yetki, vardiya bağlamı…)
// son başarılı cevabı saklanır; yalnız ağ hatasında (sunucudan hiçbir cevap yok) 24 saate kadar bu cevap kullanılır.
// Sunucu cevap verirse (401, 403, 423…) önbellek kullanılmaz. Yazma istekleri (satış, iade) hiçbir zaman buradan geçmez.
// Anahtar, oturum jetonunun parmak izini içerir: başka kullanıcı girince eski kullanıcının kayıtları eşleşmez.
export const MAX_AGE_MS = 24 * 3600000;
export const PREFIX = 'veniux:read-cache:';
const PATHS = [/^\/auth\/me$/, /^\/license\/policy$/, /^\/normal-depo\/warehouses$/, /^\/scanner\/permissions$/, /^\/scanner\/shifts\/context$/, /^\/scanner\/settings$/, /^\/scanner\/pro\/(?:preferences|categories|hardware)$/];

const pathOf = config => String(config?.url || '').split('?')[0].replace(/^\/api(?=\/)/, '');
export function cacheable(config) {
  return String(config?.method || 'get').toLowerCase() === 'get' && PATHS.some(re => re.test(pathOf(config)));
}
export function tokenId(token) {
  let hash = 5381;
  for (const ch of String(token || '')) hash = ((hash << 5) + hash + ch.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}
export function cacheKey(config, id) {
  const params = config?.params && typeof config.params === 'object' ? Object.keys(config.params).sort().map(k => k + '=' + String(config.params[k])).join('&') : '';
  return PREFIX + id + ':' + pathOf(config) + (params ? '?' + params : '');
}
export function save(storage, config, data, id, now = Date.now()) {
  try {
    storage.setItem(cacheKey(config, id), JSON.stringify({ at: now, data }));
    // Başka oturumlara ait eski kayıtları temizle (depo şişmesin, başka kullanıcıya sızmasın).
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key && key.startsWith(PREFIX) && !key.startsWith(PREFIX + id + ':')) storage.removeItem(key);
    }
  } catch { /* depo dolu veya kapalı: önbellek olmadan çalışmaya devam */ }
}
export function load(storage, config, id, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(cacheKey(config, id)) || 'null');
    if (!value || !Number.isFinite(value.at) || value.at > now || now - value.at > MAX_AGE_MS) return null;
    return value.data === undefined ? null : { data: value.data };
  } catch { return null; }
}
