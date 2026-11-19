// İki seviyeli ürün grubu: "İçecek › Gazlı İçecek" biçiminde yazılan kategori adından ağaç çıkarılır (şema değişmez).
export const SEP = ' › ';

// "a>b", "a > b" gibi yazımlar tek biçime çevrilir; en çok iki seviye tutulur.
export function normalizeCategory(value) {
  const parts = String(value || '').split(/\s*[›>]\s*/).map(p => p.trim()).filter(Boolean).slice(0, 2);
  return parts.join(SEP);
}

// Filtre listesi: üst gruplar kendi alt grupları üstünde; alt gruplar girintili. Yalnız alt grubu olan kayıtta üst grup da listeye eklenir.
export function categoryOptions(names) {
  const set = new Set();
  for (const raw of names || []) {
    const n = normalizeCategory(raw);
    if (!n) continue;
    set.add(n);
    set.add(n.split(SEP)[0]);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr')).map(value => {
    const depth = value.includes(SEP) ? 1 : 0;
    return { value, depth, label: depth ? '— ' + value.split(SEP)[1] : value };
  });
}

// Bir ürünün kategorisi seçili gruba ya da onun alt gruplarına giriyor mu?
export const inCategory = (productCategory, selected) => {
  const p = normalizeCategory(productCategory).toLocaleLowerCase('tr');
  const s = normalizeCategory(selected).toLocaleLowerCase('tr');
  return !s || p === s || p.startsWith(s + SEP);
};
