// Otomatik döviz kuru: TCMB günlük kur dosyasından USD/EUR/GBP satış (TL karşılığı) kurunu çeker.
// Elle girilmiş kur ezilmez; ağ hatasında son kur korunur ve durum kayda yazılır.
const db = require('../config/database');
const currency = require('./currencyService');

const URL = process.env.VENIUX_FX_URL || 'https://www.tcmb.gov.tr/kurlar/today.xml';
const TIMEOUT_MS = 10000;
const forbid = () => Object.assign(new Error('Bu işlem için yetkiniz yok.'), { status: 403 });

// TCMB XML'ini sadeleştirir. Dönen: { date:'2026-11-20', rates:{ USD:{selling,buying}, ... } }
function parseTcmb(xml) {
  const text = String(xml || '');
  const head = text.match(/<Tarih_Date[^>]*\sDate="(\d{2})\/(\d{2})\/(\d{4})"/);
  const date = head ? `${head[3]}-${head[1]}-${head[2]}` : null;
  const rates = {};
  for (const m of text.matchAll(/<Currency\b[^>]*\bKod="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g)) {
    const code = m[1];
    if (!currency.CURRENCIES.includes(code)) continue;
    const num = tag => { const t = m[2].match(new RegExp('<' + tag + '>\\s*([^<]*?)\\s*</' + tag + '>')); const v = t ? Number(t[1].replace(',', '.')) : NaN; return Number.isFinite(v) && v > 0 && v < 100000 ? v : null; };
    const unit = num('Unit') || 1;
    const selling = num('ForexSelling'), buying = num('ForexBuying');
    if (selling) rates[code] = { selling: selling / unit, buying: buying ? buying / unit : null };
  }
  if (!date || !Object.keys(rates).length) throw new Error('Kur dosyası okunamadı.');
  return { date, rates };
}

async function download(fetchImpl = globalThis.fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(URL, { signal: ctl.signal, headers: { Accept: 'application/xml,text/xml' } });
    if (!res.ok) throw new Error('Kur sunucusu ' + res.status + ' döndü.');
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function settings(tenantId) {
  let row;
  try { row = (await db.query('SELECT auto_enabled,last_fetch_at,last_status,last_error,rates_date FROM exchange_rate_settings WHERE tenant_id=$1', [tenantId])).rows[0]; } catch { row = null; }
  return { auto_enabled: !!(row && Number(row.auto_enabled)), last_fetch_at: row?.last_fetch_at || null, last_status: row?.last_status || null, last_error: row?.last_error || null, rates_date: row?.rates_date || null };
}

async function saveStatus(tx, tenantId, patch) {
  const cur = (await tx.query('SELECT id FROM exchange_rate_settings WHERE tenant_id=$1', [tenantId])).rows[0];
  if (!cur) await tx.query('INSERT INTO exchange_rate_settings (tenant_id,auto_enabled) VALUES ($1,0)', [tenantId]);
  const keys = Object.keys(patch);
  await tx.query('UPDATE exchange_rate_settings SET ' + keys.map((k, i) => k + '=$' + (i + 1)).join(',') + ' WHERE tenant_id=$' + (keys.length + 1), [...keys.map(k => patch[k]), tenantId]);
}

// Tek işletmeye uygular. Elle girilmiş (kaynağı 'manual' ya da kaydı olmayan) kur atlanır.
async function applyToTenant(tenantId, parsed) {
  const applied = [], skipped = [];
  await db.transaction(async tx => {
    for (const code of currency.CURRENCIES) {
      const r = parsed.rates[code];
      if (!r) continue;
      const rate = (await tx.query('SELECT id FROM exchange_rates WHERE tenant_id=$1 AND currency=$2', [tenantId, code])).rows[0];
      const src = (await tx.query('SELECT source FROM exchange_rate_sources WHERE tenant_id=$1 AND currency=$2', [tenantId, code])).rows[0];
      if (rate && (!src || src.source !== 'auto')) { skipped.push(code); continue; }
      if (rate) await tx.query('UPDATE exchange_rates SET rate_try=$1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND currency=$3', [r.selling, tenantId, code]);
      else await tx.query('INSERT INTO exchange_rates (tenant_id,currency,rate_try) VALUES ($1,$2,$3)', [tenantId, code, r.selling]);
      if (src) await tx.query("UPDATE exchange_rate_sources SET source='auto',buying_try=$1,rates_date=$2,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$3 AND currency=$4", [r.buying, parsed.date, tenantId, code]);
      else await tx.query("INSERT INTO exchange_rate_sources (tenant_id,currency,source,buying_try,rates_date) VALUES ($1,$2,'auto',$3,$4)", [tenantId, code, r.buying, parsed.date]);
      applied.push(code);
    }
    await saveStatus(tx, tenantId, { last_fetch_at: new Date().toISOString(), last_status: 'ok', last_error: null, rates_date: parsed.date });
  });
  currency._forget(tenantId);
  return { applied, skipped, date: parsed.date };
}

async function recordFailure(tenantIds, message) {
  for (const id of tenantIds) {
    try { await db.transaction(tx => saveStatus(tx, id, { last_fetch_at: new Date().toISOString(), last_status: 'error', last_error: String(message).slice(0, 300) })); } catch { /* durum yazılamadı: son kur zaten korunuyor */ }
  }
}

// Zamanlayıcı girişi: kur otomatik açık olan tüm işletmeler. Hata fırlatmaz; son kur korunur.
async function run({ fetchImpl, log = console } = {}) {
  const tenants = (await db.query('SELECT tenant_id FROM exchange_rate_settings WHERE auto_enabled=1')).rows.map(r => r.tenant_id);
  if (!tenants.length) return { tenants: 0 };
  let parsed;
  try { parsed = parseTcmb(await download(fetchImpl)); }
  catch (e) { log.warn?.('[Kur] TCMB kuru alınamadı, son kur korunuyor: ' + e.message); await recordFailure(tenants, e.message); return { tenants: tenants.length, error: e.message }; }
  let ok = 0;
  for (const id of tenants) { try { await applyToTenant(id, parsed); ok++; } catch (e) { log.warn?.('[Kur] işletme ' + id + ' güncellenemedi: ' + e.message); await recordFailure([id], e.message); } }
  log.info?.('[Kur] TCMB ' + parsed.date + ' kuru ' + ok + ' işletmeye uygulandı.');
  return { tenants: tenants.length, updated: ok, date: parsed.date };
}

// "Şimdi güncelle": yalnız bu işletme için çeker; ağ hatası kuru bozmaz, durum alanında görünür.
async function refresh(user, { fetchImpl } = {}) {
  if (!['admin', 'manager'].includes(user.role)) throw forbid();
  try { await applyToTenant(user.tenantId, parseTcmb(await download(fetchImpl))); }
  catch (e) { await recordFailure([user.tenantId], e.message); }
  return currency.rates(user);
}

async function setAuto(user, enabled, opts = {}) {
  if (!['admin', 'manager'].includes(user.role)) throw forbid();
  await db.transaction(async tx => {
    const cur = (await tx.query('SELECT id FROM exchange_rate_settings WHERE tenant_id=$1', [user.tenantId])).rows[0];
    if (cur) await tx.query('UPDATE exchange_rate_settings SET auto_enabled=$1 WHERE tenant_id=$2', [enabled ? 1 : 0, user.tenantId]);
    else await tx.query('INSERT INTO exchange_rate_settings (tenant_id,auto_enabled) VALUES ($1,$2)', [user.tenantId, enabled ? 1 : 0]);
  });
  if (enabled) return refresh(user, opts);
  return currency.rates(user);
}

module.exports = { parseTcmb, run, setAuto, refresh, settings, applyToTenant };
