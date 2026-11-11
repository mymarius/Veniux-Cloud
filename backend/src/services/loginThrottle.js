// Hesap başına giriş denemesi sınırı. IP başına sınır (express-rate-limit) tek başına yetmez:
// saldırgan çok sayıda IP kullanarak tek bir hesabın parolasını deneyebilir.
// Aynı e-posta için pencere içinde MAX hatalı denemeden sonra giriş geçici olarak kapanır; başarılı giriş sayacı sıfırlar.
// Sayaç bellekte tutulur (tek süreç). Süreç yeniden başlarsa sıfırlanır; bu bilinçli bir sadelik: kilit, kalıcı bir hizmet reddi aracı olmaz.
const WINDOW_MS = Number(process.env.LOGIN_LOCK_WINDOW_MS) || 15 * 60 * 1000;
const MAX = Number(process.env.LOGIN_LOCK_MAX) || 8;
const MAX_KEYS = 20000;
const attempts = new Map();

const key = email => String(email || '').trim().toLowerCase().slice(0, 254);

function prune(now) {
  if (attempts.size < MAX_KEYS) return;
  for (const [k, v] of attempts) if (now - v.first > WINDOW_MS) attempts.delete(k);
  if (attempts.size >= MAX_KEYS) attempts.clear();
}

// Kilitliyse kalan saniyeyi, değilse 0 döndürür.
function retryAfter(email, now = Date.now()) {
  const entry = attempts.get(key(email));
  if (!entry) return 0;
  if (now - entry.first > WINDOW_MS) { attempts.delete(key(email)); return 0; }
  return entry.count >= MAX ? Math.max(1, Math.ceil((entry.first + WINDOW_MS - now) / 1000)) : 0;
}

function fail(email, now = Date.now()) {
  const k = key(email);
  if (!k) return;
  prune(now);
  const entry = attempts.get(k);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(k, { count: 1, first: now });
  else entry.count += 1;
}

function clear(email) { attempts.delete(key(email)); }
function reset() { attempts.clear(); }

module.exports = { retryAfter, fail, clear, reset, MAX, WINDOW_MS };
