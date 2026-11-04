export function saveCountDraft(storage,key,rows,counts,now=Date.now()){
 const selected=rows.filter(row=>counts[row.location_id+':'+row.product_id+':'+(row.lot_id??'none')]!==''&&counts[row.location_id+':'+row.product_id+':'+(row.lot_id??'none')]!==undefined);
 if(selected.length>200)throw Error('Bir taslakta en fazla 200 sayım satırı saklanabilir.');
 const keep={};for(const row of selected){const id=row.location_id+':'+row.product_id+':'+(row.lot_id??'none');keep[id]=counts[id];}
 const value={version:1,at:now,rows:selected,counts:keep};storage.setItem(key,JSON.stringify(value));return value;
}
export function readCountDraft(storage,key,now=Date.now()){
 try{const v=JSON.parse(storage.getItem(key)||'null');if(v?.version!==1||!Number.isSafeInteger(v.at)||v.at>now||now-v.at>=8*3600000||!Array.isArray(v.rows)||v.rows.length>200||!v.counts||typeof v.counts!=='object')return null;return v;}catch{return null;}
}
