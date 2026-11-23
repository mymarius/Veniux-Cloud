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
  let src = {};
  try { src = Object.fromEntries((await db.query('SELECT currency,source,buying_try,rates_date FROM exchange_rate_sources WHERE tenant_id=$1', [user.tenantId])).rows.map(r => [r.currency, r])); } catch { /* eski şema: hepsi elle */ }
  const by = Object.fromEntries(rows.map(r => { const s = src[r.currency]; return [r.currency, { rate: Number(r.rate_try), updated_at: r.updated_at, source: s?.source === 'auto' ? 'auto' : 'manual', buying: s?.source === 'auto' && s.buying_try !== null ? Number(s.buying_try) : null, rates_date: s?.source === 'auto' ? s.rates_date : null }]; }));
  return { currencies: CURRENCIES, rates: Object.fromEntries(CURRENCIES.map(c => [c, by[c] || null])), auto: await require('./fxAutoService').settings(user.tenantId) };
}

// body: { USD: 38.5, EUR: null }  — null/boş kuru siler.
async function setRates(user, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  await db.transaction(async tx => {
    for (const c of CURRENCIES) {
      if (!(c in body)) continue;
      const raw = body[c];
      if (raw === null || raw === '') {
        await tx.query('DELETE FROM exchange_rates WHERE tenant_id=$1 AND currency=$2', [user.tenantId, c]);
        await tx.query('DELETE FROM exchange_rate_sources WHERE tenant_id=$1 AND currency=$2', [user.tenantId, c]);
        continue;
      }
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) fail(c + ' kuru geçersiz.');
      const prev = (await tx.query('SELECT rate_try FROM exchange_rates WHERE tenant_id=$1 AND currency=$2', [user.tenantId, c])).rows[0];
      // Arayüz aynı kuru geri gönderirse otomatik kur "elle" olmaz; yalnız değişen değer elle sayılır.
      if (prev && Number(prev.rate_try) === rate) continue;
      const upd = await tx.query('UPDATE exchange_rates SET rate_try=$1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND currency=$3', [rate, user.tenantId, c]);
      if (!upd.rowCount) await tx.query('INSERT INTO exchange_rates (tenant_id,currency,rate_try) VALUES ($1,$2,$3)', [user.tenantId, c, rate]);
      const mark = await tx.query("UPDATE exchange_rate_sources SET source='manual',buying_try=NULL,rates_date=NULL,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND currency=$2", [user.tenantId, c]);
      if (!mark.rowCount) await tx.query("INSERT INTO exchange_rate_sources (tenant_id,currency,source) VALUES ($1,$2,'manual')", [user.tenantId, c]);
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

// Kasiyer için: kuru girilmiş para birimleri (yalnız oku). Kasada döviz seçimi ve çevrimdışı önbellek bunu kullanır.
async function cashierRates(user) {
  const rows = (await db.query('SELECT currency,rate_try,updated_at FROM exchange_rates WHERE tenant_id=$1', [user.tenantId])).rows;
  return { currencies: CURRENCIES, rates: Object.fromEntries(rows.map(r => [r.currency, { rate: Number(r.rate_try), updated_at: r.updated_at }])) };
}

// Satışın ödeme para birimi: TL ise null; döviz ise kayda kur ve döviz karşılığı yazılır (ödeme tutarları yine TL'dir).
async function paymentCurrency(tx, tenantId, code, netCents) {
  if (code === undefined || code === null || code === '' || code === 'TRY') return null;
  if (!CURRENCIES.includes(code)) fail('Para birimi geçersiz.');
  const row = (await tx.query('SELECT rate_try FROM exchange_rates WHERE tenant_id=$1 AND currency=$2', [tenantId, code])).rows[0];
  if (!row) fail(code + ' için kur girilmemiş.');
  const rate = Number(row.rate_try);
  return { currency: code, rate, amount: Math.round(netCents / rate) / 100 };
}

// Defter para birimi: işletmenin ana para birimi (satış/fatura kaydına yazılır). Geçersiz ya da eksikse TRY.
const LEDGER_CURRENCIES = ['TRY', 'AZN', 'USD', 'EUR', 'GBP'];
const normalizeLedger = code => { const c = String(code || '').trim().toUpperCase(); return LEDGER_CURRENCIES.includes(c) ? c : 'TRY'; };
async function ledgerCurrency(tx, tenantId) {
  try { return normalizeLedger((await tx.query('SELECT currency FROM tenants WHERE id=$1', [tenantId])).rows[0]?.currency); } catch { return 'TRY'; }
}
// Belgenin (ör. e-fatura taslağı) para birimi satışınkiyle aynı olmalı; satış bulunamazsa işletmenin güncel ana para birimi.
async function saleCurrency(tx, tenantId, saleId) {
  try {
    const row = (await tx.query('SELECT currency FROM pos_sales WHERE id=$1 AND tenant_id=$2', [saleId, tenantId])).rows[0];
    if (row?.currency) return normalizeLedger(row.currency);
  } catch { /* eski şema veya geçersiz kimlik */ }
  return ledgerCurrency(tx, tenantId);
}

module.exports = { LEDGER_CURRENCIES, normalizeLedger, ledgerCurrency, saleCurrency, cashierRates, paymentCurrency, rates, setRates, getProduct, setProduct, apply, CURRENCIES, _forget: forget };
