// Genel API hız sınırı: oturumlu kullanıcı ya da cihaz başına dakikalık üst sınır, kimliksiz istekte IP başına daha düşük sınır.
// Amaç tek bir hesabın ya da botun listeleri sınırsız hızla çekmesini zorlaştırmak; olağan kullanım sınırların çok altındadır.
// Hesap başına giriş sınırı (loginThrottle) ve rota başına sınırlar (giriş, şifre sıfırlama) ayrıca çalışır.
const crypto = require('crypto');

const WINDOW_MS = 60 * 1000;
const AUTH_MAX = Number(process.env.API_THROTTLE_AUTH_MAX) || 1200;
const ANON_MAX = Number(process.env.API_THROTTLE_ANON_MAX) || 240;
const MAX_KEYS = 50000;
const buckets = new Map();

const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);

function identity(req) {
  const bearer = /^Bearer\s+(\S{20,})$/i.exec(req.headers.authorization || '');
  if (bearer) return { key: 'u:' + sha(bearer[1]), max: AUTH_MAX };
  const device = req.headers['x-veniux-device-token'];
  if (typeof device === 'string' && device.length >= 20) return { key: 'd:' + sha(device), max: AUTH_MAX };
  return { key: 'i:' + clientAddress(req), max: ANON_MAX };
}

// Uygulama bir ters vekilin (nginx/Passenger) arkasında çalışırken bağlantı adresi vekilin adresidir; herkes tek IP görünür.
// Bağlantı yerel vekilden geliyorsa vekilin eklediği en sağdaki X-Forwarded-For girdisi gerçek istemcidir.
// Soldaki girdiler istemci tarafından yazılabildiği için kullanılmaz. Doğrudan bağlantılarda başlığa güvenilmez.
function clientAddress(req) {
  const remote = String(req.socket?.remoteAddress || '');
  const fromProxy = !remote || remote === '::1' || remote.startsWith('127.') || remote.startsWith('::ffff:127.');
  if (fromProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(part => part.trim()).filter(Boolean);
    if (forwarded.length) return forwarded[forwarded.length - 1].slice(0, 64);
  }
  return remote || 'unknown';
}

function prune(now) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, bucket] of buckets) if (now - bucket.start >= WINDOW_MS) buckets.delete(key);
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

function apiThrottle(req, res, next) {
  if (process.env.NODE_ENV === 'test' && !process.env.API_THROTTLE_TEST) return next();
  if (req.method === 'OPTIONS') return next();
  const now = Date.now();
  const { key, max } = identity(req);
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    prune(now);
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    const wait = Math.max(1, Math.ceil((bucket.start + WINDOW_MS - now) / 1000));
    res.set('Retry-After', String(wait));
    return res.status(429).json({ error: 'Çok fazla istek. Kısa bir süre sonra tekrar deneyin.' });
  }
  next();
}

apiThrottle.reset = () => buckets.clear();
apiThrottle.clientAddress = clientAddress;
module.exports = apiThrottle;
