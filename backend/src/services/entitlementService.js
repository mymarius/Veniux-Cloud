const db = require('../config/database');

// Yeni paket matrisi (shared/planMatrix.mjs) ile mevcut lisansları eşler. Eski lisanslar özellik KAYBETMEZ:
// eski planların hepsi en kapsamlı yeni plana (İşletme WMS) eşlenir. Zorlama VENIUX_PLAN_ENFORCE=1 ile açılır;
// varsayılan kapalıdır, yani bu servis şimdilik yalnız bilgi verir ve canlı davranışı değiştirmez.
const LEGACY = {
  STARTER_ANNUAL: 'business_wms', NORMAL_WMS_ANNUAL: 'business_wms', BUSINESS_ANNUAL: 'business_wms',
  ENTERPRISE_ANNUAL: 'business_wms', ENTERPRISE_SUITE_ANNUAL: 'business_wms'
};
const TRIAL_PREFIX = 'Veniux Demo';
let matrix;
const load = async () => matrix || (matrix = await import('../../../shared/planMatrix.mjs'));
const parse = v => { const t = Date.parse(String(v || '').includes('T') ? v : String(v || '').replace(' ', 'T') + 'Z'); return Number.isFinite(t) ? t : null; };
const enforced = () => process.env.VENIUX_PLAN_ENFORCE === '1';

async function forTenant(user, central, now = Date.now()) {
  const m = await load();
  if (user.isPlatformAdmin) return { ...m.entitlement({ plan: 'business_wms', addons: ['restaurant_addon'], now }), enforced: false, source: 'platform' };
  const lic = central?.valid ? central : (await db.query("SELECT plan_id,status,expires_at,enabled_features_json FROM licenses WHERE tenant_id=$1 AND status IN ('ACTIVE','PAST_DUE') ORDER BY expires_at DESC LIMIT 1", [user.tenantId])).rows[0];
  const company = (await db.query('SELECT company_name FROM tenants WHERE id=$1', [user.tenantId])).rows[0]?.company_name || '';
  const expiry = lic ? parse(lic.expires_at) : null;
  const active = Boolean(lic) && expiry != null && expiry > now;
  const isTrial = String(company).startsWith(TRIAL_PREFIX);
  let plan = 'lite', trialEndsAt = null, source = active ? 'license' : 'none';
  if (active) plan = LEGACY[lic.plan_id] || (m.PLANS[lic.plan_id] ? lic.plan_id : 'business_wms');
  if (isTrial && active) { plan = 'lite'; trialEndsAt = expiry; source = 'trial'; }
  const addons = (await require('./sectorPacks').has(user, 'restaurant', central).catch(() => false)) ? ['restaurant_addon'] : [];
  const e = m.entitlement({ plan, addons, now, trialEndsAt });
  return { ...e, enforced: enforced(), source, expires_at: expiry, plan_name: m.PLANS[e.plan].name };
}

// Zorlama kapalıyken her zaman geçer; açıkken matristeki özelliği ister.
const requireFeature = feature => async (req, res, next) => {
  try {
    if (!enforced()) return next();
    const e = await forTenant(req.user, req.centralLicense);
    if (e.has(feature)) return next();
    res.status(402).json({ error: 'Bu özellik paketinizde yok. Paketi yükselterek açabilirsiniz.', code: 'FEATURE_LOCKED', feature, plan: e.plan });
  } catch (err) { next(err); }
};

module.exports = { forTenant, requireFeature, LEGACY, enforced };
