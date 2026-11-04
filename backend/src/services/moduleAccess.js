const db = require('../config/database');
async function getModuleType(tenantId, centralLicense) {
  if(require('./centralLicense').enabled()) {
    if(!centralLicense?.valid)return 'NONE';
    const type=require('./licenseService').getPlans().find(p=>p.id===centralLicense.plan_id)?.features?.module_type;
    return ['NORMAL','BOTH'].includes(type)?'NORMAL':'NONE';
  }
  const license = (await db.query('SELECT status,expires_at,plan_id,enabled_features_json FROM licenses WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1', [tenantId])).rows[0];
  if (!license || license.status !== 'ACTIVE' || !license.expires_at) return 'NONE';
  const raw = String(license.expires_at);
  const expiry = Date.parse(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return 'NONE';
  let features;
  try { features = JSON.parse(license.enabled_features_json || '{}'); } catch { return 'NONE'; }
  if (!features || typeof features !== 'object' || Array.isArray(features)) return 'NONE';
  const type = features.module_type ?? require('./licenseService').getPlans().find(p => p.id === license.plan_id)?.features?.module_type;
  return ['NORMAL', 'BOTH'].includes(type) ? 'NORMAL' : 'NONE';
}
module.exports = { getModuleType };
