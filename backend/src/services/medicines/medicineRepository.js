const pool = require('../../config/database');

// İlaç kataloğu veri erişimi. Tüm sorgular parametrelidir ($n yer tutucuları,
// SQLite ve MySQL adaptörleri tarafından çevrilir).

const COLUMNS = [
  'barcode', 'gtin', 'name', 'normalized_name', 'search_text', 'active_ingredient', 'normalized_ingredient',
  'dosage', 'pharmaceutical_form', 'package_size', 'manufacturer', 'company', 'normalized_company',
  'prescription_type', 'atc_code', 'license_date', 'license_number', 'market_status', 'price', 'currency', 'kub_url', 'kt_url',
  'source', 'source_url', 'data_hash'
];
const IMAGE_COLUMNS = ['image_url', 'image_local_path', 'image_source', 'image_verified'];
const int = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(value, 10) || fallback));

async function findById(id, db = pool) {
  return (await db.query('SELECT * FROM medicines WHERE id = $1', [id])).rows[0] || null;
}

async function findByBarcode(barcode, db = pool) {
  return (await db.query('SELECT * FROM medicines WHERE barcode = $1 OR gtin = $2 LIMIT 1', [barcode, barcode.padStart(14, '0')])).rows[0] || null;
}

// Senkronizasyon parçası için tek sorguda mevcut kayıtlar (N+1 yok).
async function findByBarcodes(barcodes, db = pool) {
  if (!barcodes.length) return new Map();
  const placeholders = barcodes.map((_, i) => `$${i + 1}`).join(',');
  const rows = (await db.query(`SELECT id, barcode, data_hash, source, manual_override, image_source FROM medicines WHERE barcode IN (${placeholders})`, barcodes)).rows;
  return new Map(rows.map(row => [row.barcode, row]));
}

async function insert(row, db = pool) {
  const columns = [...COLUMNS, ...IMAGE_COLUMNS, 'last_seen_sync_id', 'last_synced_at'].filter(c => row[c] !== undefined);
  const values = columns.map(c => row[c]);
  const sql = `INSERT INTO medicines (${columns.join(',')}, created_at, updated_at) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`;
  return (await db.query(sql, values)).rows[0]?.id;
}

async function update(id, row, db = pool) {
  const columns = [...COLUMNS, ...IMAGE_COLUMNS, 'manual_override', 'last_seen_sync_id', 'last_synced_at'].filter(c => row[c] !== undefined);
  if (!columns.length) return 0;
  const sets = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');
  return (await db.query(`UPDATE medicines SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = $${columns.length + 1}`, [...columns.map(c => row[c]), id])).rowCount;
}

