// Sunucu tarafı metinlerde (fiş, belge, dışa aktarım, uyarı) para birimi birimi. Tutarı biçimleme çağıranın işidir; burada yalnız birim adı/simge.
// TRY için eski çıktı korunur ("TL"); yazıcı/belge güvenliği için AZN "AZN" yazılır (₼ simgesi çoğu fiş yazıcı kod sayfasında yoktur).
const CODES = { TRY: 'TL', AZN: 'AZN', USD: 'USD', EUR: 'EUR', GBP: 'GBP' };
const SYMBOLS = { TRY: '₺', AZN: '₼', USD: '$', EUR: '€', GBP: '£' };
const norm = c => { const v = String(c || '').trim().toUpperCase(); return CODES[v] ? v : 'TRY'; };
module.exports = { unit: c => CODES[norm(c)], symbol: c => SYMBOLS[norm(c)], normalize: norm };
