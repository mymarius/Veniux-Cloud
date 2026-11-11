// Web Push (RFC 8030 + VAPID RFC 8292 + içerik şifreleme RFC 8291/8188 aes128gcm). Dış bağımlılık yok: yalnız Node crypto.
// Telefon (Chrome/Edge/Firefox, ana ekrana eklenmiş Safari) uygulama kapalıyken bile bildirim alır.
const crypto = require('crypto');
const db = require('../config/database');

const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = text => Buffer.from(String(text), 'base64url');
const SUBJECT = () => process.env.VENIUX_PUSH_SUBJECT || 'https://veniux.com';
const MAX_PAYLOAD = 3000;

// Abonelik adresi yalnız bilinen push servislerine gidebilir (sunucunun keyfi adrese istek atması engellenir).
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)web\.push\.apple\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)wns2-[a-z0-9-]+\.notify\.windows\.com$/];
function validEndpoint(endpoint) {
  try {
    const url = new URL(String(endpoint));
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.href.length <= 1000 && PUSH_HOSTS.some(re => re.test(url.hostname));
  } catch { return false; }
}

// ---------- Sunucu VAPID anahtarı ----------
function sealKey() { const { JWT_SECRET } = require('../middlewares/authMiddleware'); return crypto.createHash('sha256').update('veniux-push-vapid-v1\0' + JWT_SECRET).digest(); }
function seal(text) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', sealKey(), iv);
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return 'enc1:' + [iv, cipher.getAuthTag(), body].map(b => b.toString('base64')).join('.');
}
function unseal(payload) {
  const [iv, tag, body] = String(payload).slice(5).split('.').map(p => Buffer.from(p, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', sealKey(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
}
let keyCache = null;
async function vapid() {
  if (keyCache) return keyCache;
  let row = (await db.query('SELECT public_key,private_sealed FROM push_vapid WHERE id=1')).rows[0];
  if (!row) {
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = pair.publicKey.export({ format: 'jwk' });
    const publicKey = b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]));
    try { await db.query('INSERT INTO push_vapid (id,public_key,private_sealed) VALUES (1,$1,$2)', [publicKey, seal(JSON.stringify(pair.privateKey.export({ format: 'jwk' })))]); } catch { /* başka istek önce yazdı */ }
    row = (await db.query('SELECT public_key,private_sealed FROM push_vapid WHERE id=1')).rows[0];
  }
  keyCache = { publicKey: row.public_key, privateKey: crypto.createPrivateKey({ key: JSON.parse(unseal(row.private_sealed)), format: 'jwk' }) };
  return keyCache;
}
const resetKeyCache = () => { keyCache = null; };

function vapidHeader(endpoint, key, now = Date.now()) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT() }));
  const signature = crypto.sign('sha256', Buffer.from(header + '.' + claims), { key: key.privateKey, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + header + '.' + claims + '.' + b64u(signature) + ', k=' + key.publicKey;
}

// ---------- İçerik şifreleme (RFC 8291) ----------
// asPrivate/salt yalnız test vektörü içindir; üretimde her mesaj için rastgele üretilir.
function encrypt({ p256dh, auth }, payload, { asPrivate, salt } = {}) {
  const plain = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  if (plain.length > MAX_PAYLOAD) throw new Error('Bildirim içeriği çok büyük.');
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length !== 16) throw new Error('Abonelik anahtarı geçersiz.');
  const ecdh = crypto.createECDH('prime256v1');
  if (asPrivate) ecdh.setPrivateKey(unb64u(asPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(), secret = ecdh.computeSecret(uaPublic), nonceSalt = salt ? unb64u(salt) : crypto.randomBytes(16);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, nonceSalt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, nonceSalt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const sealed = Buffer.concat([cipher.update(Buffer.concat([plain, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); nonceSalt.copy(header, 0); header.writeUInt32BE(4096, 16); header[20] = 65;
  return Buffer.concat([header, asPublic, sealed]);
}

// Alıcı tarafı (test için): şifreli gövdeyi açar.
function decrypt({ uaPrivate, uaPublic, auth }, body) {
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), sealed = body.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.setPrivateKey(unb64u(uaPrivate));
  const secret = ecdh.computeSecret(asPublic), ua = unb64u(uaPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, unb64u(auth), Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()]);
  let end = plain.length; while (end > 0 && plain[end - 1] === 0) end--;
  return plain.subarray(0, end - 1); // son bayt: ayraç (0x02)
}

// Tek aboneliğe gönderir. Dönüş: { ok, gone, status }.
async function send(subscription, message, { ttl = 86400, urgency = 'high', fetchImpl = fetch } = {}) {
  if (!validEndpoint(subscription.endpoint)) return { ok: false, gone: true, status: 0 };
  const key = await vapid();
  const body = encrypt(subscription, JSON.stringify(message));
  let response;
  try {
    response = await fetchImpl(subscription.endpoint, { method: 'POST', redirect: 'error', headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency, Authorization: vapidHeader(subscription.endpoint, key) }, body, signal: AbortSignal.timeout(10000) });
  } catch { return { ok: false, gone: false, status: 0 }; }
  return { ok: response.status >= 200 && response.status < 300, gone: response.status === 404 || response.status === 410, status: response.status };
}

module.exports = { validEndpoint, vapid, vapidHeader, encrypt, decrypt, send, resetKeyCache, b64u, unb64u };
