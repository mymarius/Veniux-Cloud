export function lineCents(price,quantity){
 const p=Math.round(Number(price)*100),q=Math.round(Number(quantity)*1000000);
 if(!Number.isSafeInteger(p)||!Number.isSafeInteger(q)||p<0||q<0)return NaN;
 return Number((BigInt(p)*BigInt(q)+500000n)/1000000n);
}
export function cartLineCents(item){
 if(item.override!==undefined)return lineCents(item.override,item.quantity*item.count);
 if(item.weighted&&Math.abs(item.line_total-item.quantity*item.unit_price)>0.0000001)return Math.round(item.line_total*100)*item.count;
 return lineCents(item.unit_price,item.quantity*item.count);
}
