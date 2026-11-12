// Giriş denemesi sınırı. İki katmanlıdır:
//  1) (e-posta, istemci adresi) çifti başına MAX hatalı denemede o istemcinin o hesaba girişi geçici kapanır.
//     Kilit istemciye bağlı olduğu için başkasının hatalı denemeleri hesabın gerçek sahibini kilitlemez.
//  2) E-posta başına yüksek bir tavan (EMAIL_CEILING): çok sayıda adresten dağıtık parola denemesini sınırlar.
// Başarılı giriş o çiftin sayacını sıfırlar. Sayaçlar bellektedir (tek süreç); süreç yeniden başlarsa sıfırlanır.
const WINDOW_MS = Number(process.env.LOGIN_LOCK_WINDOW_MS) || 15 * 60 * 1000;
const MAX = Number(process.env.LOGIN_LOCK_MAX) || 8;
const EMAIL_CEILING = Number(process.env.LOGIN_EMAIL_CEILING) || 200;
const MAX_KEYS = 20000;
const pairs = new Map();
const emails = new Map();

const email_ = email => String(email || '').trim().toLowerCase().slice(0, 254);
const address_ = address => String(address || 'unknown').slice(0, 64);
const pairKey = (email, address) => email_(email) + '|' + address_(address);

function prune(map, now) {
  if (map.size < MAX_KEYS) return;
  for (const [k, v] of map) if (now - v.first > WINDOW_MS) map.delete(k);
  if (map.size >= MAX_KEYS) map.clear();
}

function remaining(map, key, limit, now) {
  const entry = map.get(key);
  if (!entry) return 0;
  if (now - entry.first > WINDOW_MS) { map.delete(key); return 0; }
  return entry.count >= limit ? Math.max(1, Math.ceil((entry.first + WINDOW_MS - now) / 1000)) : 0;
}

function bump(map, key, now) {
  prune(map, now);
  const entry = map.get(key);
  if (!entry || now - entry.first > WINDOW_MS) map.set(key, { count: 1, first: now });
  else entry.count += 1;
}

// Kilitliyse kalan saniyeyi, değilse 0 döndürür.
function retryAfter(email, address, now = Date.now()) {
  if (!email_(email)) return 0;
  return Math.max(remaining(pairs, pairKey(email, address), MAX, now), remaining(emails, email_(email), EMAIL_CEILING, now));
}

function fail(email, address, now = Date.now()) {
  if (!email_(email)) return;
  bump(pairs, pairKey(email, address), now);
  bump(emails, email_(email), now);
}

// Başarılı giriş yalnız o istemcinin sayacını sıfırlar; e-posta tavanı pencere dolana kadar sürer.
function clear(email, address) { pairs.delete(pairKey(email, address)); }
function reset() { pairs.clear(); emails.clear(); }

module.exports = { retryAfter, fail, clear, reset, MAX, EMAIL_CEILING, WINDOW_MS };
