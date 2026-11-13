'use strict';
// Süresi dolmuş demo işletmelerini temizler. Yalnız adı "Veniux Demo – " ile başlayan ve TÜM lisansları
// (bitişten sonra) tanınan bekleme süresini aşmış işletmeler silinir. Gerçek müşteri işletmelerine dokunmaz.
// Silme tek işlemde yapılır; herhangi bir tabloda silinemeyen kayıt kalırsa tüm işlem geri alınır.
const PREFIX = 'Veniux Demo – ';
const DEFAULT_GRACE_DAYS = 30;
const DAY = 86400000;

const sqlDate = date => date.toISOString().replace('T', ' ').replace('Z', '');
const isConstraint = error => /FOREIGN KEY|constraint|a foreign key|Cannot delete or update/i.test(String(error && (error.message || error.code)));

async function candidates(db, { now = Date.now(), graceDays = DEFAULT_GRACE_DAYS } = {}) {
  const cutoff = sqlDate(new Date(now - graceDays * DAY));
  const rows = (await db.query(
    `SELECT t.id, t.name FROM tenants t
      WHERE t.name LIKE $1
        AND EXISTS (SELECT 1 FROM licenses l WHERE l.tenant_id=t.id)
        AND NOT EXISTS (SELECT 1 FROM licenses l WHERE l.tenant_id=t.id AND (l.expires_at IS NULL OR l.expires_at >= $2))
      ORDER BY t.id`, [PREFIX + '%', cutoff])).rows;
  // LIKE'ın joker davranışına güvenme: ön ek kesin eşleşmeli
  return rows.filter(row => String(row.name).startsWith(PREFIX)).map(row => ({ id: Number(row.id), name: row.name }));
}

async function tenantTables(client, engine) {
  if (engine === 'mysql') {
    const rows = (await client.query(
      "SELECT TABLE_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME='tenant_id' AND TABLE_NAME<>'tenants'")).rows;
    return rows.map(row => row.name || row.TABLE_NAME);
  }
  const names = (await client.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.map(row => row.name);
  const out = [];
  for (const name of names) {
    if (name === 'tenants' || !/^[A-Za-z0-9_]+$/.test(name)) continue;
    const columns = (await client.query(`PRAGMA table_info(${name})`)).rows;
    if (columns.some(column => column.name === 'tenant_id')) out.push(name);
  }
  return out;
}

async function deleteTenant(db, tenantId) {
  const engine = db.getEngine ? db.getEngine() : (process.env.DB_ENGINE === 'mysql' ? 'mysql' : 'sqlite');
  return db.transaction(async client => {
    let pending = await tenantTables(client, engine);
    const deleted = {};
    while (pending.length) {
      const next = [];
      let progressed = false;
      for (const table of pending) {
        if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error('Geçersiz tablo adı.');
        try {
          const result = await client.query(`DELETE FROM ${table} WHERE tenant_id=$1`, [tenantId]);
          deleted[table] = result.rowCount || 0;
          progressed = true;
        } catch (error) {
          if (!isConstraint(error)) throw error;
          next.push(table);
        }
      }
      if (next.length && !progressed) throw new Error('Silinemeyen bağlı kayıt kaldı: ' + next.join(', '));
      pending = next;
    }
    const result = await client.query('DELETE FROM tenants WHERE id=$1 AND name LIKE $2', [tenantId, PREFIX + '%']);
    if (!result.rowCount) throw new Error('İşletme silinemedi.');
    return deleted;
  });
}

async function purge(db, { now = Date.now(), graceDays = DEFAULT_GRACE_DAYS, dryRun = false } = {}) {
  if (!Number.isInteger(graceDays) || graceDays < 1 || graceDays > 3650) throw new Error('Bekleme süresi 1–3650 gün olmalı.');
  const list = await candidates(db, { now, graceDays });
  const removed = [], failed = [];
  if (dryRun) return { dryRun: true, candidates: list, removed, failed };
  for (const tenant of list) {
    try { await deleteTenant(db, tenant.id); removed.push(tenant); }
    catch (error) { failed.push({ ...tenant, error: error.message }); }
  }
  return { dryRun: false, candidates: list, removed, failed };
}

// Bulut hizmetinde günde bir çalışır. VENIUX_DEMO_PURGE_DAYS=0 kapatır; boşsa 30 gün.
function start(db, log = console) {
  const raw = process.env.VENIUX_DEMO_PURGE_DAYS;
  const graceDays = raw === undefined || raw === '' ? DEFAULT_GRACE_DAYS : Number(raw);
  if (!graceDays) return null;
  const run = () => purge(db, { graceDays }).then(result => {
    if (result.removed.length || result.failed.length) log.log(`Demo temizliği: ${result.removed.length} işletme silindi, ${result.failed.length} hata.`);
    for (const item of result.failed) log.error(`Demo temizliği hatası (işletme ${item.id}): ${item.error}`);
  }).catch(error => log.error('Demo temizliği çalışmadı:', error.message));
  const first = setTimeout(run, 10 * 60 * 1000); first.unref();
  const timer = setInterval(run, DAY); timer.unref();
  return timer;
}

module.exports = { purge, candidates, deleteTenant, start, PREFIX, DEFAULT_GRACE_DAYS };
