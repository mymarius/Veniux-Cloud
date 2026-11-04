const crypto = require('crypto');
const repo = require('./medicineRepository');
const { parseProductName } = require('./parseProductName');
const { normalizeSearch, cleanText, cleanBarcode, toGtin, parsePrice, parseDate, normalizeStatus, safeHttpsUrl } = require('./normalize');

const MARKET_STATUSES = ['active', 'suspended', 'passive'];
const HASHED = ['name', 'active_ingredient', 'dosage', 'pharmaceutical_form', 'package_size', 'manufacturer', 'company', 'prescription_type', 'atc_code', 'market_status', 'price', 'kub_url', 'kt_url', 'license_date', 'license_number'];

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Sağlayıcının standart kaydını veritabanı satırına çevirir.
// Geçersiz kayıtlar için { error } döner (senkronizasyonda "hatalı" sayılır).
function toRow(record, source) {
  const barcode = cleanBarcode(record.barcode);
  const name = cleanText(record.name, 300);
  // Kaynakta barkodu hiç olmayan ürünler hata değil; eşleştirilemedikleri için atlanır.
  if (!barcode && !cleanText(record.barcode)) return { error: 'Kaynakta barkodu yok', skip: true };
  if (!barcode) return { error: 'Geçersiz barkod' };
  if (!name) return { error: 'İlaç adı eksik' };
  const activeIngredient = cleanText(record.activeIngredient, 500);
  // Kaynak doz / form / paket vermiyorsa resmi ürün adından çıkarılır.
  const fromName = parseProductName(name);
  const company = cleanText(record.company, 200);
  const atc = cleanText(record.atcCode, 20)?.toUpperCase().replace(/\s/g, '') || null;
  const row = {
    barcode,
    gtin: toGtin(barcode),
    name,
    normalized_name: normalizeSearch(name),
    active_ingredient: activeIngredient,
    normalized_ingredient: normalizeSearch(activeIngredient) || null,
    dosage: cleanText(record.dosage, 200) || fromName.dosage,
    pharmaceutical_form: cleanText(record.pharmaceuticalForm, 200) || fromName.pharmaceuticalForm,
    package_size: cleanText(record.packageSize, 200) || fromName.packageSize,
    manufacturer: cleanText(record.manufacturer, 200),
    company,
    normalized_company: normalizeSearch(company) || null,
    prescription_type: cleanText(record.prescriptionType, 80),
    atc_code: atc && /^[A-Z0-9]{1,10}$/.test(atc) ? atc : null,
    license_date: parseDate(record.licenseDate),
    license_number: cleanText(record.licenseNumber, 100),
    market_status: MARKET_STATUSES.includes(record.marketStatus) ? record.marketStatus : normalizeStatus(record.marketStatus),
    price: parsePrice(record.price),
    currency: cleanText(record.currency, 8) || 'TRY',
    kub_url: safeHttpsUrl(record.kubUrl),
    kt_url: safeHttpsUrl(record.ktUrl),
    source,
    source_url: safeHttpsUrl(record.sourceUrl)
  };
  row.search_text = [row.normalized_name, row.normalized_ingredient, row.normalized_company, normalizeSearch(row.manufacturer), barcode, row.atc_code?.toLowerCase()].filter(Boolean).join(' ');
  row.data_hash = crypto.createHash('sha1').update(JSON.stringify(HASHED.map(k => row[k] ?? null))).digest('hex');
  return { row, image: safeHttpsUrl(record.image) };
}

// API çıktısı: dış kaynak HTML'i içermez, görsel yalnızca kendi uç noktamızdan sunulur.
function toDto(m) {
  if (!m) return null;
  const hasImage = Boolean(m.image_local_path || m.image_url);
  return {
    id: m.id,
    barcode: m.barcode,
    gtin: m.gtin,
    name: m.name,
    activeIngredient: m.active_ingredient,
    dosage: m.dosage,
    pharmaceuticalForm: m.pharmaceutical_form,
    packageSize: m.package_size,
    manufacturer: m.manufacturer,
    company: m.company,
    prescriptionType: m.prescription_type,
    atcCode: m.atc_code,
    licenseDate: m.license_date ? String(m.license_date).slice(0, 10) : null,
    licenseNumber: m.license_number,
    marketStatus: m.market_status,
    price: m.price === null || m.price === undefined ? null : Number(m.price),
    currency: m.currency,
    image: hasImage ? `/medicines/${m.id}/image?v=${encodeURIComponent(String(m.updated_at || '').replace(/\D/g, ''))}` : null,
    imageLookup: !hasImage ? `/medicines/${m.id}/image` : null,
    imageSource: hasImage ? m.image_source : null,
    imageVerified: Boolean(m.image_verified),
    imageUrl: m.image_url,
    imageCached: Boolean(m.image_local_path),
    kubUrl: m.kub_url,
    ktUrl: m.kt_url,
    source: m.source,
    sourceUrl: m.source_url,
    manualOverride: Boolean(m.manual_override),
    lastSyncedAt: m.last_synced_at,
    createdAt: m.created_at,
    updatedAt: m.updated_at
  };
}

