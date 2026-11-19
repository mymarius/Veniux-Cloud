const db = require('../config/database');

// Yeni paket matrisi (shared/planMatrix.mjs) ile mevcut lisansları eşler. Eski lisanslar özellik KAYBETMEZ:
// eski planların hepsi en kapsamlı yeni plana (İşletme WMS) eşlenir. Zorlama VENIUX_PLAN_ENFORCE=1 ile açılır;
// varsayılan kapalıdır, yani bu servis şimdilik yalnız bilgi verir ve canlı davranışı değiştirmez.
const LEGACY = {
  STARTER_ANNUAL: 'business_wms', NORMAL_WMS_ANNUAL: 'business_wms', BUSINESS_ANNUAL: 'business_wms',
  ENTERPRISE_ANNUAL: 'business_wms', ENTERPRISE_SUITE_ANNUAL: 'business_wms',
  LITE_FOREVER: 'lite', LIFETIME_DESKTOP: 'lifetime_desktop'
};
const TRIAL_PREFIX = 'Veniux Demo';
// Katalog modüllerinden plan: depo (wms) varsa İşletme WMS, gelişmiş rapor/cari varsa Pro, yalnız stok+kasa ise Lite hak kümesi.
const fromModules = mods => (mods.includes('wms') ? 'business_wms' : (mods.includes('reports_pro') || mods.includes('credit')) ? 'pro' : 'lite');
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
  if (active) {
    // Paket sözleşmesi (modül listeli katalog paketi) varsa hak, sözleşmenin modüllerinden türetilir; yoksa eski plan eşlemesi.
    let contract = null;
    try { contract = require('./productPackages').parse(central?.product_package ? { product_package: central.product_package } : JSON.parse(lic.enabled_features_json || '{}')); } catch { contract = null; }
    if (contract) plan = fromModules(contract.modules);
    else plan = LEGACY[lic.plan_id] || (m.PLANS[lic.plan_id] ? lic.plan_id : 'business_wms');
  }
  if (isTrial && active) { plan = 'lite'; trialEndsAt = expiry; source = 'trial'; }
  const addons = (await require('./sectorPacks').has(user, 'restaurant', central).catch(() => false)) ? ['restaurant_addon'] : [];
  let cloudUntil = null;
  try { const f = JSON.parse(lic?.enabled_features_json || '{}'); if (f.cloud_until) cloudUntil = Date.parse(f.cloud_until + 'T23:59:59Z'); } catch { cloudUntil = null; }
  const e = m.entitlement({ plan, addons, now, trialEndsAt, cloudUntil });
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

// Lite hesaplarda (yalnız LITE_FOREVER lisansı) yolların hangi özelliği istediği. Ücretli lisanslar bu kapıdan etkilenmez.
const LITE_PATHS = [
  [/^\/api\/ai(\/|$)/, 'ai_assistant'], [/^\/api\/online-store(\/|$)/, 'online_store'], [/^\/api\/marketplace(\/|$)/, 'marketplace'],
  [/^\/api\/edocuments(\/|$)/, 'edocument'], [/^\/api\/accounting-exports(\/|$)/, 'accounting_export'],
  [/^\/api\/scanner\/(gross-profit|pro\/(insights|together|reorder-forecast|expiry-discounts))/, 'cost_reports'], [/^\/api\/scanner\/pos-events/, 'cost_reports'],
  [/^\/api\/scanner\/pro\/(loyalty|campaigns)/, 'loyalty'], [/^\/api\/(scanner\/pro\/accounts|scanner\/accounts)/, 'credit_reminders'],
  [/^\/api\/(purchase-orders|suppliers)(\/|$)/, 'purchase_invoices'], [/^\/api\/wms(\/|$)/, 'wms_map'], [/^\/api\/sector\/(hardware|tableware)(\/|$)/, 'retail_depth'],
  [/^\/api\/sector\/restaurant(\/|$)/, 'tables'], [/^\/api\/(open-api|webhooks)(\/|$)/, 'open_api']
];
const liteCache = new Map();
async function isLite(tenantId, now = Date.now()) {
  const hit = liteCache.get(tenantId);
  if (hit && now - hit.at < 60000) return hit.lite;
  const lic = (await db.query("SELECT plan_id FROM licenses WHERE tenant_id=$1 AND status IN ('ACTIVE','PAST_DUE') ORDER BY expires_at DESC LIMIT 1", [tenantId])).rows[0];
  const lite = lic?.plan_id === 'LITE_FOREVER';
  liteCache.set(tenantId, { at: now, lite });
  return lite;
}
const featureFor = path => (LITE_PATHS.find(([re]) => re.test(path)) || [])[1] || null;

// authMiddleware'den çağrılır: yalnız Lite lisanslı işletmede premium yolları engeller.
async function liteGuard(user, path) {
  if (user.isPlatformAdmin) return;
  const feature = featureFor(path);
  if (!feature || !(await isLite(user.tenantId))) return;
  throw Object.assign(new Error('Bu özellik Lite pakette yok. Paketi yükselterek açabilirsiniz.'), { status: 402, code: 'FEATURE_LOCKED', feature });
}

module.exports = { fromModules, forTenant, requireFeature, liteGuard, featureFor, isLite, _clearLite: () => liteCache.clear(), LEGACY, enforced };
