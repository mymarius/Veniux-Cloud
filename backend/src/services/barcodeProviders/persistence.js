// Barkod sağlayıcı ayarı (platform genelinde sıra/etkinlik) ve kalıcı kullanım sayacı. Şema 035.
// Tablo yoksa (eski şema) her şey sessizce bellek davranışına döner; barkod araması asla bu yüzden bozulmaz.
const db = require('../../config/database');

let cache = { at: 0, rows: [] };
const TTL = 30e3;

async function settings(force = false, now = Date.now()) {
  if (!force && now - cache.at < TTL) return cache.rows;
  try {
    const rows = (await db.query('SELECT provider_id,enabled,position FROM barcode_provider_settings')).rows.map(r => ({ id: r.provider_id, enabled: Number(r.enabled) === 1, position: Number(r.position) }));
    cache = { at: now, rows };
  } catch { cache = { at: now, rows: [] }; }
  return cache.rows;
}

// items: [{ id, enabled, position }]. Yalnız bilinen sağlayıcı kimlikleri (çağıran doğrular).
async function saveSettings(items, userId) {
  await db.transaction(async tx => {
    for (const it of items) {
      const upd = await tx.query('UPDATE barcode_provider_settings SET enabled=$1,position=$2,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE provider_id=$4', [it.enabled ? 1 : 0, it.position, userId || null, it.id]);
      if (!upd.rowCount) await tx.query('INSERT INTO barcode_provider_settings (provider_id,enabled,position,updated_by) VALUES ($1,$2,$3,$4)', [it.id, it.enabled ? 1 : 0, it.position, userId || null]);
    }
  });
  cache = { at: 0, rows: [] };
}

// --- kullanım sayacı: bellekte biriktirilir, periyodik ve kapanışta yazılır (kasa/arama yolunda veritabanı yazısı yok) ---
const KINDS = ['requests', 'found', 'missing', 'errors', 'limited', 'cache_hits'];
const pending = new Map();   // "gün|sağlayıcı|işletme" -> sayaçlar
let timer = null;
const dayOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

function record(providerId, tenantId, kind, now = Date.now()) {
  if (!KINDS.includes(kind) || !Number.isSafeInteger(Number(tenantId))) return;
  const key = dayOf(now) + '|' + providerId + '|' + Number(tenantId);
  let row = pending.get(key); if (!row) pending.set(key, row = Object.fromEntries(KINDS.map(k => [k, 0])));
  row[kind]++;
  if (!timer && process.env.NODE_ENV !== 'test') { timer = setInterval(() => { flush().catch(() => {}); }, 60e3); timer.unref?.(); }
}

async function flush() {
  if (!pending.size) return 0;
  const batch = [...pending.entries()]; pending.clear();
  let written = 0;
  try {
    await db.transaction(async tx => {
      for (const [key, row] of batch) {
        const [day, provider, tenant] = key.split('|');
        const sets = KINDS.map((k, i) => k + '=' + k + '+$' + (i + 1)).join(',');
        const vals = KINDS.map(k => row[k]);
        const upd = await tx.query('UPDATE barcode_provider_usage SET ' + sets + ' WHERE day=$' + (KINDS.length + 1) + ' AND provider_id=$' + (KINDS.length + 2) + ' AND tenant_id=$' + (KINDS.length + 3), [...vals, day, provider, Number(tenant)]);
        if (!upd.rowCount) await tx.query('INSERT INTO barcode_provider_usage (day,provider_id,tenant_id,' + KINDS.join(',') + ') VALUES ($1,$2,$3,' + KINDS.map((_, i) => '$' + (i + 4)).join(',') + ')', [day, provider, Number(tenant), ...vals]);
        written++;
      }
    });
  } catch {
    // yazılamadıysa sayaçlar geri eklenir (tablo yoksa ya da geçici hata): bir sonraki denemede yeniden yazılır
    for (const [key, row] of batch) { const cur = pending.get(key); if (cur) for (const k of KINDS) cur[k] += row[k]; else pending.set(key, row); }
    return 0;
  }
  return written;
}

// Son N günün sağlayıcı bazında toplamı (platform yöneticisi görünümü).
async function usage(days = 30) {
  const from = dayOf(Date.now() - Math.max(1, Math.min(365, days)) * 86400e3);
  try {
    return (await db.query('SELECT provider_id,SUM(requests) requests,SUM(found) found,SUM(missing) missing,SUM(errors) errors,SUM(limited) limited,SUM(cache_hits) cache_hits,COUNT(DISTINCT tenant_id) tenants FROM barcode_provider_usage WHERE day>=$1 GROUP BY provider_id', [from])).rows
      .map(r => ({ provider_id: r.provider_id, requests: Number(r.requests), found: Number(r.found), missing: Number(r.missing), errors: Number(r.errors), limited: Number(r.limited), cache_hits: Number(r.cache_hits), tenants: Number(r.tenants), since: from }));
  } catch { return []; }
}

function _reset() { pending.clear(); cache = { at: 0, rows: [] }; if (timer) { clearInterval(timer); timer = null; } }
module.exports = { settings, saveSettings, record, flush, usage, _reset, KINDS };