// Damerau–Levenshtein (kısa kelimeler için, erken çıkışlı)
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

function readFilters(query) {
  const text = normalizeSearch(query.q || query.search || '').slice(0, 100);
  const digits = /^\d{4,14}$/.test(String(query.q || '').trim()) ? String(query.q).trim() : null;
  return {
    text,
    digits,
    company: normalizeSearch(query.company) || null,
    activeIngredient: normalizeSearch(query.activeIngredient || query.active_ingredient) || null,
    atc: /^[A-Za-z0-9]{1,10}$/.test(query.atc || query.atcCode || '') ? String(query.atc || query.atcCode) : null,
    prescriptionType: cleanText(query.prescriptionType,80)||null,
    marketStatus: MARKET_STATUSES.includes(query.marketStatus) ? query.marketStatus : null,
    source: /^[a-z0-9_-]{1,40}$/.test(query.source || '') ? query.source : null,
    image: ['missing', 'unverified', 'verified'].includes(query.image) ? query.image : null,
    page: query.page,
    limit: query.limit
  };
}

async function search(query, { includeAll = false } = {}) {
  const f = readFilters(query);
  const base = { ...f, includeAll: includeAll || f.marketStatus === 'passive' };
  if (f.digits) {
    const result = await repo.search({ ...base, barcodePrefix: f.digits });
    if (result.total) return { ...result, rows: result.rows.map(toDto), fuzzy: false };
  }
  const tokens = f.text ? f.text.split(' ').filter(Boolean).slice(0, 6) : [];
  const result = await repo.search({ ...base, tokens, phrase: f.text || null });
  if (result.total || !f.text || f.text.length < 3) return { ...result, rows: result.rows.map(toDto), fuzzy: false };

  // Sonuç yoksa yazım hatası toleransı: "prol" → "parol", "ibuprfen" → "ibuprofen"
  const first = tokens[0];
  // Aday seti ilk harfle sınırlanır (ikinci harfteki hatalar da yakalanır, tüm tablo taranmaz).
  const candidates = await repo.fuzzyCandidates(first.slice(0, 1));
  const max = first.length <= 4 ? 1 : 2;
  const scored = candidates
    .map(c => {
      const words = `${c.normalized_name} ${c.normalized_ingredient || ''}`.split(' ').filter(Boolean);
      const best = Math.min(...words.map(w => Math.min(distance(first, w, max), distance(first, w.slice(0, first.length), max))));
      return { id: c.id, score: best };
    })
    .filter(c => c.score <= max)
    .sort((a, b) => a.score - b.score)
    .slice(0, 300);
  if (!scored.length) return { ...result, rows: [], fuzzy: false };
  const fuzzy = await repo.search({ ...base, ids: scored.map(s => s.id) });
  return { ...fuzzy, rows: fuzzy.rows.map(toDto), fuzzy: true };
}

// Piyasaya yeni giren ilaçlar: ruhsat tarihi bugün / son 7 gün / son 30 gün olanlar.
// Kayan pencere kullanılır; takvim sınırında (ayın 1'i, pazartesi) liste birden sıfırlanmaz.
// Tarihler İstanbul saatine göredir.
function periodStarts(now = new Date()) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(now);
  const back = days => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); };
  return { today, day: today, week: back(6), month: back(29) };
}

