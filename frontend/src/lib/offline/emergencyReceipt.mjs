// Çevrimdışı satışlara geçici fiş numarası: E<cihaz>-<gün>-<sıra>. Sıra cihazda gün başına kalıcı sayaçtan gelir
// ve geri sarmaz; sunucu satışı kabul edince kendi kasa-gün numarasını ayrıca verir, geçici numara kayıtta saklanır.
const pad = (n, width) => String(n).padStart(width, '0');
export function deviceKey(deviceUid) {
  let hash = 2166136261;
  for (const ch of String(deviceUid || 'cihaz')) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash.toString(36).toUpperCase().padStart(3, '0').slice(-3);
}
export function businessDay(now = new Date()) {
  return new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
}
// storage: getItem/setItem (localStorage gibi). Sayaç yazılamazsa hata verir; numara üretilmez (çift numara riski).
export function nextEmergencyReceipt(storage, deviceUid, now = new Date()) {
  const day = businessDay(now), key = 'veniux:emergency-receipt:' + deviceKey(deviceUid) + ':' + day;
  const last = Number.parseInt(storage.getItem(key) || '0', 10) || 0, next = last + 1;
  storage.setItem(key, String(next));
  if (Number.parseInt(storage.getItem(key), 10) !== next) throw new Error('Geçici fiş sayacı yazılamadı.');
  return 'E' + deviceKey(deviceUid) + '-' + day + '-' + pad(next, 5);
}
