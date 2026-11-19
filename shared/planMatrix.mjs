// Paket ve özellik matrisi (Adım 1 tasarımı). Henüz lisans/satış akışına BAĞLI DEĞİL: canlı lisanslar ve fiyatlar değişmez.
// Bağlanması için onay gerekir (docs/PLAN-PAKET-VE-4-ADIM.md). Fiyatlar kullanıcı kararıdır, KDV dahil TL.
export const PLAN_IDS = ['lite', 'pro', 'lifetime_desktop', 'business_wms'];

export const FEATURES = [
  'offline_sales', 'products_stock', 'customer_credit', 'report_7d', 'auto_backup', 'ecr_bridge',
  'cost_reports', 'excel_import', 'multi_staff', 'purchase_invoices', 'shared_catalog', 'lot_expiry',
  'credit_reminders', 'loyalty', 'edocument', 'customer_display', 'retail_depth', 'mobile_app', 'web_app',
  'ai_assistant', 'ai_unlimited', 'wms_map', 'inbound_waybill', 'picking_shipping', 'transfers', 'count_approval',
  'marketplace', 'online_store', 'accounting_export', 'open_api'
];

const set = (...names) => Object.fromEntries(names.map(n => [n, true]));
const LITE = set('offline_sales', 'products_stock', 'customer_credit', 'report_7d', 'auto_backup', 'ecr_bridge', 'web_app');
const PRO = { ...LITE, ...set('cost_reports', 'excel_import', 'multi_staff', 'purchase_invoices', 'shared_catalog', 'lot_expiry', 'credit_reminders', 'loyalty', 'edocument', 'customer_display', 'retail_depth', 'mobile_app', 'ai_assistant') };

export const PLANS = {
  lite: { id: 'lite', name: 'Veniux Lite', price_try: 0, period: 'forever', limits: { desktop: 1, warehouses: 1, admins: 1, staff: 0, ai_monthly: 0 }, features: LITE },
  pro: { id: 'pro', name: 'Veniux Pro', price_try: 5490, monthly_try: 599, period: 'year', limits: { desktop: 1, warehouses: 1, admins: null, staff: null, ai_monthly: 100 }, features: PRO },
  lifetime_desktop: { id: 'lifetime_desktop', name: 'Veniux Ömür Boyu Masaüstü', price_try: 11490, period: 'once', limits: { desktop: 1, warehouses: 1, admins: null, staff: null, ai_monthly: 100 },
    features: { ...PRO }, bundled_cloud_years: 1 },
  business_wms: { id: 'business_wms', name: 'Veniux İşletme WMS', price_try: 14900, period: 'year', limits: { desktop: null, warehouses: 3, admins: null, staff: null, ai_monthly: null },
    features: { ...PRO, ...set('ai_unlimited', 'wms_map', 'inbound_waybill', 'picking_shipping', 'transfers', 'count_approval', 'marketplace', 'online_store', 'accounting_export', 'open_api') } }
};
export const RESTAURANT_ADDON = { id: 'restaurant_addon', name: 'Pide ve Restoran', requires: ['pro', 'lifetime_desktop', 'business_wms'], features: set('tables', 'waiter', 'kds', 'courier', 'recipe_stock') };
export const TRIAL = { days: 30, plan: 'business_wms', card_required: false, fallback: 'lite' };

// Bulut ve yapay zekâ maliyeti doğuran özellikler yalnız etkin abonelikte açık (Lite ve süresi dolmuş ömür boyu bulut yılı kapalı).
export const CLOUD_COST_FEATURES = ['ai_assistant', 'ai_unlimited', 'mobile_app', 'shared_catalog', 'edocument', 'marketplace', 'online_store'];

export function entitlement({ plan, addons = [], now = Date.now(), cloudUntil = null, trialEndsAt = null }) {
  const inTrial = trialEndsAt != null && now < trialEndsAt;
  const base = PLANS[inTrial ? TRIAL.plan : plan] || PLANS.lite;
  const features = { ...base.features };
  if (!inTrial && base.id === 'lifetime_desktop' && !(cloudUntil && now < cloudUntil)) for (const f of CLOUD_COST_FEATURES) delete features[f];
  for (const a of addons) if (a === RESTAURANT_ADDON.id && (inTrial || RESTAURANT_ADDON.requires.includes(base.id))) Object.assign(features, RESTAURANT_ADDON.features);
  return { plan: base.id, trial: inTrial, limits: base.limits, features, has: f => features[f] === true };
}

export const withinLimit = (value, limit) => limit == null || value <= limit;
