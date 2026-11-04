export function categoryIcon(category,override){
 if(['box','leaf','cup','basket','tag'].includes(override))return override;
 const text=String(category||'').toLocaleLowerCase('tr-TR');
 if(/manav|meyve|sebze|taze/.test(text))return 'leaf';
 if(/içecek|icecek|kahve|çay|cay|süt|sut/.test(text))return 'cup';
 if(/fırın|firin|ekmek|unlu/.test(text))return 'bread';
 if(/et |kasap|şarküteri|sarkuteri|balık/.test(text))return 'fish';
 if(/temizlik|hijyen|bakım|bakim/.test(text))return 'clean';
 if(/gıda|gida|market/.test(text))return 'basket';
 return 'box';
}
export function cashierName(user){
 const name=String(user?.full_name||'').trim().replace(/\s+/g,' ');
 return name&&name.length<=80&&!/@|^(owner|user|tenant)[_-]|^[0-9_-]+$/i.test(name)?name:'Kasiyer';
}
export function registerName(register){return register?.id?`${register.name||'Kasa'} · ${String(register.id).padStart(2,'0')}`:'Kasa seçiliyor';}
export function orderedProducts(products,pinned,favorites,prioritize){
 const ids=new Set(favorites),seen=new Set(),source=prioritize?[...pinned.filter(p=>ids.has(p.id)),...products]:products;
 return source.filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;});
}
export const POS_COUNT_MAX=100000;
export function validCount(value){return /^\d+$/.test(String(value))&&Number(value)>=1&&Number(value)<=POS_COUNT_MAX;}
export function latencySummary(rows){const values=rows.map(r=>r.total_ms).sort((a,b)=>a-b);return {samples:values.length,p50_ms:values.length?values[Math.ceil(values.length*.5)-1]:null,p95_ms:values.length?values[Math.ceil(values.length*.95)-1]:null};}
