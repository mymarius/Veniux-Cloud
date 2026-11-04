export function cacheKey(user,tenant){return 'veniux:catalog-v1:'+encodeURIComponent(String(tenant))+':'+encodeURIComponent(String(user));}
export function cacheCatalog(storage,key,items,now=Date.now()){
 const safe=items.slice(-250).map(p=>Object.fromEntries(['id','name','barcode','sku','category','unit','sale_price','kdv_orani','image_available','brand'].map(k=>[k,p[k]??null])));
 try{storage.setItem(key,JSON.stringify({at:now,items:safe}));}catch{}
}
export function readCatalog(storage,key,now=Date.now()){
 try{const v=JSON.parse(storage.getItem(key)||'null');if(!v||!Number.isSafeInteger(v.at)||v.at>now||now-v.at>86400000||!Array.isArray(v.items)||v.items.length>250)return [];return v.items.filter(p=>Number.isSafeInteger(p.id)&&typeof p.name==='string');}catch{return [];}
}
