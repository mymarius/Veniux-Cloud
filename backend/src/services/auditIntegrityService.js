// Denetim kaydı bütünlüğü (değiştirildiği anlaşılan kayıt).
// Her firma için kayıtlar sırayla zincirlenir: hash = HMAC(anahtar, önceki_hash + kaydın içeriği).
// Anahtar sunucu sırrından türetilir; veritabanına yalnız erişen biri kaydı değiştirirse veya silerse
// zinciri yeniden hesaplayamaz ve doğrulama ilk bozuk kaydı gösterir.
// Sınırlar: Henüz mühürlenmemiş (en çok ~1 dakikalık) kayıt korunmaz; sunucu sırrını da ele geçiren biri zinciri
// baştan yazabilir. Bu yüzden düzenli yedekler zincirin dışarıdaki kopyasıdır.
// Saklama süresi dolan kayıtlar silinir; silinen bölümün son hash'i bir kontrol noktasına yazılır, zincir oradan sürer.
const crypto = require('crypto');
const db = require('../config/database');
const GENESIS = 'GENESIS';

function key() {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-this';
  return crypto.createHash('sha256').update('veniux-audit-v1\0' + secret).digest();
}
const canonical = row => JSON.stringify([Number(row.id), Number(row.tenant_id), row.user_email ?? null, row.action, row.entity_type, row.entity_id === null || row.entity_id === undefined ? null : Number(row.entity_id), row.details ?? null, String(row.created_at ?? '')]);
const link = (prev, row) => crypto.createHmac('sha256', key()).update(prev + '\n' + canonical(row)).digest('hex');

async function head(tenant, tx = db) {
  const seal = (await tx.query('SELECT audit_id,hash FROM audit_seals WHERE tenant_id=$1 ORDER BY audit_id DESC LIMIT 1', [tenant])).rows[0];
  if (seal) return { after: Number(seal.audit_id), hash: seal.hash };
  const cp = (await tx.query('SELECT through_audit_id,last_hash FROM audit_checkpoints WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1', [tenant])).rows[0];
  return cp ? { after: Number(cp.through_audit_id), hash: cp.last_hash } : { after: 0, hash: GENESIS };
}

// Mühürlenmemiş kayıtları sırayla zincire ekler.
async function seal(tenant) {
  return db.transaction(async tx => {
    let { after, hash } = await head(tenant, tx), count = 0;
    for (;;) {
      const rows = (await tx.query('SELECT * FROM audit_logs WHERE tenant_id=$1 AND id>$2 ORDER BY id LIMIT 500', [tenant, after])).rows;
      if (!rows.length) break;
      for (const row of rows) {
        const next = link(hash, row);
        await tx.query('INSERT INTO audit_seals (tenant_id,audit_id,prev_hash,hash) VALUES ($1,$2,$3,$4)', [tenant, row.id, hash, next]);
        hash = next; after = Number(row.id); count++;
      }
    }
    return count;
  });
}

// Zinciri baştan doğrular. Değiştirilmiş, silinmiş veya araya sonradan eklenmiş kaydı bildirir.
async function verify(tenant) {
  await seal(tenant);
  const cp = (await db.query('SELECT through_audit_id,last_hash FROM audit_checkpoints WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1', [tenant])).rows[0];
  let prev = cp ? cp.last_hash : GENESIS, checked = 0;
  const seals = (await db.query('SELECT s.audit_id,s.prev_hash,s.hash,a.id,a.tenant_id,a.user_email,a.action,a.entity_type,a.entity_id,a.details,a.created_at FROM audit_seals s LEFT JOIN audit_logs a ON a.id=s.audit_id WHERE s.tenant_id=$1 ORDER BY s.audit_id', [tenant])).rows;
  for (const s of seals) {
    if (s.prev_hash !== prev) return { ok: false, checked, problem: 'chain_broken', audit_id: Number(s.audit_id) };
    if (s.id === null || s.id === undefined) return { ok: false, checked, problem: 'deleted', audit_id: Number(s.audit_id) };
    if (link(prev, s) !== s.hash) return { ok: false, checked, problem: 'modified', audit_id: Number(s.audit_id) };
    prev = s.hash; checked++;
  }
  const last = seals.length ? Number(seals[seals.length - 1].audit_id) : Number(cp?.through_audit_id || 0);
  const inserted = Number((await db.query('SELECT COUNT(*) AS n FROM audit_logs a WHERE a.tenant_id=$1 AND a.id<$2 AND NOT EXISTS (SELECT 1 FROM audit_seals s WHERE s.audit_id=a.id) AND a.id>$3', [tenant, last, Number(cp?.through_audit_id || 0)])).rows[0].n);
  if (inserted) return { ok: false, checked, problem: 'inserted', count: inserted };
  return { ok: true, checked, since: cp ? 'checkpoint' : 'start' };
}

// Saklama süresi dolan kayıtları siler; zincir bir kontrol noktasıyla devam eder. Silme de kayda geçer.
async function purge(tenant, years, now = new Date()) {
  if (!Number.isInteger(years) || years < 1 || years > 10) throw Error('Saklama süresi 1-10 yıl olmalı.');
  await seal(tenant);
  const cutoff = new Date(now.getTime() - years * 365.25 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  return db.transaction(async tx => {
    const last = (await tx.query('SELECT s.audit_id,s.hash FROM audit_seals s JOIN audit_logs a ON a.id=s.audit_id WHERE s.tenant_id=$1 AND a.created_at<$2 ORDER BY s.audit_id DESC LIMIT 1', [tenant, cutoff])).rows[0];
    if (!last) return { purged: 0 };
    const n = Number((await tx.query('SELECT COUNT(*) AS n FROM audit_logs WHERE tenant_id=$1 AND id<=$2', [tenant, last.audit_id])).rows[0].n);
    await tx.query('DELETE FROM audit_logs WHERE tenant_id=$1 AND id<=$2', [tenant, last.audit_id]);
    await tx.query('DELETE FROM audit_seals WHERE tenant_id=$1 AND audit_id<=$2', [tenant, last.audit_id]);
    await tx.query('INSERT INTO audit_checkpoints (tenant_id,through_audit_id,last_hash,purged_count,reason) VALUES ($1,$2,$3,$4,$5)', [tenant, last.audit_id, last.hash, n, `${years} yıllık saklama süresi`]);
    await tx.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,NULL,'audit.retention_purge','audit',NULL,$2)", [tenant, JSON.stringify({ purged: n, before: cutoff, years })]);
    return { purged: n, before: cutoff };
  });
}

let lastPurgeDay = '';
async function tick(now = new Date()) {
  const tenants = (await db.query('SELECT DISTINCT tenant_id FROM audit_logs')).rows.map(r => r.tenant_id);
  const day = now.toISOString().slice(0, 10), purgeToday = day !== lastPurgeDay;
  for (const t of tenants) {
    try {
      await seal(t);
      if (purgeToday) await purge(t, (await require('./settingsPolicyService').read(t, 'security')).auditRetentionYears || 2, now);
    } catch (error) { console.error('[Denetim kaydı]', t, error.message); }
  }
  lastPurgeDay = day;
}

module.exports = { seal, verify, purge, tick, link, canonical };
