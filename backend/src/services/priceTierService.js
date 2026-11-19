const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Fiyat türleri: Fiyat 1 = ürünün normal satış fiyatı (perakende); Fiyat 2 = toptan; Fiyat 3 = özel.
// Üründe ilgili fiyat girilmemişse satış Fiyat 1'den yapılır. Fiyatlar KDV dahildir (satış fiyatıyla aynı).
const NAMES = { 1: 'Perakende', 2: 'Toptan', 3: 'Özel' };

function parseTier(value) {
  if (value === undefined || value === null || value === '') return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 3) fail('Fiyat türü geçersiz.');
  return n;
}

async function productRow(user, productId) {
  const p = (await db.query("SELECT id,sale_price FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [productId, user.tenantId])).rows[0];
  if (!p) fail('Ürün bulunamadı.', 404);
  return p;
}

async function get(user, productId) {
  const p = await productRow(user, productId);
  const rows = (await db.query('SELECT tier,price FROM product_price_tiers WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, p.id])).rows;
  const by = Object.fromEntries(rows.map(r => [Number(r.tier), Number(r.price)]));
  return { product_id: Number(p.id), tier1: Number(p.sale_price), tier2: by[2] ?? null, tier3: by[3] ?? null, names: NAMES };
}

// body: { tier2: 95.5 | null, tier3: ... }  — null/boş fiyatı siler.
async function set(user, productId, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  const p = await productRow(user, productId);
  await db.transaction(async tx => {
    for (const tier of [2, 3]) {
      const key = 'tier' + tier;
      if (!(key in body)) continue;
      const raw = body[key];
      if (raw === null || raw === '') { await tx.query('DELETE FROM product_price_tiers WHERE tenant_id=$1 AND product_id=$2 AND tier=$3', [user.tenantId, p.id, tier]); continue; }
      const price = Number(raw);
      if (!Number.isFinite(price) || price < 0 || price > 100000000) fail(NAMES[tier] + ' fiyatı geçersiz.');
      const rounded = Math.round(price * 100) / 100;
      const upd = await tx.query('UPDATE product_price_tiers SET price=$1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND product_id=$3 AND tier=$4', [rounded, user.tenantId, p.id, tier]);
      if (!upd.rowCount) await tx.query('INSERT INTO product_price_tiers (tenant_id,product_id,tier,price) VALUES ($1,$2,$3,$4)', [user.tenantId, p.id, tier, rounded]);
    }
  });
  return get(user, productId);
}

// Okutma sonucuna (scan) seçili fiyat türünü uygular; tartılı, koli ve takım satırlarına dokunmaz. Tablo yalnız tier>1 iken okunur.
async function apply(tx, tenantId, scan, tier) {
  if (!tier || tier < 2 || !scan?.product || scan.weighted || scan.pack || scan.set || scan.product.is_set) return scan;
  const row = (await tx.query('SELECT price FROM product_price_tiers WHERE tenant_id=$1 AND product_id=$2 AND tier=$3', [tenantId, scan.product.id, tier])).rows[0];
  if (row) { const price = Number(row.price); scan.unit_price = price; scan.price_tier = tier; }
  return scan;
}

async function status(user) {
  try {
    const n = Number((await db.query('SELECT COUNT(*) AS n FROM product_price_tiers WHERE tenant_id=$1', [user.tenantId])).rows[0].n);
    return { enabled: n > 0, names: NAMES };
  } catch { return { enabled: false, names: NAMES }; }
}

module.exports = { get, set, apply, status, parseTier, NAMES };
