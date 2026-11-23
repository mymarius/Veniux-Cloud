// Barkod sağlayıcıları için ortak doğrulama: dış veri güvenilmezdir, forma yalnız temizlenmiş "öneri" olarak gider.
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Görsel yalnız https ve sağlayıcının izin verdiği alan adlarından kabul edilir.
function safeImage(value, hostPattern) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && hostPattern.test(u.hostname) ? u.href : '';
  } catch { return ''; }
}

// Sağlayıcıdan gelen ham alanları tek biçimli öneriye çevirir. Ad yoksa öneri yoktur (boş kayıt önerilmez).
function suggestion({ name, brand, quantityText, size, image, category }) {
  const n = clean(name, 200);
  if (!n) return null;
  const b = clean(brand, 80);
  const q = clean(quantityText, 40);
  const lower = s => s.toLocaleLowerCase('tr');
  const nameHasBrand = b && lower(n).includes(lower(b));
  const nameHasQty = q && lower(n).replace(/\s/g, '').includes(lower(q).replace(/\s/g, ''));
  return {
    name: n,
    brand: b || null,
    quantity_text: q || null,
    size: size && Number.isFinite(size.value) && size.value > 0 && size.unit ? { value: size.value, unit: clean(size.unit, 8).toLowerCase() } : null,
    image_url: image || null,
    category: clean(category, 80) || null,
    suggested_name: [nameHasBrand ? '' : b, n, nameHasQty ? '' : q].filter(Boolean).join(' ').slice(0, 200),
    suggested_unit: 'adet'
  };
}

// HTTP hatasını anahtar sızdırmadan tanımlayan hata (adres ve başlıklar mesaja girmez).
const httpError = status => Object.assign(new Error('http ' + status), { httpStatus: status });

module.exports = { clean, safeImage, suggestion, httpError };
