// Bluetooth termal yazıcı için ESC/POS etiket üretimi (58/80 mm fiş yazıcıları ve çoğu mini raf etiketi yazıcısı).
// TSPL/ZPL gibi etiket dili konuşan yazıcılar desteklenmez. Türkçe karakterler varsayılan olarak ASCII'ye çevrilir
// (yazıcı kod sayfası bilinmeden bozuk yazı basmamak için); kod sayfası biliniyorsa options.codepage verilir.

const TR = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U', '₺': 'TL', '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '×': 'x' };
export const toAscii = text => String(text ?? '').replace(/[çÇğĞıİöÖşŞüÜ₺’“”–—×]/g, ch => TR[ch]).replace(/[^\x20-\x7e]/g, '?');

const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
export const money = value => Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';

// "123 456" gibi ayırıcı içermeyen barkod: yalnız yazdırılabilir ASCII; EAN-13 ise 13 rakam ve doğru sağlama basamağı.
export function ean13Valid(code) {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = [...code].map(Number), sum = digits.slice(0, 12).reduce((s, d, i) => s + d * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

function wrap(text, width) {
  const words = toAscii(text).split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= width) line += ' ' + word;
    else { lines.push(line); line = word; }
    while (line.length > width) { lines.push(line.slice(0, width)); line = line.slice(width); }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

// Etiket: ürün adı (iri, ortalı), fiyat (çok iri), barkod ve barkod yazısı; sonda boşluk ve (varsa) kesme.
export function encodeLabel({ name, price, barcode, unit, columns = 32, cut = true } = {}) {
  const out = [];
  const push = (...bytes) => out.push(...bytes);
  const text = value => { for (const ch of toAscii(value)) push(ch.charCodeAt(0)); };
  push(ESC, 0x40);                       // yazıcıyı başlat
  push(ESC, 0x61, 1);                    // ortala
  push(GS, 0x21, 0x01); push(ESC, 0x45, 1); // çift yükseklik, kalın
  for (const line of wrap(name || '', Math.max(10, Math.floor(columns / 2) + 6))) { text(line); push(LF); }
  push(ESC, 0x45, 0);
  push(GS, 0x21, 0x33);                  // 4x4 büyük: fiyat
  text(money(price)); push(LF);
  push(GS, 0x21, 0x00);
  if (unit) { text('Birim: ' + unit); push(LF); }
  const code = String(barcode ?? '').trim();
  if (code) {
    push(GS, 0x68, 60);                  // barkod yüksekliği
    push(GS, 0x77, code.length > 16 ? 2 : 3); // modül genişliği
    push(GS, 0x48, 2);                   // okunur yazı barkodun altında
    if (ean13Valid(code)) { push(GS, 0x6b, 2); for (const ch of code) push(ch.charCodeAt(0)); push(0); }
    else { const data = '{B' + toAscii(code).slice(0, 40); push(GS, 0x6b, 73, data.length); text(data); }
    push(LF);
  }
  push(ESC, 0x61, 0);
  push(LF, LF, LF);
  if (cut) push(GS, 0x56, 66, 0);        // kısmi kesme (etiket yazıcıları yok sayar)
  return Uint8Array.from(out);
}

// Bluetooth'a yazarken paket boyutu sınırı: BLE paketleri küçüktür; parçalara bölünür.
export function chunk(bytes, size = 100) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += size) parts.push(bytes.slice(i, i + size));
  return parts;
}
