import api from '../api/client';
import { pushStatus, subscriptionBody, unsupportedReason, urlBase64ToUint8Array } from './push.mjs';

export function pushEnv() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return {
    insideApp: Boolean(window.veniuxMobile),
    secure: window.isSecureContext && /^https?:$/.test(window.location.protocol),
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    ios: /iPhone|iPad|iPod/.test(ua)
  };
}

export async function getPushState() {
  const reason = unsupportedReason(pushEnv());
  if (reason) return { status: 'unsupported', reason };
  let subscribed = false;
  try { const reg = await navigator.serviceWorker.getRegistration(); subscribed = Boolean(reg && await reg.pushManager.getSubscription()); } catch { subscribed = false; }
  return { status: pushStatus({ supported: true, permission: Notification.permission, subscribed }), reason: null };
}

// Bildirimleri açar: izin ister, aboneliği oluşturur ve sunucuya kaydeder.
export async function enablePush() {
  const reason = unsupportedReason(pushEnv());
  if (reason) throw new Error(reason);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.');
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = (await api.get('/push/key')).data;
  const subscription = (await registration.pushManager.getSubscription()) || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await api.post('/push/subscribe', subscriptionBody(subscription));
  return true;
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration && await registration.pushManager.getSubscription();
  if (!subscription) return false;
  try { await api.delete('/push/subscribe', { data: { endpoint: subscription.endpoint } }); } catch { /* sunucu erişilemese de cihazdan çıkılır */ }
  await subscription.unsubscribe();
  return true;
}

export async function sendTestPush() {
  return (await api.post('/push/test', {})).data;
}
