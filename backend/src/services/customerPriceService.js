const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Müşteri fiyat kuralı: cari hesaba bağlı fiyat türü (Fiyat 1/2/3) ve yüzde iskonto.
// Kasada müşteri seçilince sunucu kuralı kendisi uygular; istemcinin gönderdiği fiyat türü kuralı geçersiz kılmaz.
function parseId(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) fail('Müşteri geçersiz.');
  return n;
}

async function accountRow(tx, tenantId, id) {
  const a = (await tx.query('SELECT id,name FROM retail_credit_accounts WHERE tenant_id=$1 AND id=$2', [tenantId, id])).rows[0];
  if (!a) fail('Müşteri bulunamadı.', 404);
  return a;
}

async function rule(tx, tenantId, id) {
  try {
    const r = (await tx.query('SELECT price_tier,discount_percent FROM customer_price_rules WHERE tenant_id=$1 AND account_id=$2', [tenantId, id])).rows[0];
    return { price_tier: r ? Number(r.price_tier) : 1, discount_percent: r ? Number(r.discount_percent) : 0 };
  } catch { return { price_tier: 1, discount_percent: 0 }; }
}

// Kasa için: seçilebilir müşteriler ve kuralları (kasiyer de okur).
async function list(user) {
  const rows = (await db.query('SELECT a.id,a.name,r.price_tier,r.discount_percent FROM retail_credit_accounts a LEFT JOIN customer_price_rules r ON r.tenant_id=a.tenant_id AND r.account_id=a.id WHERE a.tenant_id=$1 ORDER BY a.name LIMIT 500', [user.tenantId])).rows;
  return { items: rows.map(r => ({ id: Number(r.id), name: r.name, price_tier: Number(r.price_tier || 1), discount_percent: Number(r.discount_percent || 0) })) };
}

async function get(user, id) {
  const a = await accountRow(db, user.tenantId, parseId(id));
  return { account_id: Number(a.id), name: a.name, ...(await rule(db, user.tenantId, Number(a.id))) };
}

async function set(user, id, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  const accountId = parseId(id);
  await accountRow(db, user.tenantId, accountId);
  const tier = Number(body.price_tier ?? 1), pct = Number(body.discount_percent ?? 0);
  if (!Number.isInteger(tier) || tier < 1 || tier > 3) fail('Fiyat türü geçersiz.');
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) fail('İskonto yüzdesi 0–100 arasında olmalı.');
  const rounded = Math.round(pct * 100) / 100;
  if (tier === 1 && rounded === 0) await db.query('DELETE FROM customer_price_rules WHERE tenant_id=$1 AND account_id=$2', [user.tenantId, accountId]);
  else {
    const upd = await db.query('UPDATE customer_price_rules SET price_tier=$1,discount_percent=$2,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$3 AND account_id=$4', [tier, rounded, user.tenantId, accountId]);
    if (!upd.rowCount) await db.query('INSERT INTO customer_price_rules (tenant_id,account_id,price_tier,discount_percent) VALUES ($1,$2,$3,$4)', [user.tenantId, accountId, tier, rounded]);
  }
  return get(user, accountId);
}

// Satış/okutma için: müşteri yoksa null, varsa { id, price_tier, discount_percent }.
async function resolve(tx, tenantId, customerId) {
  const id = parseId(customerId);
  if (id === null) return null;
  await accountRow(tx, tenantId, id);
  return { id, ...(await rule(tx, tenantId, id)) };
}

// Okutma sonucuna yüzde iskonto uygular (kademe/döviz sonrası); tartılı, koli ve takım satırlarına dokunmaz.
function applyDiscount(scan, resolved) {
  if (!resolved || !(resolved.discount_percent > 0) || !scan?.product || scan.weighted || scan.pack || scan.set || scan.product.is_set) return scan;
  scan.unit_price = Math.round(Number(scan.unit_price) * (1 - resolved.discount_percent / 100) * 100) / 100;
  scan.customer_discount = resolved.discount_percent;
  return scan;
}

module.exports = { list, get, set, resolve, applyDiscount, parseId };
