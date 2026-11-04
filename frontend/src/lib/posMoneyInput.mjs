const decimal=new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
export function moneyNumber(value){return Number.isFinite(Number(value))?decimal.format(Number(value)):'';}
export function moneyLabel(value){return Number.isFinite(Number(value))?moneyNumber(value)+' TL':'—';}
// Presentation boundary only; the API continues receiving canonical decimal strings.
// Reject excess decimals rather than silently rounding an entered amount.
export function canonicalMoney(value){
 const raw=String(value).trim();if(raw==='')return '';
 if(/^\d+(?:,\d{0,2})?$/.test(raw))return raw.replace(',','.');
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d{0,2})?$/.test(raw))return raw.replaceAll('.','').replace(',','.');
 if(/^\d+(?:\.\d{0,2})?$/.test(raw))return raw;
 return null;
}
