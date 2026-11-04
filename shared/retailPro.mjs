// Quantities enter as decimal strings and are converted through integer micros.
export function quantity(value,unit='kg'){
 if(!['string','number'].includes(typeof value)||!['kg','g','litre'].includes(unit))throw Error('Tartı miktarı veya birimi geçersiz.');
 const text=String(value).replace(',','.');
 if(!/^\d{1,7}(?:\.\d{1,6})?$/.test(text))throw Error('Miktar en fazla altı ondalık basamaklı olmalıdır.');
 const [whole,part='']=text.split('.');let micros=BigInt(whole)*1000000n+BigInt(part.padEnd(6,'0'));
 if(unit==='g'){if(micros%1000n)throw Error('Gram miktarı en fazla üç ondalık basamaklı olmalıdır.');micros/=1000n;}
 if(micros<=0n||micros>1000000000000n)throw Error('Miktar sıfırdan büyük ve sınır içinde olmalıdır.');
 return Number(micros)/1000000;
}
export function safeImage(path){return typeof path==='string'&&/^\/uploads\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp)$/i.test(path)?path:null;}
export function keypad(value,key){
 const s=String(value||'');if(key==='C')return '';if(key==='⌫')return s.slice(0,-1);
 if(!/^[0-9.]$/.test(key)||key==='.'&&s.includes('.')||s.length>=12)return s;
 return !s&&key==='.'?'0.':s+key;
}
export function scaleReading(frame,{now=Date.now(),maxAgeMs=2000}={}){
 if(!frame||typeof frame.stable!=='boolean'||!frame.stable||!Number.isSafeInteger(frame.timestamp)||frame.timestamp>now||now-frame.timestamp>maxAgeMs)throw Error('Ağırlık kararsız veya güncel değil. Yeniden tartın.');
 return {quantity:quantity(frame.weight,frame.unit),unit:frame.unit==='g'?'kg':frame.unit,timestamp:frame.timestamp};
}
