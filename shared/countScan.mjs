// Hızlı sayım: raf kodu okutulunca etkin raf değişir, ürün barkodu okutulunca o satırın sayacı bir artar.
const same = (a, b) => String(a ?? '').trim().toLocaleLowerCase('tr-TR') === String(b ?? '').trim().toLocaleLowerCase('tr-TR');
export const countKey = row => row.location_id + ':' + row.product_id + ':' + (row.lot_id ?? 'none');

export function applyScan(rows, counts, code, location = null) {
  if (!String(code ?? '').trim()) return { counts, location, error: 'Okunan kod boş.' };
  const shelf = rows.find(row => same(row.location_code, code));
  if (shelf) return { counts, location: shelf.location_id, shelf: shelf.location_code };
  const products = rows.filter(row => row.product_id && (same(row.barcode, code) || same(row.sku, code)));
  if (!products.length) return { counts, location, error: `${code} bu sayım listesinde yok. Ürün başka rafta olabilir; manuel satır ekleyin.` };
  const matches = location === null ? products : products.filter(row => row.location_id === location);
  if (!matches.length) return { counts, location, error: `${products[0].product_name} seçili rafta görünmüyor. Doğru rafı okutun veya manuel satır ekleyin.` };
  if (matches.length > 1) return { counts, location, error: `${matches[0].product_name} birden fazla raf veya lotta var. Önce raf kodunu okutun; lotluysa miktarı satıra elle girin.` };
  const row = matches[0], key = countKey(row);
  const quantity = Number(counts[key] || 0) + 1;
  return { counts: { ...counts, [key]: String(quantity) }, location, row, quantity };
}

export function countProgress(rows, counts) {
  const countable = rows.filter(row => row.product_id);
  const done = countable.filter(row => counts[countKey(row)] !== '' && counts[countKey(row)] !== undefined).length;
  return { done, total: countable.length, percent: countable.length ? Math.round(done / countable.length * 100) : 0 };
}
