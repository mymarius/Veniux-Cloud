// Büyük katalogda (on binlerce ürün) ekranların tüm ürünleri indirmemesi için ortak yardımcılar.
// Sunucu: GET /products?search=&limit=1..1000&offset=  ve  GET /stock/records?limit=1..2000&offset=

export const PRODUCT_PICK_LIMIT = 20;

const asRows = data => (Array.isArray(data) ? data : data?.products || data?.data || []);

// Yazdıkça aranan seçim kutuları için: en fazla `limit` ürün (boş arama = en yeni ürünler).
export async function searchProducts(api, query = '', { limit = PRODUCT_PICK_LIMIT, signal } = {}) {
  const params = { limit };
  if (String(query).trim()) params.search = String(query).trim();
  const res = await api.get('/products', { params, signal });
  return asRows(res.data);
}

// Aynı ürünü iki kez eklemeden birleştirir; `first` listede önce gelir (ör. seçili ürün).
export function mergeProducts(first = [], second = []) {
  const seen = new Set();
  const out = [];
  for (const p of [...first, ...second]) {
    if (!p || seen.has(String(p.id))) continue;
    seen.add(String(p.id));
    out.push(p);
  }
  return out;
}

// Gerçekten tüm kaydı isteyen yerler (dışa aktarma) için sayfa sayfa çeker; bellekte tek dev yanıt oluşmaz.
// `maxPages` sınırı sonsuz döngüyü önler. Sayfa boyutundan az dönen sayfa sonuncudur.
export async function fetchAllPages(api, url, { params = {}, pageSize = 2000, maxPages = 500, onPage } = {}) {
  const all = [];
  for (let page = 0; page < maxPages; page++) {
    const res = await api.get(url, { params: { ...params, limit: pageSize, offset: page * pageSize } });
    const rows = asRows(res.data);
    if (!Array.isArray(rows)) throw new Error('INVALID_PAGE');
    all.push(...rows);
    onPage?.(all.length);
    if (rows.length < pageSize) return all;
  }
  throw new Error('TOO_MANY_PAGES');
}

// Ekranda çizilen satır sayısını sınırlar (50 bin satırlık tablo DOM'u dondurur). Sayfa numarası sınır dışıysa kırpılır.
export const LIST_PAGE_SIZE = 100;
export function pageSlice(rows = [], page = 0, size = LIST_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { rows: rows.slice(current * size, (current + 1) * size), page: current, pages, total: rows.length, from: rows.length ? current * size + 1 : 0, to: Math.min(rows.length, (current + 1) * size) };
}
