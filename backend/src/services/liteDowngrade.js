const db = require('../config/database');
const licenseService = require('./licenseService');

// Süresi (ve ek süresi) dolan ücretli lisanslı işletmeyi veri silmeden ücretsiz Lite lisansına indirir.
// Varsayılan KAPALI: VENIUX_LITE_DOWNGRADE=1 olmadıkça cron çalıştırmaz (ücretsiz erişim vermek ticari karardır).
// Deneme/demo hesapları (şirket adı "Veniux Demo" ile başlar) etkilenmez; onlar kendi silme akışına tabidir.
const TRIAL_PREFIX = 'Veniux Demo';
const DAY = 86400000;
const parse = v => { const t = Date.parse(String(v || '').includes('T') ? v : String(v || '').replace(' ', 'T') + 'Z'); return Number.isFinite(t) ? t : null; };
const stamp = ms => new Date(ms).toISOString().replace('T', ' ').replace('Z', '');

async function run({ now = Date.now(), graceDays = 14 } = {}) {
  const plan = licenseService.getPlans().find(p => p.id === 'LITE_FOREVER');
  const tenants = (await db.query("SELECT id, company_name FROM tenants WHERE COALESCE(is_active,1)=1")).rows;
  const moved = [];
  for (const t of tenants) {
    if (String(t.company_name || '').startsWith(TRIAL_PREFIX)) continue;
    const latest = (await db.query('SELECT id,plan_id,status,expires_at FROM licenses WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1', [t.id])).rows[0];
    if (!latest || latest.plan_id === 'LITE_FOREVER' || latest.plan_id === 'LIFETIME_DESKTOP') continue;
    const expiry = parse(latest.expires_at);
    if (expiry == null || expiry + graceDays * DAY > now) continue;
    if (['REVOKED', 'SUSPENDED', 'PENDING_PAYMENT'].includes(latest.status)) continue;
    await db.transaction(async tx => {
      await tx.query("UPDATE licenses SET status='EXPIRED' WHERE id=$1 AND tenant_id=$2", [latest.id, t.id]);
      await tx.query(`INSERT INTO licenses (license_key, tenant_id, plan_id, status, max_users, max_warehouses, max_devices, max_pdas, enabled_features_json, issued_at, expires_at, grace_period_days)
        VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6,$7,$8,CURRENT_TIMESTAMP,$9,14)`,
      [licenseService.generateKey(), t.id, plan.id, plan.max_users, plan.max_warehouses, plan.max_devices, plan.max_pdas, JSON.stringify(plan.features), stamp(now + 36500 * DAY)]);
      await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)', [t.id, 'system', 'license.downgraded_to_lite', 'license', JSON.stringify({ from: latest.plan_id, expired_at: latest.expires_at })]);
    });
    moved.push(Number(t.id));
  }
  return { moved };
}

const enabled = () => process.env.VENIUX_LITE_DOWNGRADE === '1';
module.exports = { run, enabled };
