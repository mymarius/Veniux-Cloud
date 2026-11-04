// Integer kuruş only. Historical receipts never consult the current product catalog.
const validRate=value=>['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=100;
function amount(value){if(!Number.isSafeInteger(value)||value<0)throw Object.assign(Error('Geçersiz kuruş tutarı.'),{status:400});return value;}
function round(n,d){return Number((BigInt(n)+BigInt(d)/2n)/BigInt(d));}
function inclusive(base,rate){amount(base);if(!validRate(rate))throw Object.assign(Error('KDV oranı geçersiz.'),{status:400});return amount(base+round(BigInt(base)*BigInt(Number(rate)),100));}
function breakdown(items,mode='sale'){
 if(!['sale','refund','remaining'].includes(mode))throw Error('Invalid VAT summary mode');
 const groups=new Map();let unknown=0;
 for(const line of items){
  const original=amount(line.net_cents),refunded=amount(line.refunded_cents||0);
  const total=mode==='sale'?original:mode==='refund'?refunded:original-refunded;amount(total);
  const known=validRate(line.vat_rate)&&Number.isSafeInteger(line.net_ex_vat_cents)&&line.net_ex_vat_cents>=0&&line.net_ex_vat_cents<=original;
  const refundKnown=refunded===0||Number.isSafeInteger(line.refunded_ex_vat_cents)&&line.refunded_ex_vat_cents>=0&&line.refunded_ex_vat_cents<=refunded;
  if(!known||(mode!=='sale'&&!refundKnown)){unknown+=total;continue;}
  const refundBase=line.refunded_ex_vat_cents||0;
  const base=mode==='sale'?line.net_ex_vat_cents:mode==='refund'?refundBase:line.net_ex_vat_cents-refundBase;
  if(base<0||base>total){unknown+=total;continue;}
  const rate=Number(line.vat_rate),group=groups.get(rate)||{rate,base_cents:0,vat_cents:0,total_cents:0};
  group.base_cents+=base;group.vat_cents+=total-base;group.total_cents+=total;groups.set(rate,group);
 }
 return {version:1,rounding:'line_half_up_kurus',groups:[...groups.values()].sort((a,b)=>a.rate-b.rate),unknown_total_cents:unknown,total_cents:amount([...groups.values()].reduce((n,g)=>n+g.total_cents,unknown))};
}
module.exports={validRate,inclusive,breakdown};
