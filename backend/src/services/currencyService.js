const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Dövizli fiyat: ürün fiyatı döviz olarak girilir, satış anında işletmenin girdiği güncel kurla TL'ye çevrilir (kuruşa yuvarlanır).
// Kur elle girilir; otomatik kur kaynağı yoktur. Kur girilmemiş dövizli ürün normal TL satış fiyatından satılır.
const CURRENCIES = ['USD', 'EUR', 'GBP'];
const cache = new Map();
const forget = tenantId => cache.delete(tenantId);

async function rates(user) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  const rows = (await db.query('SELECT currency,rate_try,updated_at FROM exchange_rates WHERE tenant_id=$1', [user.tenantId])).rows;
  const by = Object.fromEntries(rows.map(r => [r.currency, { rate: Number(r.rate_try), updated_at: r.updated_at }]));
  return { currencies: CURRENCIES, rates: Object.fromEntries(CURRENCIES.map(c => [c, by[c] || null])) };
}

// body: { USD: 38.5, EUR: null }  — null/boş kuru siler.
async function setRates(user, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  await db.transaction(async tx => {
    for (const c of CURRENCIES) {
      if (!(c in body)) continue;
      const raw = body[c];
      if (raw === null || raw === '') { await tx.query('DELETE FROM exchange_rates WHERE tenant_id=$1 AND currency=$2', [user.tenantId, c]); continue; }
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) fail(c + ' kuru geçersiz.');
      const upd = await tx.query('UPDATE exchange_rates SET rate_try=$1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND currency=$3', [rate, user.tenantId, c]);
      if (!upd.rowCount) await tx.query('INSERT INTO exchange_rates (tenant_id,currency,rate_try) VALUES ($1,$2,$3)', [user.tenantId, c, rate]);
    }
  });
  forget(user.tenantId);
  return rates(user);
}

async function productRow(user, productId) {
  const p = (await db.query("SELECT id FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [productId, user.tenantId])).rows[0];
  if (!p) fail('Ürün bulunamadı.', 404);
  return p;
}

async function getProduct(user, productId) {
  const p = await productRow(user, productId);
  const row = (await db.query('SELECT currency,price FROM product_currency_prices WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, p.id])).rows[0];
  return { product_id: Number(p.id), currency: row ? row.currency : null, price: row ? Number(row.price) : null, currencies: CURRENCIES };
}

// body: { currency: 'USD', price: 12.5 }  veya { currency: null } ile silinir.
async function setProduct(user, productId, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  const p = await productRow(user, productId);
  if (body.currency === null || body.currency === '' || body.currency === undefined) {
    await db.query('DELETE FROM product_currency_prices WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, p.id]);
  } else {
    if (!CURRENCIES.includes(body.currency)) fail('Para birimi geçersiz.');
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 100000000) fail('Döviz fiyatı geçersiz.');
    const upd = await db.query('UPDATE product_currency_prices SET currency=$1,price=$2,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$3 AND product_id=$4', [body.currency, price, user.tenantId, p.id]);
    if (!upd.rowCount) await db.query('INSERT INTO product_currency_prices (tenant_id,product_id,currency,price) VALUES ($1,$2,$3,$4)', [user.tenantId, p.id, body.currency, price]);
  }
  forget(user.tenantId);
  return getProduct(user, productId);
}

async function hasAny(tx, tenantId, now = Date.now()) {
  const hit = cache.get(tenantId);
  if (hit && now - hit.at < 60000) return hit.has;
  let has = false;
  try { has = Number((await tx.query('SELECT COUNT(*) AS n FROM product_currency_prices WHERE tenant_id=$1', [tenantId])).rows[0].n) > 0; } catch { has = false; }
  cache.set(tenantId, { at: now, has });
  return has;
}

// Okutma sonucuna dövizli fiyatı uygular. Fiyat türü uygulanmış, tartılı, koli ve takım satırlarına dokunmaz.
// Tablo yoksa (eski şema) ya da kur girilmemişse hiçbir şey yapmaz; satışı asla bozmaz.
async function apply(tx, tenantId, scan) {
  try {
    if (!scan?.product || scan.price_tier || scan.weighted || scan.pack || scan.set || scan.product.is_set) return scan;
    if (!(await hasAny(tx, tenantId))) return scan;
    const row = (await tx.query('SELECT p.currency,p.price,r.rate_try FROM product_currency_prices p JOIN exchange_rates r ON r.tenant_id=p.tenant_id AND r.currency=p.currency WHERE p.tenant_id=$1 AND p.product_id=$2', [tenantId, scan.product.id])).rows[0];
    if (!row) return scan;
    scan.unit_price = Math.round(Number(row.price) * Number(row.rate_try) * 100) / 100;
    scan.fx = { currency: row.currency, price: Number(row.price), rate: Number(row.rate_try) };
  } catch { /* şema eski ya da geçici hata: normal fiyat kullanılır */ }
  return scan;
}

module.exports = { rates, setRates, getProduct, setProduct, apply, CURRENCIES, _forget: forget };
