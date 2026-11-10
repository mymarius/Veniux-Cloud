// Çevrimdışı ürün listesi: tüm katalog sayfa sayfa indirilir (eski 250 ürünlük önbellek yetmez), barkod ve SKU ile aranır.
// Yalnız birebir eşleşme aranır; tartı etiketi ve GS1 çözümleme çevrimdışı yoktur.
const FIELDS = ['id', 'name', 'barcode', 'sku', 'category', 'unit', 'sale_price', 'kdv_orani'];
export const slim = p => Object.fromEntries(FIELDS.map(k => [k, p[k] ?? null]));

// fetchPage(after) -> {items, next}; sınır: 50 sayfa. Yarıda kalırsa çağıran mevcut önbelleği değiştirmez.
export async function downloadCatalog(fetchPage, { maxPages = 50 } = {}) {
  const items = [];
  let after = 0;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(after);
    for (const p of result.items || []) items.push(slim(p));
    if (!result.next) return { items, complete: true };
    if (result.next <= after) throw new Error('Ürün listesi sayfalaması ilerlemedi.');
    after = result.next;
  }
  return { items, complete: false };
}
export function buildIndex(items) {
  const index = new Map();
  for (const p of items) for (const code of [p.barcode, p.sku]) if (code) { const key = String(code); if (!index.has(key)) index.set(key, p); }
  return index;
}
export function findProduct(index, code) { return index.get(String(code || '').trim()) || null; }
