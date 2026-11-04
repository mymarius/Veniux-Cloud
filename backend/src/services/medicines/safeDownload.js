const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const dns = require('dns').promises;

// SSRF'e karşı korumalı indirme: yalnızca https, yalnızca izinli alan adları,
// özel/yerel IP'ler reddedilir, yönlendirmeler tek tek denetlenir, boyut sınırlı.

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
const isPrivateIp = ip => (net.isIPv6(ip) ? /^(::1|fc|fd|fe80|::ffff:(10|127|192\.168|169\.254))/i.test(ip) : PRIVATE_V4.some(r => r.test(ip)));

function hostAllowed(hostname, allowedHosts) {
  const host = hostname.toLowerCase();
  return allowedHosts.map(h => h.trim().toLowerCase()).filter(Boolean).some(h => host === h || host.endsWith('.' + h));
}

async function assertSafeUrl(raw, allowedHosts) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Geçersiz adres.'); }
  if (url.protocol !== 'https:') throw new Error('Yalnızca https adreslerine izin verilir.');
  if (url.username || url.password) throw new Error('Kimlik bilgisi içeren adreslere izin verilmez.');
  if (!hostAllowed(url.hostname, allowedHosts)) throw new Error(`İzin verilmeyen alan adı: ${url.hostname}`);
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) throw new Error('Yerel veya özel ağ adreslerine izin verilmez.');
  return url;
}

// Retry the entire transfer, including DNS and body reads, with a fresh timeout.
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);
function isTransient(error) {
  return error.name === 'AbortError' || TRANSIENT_CODES.has(error.code) || TRANSIENT_CODES.has(error.cause?.code) || error.retryable === true;
}

async function fetchOnce(raw, { allowedHosts, maxBytes, timeoutMs = 60000, accept }) {
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await assertSafeUrl(current, allowedHosts);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: 'manual', signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Veniux-MedicineSync/1.0)', Connection: 'close', ...(accept ? { Accept: accept } : {}) }
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        current = new URL(response.headers.get('location'), url).toString();
        continue;
      }
      if (!response.ok) {
        throw Object.assign(new Error('Kaynak HTTP ' + response.status + ' döndürdü.'), { retryable: [408, 502, 503, 504].includes(response.status) });
      }
      if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new Error('Dosya boyut sınırını aşıyor.');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error('Dosya boyut sınırını aşıyor.');
        chunks.push(Buffer.from(chunk));
      }
      return { buffer: Buffer.concat(chunks), contentType: response.headers.get('content-type') || '', finalUrl: url.toString() };
    } finally { clearTimeout(timer); controller.abort(); }
  }
  throw new Error('Çok fazla yönlendirme.');
}

async function fetchSafely(raw, options) {
  for (let attempt = 0; ; attempt++) {
    try { return await fetchOnce(raw, options); }
    catch (error) {
      if (isTransient(error) && attempt < (options.retries ?? 3)) {
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
        continue;
      }
      const code = error.cause?.code || error.code;
      if (isTransient(error) || code) {
        throw Object.assign(new Error(error.name === 'AbortError' ? 'Zaman aşımı.' : 'Bağlantı kurulamadı (' + (code || error.message) + ').'), { cause: error, retryable: isTransient(error) });
      }
      throw error;
    }
  }
}

async function downloadToFile(raw, dir, options) {
  const { buffer, finalUrl } = await fetchSafely(raw, options);
  fs.mkdirSync(dir, { recursive: true });
  const ext = (path.extname(new URL(finalUrl).pathname).toLowerCase().match(/^\.(xlsx|xls|csv)$/) || ['.xlsx'])[0];
  const file = path.join(dir, `download-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  fs.writeFileSync(file, buffer);
  return file;
}

module.exports = { fetchSafely, downloadToFile, assertSafeUrl, hostAllowed };
