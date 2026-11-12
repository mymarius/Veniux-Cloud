// Uyarı durumu tek yerde: sunucu uyarıyı `status` alanıyla verir ('unread', 'active', 'read', 'resolved').
// Eskiden telefon ekranları var olmayan `is_read` alanına bakıyordu; bu yüzden okunan uyarı da "okunmamış" sayılıyor, zil rozeti hiç sönmüyordu.
export function isOpenAlert(alert) {
  if (!alert || typeof alert !== 'object') return false;
  if (alert.status) return alert.status === 'unread' || alert.status === 'active';
  return !(alert.is_read || alert.read);
}

export const openAlerts = list => (Array.isArray(list) ? list : []).filter(isOpenAlert);

// Daha önce görülmemiş açık uyarılar (bildirim göndermek için). seen: Set veya dizi.
export function unseenAlerts(list, seen) {
  const known = new Set(seen || []);
  return openAlerts(list).filter(alert => alert.id != null && !known.has(String(alert.id)));
}
