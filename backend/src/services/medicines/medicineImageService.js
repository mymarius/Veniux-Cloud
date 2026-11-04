const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = require('./medicineRepository');
const { fetchSafely, hostAllowed } = require('./safeDownload');
const { safeHttpsUrl } = require('./normalize');

// Görsel önceliği: 1) kaynağın resmi görseli  2) üreticinin resmi görseli
// 3) elle yüklenen görsel  4) arayüzde "Görsel bulunamadı" yer tutucusu.
// Barkodla kesin eşleşmeyen hiçbir görsel otomatik "doğrulandı" sayılmaz.

const DIR = path.join(process.env.MEDICINE_STORAGE_DIR || require('../../config/runtimeConfig').paths().storage, 'medicine-images');
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const SOURCES = ['provider', 'manufacturer', 'manual'];

// MIME türü istemcinin söylediğine değil dosyanın imzasına göre belirlenir.
function detectType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function writeImage(medicineId, buffer) {
  const ext = detectType(buffer);
  if (!ext) throw Object.assign(new Error('Yalnızca JPEG, PNG veya WEBP görseller kabul edilir.'), { status: 415 });
  if (buffer.length > MAX_BYTES) throw Object.assign(new Error('Görsel en fazla 2 MB olabilir.'), { status: 413 });
  fs.mkdirSync(DIR, { recursive: true });
  const name = `medicine-${medicineId}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(DIR, name), buffer);
  return name; // veritabanında yalnızca dosya adı tutulur (yol enjeksiyonu yok)
}

function removeLocal(name) {
  if (!name || name !== path.basename(name)) return;
  fs.rm(path.join(DIR, name), { force: true }, () => {});
}

async function upload(medicineId, buffer) {
  const medicine = await repo.findById(medicineId);
  const name = writeImage(medicineId, buffer);
  removeLocal(medicine.image_local_path);
  // Yönetici kendi yüklediği görselin doğru ilaca ait olduğunu onaylamış sayılır.
  await repo.update(medicineId, { image_local_path: name, image_source: 'manual', image_verified: 1, manual_override: medicine.source === 'manual' ? 0 : 1 });
}

// Uzak görsel adresi: yalnızca https. İndirilmez, kaydedilir; doğrulama yöneticinin kararıdır.
async function setRemote(medicineId, { imageUrl, imageSource = 'manufacturer', verified = false }) {
  const medicine = await repo.findById(medicineId);
  const url = imageUrl ? safeHttpsUrl(imageUrl) : null;
  if (imageUrl && !url) throw Object.assign(new Error('Görsel adresi https ile başlamalıdır.'), { status: 400 });
  if (!SOURCES.includes(imageSource)) throw Object.assign(new Error('Geçersiz görsel kaynağı.'), { status: 400 });
  const changed = url !== medicine.image_url;
  if (changed && medicine.image_local_path && medicine.image_source !== 'manual') removeLocal(medicine.image_local_path);
  await repo.update(medicineId, {
    image_url: url,
    image_source: url || medicine.image_local_path ? imageSource : null,
    image_local_path: changed && medicine.image_source !== 'manual' ? null : medicine.image_local_path,
    image_verified: verified ? 1 : 0,
    manual_override: medicine.source === 'manual' ? 0 : 1
  });
}

async function setVerified(medicineId, verified) {
  await repo.update(medicineId, { image_verified: verified ? 1 : 0 });
}

async function clear(medicineId) {
  const medicine = await repo.findById(medicineId);
  removeLocal(medicine.image_local_path);
  await repo.update(medicineId, { image_url: null, image_local_path: null, image_source: null, image_verified: 0, manual_override: medicine.source === 'manual' ? 0 : 1 });
}

// Uzak görseli yerel depoya kopyalar. Yalnızca kullanım izni bilinen ve
// MEDICINE_IMAGE_CACHE_HOSTS ile açıkça izin verilen alan adları için.
const cacheHosts = () => (process.env.MEDICINE_IMAGE_CACHE_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean);
async function cacheRemote(medicineId) {
  const medicine = await repo.findById(medicineId);
  if (!medicine.image_url) throw Object.assign(new Error('Önbelleğe alınacak uzak görsel yok.'), { status: 400 });
  const host = new URL(medicine.image_url).hostname;
  if (!cacheHosts().length || !hostAllowed(host, cacheHosts())) {
    throw Object.assign(new Error(`${host} için görsel kopyalama izni tanımlı değil. Kullanım izni varsa MEDICINE_IMAGE_CACHE_HOSTS ayarına ekleyin.`), { status: 403 });
  }
  const { buffer } = await fetchSafely(medicine.image_url, { allowedHosts: cacheHosts(), maxBytes: MAX_BYTES, timeoutMs: 15000, accept: 'image/*' });
  const name = writeImage(medicineId, buffer);
  removeLocal(medicine.image_local_path);
  await repo.update(medicineId, { image_local_path: name });
}

// Sunum: yerel dosya varsa o, yoksa https uzak adrese yönlendirme.
function resolve(medicine) {
  if (medicine.image_local_path) {
    const file = path.join(DIR, path.basename(medicine.image_local_path));
    if (fs.existsSync(file)) return { file, type: TYPES[path.extname(file).slice(1)] || 'application/octet-stream' };
  }
  if (medicine.image_url && safeHttpsUrl(medicine.image_url)) return { redirect: medicine.image_url };
  return null;
}

module.exports = { upload, setRemote, setVerified, clear, cacheRemote, resolve, detectType, cacheHosts, removeLocal, MAX_BYTES };
