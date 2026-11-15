// Online mağaza özel alan adı: işletme kendi alan adını (ör. magaza.firmam.com) bağlar.
// Sahiplik, alan adına eklenen bir DNS TXT kaydıyla doğrulanır; doğrulanmayan alan adı yönlendirilmez.
// Not: HTTPS sertifikası alan adı başına ayrıca sağlanmalıdır (Cloudflare özel ana makine adı veya Plesk).
const crypto = require('crypto');
const dns = require('dns').promises;
const db = require('../config/database');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const HOST = /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const PRIMARY = () => String(process.env.VENIUX_PRIMARY_HOSTS || 'app.veniux.com,veniux.com,www.veniux.com,api.veniux.com,localhost,127.0.0.1').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
const cnameTarget = () => (process.env.VENIUX_SHOP_CNAME || 'app.veniux.com').toLowerCase();
const TXT_PREFIX = '_veniux-verify.';

function cleanDomain(value) {
  let d = String(value || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  if (!HOST.test(d)) fail('Geçerli bir alan adı yazın (örn. magaza.firmam.com).', 422, 'BAD_DOMAIN');
  if (PRIMARY().includes(d) || d === 'veniux.com' || d.endsWith('.veniux.com')) fail('Bu alan adı kullanılamaz.', 422, 'BAD_DOMAIN');
  return d;
}
const shape = r => r ? {
  domain: r.domain, verified: Boolean(r.verified_at), verified_at: r.verified_at || null,
  instructions: { cname: { name: r.domain, value: cnameTarget() }, txt: { name: TXT_PREFIX + r.domain, value: r.verify_token } }
} : null;
async function get(user) {
  const row = (await db.query('SELECT * FROM online_domains WHERE tenant_id=$1', [user.tenantId])).rows[0];
  return { domain: shape(row) };
}
async function save(user, body = {}) {
  const domain = cleanDomain(body.domain);
  const clash = (await db.query('SELECT tenant_id FROM online_domains WHERE domain=$1', [domain])).rows[0];
  if (clash && Number(clash.tenant_id) !== Number(user.tenantId)) fail('Bu alan adı başka bir işletmeye bağlı.', 409, 'DOMAIN_TAKEN');
  const have = (await db.query('SELECT * FROM online_domains WHERE tenant_id=$1', [user.tenantId])).rows[0];
  if (have && have.domain === domain) return get(user);
  const token = 'veniux-verify-' + crypto.randomBytes(12).toString('hex');
  if (have) await db.query('UPDATE online_domains SET domain=$2,verify_token=$3,verified_at=NULL WHERE tenant_id=$1', [user.tenantId, domain, token]);
  else await db.query('INSERT INTO online_domains (tenant_id,domain,verify_token) VALUES ($1,$2,$3)', [user.tenantId, domain, token]);
  cache.clear();
  return get(user);
}
async function remove(user) {
  await db.query('DELETE FROM online_domains WHERE tenant_id=$1', [user.tenantId]);
  cache.clear();
  return { domain: null };
}
// DNS sorgusu yerine test edilebilir bir çözücü (testlerde değiştirilir).
const resolver = { txt: name => dns.resolveTxt(name), cname: name => dns.resolveCname(name) };
async function verify(user) {
  const row = (await db.query('SELECT * FROM online_domains WHERE tenant_id=$1', [user.tenantId])).rows[0];
  if (!row) fail('Önce alan adını kaydedin.', 404, 'NO_DOMAIN');
  let txtOk = false, cnameOk = false;
  try { txtOk = (await resolver.txt(TXT_PREFIX + row.domain)).some(parts => parts.join('') === row.verify_token); } catch { /* kayıt yok */ }
  try { cnameOk = (await resolver.cname(row.domain)).some(v => String(v).replace(/\.$/, '').toLowerCase() === cnameTarget()); } catch { /* CNAME yok (A kaydı olabilir) */ }
  if (txtOk && !row.verified_at) { await db.query('UPDATE online_domains SET verified_at=CURRENT_TIMESTAMP WHERE tenant_id=$1', [user.tenantId]); cache.clear(); }
  const fresh = (await db.query('SELECT * FROM online_domains WHERE tenant_id=$1', [user.tenantId])).rows[0];
  return { domain: shape(fresh), checks: { txt: txtOk, cname: cnameOk } };
}

// Gelen istek: Host başlığı doğrulanmış bir alan adıysa mağaza kimliği döner. Sonuç kısa süre önbelleğe alınır.
const cache = new Map();
async function lookup(host) {
  const key = String(host || '').toLowerCase().replace(/:\d+$/, '');
  if (!key || PRIMARY().includes(key) || /^[\d.]+$/.test(key) || key.includes(':')) return null;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  let value = null;
  const row = (await db.query('SELECT d.tenant_id,s.slug FROM online_domains d JOIN online_stores s ON s.tenant_id=d.tenant_id WHERE d.domain=$1 AND d.verified_at IS NOT NULL AND s.published=1', [key])).rows[0];
  if (row) value = { tenantId: Number(row.tenant_id), slug: row.slug };
  if (cache.size > 500) cache.clear();
  cache.set(key, { value, until: Date.now() + 60000 });
  return value;
}

module.exports = { get, save, remove, verify, lookup, cleanDomain, resolver, clearCache: () => cache.clear() };