async function markSeen(ids, syncId, db = pool) {
  if (!ids.length) return;
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  await db.query(`UPDATE medicines SET last_seen_sync_id = $1, last_synced_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, [syncId, ...ids]);
}

async function remove(id) { return (await pool.query('DELETE FROM medicines WHERE id = $1', [id])).rowCount; }

// Arama: her kelime search_text içinde aranır; ada göre önce "ile başlayan" sonuçlar.
function buildFilters(f) {
  const where = []; const params = [];
  const add = (sql, ...values) => { where.push(sql.replace(/\?/g, () => `$${params.push(values.shift())}`)); };
  if (!f.includeAll) add('market_status <> ?', 'passive');
  if (f.prescriptionType) add('prescription_type = ?',f.prescriptionType);
  if (f.marketStatus) add('market_status = ?', f.marketStatus);
  if (f.company) add('normalized_company LIKE ?', `%${f.company}%`);
  if (f.activeIngredient) add('normalized_ingredient LIKE ?', `%${f.activeIngredient}%`);
  if (f.atc) add('atc_code LIKE ?', `${f.atc.toUpperCase()}%`);
  if (f.source) add('source = ?', f.source);
  if (f.image === 'missing') where.push("(image_url IS NULL AND image_local_path IS NULL)");
  if (f.image === 'unverified') where.push("((image_url IS NOT NULL OR image_local_path IS NOT NULL) AND image_verified = 0)");
  if (f.image === 'verified') where.push('image_verified = 1');
  if (f.ids) add(`id IN (${f.ids.map(() => '?').join(',')})`, ...f.ids);
  if (f.barcodePrefix) add('(barcode LIKE ? OR gtin LIKE ?)', `${f.barcodePrefix}%`, `%${f.barcodePrefix}%`);
  for (const token of f.tokens || []) add('search_text LIKE ?', `%${token}%`);
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function search(filters) {
  const limit = int(filters.limit, 24, 1, 100);
  const page = int(filters.page, 1, 1, 100000);
  const { where, params } = buildFilters(filters);
  const total = Number((await pool.query(`SELECT COUNT(*) AS c FROM medicines ${where}`, params)).rows[0].c);
  let order = 'name ASC';
  const orderParams = [];
  if (filters.phrase) {
    orderParams.push(`${filters.phrase}%`, `%${filters.phrase}%`);
    order = `CASE WHEN normalized_name LIKE $${params.length + 1} THEN 0 WHEN normalized_name LIKE $${params.length + 2} THEN 1 ELSE 2 END, name ASC`;
  }
  const rows = (await pool.query(`SELECT * FROM medicines ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, [...params, ...orderParams])).rows;
  return { rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Bulanık arama için aday seti: ilk iki harfi tutan ad / etken madde kayıtları.
async function fuzzyCandidates(prefix, cap = 5000) {
  return (await pool.query(
    `SELECT id, normalized_name, normalized_ingredient FROM medicines WHERE market_status <> 'passive' AND (normalized_name LIKE $1 OR normalized_ingredient LIKE $1 OR normalized_name LIKE $2) LIMIT ${cap}`,
    [`${prefix}%`, `% ${prefix}%`]
  )).rows;
}

// Ruhsat tarihi aralıkta olan ilaçlar (en yeni önce) ve dönem sayıları — indeksli sorgular.
async function newMedicines({ from, to, limit = 30 }) {
  return (await pool.query(
    `SELECT * FROM medicines WHERE license_date >= $1 AND license_date <= $2 AND market_status <> 'passive' ORDER BY license_date DESC, name ASC LIMIT ${int(limit, 30, 1, 100)}`,
    [from, to]
  )).rows;
}
async function countNewSince(dates, to) {
  const out = {};
  for (const [key, from] of Object.entries(dates)) {
    out[key] = Number((await pool.query("SELECT COUNT(*) AS c FROM medicines WHERE license_date >= $1 AND license_date <= $2 AND market_status <> 'passive'", [from, to])).rows[0].c);
  }
  return out;
}
async function latestLicensed(limit = 8) {
  return (await pool.query(`SELECT * FROM medicines WHERE license_date IS NOT NULL AND market_status <> 'passive' ORDER BY license_date DESC, name ASC LIMIT ${int(limit, 8, 1, 50)}`)).rows;
}

async function stats() {
  const one = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].c || 0);
  const [total, active, suspended, passive, manual, withImage, verified] = await Promise.all([
    one('SELECT COUNT(*) AS c FROM medicines'),
    one("SELECT COUNT(*) AS c FROM medicines WHERE market_status = 'active'"),
    one("SELECT COUNT(*) AS c FROM medicines WHERE market_status = 'suspended'"),
    one("SELECT COUNT(*) AS c FROM medicines WHERE market_status = 'passive'"),
    one("SELECT COUNT(*) AS c FROM medicines WHERE source = 'manual'"),
    one('SELECT COUNT(*) AS c FROM medicines WHERE image_url IS NOT NULL OR image_local_path IS NOT NULL'),
    one('SELECT COUNT(*) AS c FROM medicines WHERE image_verified = 1')
  ]);
  const prescriptions = (await pool.query("SELECT COALESCE(prescription_type, 'Belirtilmemiş') AS label, COUNT(*) AS c FROM medicines WHERE market_status <> 'passive' GROUP BY COALESCE(prescription_type, 'Belirtilmemiş') ORDER BY c DESC LIMIT 8")).rows;
  const companies = (await pool.query("SELECT company AS label, COUNT(*) AS c FROM medicines WHERE company IS NOT NULL AND market_status <> 'passive' GROUP BY company ORDER BY c DESC LIMIT 8")).rows;
  const atcGroups = (await pool.query("SELECT SUBSTR(atc_code, 1, 1) AS label, COUNT(*) AS c FROM medicines WHERE atc_code IS NOT NULL AND market_status <> 'passive' GROUP BY SUBSTR(atc_code, 1, 1) ORDER BY c DESC")).rows;
  return { total, active, suspended, passive, manual, withImage, verified, prescriptions, companies, atcGroups };
}

