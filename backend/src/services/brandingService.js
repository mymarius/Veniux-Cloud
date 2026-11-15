// İşletmenin marka adı ve logosu. Logo, bayt imzasından doğrulanan PNG/JPEG/WebP'dir (SVG kabul edilmez); veritabanında base64 saklanır
// ve küçük olduğu için oturumlu istekte "data:" adresi olarak döner (<img> etiketi oturum başlığı gönderemediği için ayrı dosya adresi yoktur).
const db = require('../config/database');
const { inspect } = require('./onlineStoreMedia');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const MAX_BYTES = 200 * 1024, MIN_SIDE = 32, MAX_SIDE = 1024;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function cleanName(value) {
  if (value === undefined) return undefined;
  const name = String(value === null ? '' : value).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().replace(/\s+/g, ' ');
  if (name.length > 60) fail('Marka adı en çok 60 karakter olabilir.', 422, 'BAD_NAME');
  return name || null;
}
function readLogo(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(MAX_BYTES * 4 / 3) + 64) fail('Logo çok büyük (en çok 200 KB).', 413, 'LOGO_TOO_BIG');
  const m = DATA_URL.exec(dataUrl);
  if (!m) fail('Logo PNG, JPEG ya da WebP olmalı.', 422, 'BAD_LOGO');
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > MAX_BYTES) fail('Logo çok büyük (en çok 200 KB).', 413, 'LOGO_TOO_BIG');
  const info = inspect(buffer);
  if (!info || info.mime !== m[1]) fail('Dosya, belirtilen görsel türüyle uyuşmuyor.', 422, 'BAD_LOGO');
  if (info.width < MIN_SIDE || info.height < MIN_SIDE || info.width > MAX_SIDE || info.height > MAX_SIDE) fail(`Logo ${MIN_SIDE}-${MAX_SIDE} piksel arasında olmalı.`, 422, 'BAD_LOGO_SIZE');
  return { mime: info.mime, data: m[2], width: info.width, height: info.height };
}
async function get(tenantId) {
  const row = (await db.query('SELECT brand_name, logo_mime, logo_data, logo_width, logo_height, updated_at FROM tenant_branding WHERE tenant_id=$1', [tenantId])).rows[0];
  if (!row) return { brand_name: '', logo: null, logo_width: null, logo_height: null, updated_at: null };
  return { brand_name: row.brand_name || '', logo: row.logo_data ? `data:${row.logo_mime};base64,${row.logo_data}` : null, logo_width: row.logo_width == null ? null : Number(row.logo_width), logo_height: row.logo_height == null ? null : Number(row.logo_height), updated_at: row.updated_at };
}
async function save(user, body = {}) {
  const name = cleanName(body.brand_name);
  const logo = body.logo_data_url ? readLogo(body.logo_data_url) : null;
  const remove = body.remove_logo === true;
  const have = (await db.query('SELECT tenant_id FROM tenant_branding WHERE tenant_id=$1', [user.tenantId])).rows[0];
  await db.transaction(async tx => {
    if (!have) await tx.query('INSERT INTO tenant_branding (tenant_id) VALUES ($1)', [user.tenantId]);
    if (name !== undefined) await tx.query('UPDATE tenant_branding SET brand_name=$2,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1', [user.tenantId, name]);
    if (logo) await tx.query('UPDATE tenant_branding SET logo_mime=$2,logo_data=$3,logo_width=$4,logo_height=$5,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1', [user.tenantId, logo.mime, logo.data, logo.width, logo.height]);
    else if (remove) await tx.query('UPDATE tenant_branding SET logo_mime=NULL,logo_data=NULL,logo_width=NULL,logo_height=NULL,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1', [user.tenantId]);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)', [user.tenantId, user.email || null, 'branding.updated', 'branding', JSON.stringify({ name: name === undefined ? undefined : name, logo: logo ? { bytes: Buffer.from(logo.data, 'base64').length, width: logo.width, height: logo.height } : remove ? 'removed' : undefined })]);
  });
  return get(user.tenantId);
}

module.exports = { get, save, MAX_BYTES };
