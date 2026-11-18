// Mal kabul: barkod okutarak ya da ürün adı yazarak kalem ekleme. Saf mantık; arayüzden bağımsız test edilir.
const blank = item => !item.product_id;
const same = (a, b) => String(a) === String(b);

export function findProduct(products = [], code = '') {
  const value = String(code).trim();
  if (!value) return null;
  const lower = value.toLocaleLowerCase('tr-TR');
  return products.find(p => same(p.barcode ?? '', value) || same(p.gtin ?? '', value) || same(p.sku ?? '', value))
    || products.find(p => String(p.name || '').toLocaleLowerCase('tr-TR') === lower)
    || null;
}

// Okutulan ürünü kalemlere ekler. Aynı ürün varsa miktarı artırır; ilk kalem boşsa onu doldurur.
// Sonuç: { items, status: 'added' | 'incremented' | 'notfound', product }
export function addScanned(items, products, code, amount = 1) {
  const product = findProduct(products, code);
  if (!product) return { items, status: 'notfound', product: null };
  const qty = Math.max(1, Number(amount) || 1);
  const index = items.findIndex(item => same(item.product_id, product.id));
  if (index >= 0) {
    const next = items.map((item, i) => (i === index ? { ...item, expected_qty: Number(item.expected_qty || 0) + qty } : item));
    return { items: next, status: 'incremented', product };
  }
  const row = { product_id: product.id, expected_qty: qty, lot_number: '', expiry_date: '' };
  const empty = items.findIndex(blank);
  if (empty >= 0 && items.length === 1) return { items: [row], status: 'added', product };
  if (empty >= 0) return { items: items.map((item, i) => (i === empty ? row : item)), status: 'added', product };
  return { items: [...items, row], status: 'added', product };
}

// İrsaliye numarası verilmediyse boş bırakılır (sunucu bunu isteğe bağlı kabul eder).
export const cleanWaybill = value => {
  const text = String(value ?? '').trim();
  return text ? text : null;
};

// Kabul numarası ekranda kısa gösterilir: INB-2026-ef0d91f1-e773-... -> INB-2026-EF0D91F1
export const shortReceiptNo = value => {
  const match = /^([A-Z]+-\d{4})-([0-9a-f]{8})-[0-9a-f-]+$/i.exec(String(value || ''));
  return match ? `${match[1]}-${match[2].toUpperCase()}` : String(value || '');
};
