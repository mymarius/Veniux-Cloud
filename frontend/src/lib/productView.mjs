// Ürün listesi: hızlı filtre ("Kritik", "Tükendi"...) ve sütun sıralaması. Saf mantık; arayüzden bağımsız test edilir.
export const stockState = product => {
  const qty = Number(product?.total_quantity || 0), min = Number(product?.min_stock_level || 0);
  return qty <= 0 ? 'out' : min > 0 && qty <= min ? 'low' : 'ok';
};
const costOf = product => Number(product?.purchase_price || product?.cost_price || 0);
const priceOf = product => Number(product?.sale_price || product?.kamu_fiyati || 0);

export const VIEWS = [['all', 'Tümü'], ['low', 'Kritik'], ['out', 'Tükendi'], ['nobarcode', 'Barkodsuz'], ['nocost', 'Maliyetsiz']];

export function matchesView(product, view) {
  switch (view) {
    case 'low': return stockState(product) === 'low';
    case 'out': return stockState(product) === 'out';
    case 'nobarcode': return !(product?.barcode || product?.gtin);
    case 'nocost': return costOf(product) <= 0;
    default: return true;
  }
}

export function countViews(products = []) {
  const counts = Object.fromEntries(VIEWS.map(([key]) => [key, 0]));
  for (const product of products) for (const [key] of VIEWS) if (matchesView(product, key)) counts[key] += 1;
  return counts;
}

const KEYS = {
  name: p => String(p?.name || ''),
  stock: p => Number(p?.total_quantity || 0),
  cost: costOf,
  price: priceOf
};

// dir: 'asc' | 'desc'. Anahtar bilinmiyorsa sıra değişmez. Özgün listeyi bozmaz.
export function sortProducts(products = [], key, dir = 'asc') {
  const pick = KEYS[key];
  if (!pick) return products;
  const sign = dir === 'desc' ? -1 : 1;
  return [...products].sort((a, b) => {
    const x = pick(a), y = pick(b);
    const order = typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y;
    return sign * order;
  });
}

// Başlığa tıklama: yeni sütun artan başlar, aynı sütun tekrar tıklanınca yön değişir, üçüncü tıklamada sıralama kalkar.
export function nextSort(current, key) {
  if (current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return { key: null, dir: 'asc' };
}
