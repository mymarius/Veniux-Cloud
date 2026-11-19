// Paket birleştirme: hırdavat ve züccaciye ayrı satılan sektör paketi olmaktan çıkar, perakende ve depo paketlerinin içine girer.
// Katalog okunurken uygulanır (idempotent, veritabanındaki fiyatlara dokunmaz). Eski sözleşmeler kendi modül listesini korur.
const MERGED = ['hardware', 'tableware'];
const WITH_ONLINE = ['UNIFIED_BUSINESS', 'UNIFIED_ENTERPRISE', 'UNIFIED_UNIFIED'];
const INCLUDE_MERGED = ['RETAIL_PRO', 'RETAIL_BUSINESS', 'WAREHOUSE_PRO', 'WAREHOUSE_ENTERPRISE', 'UNIFIED_START', 'UNIFIED_BUSINESS', 'UNIFIED_ENTERPRISE', 'UNIFIED_UNIFIED'];
// Yeni satışta gösterilmez; mevcut sözleşmeler çalışmaya devam eder.
const RETIRED = ['RETAIL_HIRDAVAT', 'RETAIL_ZUCCACIYE', 'RETAIL_ONLINE'];
// Yalnız platform sahibi fiyat girmemişse görünen önerilen fiyatlar (KDV dahil, kuruş). Sahibin girdiği fiyat her zaman önceliklidir.
const DEFAULT_PRICES = { RETAIL_PRO: { annual_cents: 549000, monthly_cents: 59900 }, UNIFIED_BUSINESS: { annual_cents: 1490000, monthly_cents: null } };

function normalise(catalogue) {
  const plans = catalogue.plans.map(plan => {
    const next = { ...plan, modules: [...plan.modules] };
    const add = m => { if (!next.modules.includes(m)) next.modules.push(m); };
    if (INCLUDE_MERGED.includes(next.code)) MERGED.forEach(add);
    if (WITH_ONLINE.includes(next.code)) add('online_store');
    // Satıştan kaldırma yalnız varsayılan katalogda (henüz kaydedilmiş katalog yokken); platform sahibi kaydettiyse karar onundur.
    if (RETIRED.includes(next.code) && !catalogue.revision) next.available = false;
    const price = DEFAULT_PRICES[next.code];
    if (price && next.monthly_cents == null && next.annual_cents == null) { next.monthly_cents = price.monthly_cents; next.annual_cents = price.annual_cents; }
    return next;
  });
  return { ...catalogue, plans };
}

module.exports = { normalise, MERGED, RETIRED, INCLUDE_MERGED, DEFAULT_PRICES };
