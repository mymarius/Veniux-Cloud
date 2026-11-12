// Firebase Cloud Messaging (HTTP v1): Android uygulaması kapalıyken bile bildirim gönderir.
// Dış bağımlılık yok: yalnız Node crypto ve fetch. Sunucu kimliği bir hizmet hesabı (service account) JSON dosyasıdır;
// dosya web kökünün DIŞINDA durur ve yolu FCM_SERVICE_ACCOUNT_FILE ortam değişkeniyle verilir. Anahtar koda ya da veritabanına yazılmaz.
const crypto = require('crypto');
const fs = require('fs');

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const b64u = value => Buffer.from(value).toString('base64url');
let fetchImpl = (...args) => fetch(...args);
let account = null, accessCache = null;

function loadAccount() {
  if (account) return account;
  const file = process.env.FCM_SERVICE_ACCOUNT_FILE;
  if (!file) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof data.project_id !== 'string' || typeof data.client_email !== 'string' || typeof data.private_key !== 'string') return null;
    crypto.createPrivateKey(data.private_key);
    account = { projectId: data.project_id, email: data.client_email, key: data.private_key, tokenUri: TOKEN_URI };
    return account;
  } catch { return null; }
}

const configured = () => Boolean(loadAccount());
const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_:.\-]{50,4096}$/.test(token);

async function accessToken(now = Date.now()) {
  const acc = loadAccount();
  if (!acc) throw Object.assign(new Error('FCM yapılandırılmamış.'), { code: 'FCM_NOT_CONFIGURED' });
  if (accessCache && accessCache.expires - 60000 > now) return accessCache.token;
  const iat = Math.floor(now / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64u(JSON.stringify({ iss: acc.email, scope: SCOPE, aud: acc.tokenUri, iat, exp: iat + 3600 }));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(head + '.' + claims), acc.key).toString('base64url');
  const response = await fetchImpl(acc.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claims + '.' + signature
  });
  if (!response.ok) throw Object.assign(new Error('FCM erişim anahtarı alınamadı (' + response.status + ').'), { code: 'FCM_AUTH' });
  const body = await response.json();
  accessCache = { token: body.access_token, expires: now + Number(body.expires_in || 3600) * 1000 };
  return accessCache.token;
}

// Tek cihaza bildirim. Dönüş: { ok } | { gone } (token artık geçersiz: kaydı sil) | { ok:false, transient|config }
async function send(token, message = {}) {
  if (!validToken(token)) return { ok: false, gone: true };
  let bearer;
  try { bearer = await accessToken(); } catch (error) { return { ok: false, config: true, error: error.code || 'FCM_AUTH' }; }
  const payload = {
    message: {
      token,
      notification: { title: String(message.title || 'Veniux').slice(0, 120), body: String(message.body || '').slice(0, 400) },
      data: { url: String(message.url || '/m').slice(0, 200), tag: String(message.tag || 'veniux').slice(0, 80) },
      android: { priority: 'HIGH', ttl: '3600s', notification: { channel_id: 'veniux-alerts', tag: String(message.tag || 'veniux').slice(0, 80) } }
    }
  };
  try {
    const response = await fetchImpl('https://fcm.googleapis.com/v1/projects/' + loadAccount().projectId + '/messages:send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload)
    });
    if (response.ok) return { ok: true };
    let code = '';
    try { const body = await response.json(); code = String(body.error?.details?.find?.(d => d.errorCode)?.errorCode || body.error?.status || ''); } catch { /* gövde yok */ }
    if (response.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') return { ok: false, gone: true };
    if (response.status === 401 || response.status === 403) { accessCache = null; return { ok: false, config: true, error: code || String(response.status) }; }
    return { ok: false, transient: true, error: code || String(response.status) };
  } catch { return { ok: false, transient: true }; }
}

module.exports = { configured, validToken, send, accessToken, _setFetch: fn => { fetchImpl = fn || ((...args) => fetch(...args)); }, _reset: () => { account = null; accessCache = null; } };