// Ayarlar (anahtar-değer)
async function getSettings() {
  const rows = (await pool.query('SELECT `key`, value FROM medicine_catalog_settings')).rows;
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
async function setSetting(key, value, db = pool) {
  const existing = (await db.query('SELECT `key` FROM medicine_catalog_settings WHERE `key` = $1', [key])).rows[0];
  if (existing) await db.query('UPDATE medicine_catalog_settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE `key` = $2', [value, key]);
  else await db.query('INSERT INTO medicine_catalog_settings (`key`, value) VALUES ($1, $2)', [key, value]);
}

// Senkronizasyon günlükleri
async function createLog(provider, triggeredBy) {
  return (await pool.query("INSERT INTO medicine_sync_logs (provider, status, triggered_by, started_at) VALUES ($1, 'running', $2, CURRENT_TIMESTAMP) RETURNING id", [provider, triggeredBy])).rows[0].id;
}
async function updateLog(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => (fields[k] === 'NOW()' ? `${k} = CURRENT_TIMESTAMP` : `${k} = $${i + 1}`)).join(', ');
  await pool.query(`UPDATE medicine_sync_logs SET ${sets} WHERE id = $${keys.length + 1}`, [...keys.map(k => fields[k]), id]);
}
async function listLogs(limit = 50) {
  return (await pool.query(`SELECT * FROM medicine_sync_logs ORDER BY id DESC LIMIT ${int(limit, 50, 1, 200)}`)).rows;
}
async function getLog(id) { return (await pool.query('SELECT * FROM medicine_sync_logs WHERE id = $1', [id])).rows[0] || null; }
async function runningLog() { return (await pool.query("SELECT * FROM medicine_sync_logs WHERE status = 'running' ORDER BY id DESC LIMIT 1")).rows[0] || null; }
async function lastSuccessfulLog() { return (await pool.query("SELECT * FROM medicine_sync_logs WHERE status IN ('success', 'partial') ORDER BY id DESC LIMIT 1")).rows[0] || null; }

async function countMissing(source, syncId) {
  const base = "FROM medicines WHERE source = $1 AND market_status <> 'passive' AND manual_override = 0";
  const missing = Number((await pool.query(`SELECT COUNT(*) AS c ${base} AND (last_seen_sync_id IS NULL OR last_seen_sync_id <> $2)`, [source, syncId])).rows[0].c);
  const all = Number((await pool.query(`SELECT COUNT(*) AS c ${base}`, [source])).rows[0].c);
  return { missing, all };
}
async function deactivateMissing(source, syncId) {
  return (await pool.query("UPDATE medicines SET market_status = 'passive', updated_at = CURRENT_TIMESTAMP WHERE source = $1 AND market_status <> 'passive' AND manual_override = 0 AND (last_seen_sync_id IS NULL OR last_seen_sync_id <> $2)", [source, syncId])).rowCount;
}

module.exports = {
  findById, findByBarcode, findByBarcodes, insert, update, markSeen, remove, search, fuzzyCandidates, stats,
  newMedicines, countNewSince, latestLicensed,
  getSettings, setSetting, createLog, updateLog, listLogs, getLog, runningLog, lastSuccessfulLog, countMissing, deactivateMissing
};