async function newMedicines(period = 'week', limit) {
  const starts = periodStarts();
  const key = ['day', 'week', 'month'].includes(period) ? period : 'week';
  const [rows, counts] = await Promise.all([
    repo.newMedicines({ from: starts[key], to: starts.today, limit }),
    repo.countNewSince({ day: starts.day, week: starts.week, month: starts.month }, starts.today)
  ]);
  // Dönem boşsa en son ruhsat alan ilaçlar yine de gösterilir.
  const latest = await repo.latestLicensed(rows.length ? 1 : 8);
  return {
    period: key, from: starts[key], to: starts.today, counts, data: rows.map(toDto),
    latest: rows.length ? [] : latest.map(toDto),
    latestLicenseDate: latest[0]?.license_date ? String(latest[0].license_date).slice(0, 10) : null
  };
}

async function getById(id) {
  if (!/^\d+$/.test(String(id))) throw httpError(400, 'Geçersiz ilaç kimliği.');
  const row = await repo.findById(Number(id));
  if (!row) throw httpError(404, 'İlaç bulunamadı.');
  return row;
}

async function getByBarcode(raw) {
  const barcode = cleanBarcode(raw);
  if (!barcode) throw httpError(400, 'Geçersiz barkod. 8-14 haneli olmalıdır.');
  return repo.findByBarcode(barcode);
}

// Yönetici: ilaç ekle / düzenle
function fromAdminBody(body, existing) {
  const merged = {
    barcode: body.barcode ?? existing?.barcode,
    name: body.name ?? existing?.name,
    activeIngredient: body.activeIngredient ?? existing?.active_ingredient,
    dosage: body.dosage ?? existing?.dosage,
    pharmaceuticalForm: body.pharmaceuticalForm ?? existing?.pharmaceutical_form,
    packageSize: body.packageSize ?? existing?.package_size,
    manufacturer: body.manufacturer ?? existing?.manufacturer,
    company: body.company ?? existing?.company,
    prescriptionType: body.prescriptionType ?? existing?.prescription_type,
    atcCode: body.atcCode ?? existing?.atc_code,
    licenseDate: body.licenseDate ?? existing?.license_date,
    licenseNumber: body.licenseNumber ?? existing?.license_number,
    marketStatus: body.marketStatus ?? existing?.market_status,
    price: body.price ?? existing?.price,
    currency: body.currency ?? existing?.currency,
    kubUrl: body.kubUrl ?? existing?.kub_url,
    ktUrl: body.ktUrl ?? existing?.kt_url,
    sourceUrl: existing?.source_url
  };
  if (body.marketStatus && !MARKET_STATUSES.includes(body.marketStatus)) throw httpError(400, 'Geçersiz piyasa durumu.');
  for (const key of ['kubUrl', 'ktUrl']) if (body[key] && !safeHttpsUrl(body[key])) throw httpError(400, 'KÜB / KT bağlantıları https ile başlamalıdır.');
  const { row, error } = toRow(merged, existing?.source || 'manual');
  if (error) throw httpError(400, error === 'İlaç adı eksik' ? 'İlaç adı zorunludur.' : 'Barkod 8-14 haneli rakamlardan oluşmalıdır.');
  return row;
}

async function create(body) {
  const row = fromAdminBody(body);
  if (await repo.findByBarcode(row.barcode)) throw httpError(409, 'Bu barkodla kayıtlı bir ilaç zaten var.');
  row.source = 'manual';
  const id = await repo.insert(row);
  return repo.findById(id);
}

async function updateMedicine(id, body) {
  const existing = await getById(id);
  const row = fromAdminBody(body, existing);
  if (row.barcode !== existing.barcode) {
    const clash = await repo.findByBarcode(row.barcode);
    if (clash && clash.id !== existing.id) throw httpError(409, 'Bu barkod başka bir ilaçta kayıtlı.');
  }
  delete row.source; // kaynak değişmez
  // Sağlayıcıdan gelen bir kayıt elle düzenlenirse senkronizasyon üzerine yazmaz.
  if (existing.source !== 'manual') row.manual_override = body.releaseOverride ? 0 : 1;
  await repo.update(existing.id, row);
  return repo.findById(existing.id);
}

async function deactivate(id) {
  const existing = await getById(id);
  await repo.update(existing.id, { market_status: 'passive', manual_override: existing.source === 'manual' ? 0 : 1 });
  return repo.findById(existing.id);
}

async function removePermanently(id) {
  const existing = await getById(id);
  await repo.remove(existing.id);
  return existing;
}

module.exports = { toRow, toDto, search, newMedicines, periodStarts, getById, getByBarcode, create, updateMedicine, deactivate, removePermanently, distance, httpError };
