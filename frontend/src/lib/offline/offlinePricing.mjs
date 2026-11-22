// Çevrimdışı fiyat kuralları: sunucudaki priceTierService + currencyService + customerPriceService ile aynı sıra ve yuvarlama.
// 1) Fiyat türü (müşteri kuralı varsa kural, yoksa kasiyerin seçtiği) → ürünün o türdeki fiyatı varsa o fiyat
// 2) Tür fiyatı uygulanmadıysa ve ürün dövizliyse: döviz fiyatı × kur
// 3) Müşteri iskontosu (%). Koli/paket satırlarına dokunulmaz (sunucuyla aynı).
const round2 = n => Math.round(n * 100) / 100;

export function effectiveTier(selectedTier, customerRule) {
  const t = Number(customerRule?.price_tier);
  return t > 1 ? t : Number(selectedTier) || 1;
}

// product: {sale_price, tiers?:{2:x,3:y}, fx?:{currency,price}, pack?}; rates: {USD:{rate}}; customerRule: {price_tier,discount_percent}|null
export function priceOffline(product, { tier = 1, customerRule = null, rates = {} } = {}) {
  let unit = Number(product.sale_price), appliedTier = null, fx = null, discount = null;
  if (product.pack) return { unit_price: unit, price_tier: null, fx: null, customer_discount: null };
  const eff = effectiveTier(tier, customerRule);
  const tierPrice = eff > 1 ? product.tiers?.[eff] : undefined;
  if (tierPrice !== undefined && tierPrice !== null) { unit = Number(tierPrice); appliedTier = eff; }
  else if (product.fx && rates[product.fx.currency]?.rate > 0) {
    const rate = Number(rates[product.fx.currency].rate);
    unit = round2(Number(product.fx.price) * rate);
    fx = { currency: product.fx.currency, price: Number(product.fx.price), rate };
  }
  const pct = Number(customerRule?.discount_percent) || 0;
  if (pct > 0) { unit = round2(unit * (1 - pct / 100)); discount = pct; }
  return { unit_price: unit, price_tier: appliedTier, fx, customer_discount: discount };
}

// Ödeme para birimi karşılığı (kasada gösterim): TL kuruş → döviz tutarı
export function toCurrency(totalCents, rate) { return rate > 0 ? Math.round(Number(totalCents) / Number(rate)) / 100 : null; }

const KEY = 'veniux:offline-pricing';
export function savePricing(storage, data) { try { storage.setItem(KEY, JSON.stringify({ ...loadPricing(storage), ...data })); } catch { /* dolu depo */ } }
export function loadPricing(storage) { try { const v = JSON.parse(storage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
