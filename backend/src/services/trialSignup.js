'use strict';
// Kendi kendine açılan 14 günlük deneme (docs/DENEME-OTOMASYONU-TASARIMI.md).
// 1) İstek: e-posta + işletme adı → imzalı, 24 saat geçerli doğrulama bağlantısı e-postayla gider. Kayıt oluşmaz.
// 2) Onay: bağlantıdaki belirteç doğrulanır → merkezde deneme lisansı (VNX-) üretilir → demo işletme açılır.
//    Şifre ve lisans anahtarı yalnız bu yanıtta bir kez döner; e-postayla gönderilmez, kayda düz yazılmaz.
// Tek kullanım: aynı e-postayla ikinci kez hesap açılamaz (demoAccount EXISTS). CAPTCHA yok; yerine
// e-posta doğrulaması, görünmez tuzak alan, IP/e-posta sınırı, tek kullanımlık alan adı engeli ve günlük kota var.
const crypto = require('crypto');

const TOKEN_HOURS = 24;
const DAILY_LIMIT = Number(process.env.VENIUX_TRIAL_DAILY_LIMIT || 20);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com', 'temp-mail.org', 'tempmail.com', 'tempmail.net', 'yopmail.com', 'yopmail.net', 'trashmail.com', 'getnada.com', 'maildrop.cc', 'dispostable.com', 'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'tempr.email', 'discard.email', 'spamgourmet.com', 'mail.tm', 'moakt.com', 'burnermail.io']);

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

function serviceKey() {
  const key = process.env.VENIUX_TRIAL_SERVICE_KEY || '';
  return key.length >= 32 ? key : null;
}
const enabled = () => Boolean(serviceKey() && process.env.VENIUX_LICENSE_AUTHORITY_URL);

function secret() {
  const base = process.env.JWT_SECRET || '';
  if (Buffer.byteLength(base) < 32) throw fail(503, 'NO_SECRET', 'Deneme şu anda açılamıyor.');
  return crypto.createHmac('sha256', base).update('veniux-trial-token-v1').digest();
}

function normalize({ email, company }) {
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const name = typeof company === 'string' ? company.trim().replace(/\s+/g, ' ') : '';
  if (!EMAIL.test(address) || address.length > 254) throw fail(400, 'BAD_EMAIL', 'Geçerli bir e-posta adresi yazın.');
  if (DISPOSABLE.has(address.split('@')[1])) throw fail(400, 'DISPOSABLE', 'Geçici e-posta adresleriyle deneme açılamıyor. İşletmenizin e-postasını yazın.');
  if (name.length < 2 || name.length > 80 || /[<>]/.test(name)) throw fail(400, 'BAD_COMPANY', 'İşletme adını 2–80 karakter arasında yazın.');
  return { email: address, company: name };
}

