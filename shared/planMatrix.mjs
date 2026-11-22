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
  pro: { id: 'pro', name: 'Veniux Pro', price_try: 7990, monthly_try: 849, period: 'year', limits: { desktop: 1, warehouses: 1, admins: null, staff: null, ai_monthly: 100 }, features: PRO },
  lifetime_desktop: { id: 'lifetime_desktop', name: 'Veniux Ömür Boyu Masaüstü', price_try: 15990, period: 'once', limits: { desktop: 1, warehouses: 1, admins: null, staff: null, ai_monthly: 100 },
    features: { ...PRO }, bundled_cloud_years: 1 },
  business_wms: { id: 'business_wms', name: 'Veniux İşletme WMS', price_try: 21900, period: 'year', limits: { desktop: null, warehouses: 3, admins: null, staff: null, ai_monthly: null },
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

// ---- Web sitesi için Türkçe etiketler ve karşılaştırma grupları (tools/site/export-plans.mjs bunu JSON'a döker) ----
export const FEATURE_LABELS = {
  offline_sales: 'İnternetsiz barkodlu satış', products_stock: 'Ürün ve stok takibi', customer_credit: 'Müşteri veresiye takibi', report_7d: 'Günlük rapor (son 7 gün)',
  auto_backup: 'Otomatik günlük yedek', ecr_bridge: 'Yazarkasa köprüsü', cost_reports: 'Kâr, maliyet ve tüm geçmiş raporlar', excel_import: 'Excel ile ürün aktarma ve dışa aktarma',
  multi_staff: 'Sınırsız personel ve yetkilendirme', purchase_invoices: 'Alış faturası ve firma yönetimi', shared_catalog: 'Hazır barkodlu ürün kataloğu', lot_expiry: 'Lot ve son kullanma tarihi (miat)',
  credit_reminders: 'Veresiye vade hatırlatması', loyalty: 'Sadakat puanı ve damga kartı', edocument: 'e-Fatura ve e-Arşiv', customer_display: 'Müşteri ekranı (ikinci monitör)',
  retail_depth: 'Hırdavat, züccaciye ve butik özellikleri (ölçü/raf, takım, beden/renk)', mobile_app: 'Mobil uygulama (Android)', web_app: 'Web uygulaması', ai_assistant: 'İşletme asistanı (aylık 100 sorgu)',
  ai_unlimited: 'Sınırsız asistan ve fatura okuma', wms_map: 'Koridor, raf ve göz haritası', inbound_waybill: 'İrsaliyeli mal kabul', picking_shipping: 'Toplama ve sevkiyat',
  transfers: 'Depolar ve şubeler arası transfer', count_approval: 'Yönetici onaylı sayım farkı', marketplace: 'Pazaryeri bağlantıları', online_store: 'Online mağaza',
  accounting_export: 'Muhasebe aktarımı', open_api: 'Açık API ve webhook'
};
export const FEATURE_GROUPS = [
  ['Satış ve stok', ['offline_sales', 'products_stock', 'lot_expiry', 'retail_depth', 'shared_catalog', 'excel_import']],
  ['Cari ve finans', ['customer_credit', 'credit_reminders', 'purchase_invoices', 'loyalty', 'edocument', 'accounting_export']],
  ['Raporlama', ['report_7d', 'cost_reports']],
  ['Personel ve cihaz', ['multi_staff', 'customer_display', 'ecr_bridge']],
  ['Erişim', ['web_app', 'mobile_app', 'auto_backup']],
  ['Depo ve büyüme', ['wms_map', 'inbound_waybill', 'picking_shipping', 'transfers', 'count_approval', 'marketplace', 'online_store', 'open_api']],
  ['Yapay zekâ', ['ai_assistant', 'ai_unlimited']]
];
export const ADDON_LABELS = { tables: 'Masa ve salon planı', waiter: 'Garson sipariş ekranı (telefon ve dokunmatik)', kds: 'Mutfak ekranı ve sesli uyarı', courier: 'Paket ve motor kurye takibi', recipe_stock: 'Reçeteye göre hammadde stok düşümü' };
export const TAGLINES = {
  lite: 'Mikro işletmeler için. Masraf yok, süre sınırı yok.',
  pro: 'Satış, stok ve cariyi profesyonelce yöneten işletmeler için.',
  lifetime_desktop: 'Tek bilgisayarda ömür boyu kullanmak isteyenler için; ilk yıl web ve mobil hediye.',
  business_wms: 'Birden çok depo, şube ve kasa: depo yönetimi ve büyüme araçları.'
};
