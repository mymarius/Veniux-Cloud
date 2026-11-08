// Sunucu dışı yedek: zaten şifreli yedek dosyası S3 uyumlu depolamaya (Backblaze B2, Cloudflare R2, Hetzner…) yüklenir.
// Şifreleme anahtarı hiçbir zaman gönderilmez. Ek kütüphane yok: AWS Signature Version 4 burada hesaplanır.
const crypto = require('crypto');

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const encodePath = value => value.split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/');

const KEYS = ['OFFSITE_S3_ENDPOINT', 'OFFSITE_S3_REGION', 'OFFSITE_S3_BUCKET', 'OFFSITE_S3_KEY_ID', 'OFFSITE_S3_SECRET', 'OFFSITE_S3_PREFIX'];
// Ayarlar ortamdan, yoksa veri klasöründeki integrations.env dosyasından okunur (sunucu başlatıcısı bu anahtarları aktarmaz).
function settings() {
  if (process.env.OFFSITE_S3_BUCKET) return process.env;
  try {
    const file = require('path').join(process.env.VENIUX_DATA_DIR || '', 'integrations.env');
    const parsed = require('util').parseEnv(require('fs').readFileSync(file, 'utf8'));
    return Object.fromEntries(KEYS.filter(k => parsed[k]).map(k => [k, parsed[k]]));
  } catch { return {}; }
}
function config() {
  const env = settings();
  if (!env.OFFSITE_S3_ENDPOINT || !env.OFFSITE_S3_BUCKET || !env.OFFSITE_S3_KEY_ID || !env.OFFSITE_S3_SECRET) return null;
  const endpoint = new URL(env.OFFSITE_S3_ENDPOINT);
  if (endpoint.protocol !== 'https:') throw Object.assign(Error('Sunucu dışı yedek adresi HTTPS olmalı.'), { status: 400 });
  return { host: endpoint.host, region: env.OFFSITE_S3_REGION || 'us-east-1', bucket: env.OFFSITE_S3_BUCKET, keyId: env.OFFSITE_S3_KEY_ID, secret: env.OFFSITE_S3_SECRET, prefix: (env.OFFSITE_S3_PREFIX || 'veniux').replace(/^\/+|\/+$/g, '') };
}

// Header imzalı istek (path-style). headers: imzalanacak ek başlıklar, küçük harf anahtarlarla.
function sign({ method, host, path, region, keyId, secret, payloadHash, amzDate, headers = {} }) {
  const date = amzDate.slice(0, 8), scope = `${date}/${region}/s3/aws4_request`;
  const all = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...headers };
  const names = Object.keys(all).map(n => n.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')]));
  const canonical = [method, encodePath(path), '', names.map(n => `${n}:${lower[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4' + secret, date), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
  return { authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`, headers: lower, signature };
}

async function request(method, name, body, cfg = config(), now = new Date()) {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const path = `/${cfg.bucket}/${cfg.prefix ? cfg.prefix + '/' : ''}${name}`, payloadHash = sha256(body || '');
  const extra = body ? { 'content-length': String(body.length), 'content-type': 'application/octet-stream' } : {};
  const signed = sign({ method, host: cfg.host, path, region: cfg.region, keyId: cfg.keyId, secret: cfg.secret, payloadHash, amzDate, headers: extra });
  const { host, ...headers } = signed.headers;
  return fetch(`https://${cfg.host}${encodePath(path)}`, { method, headers: { ...headers, authorization: signed.authorization }, body, redirect: 'error', signal: AbortSignal.timeout(120000) });
}

// Yükler, sonra boyutu HEAD ile doğrular. Hata ayrıntısı (anahtar, adres) kullanıcıya gösterilmez.
async function upload(name, buffer) {
  const cfg = config();
  if (!cfg) return { status: 'none' };
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(name)) throw Error('Geçersiz yedek adı.');
  try {
    const put = await request('PUT', name, buffer, cfg);
    if (!put.ok) throw Error('put ' + put.status);
    const head = await request('HEAD', name, null, cfg);
    if (!head.ok || Number(head.headers.get('content-length')) !== buffer.length) throw Error('head ' + head.status);
    return { status: 'ok', at: new Date().toISOString() };
  } catch {
    return { status: 'failed', error: 'Yedek sunucu dışı depolamaya yüklenemedi. Erişim anahtarını ve bağlantıyı kontrol edin.' };
  }
}

async function remove(name) {
  const cfg = config();
  if (!cfg || !/^[A-Za-z0-9._-]{1,200}$/.test(name)) return;
  try { await request('DELETE', name, null, cfg); } catch { /* Silinemeyen eski kopya bir sonraki temizlikte yeniden denenmez; depolama kotası büyük. */ }
}

module.exports = { config, sign, upload, remove };
