// Yönetim sitesinden (yonetim.veniux.com) gelen imzalı istekleri doğrular. Oturum açma yoktur: her istek, yalnız iki tarafın bildiği
// gizli anahtarla (VENIUX_OWNER_CONSOLE_SECRET) HMAC-SHA256 ile imzalanır. Anahtar tanımlı değilse uç kapalıdır (503).
//
// İmzalanan metin:  YÖNTEM \n YOL(sorgusuz) \n ZAMAN \n NONCE \n SHA256(gövde)
// Başlıklar: X-Console-Time (saniye, ±60 sn), X-Console-Nonce (16-64 onaltılık), X-Console-Signature (onaltılık HMAC).
// Aynı nonce ikinci kez kabul edilmez (tekrar saldırısı); gövde değişirse imza tutmaz.
const crypto = require('crypto');
const WINDOW_SECONDS = 60;
const seen = new Map();

function secret() { const s = process.env.VENIUX_OWNER_CONSOLE_SECRET || ''; return s.length >= 32 ? s : null; }
function sign(key, method, path, time, nonce, body) {
  return crypto.createHmac('sha256', key).update([method.toUpperCase(), path, String(time), nonce, crypto.createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
}
function prune(now) { for (const [k, t] of seen) if (t < now - WINDOW_SECONDS * 2) seen.delete(k); }
function deny(res, status, code, error) { return res.status(status).json({ code, error }); }

function middleware(req, res, next) {
  const key = secret();
  if (!key) return deny(res, 503, 'CONSOLE_DISABLED', 'Yönetim sitesi bağlantısı bu sunucuda kapalı.');
  const time = Number(req.get('x-console-time')), nonce = String(req.get('x-console-nonce') || ''), given = String(req.get('x-console-signature') || '');
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(time) || Math.abs(now - time) > WINDOW_SECONDS || !/^[a-f0-9]{16,64}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(given)) return deny(res, 401, 'BAD_SIGNATURE', 'İstek imzası geçersiz.');
  const body = req.rawBody !== undefined ? Buffer.from(String(req.rawBody), 'utf8') : Buffer.alloc(0);
  const path = req.originalUrl.split('?')[0];
  const expected = sign(key, req.method, path, time, nonce, body);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return deny(res, 401, 'BAD_SIGNATURE', 'İstek imzası geçersiz.');
  prune(now);
  if (seen.has(nonce)) return deny(res, 401, 'REPLAY', 'Bu istek daha önce kullanıldı.');
  seen.set(nonce, now);
  req.consoleActor = 'yonetim-sitesi';
  next();
}
module.exports = { middleware, sign, secret, WINDOW_SECONDS, _seen: seen };
