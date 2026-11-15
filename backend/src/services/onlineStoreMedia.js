// Ürün görselleri (online mağaza): doğrulama, depolama, silme, sıralama.
// Görsel tarayıcıda küçültülüp WebP/JPEG'e çevrilir (EXIF kendiliğinden silinir); sunucu bayt imzasını, boyutu ve en/boy sınırını doğrular, olduğu gibi saklar.
// Dosya yolu yalnız veritabanı kaydından (işletme no + rastgele anahtar) kurulur; kullanıcı girdisi dosya adına girmez.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const runtimeConfig = require('../config/runtimeConfig');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PER_PRODUCT = 5;
const QUOTA_BYTES = 300 * 1024 * 1024;
const MAX_SIDE = 4096, MIN_SIDE = 50;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const root = () => path.join(runtimeConfig.paths().data, 'online-media');
const pathOf = row => (row && Number.isSafeInteger(Number(row.tenant_id)) && /^[A-Za-z0-9_-]{16,64}$/.test(String(row.file_key)) && EXT[row.mime]
  ? path.join(root(), String(Number(row.tenant_id)), row.file_key + '.' + EXT[row.mime]) : null);

// Bayt imzasından tür ve boyut okunur; başlıktaki Content-Type'a ve dosya adına güvenilmez.
function inspect(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buffer.toString('ascii', 12, 16) === 'IHDR') return { mime: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) { i += 1; continue; }
      const marker = buffer[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = buffer.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { mime: 'image/jpeg', height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      i += 2 + length;
    }
    return null;
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buffer.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return { mime: 'image/webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const bits = buffer.readUInt32LE(21); return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
    if (kind === 'VP8X') return { mime: 'image/webp', width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  return null;
}

async function ownProduct(user, productId) {
  const id = Number(productId);
  const row = Number.isSafeInteger(id) ? (await db.query("SELECT id FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [id, user.tenantId])).rows[0] : null;
  if (!row) fail('Ürün bulunamadı.', 404);
  return id;
}
const shape = (row, slug) => ({ id: Number(row.id), key: row.file_key, position: Number(row.position), alt: row.alt || '', width: row.width == null ? null : Number(row.width), height: row.height == null ? null : Number(row.height), bytes: Number(row.bytes), mime: row.mime, ...(slug ? { url: `/api/public/shop/${slug}/media/${row.file_key}` } : {}) });

async function list(user, productId) {
  const id = await ownProduct(user, productId);
  return { items: (await db.query('SELECT * FROM online_product_media WHERE tenant_id=$1 AND product_id=$2 ORDER BY position,id', [user.tenantId, id])).rows.map(r => shape(r)) };
}
async function save(user, productId, buffer, alt) {
  const id = await ownProduct(user, productId);
  if (!Buffer.isBuffer(buffer) || !buffer.length) fail('Görsel dosyası boş.');
  if (buffer.length > MAX_BYTES) fail('Görsel en çok 2 MB olabilir. Küçültüp tekrar deneyin.', 413, 'TOO_LARGE');
  const info = inspect(buffer);
  if (!info) fail('Yalnız JPEG, PNG veya WebP görsel yüklenebilir.', 415, 'BAD_IMAGE');
  if (info.width < MIN_SIDE || info.height < MIN_SIDE || info.width > MAX_SIDE || info.height > MAX_SIDE) fail(`Görsel ${MIN_SIDE}-${MAX_SIDE} piksel arasında olmalı.`, 422, 'BAD_DIMENSIONS');
  const used = (await db.query('SELECT COUNT(*) AS n,COALESCE(SUM(bytes),0) AS b FROM online_product_media WHERE tenant_id=$1', [user.tenantId])).rows[0];
  const own = Number((await db.query('SELECT COUNT(*) AS n FROM online_product_media WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id])).rows[0].n);
  if (own >= MAX_PER_PRODUCT) fail(`Bir ürüne en çok ${MAX_PER_PRODUCT} görsel eklenebilir.`, 409, 'TOO_MANY');
  if (Number(used.b) + buffer.length > QUOTA_BYTES) fail('Görsel depolama kotası doldu (300 MB). Kullanılmayan görselleri silin.', 409, 'QUOTA');
  const key = crypto.randomBytes(24).toString('base64url');
  const row = { tenant_id: user.tenantId, file_key: key, mime: info.mime };
  const file = pathOf(row);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, buffer, { mode: 0o600 });
  fs.renameSync(temp, file);
  try {
    const next = (await db.query('SELECT COALESCE(MAX(position),-1)+1 AS p FROM online_product_media WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id])).rows[0].p;
    const inserted = (await db.query('INSERT INTO online_product_media (tenant_id,product_id,position,file_key,mime,bytes,width,height,alt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [user.tenantId, id, Number(next), key, info.mime, buffer.length, info.width, info.height, String(alt || '').trim().slice(0, 140) || null])).rows[0];
    return shape(inserted);
  } catch (error) { try { fs.unlinkSync(file); } catch { /* dosya yoksa sorun değil */ } throw error; }
}
async function remove(user, productId, mediaId) {
  const id = await ownProduct(user, productId);
  const row = (await db.query('SELECT * FROM online_product_media WHERE id=$1 AND tenant_id=$2 AND product_id=$3', [Number(mediaId), user.tenantId, id])).rows[0];
  if (!row) fail('Görsel bulunamadı.', 404);
  await db.transaction(async tx => {
    await tx.query('DELETE FROM online_product_media WHERE id=$1 AND tenant_id=$2', [row.id, user.tenantId]);
    const rest = (await tx.query('SELECT id FROM online_product_media WHERE tenant_id=$1 AND product_id=$2 ORDER BY position,id', [user.tenantId, id])).rows;
    for (let i = 0; i < rest.length; i += 1) await tx.query('UPDATE online_product_media SET position=$1 WHERE id=$2 AND tenant_id=$3', [i, rest[i].id, user.tenantId]);
  });
  const file = pathOf(row);
  try { if (file) fs.unlinkSync(file); } catch { /* dosya zaten yoksa sorun değil */ }
  return { removed: Number(row.id) };
}
async function reorder(user, productId, body = {}) {
  const id = await ownProduct(user, productId);
  const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
  const have = (await db.query('SELECT id FROM online_product_media WHERE tenant_id=$1 AND product_id=$2 ORDER BY position,id', [user.tenantId, id])).rows.map(r => Number(r.id));
  if (ids.length !== have.length || new Set(ids).size !== ids.length || ids.some(v => !have.includes(v))) fail('Sıralama listesi mevcut görsellerle eşleşmiyor.');
  await db.transaction(async tx => { for (let i = 0; i < ids.length; i += 1) await tx.query('UPDATE online_product_media SET position=$1 WHERE id=$2 AND tenant_id=$3', [i, ids[i], user.tenantId]); });
  return list(user, id);
}
async function setAlt(user, productId, mediaId, body = {}) {
  const id = await ownProduct(user, productId);
  const row = (await db.query('SELECT id FROM online_product_media WHERE id=$1 AND tenant_id=$2 AND product_id=$3', [Number(mediaId), user.tenantId, id])).rows[0];
  if (!row) fail('Görsel bulunamadı.', 404);
  await db.query('UPDATE online_product_media SET alt=$1 WHERE id=$2 AND tenant_id=$3', [String(body.alt || '').trim().slice(0, 140) || null, Number(mediaId), user.tenantId]);
  return list(user, id);
}
// Yönetici önizlemesi: oturumlu; yalnız kendi işletmesinin görseli.
async function ownFile(user, key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) fail('Görsel bulunamadı.', 404);
  const row = (await db.query('SELECT * FROM online_product_media WHERE tenant_id=$1 AND file_key=$2', [user.tenantId, key])).rows[0];
  const file = row && pathOf(row);
  if (!file || !fs.existsSync(file)) fail('Görsel bulunamadı.', 404);
  return { file, mime: row.mime };
}

module.exports = { pathOf, root, inspect, list, save, remove, reorder, setAlt, ownFile, MAX_BYTES, MAX_PER_PRODUCT, QUOTA_BYTES };
