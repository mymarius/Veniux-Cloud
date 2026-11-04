'use strict';
// Editorial arithmetic only. Never writes the public catalogue or a licence.
function quote(netMonthlyCents,{months=1,discountPercent=0,vatPercent=20}={}){
 if(netMonthlyCents===null)return null;
 if(!Number.isSafeInteger(netMonthlyCents)||netMonthlyCents<0||netMonthlyCents>100000000||![1,12].includes(months)||!Number.isInteger(discountPercent)||discountPercent<0||discountPercent>80||!Number.isInteger(vatPercent)||vatPercent<0||vatPercent>100)throw Error('Invalid pricing proposal');
 const raw=BigInt(netMonthlyCents)*BigInt(months),round=n=>(n+50n)/100n;
 const net=round(raw*BigInt(100-discountPercent)),vat=round(net*BigInt(vatPercent));
 return {net_cents:Number(net),vat_cents:Number(vat),gross_cents:Number(net+vat)};
}
module.exports={quote};
