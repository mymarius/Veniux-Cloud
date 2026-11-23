// Merkezi para biçimleme. Ülke/para birimi bilgisi tek yerde; çağıranlar ₺ veya tr-TR yazmaz.
// Yeni ülke: CURRENCIES'e bir satır eklemek yeter. Tutarlar saklanırken ayrıca kendi para birimiyle tutulmalıdır (şema işi, ayrı).
export const CURRENCIES = {
  TRY: { symbol: '₺', locale: 'tr-TR', digits: 2 },
  AZN: { symbol: '₼', locale: 'az-Latn-AZ', digits: 2 },
  USD: { symbol: '$', locale: 'en-US', digits: 2 },
  EUR: { symbol: '€', locale: 'de-DE', digits: 2 },
  GBP: { symbol: '£', locale: 'en-GB', digits: 2 },
};

let active = 'TRY';

export function normalizeCurrency(code) {
  const c = String(code || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CURRENCIES, c) ? c : 'TRY';
}
// Etiket/yer tutucu metinlerde ₺ yerine kullanılır: currencySymbol() → "₺" veya "₼".
export function currencySymbol(code = active) { return CURRENCIES[normalizeCurrency(code)].symbol; }
export function setActiveCurrency(code) { active = normalizeCurrency(code); return active; }
export function getActiveCurrency() { return active; }

// Intl bazı yerellerde (az-Latn-AZ) sembolü "AZN" yazabilir; sembolü biz sabitleriz, sayıyı Intl biçimler.
export function formatMoney(value, { currency = active, decimals } = {}) {
  const code = normalizeCurrency(currency);
  const def = CURRENCIES[code];
  const n = Number(value);
  const d = decimals === undefined ? def.digits : decimals;
  const v = Number.isFinite(n) ? n : 0;
  const body = new Intl.NumberFormat(def.locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v));
  const neg = v < 0 && Number(body.replace(/[^\d]/g, '')) !== 0 ? '-' : '';
  return code === 'TRY' ? `${neg}₺${body}` : `${neg}${body} ${def.symbol}`;
}
