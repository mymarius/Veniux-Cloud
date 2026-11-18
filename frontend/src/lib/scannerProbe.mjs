// Barkod okuyucu testi: okuyucular "klavye gibi" çok hızlı yazar ve Enter ile bitirir.
// Elle yazılan metin yavaş olduğu için ayırt edilir. Saf mantık; arayüzden bağımsız test edilir.
export const FAST_MS = 50; // tuşlar arası ortalama süre bu değerin altındaysa okuyucu sayılır
export const MIN_LENGTH = 6;

// times: her tuşun ms zaman damgası; text: okunan metin (Enter hariç)
export function classifyScan(times, text) {
  const value = String(text || '').trim();
  if (value.length < MIN_LENGTH || !Array.isArray(times) || times.length < value.length) {
    return { kind: 'short', message: 'Çok kısa. Okuyucuyla bir ürünün barkodunu okutun.' };
  }
  const gaps = [];
  for (let i = 1; i < times.length; i += 1) gaps.push(times[i] - times[i - 1]);
  const average = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity;
  if (average <= FAST_MS) return { kind: 'scanner', average: Math.round(average), message: 'Barkod okuyucu algılandı: ' + value };
  return { kind: 'manual', average: Math.round(average), message: 'Bu elle yazılmış gibi görünüyor. Okuyucuyla okutun.' };
}

const PRINTER_STATUS = { 0: 'Hazır', 1: 'Duraklatıldı', 2: 'Hata', 3: 'Siliniyor', 4: 'Kâğıt sıkıştı', 5: 'Kâğıt bitti', 6: 'Elle besleme', 7: 'Kâğıt sorunu', 8: 'Çevrimdışı' };
export const printerStatusText = value => PRINTER_STATUS[value] || (typeof value === 'string' && value ? value : 'Bilinmiyor');

// Yazıcı adına göre fiş (termal) yazıcı olup olmadığı tahmini; yalnız ipucu olarak gösterilir.
export const looksThermal = name => /pos|receipt|thermal|termal|tm-t|tsp|rp\d|xp-|fis|fiş|zjiang|epson|star|bixolon|citizen|sewoo|80mm|58mm/i.test(String(name || ''));