function sign(data, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ e: data.email, c: data.company, x: now + TOKEN_HOURS * 3600000, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

function read(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw fail(400, 'BAD_TOKEN', 'Bağlantı geçersiz. Yeni bir deneme isteği gönderin.');
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw fail(400, 'BAD_TOKEN', 'Bağlantı geçersiz. Yeni bir deneme isteği gönderin.');
  let value;
  try { value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw fail(400, 'BAD_TOKEN', 'Bağlantı geçersiz. Yeni bir deneme isteği gönderin.'); }
  if (!Number.isFinite(value.x) || value.x < now) throw fail(410, 'EXPIRED', 'Bağlantının süresi dolmuş. Yeni bir deneme isteği gönderin.');
  return normalize({ email: value.e, company: value.c });
}

const lastSent = new Map();
const inFlight = new Set();

function appUrl() {
  return (process.env.VENIUX_PUBLIC_APP_URL || 'https://app.veniux.com').replace(/\/$/, '');
}

async function request(db, input, { sendEmail, now = Date.now() } = {}) {
  if (!enabled()) throw fail(503, 'DISABLED', 'Kendi kendine deneme şu anda kapalı. Bize veniux.com üzerinden yazın, hesabınızı açalım.');
  if (input && typeof input.website === 'string' && input.website.trim()) return { sent: true }; // tuzak alan: botlara sessizce başarı
  if (!input || input.consent !== true) throw fail(400, 'NO_CONSENT', 'Aydınlatma metnini okuduğunuzu onaylayın.');
  const data = normalize(input);
  const previous = lastSent.get(data.email);
  if (previous && now - previous < 10 * 60000) return { sent: true };
  for (const [key, at] of lastSent) if (now - at > 3600000) lastSent.delete(key);
  // Kayıtlı e-postaya bağlantı gönderilmez; yanıt aynı kalır ki hangi adreslerin kayıtlı olduğu öğrenilemesin.
  if ((await db.query('SELECT id FROM users WHERE LOWER(email)=$1', [data.email])).rows.length) { lastSent.set(data.email, now); return { sent: true }; }
  const link = `${appUrl()}/deneme/onay#t=${sign(data, now)}`;
  const text = `Merhaba,\n\n${data.company} için Veniux deneme hesabı isteği aldık. Hesabınızı açmak için 24 saat içinde bu bağlantıyı açın:\n\n${link}\n\nBu isteği siz göndermediyseniz bu e-postayı yok sayın; hesap açılmaz.\n\nVeniux`;
  const html = `<p>Merhaba,</p><p><b>${data.company.replace(/[&<>"]/g, '')}</b> için Veniux deneme hesabı isteği aldık. Hesabınızı açmak için 24 saat içinde aşağıdaki bağlantıyı açın:</p><p><a href="${link}">Deneme hesabımı aç</a></p><p>Bu isteği siz göndermediyseniz bu e-postayı yok sayın; hesap açılmaz.</p><p>Veniux</p>`;
  const result = await sendEmail(data.email, 'Veniux deneme hesabınızı onaylayın', text, html);
  if (!result || !result.success) throw fail(503, 'MAIL_FAILED', 'Onay e-postası şu anda gönderilemedi. Biraz sonra tekrar deneyin.');
  lastSent.set(data.email, now);
  return { sent: true };
}

async function confirm(db, token, { central, demoAccount, now = Date.now() } = {}) {
  if (!enabled()) throw fail(503, 'DISABLED', 'Kendi kendine deneme şu anda kapalı.');
  const data = read(token, now);
  if (inFlight.has(data.email)) throw fail(409, 'BUSY', 'Hesabınız hazırlanıyor, birkaç saniye sonra sayfayı yenileyin.');
  inFlight.add(data.email);
  try {
    if ((await db.query('SELECT id FROM users WHERE LOWER(email)=$1', [data.email])).rows.length) throw fail(409, 'USED', 'Bu e-postayla hesap zaten açılmış. Giriş sayfasından girebilir, şifrenizi unuttuysanız sıfırlayabilirsiniz.');
    const today = new Date(now).toISOString().slice(0, 10) + ' 00:00:00';
    const opened = Number((await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE action='demo.created' AND created_at>=$1", [today])).rows[0].n);
    if (opened >= DAILY_LIMIT) throw fail(429, 'DAILY_QUOTA', 'Bugünkü deneme kontenjanı doldu. Yarın tekrar deneyin ya da bize yazın.');
    let issued;
    try { issued = await central.request('/trial', { service_key: serviceKey(), company: data.company }); }
    catch { throw fail(503, 'AUTHORITY', 'Lisans merkezine şu anda ulaşılamadı. Biraz sonra bu sayfayı yenileyin.'); }
    if (!issued || issued.ok !== true || !/^VNX-[A-F0-9]{48}$/.test(issued.license_key || '')) throw fail(429, issued && issued.code === 'OPEN_QUOTA' ? 'OPEN_QUOTA' : 'DAILY_QUOTA', 'Deneme kontenjanı şu anda dolu. Bize yazın, hesabınızı açalım.');
    const account = await demoAccount.create(db, { email: data.email, company: data.company, days: 14 });
    return { email: account.email, password: account.password, license_key: issued.license_key, expires_at: account.expiresAt, activate_url: `${appUrl()}/activate`, login_url: `${appUrl()}/login` };
  } finally {
    inFlight.delete(data.email);
  }
}

module.exports = { enabled, request, confirm, sign, read, normalize, _reset: () => { lastSent.clear(); inFlight.clear(); } };
