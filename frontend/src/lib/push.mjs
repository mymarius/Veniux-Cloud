// Telefon bildirimi (Web Push) için istemci yardımcıları. Tarayıcıya özgü çağrılar dışarıdan verilir; böylece mantık test edilebilir.

// Sunucudan gelen VAPID açık anahtarı (base64url) -> PushManager'ın beklediği bayt dizisi.
export function urlBase64ToUint8Array(text) {
  const padded = String(text || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(text || '').length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}

// Durum: 'unsupported' (bu ortamda push yok), 'blocked' (izin reddedildi), 'off' (kapalı), 'on' (açık ve abone).
export function pushStatus({ supported, permission, subscribed }) {
  if (!supported) return 'unsupported';
  if (permission === 'denied') return 'blocked';
  return permission === 'granted' && subscribed ? 'on' : 'off';
}

// Neden desteklenmediğini kullanıcıya anlatan kısa metin (null = destekleniyor).
export function unsupportedReason(env) {
  if (env.insideApp) return 'Bu, Android uygulamasının içi. Telefon kapalıyken bildirim için Veniux\'u telefonun tarayıcısında açıp "Ana ekrana ekle" ile kurun.';
  if (!env.secure) return 'Bildirim için güvenli (https) bağlantı gerekir.';
  if (!env.serviceWorker || !env.pushManager || !env.notification) return env.ios ? 'iPhone\'da bildirim için Safari\'de "Paylaş > Ana Ekrana Ekle" ile kurup uygulamayı oradan açın (iOS 16.4 veya üstü).' : 'Bu tarayıcı telefon bildirimini desteklemiyor. Chrome veya Edge kullanın.';
  return null;
}

export function subscriptionBody(subscription) {
  const json = typeof subscription?.toJSON === 'function' ? subscription.toJSON() : subscription;
  if (!json || typeof json.endpoint !== 'string' || !json.keys || typeof json.keys.p256dh !== 'string' || typeof json.keys.auth !== 'string') throw new Error('Bildirim aboneliği oluşturulamadı.');
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}
