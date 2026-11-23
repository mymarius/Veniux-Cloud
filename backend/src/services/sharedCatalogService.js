// Ortak katalog: işletmelerin kendi yeni ürün kaydında girdiği barkod/ad bilgisi, en az İKİ farklı işletme aynı barkodu girince
// "yayımlanır" ve diğer işletmelere barkod önerisi olarak sunulur. Fiyat, stok, işletme kimliği ve tedarikçi hiçbir zaman saklanmaz/paylaşılmaz.
// İşletme tercihi: tenants.catalog_sharing=0 ise katkı verilmez. Katkı en iyi çabayla yapılır; kabul/ürün kaydını asla bozmaz.
const db = require('../config/database');

const norm = s => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const MIN_TENANTS = 2;

function barcodeKey(code) {
  const c = String(code || '').trim();
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return null;           // yalnız standart GTIN/EAN/UPC barkodları
  return c.length === 14 && c[0] === '0' ? c.slice(1) : c;
}

// tx: işlem bağlantısı. entry: { tenantId, barcode, name, brand?, unit?, category? }
async function contribute(tx, entry) {
  try {
    const code = barcodeKey(entry.barcode), name = clean(entry.name, 200);
    if (!code || !name) return { skipped: 'invalid' };
    const t = (await tx.query('SELECT catalog_sharing FROM tenants WHERE id=$1', [entry.tenantId])).rows[0];
    if (!t || Number(t.catalog_sharing) !== 1) return { skipped: 'opt-out' };
    const row = [code, entry.tenantId, name, clean(entry.brand, 80) || null, clean(entry.unit, 12) || null, clean(entry.category, 80) || null];
    const own = (await tx.query('SELECT barcode FROM shared_catalog_votes WHERE barcode=$1 AND tenant_id=$2', [code, entry.tenantId])).rows[0];
    if (own) await tx.query('UPDATE shared_catalog_votes SET name=$3,brand=$4,unit=$5,category=$6 WHERE barcode=$1 AND tenant_id=$2', row);
    else await tx.query('INSERT INTO shared_catalog_votes (barcode,tenant_id,name,brand,unit,category) VALUES ($1,$2,$3,$4,$5,$6)', row);
    return publish(tx, code);
  } catch { return { skipped: 'error' }; }
}

// Aynı barkod için oylar: en çok oy alan ad (eşitlikte en kısa, sonra alfabetik) yayımlanır; en az 2 farklı işletme gerekir.
async function publish(tx, code) {
  const votes = (await tx.query('SELECT name,brand,unit,category FROM shared_catalog_votes WHERE barcode=$1', [code])).rows;
  if (votes.length < MIN_TENANTS) return { published: false, tenants: votes.length };
  const tally = new Map();
  for (const v of votes) { const k = norm(v.name); const e = tally.get(k) || { n: 0, v }; e.n++; tally.set(k, e); }
  const best = [...tally.entries()].sort((a, b) => b[1].n - a[1].n || a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1))[0][1].v;
  const exists = (await tx.query('SELECT barcode FROM shared_catalog_products WHERE barcode=$1', [code])).rows[0];
  const vals = [code, best.name, best.brand || null, best.unit || null, best.category || null, votes.length];
  if (exists) await tx.query('UPDATE shared_catalog_products SET name=$2,brand=$3,unit=$4,category=$5,tenants_count=$6,updated_at=CURRENT_TIMESTAMP WHERE barcode=$1', vals);
  else await tx.query('INSERT INTO shared_catalog_products (barcode,name,brand,unit,category,tenants_count) VALUES ($1,$2,$3,$4,$5,$6)', vals);
  return { published: true, tenants: votes.length };
}

async function find(code) {
  const key = barcodeKey(code);
  if (!key) return null;
  try { return (await db.query('SELECT barcode,name,brand,unit,category,tenants_count FROM shared_catalog_products WHERE barcode=$1', [key])).rows[0] || null; } catch { return null; }
}

module.exports = { contribute, find, barcodeKey, MIN_TENANTS };
