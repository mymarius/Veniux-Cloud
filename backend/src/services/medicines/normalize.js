// Türkçe arama normalizasyonu ve sağlayıcı verilerinin temizlenmesi.
// Orijinal ürün adları değiştirilmez; arama için ayrı normalize alanlar kullanılır.

// Önce Türkçe kurallarıyla küçük harfe çevrilir (İ→i, I→ı), sonra arama
// toleransı için harfler sadeleştirilir: "PAROL", "Parol", "parol" ve
// "İBUFEN"/"ibufen"/"ıbufen" aynı anahtara düşer.
const FOLD = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

function normalizeSearch(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/[ışğüöçâîû]/g, ch => FOLD[ch])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Dış kaynaktan gelen metinler: HTML etiketleri ve kontrol karakterleri atılır,
// uzunluk sınırlanır. Arayüzde ayrıca React kaçışı uygulanır.
function cleanText(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, max) : null;
}

// Barkod: yalnızca rakam, 8-14 hane. GTIN 14 haneye tamamlanır.
function cleanBarcode(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (/^\d+(\.0+)?$/.test(text)) text = text.replace(/\.0+$/, ''); // Excel sayısı
  if (/^\d(\.\d+)?e\+\d+$/i.test(text)) text = BigInt(Math.round(Number(text))).toString();
  // Kaynak dosyalarda barkoda yapışmış ":" , boşluk, görünmez karakter vb. temizlenir;
  // harf içeren değerler barkod sayılmaz.
  if (!/\p{L}/u.test(text)) text = text.replace(/\D/g, '');
  return /^\d{8,14}$/.test(text) ? text : null;
}

const toGtin = barcode => (barcode ? barcode.padStart(14, '0') : null);

// GTIN kontrol hanesi doğrulaması (bilgi amaçlı; geçersiz olanlar reddedilmez).
function hasValidCheckDigit(barcode) {
  if (!barcode) return false;
  const digits = barcode.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

// "1.234,56" / "1234.56" / 1234.56 → 1234.56
function parsePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
  let text = String(value).replace(/[^\d.,-]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

// Tarih → 'YYYY-MM-DD'. Excel seri numarası, "gg.aa.yyyy", "gg/aa/yyyy" ve ISO kabul edilir.
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const pad = n => String(n).padStart(2, '0');
  const build = (y, m, d) => {
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y >= 1900 && y <= 2100 ? `${y}-${pad(m)}-${pad(d)}` : null;
  };
  if (typeof value === 'number') {
    if (value < 1 || value > 80000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 864e5); // Excel seri günü
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) return build(+m[3], +m[2], +m[1]); // Türkiye biçimi: gün.ay.yıl
  if (/^\d+(\.\d+)?$/.test(text)) return parseDate(Number(text));
  return null;
}

const STATUS_MAP = [
  [/^(aktif|active|satista|piyasada|evet var|var|1|true)$/, 'active'],
  [/askida|askiya|suspend|gecici/, 'suspended'],
  [/pasif|iptal|cekil|passive|withdrawn|inactive|^(0|false|yok|hayir)$/, 'passive']
];
function normalizeStatus(value) {
  const text = normalizeSearch(value);
  if (!text) return 'active';
  for (const [pattern, status] of STATUS_MAP) if (pattern.test(text)) return status;
  return 'active';
}

const safeHttpsUrl = value => {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'https:' ? url.toString().slice(0, 1000) : null;
  } catch { return null; }
};

module.exports = { normalizeSearch, cleanText, cleanBarcode, toGtin, hasValidCheckDigit, parsePrice, parseDate, normalizeStatus, safeHttpsUrl };
