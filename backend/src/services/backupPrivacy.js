const sensitive=key=>key!=='strictPassword'&&/(password|passwd|passphrase|(?:^|[_-])pass(?:$|[_-])|smtp.?pass|secret|token|credential|api.?key|private.?key|access.?key|signing.?key|encryption.?key|authorization|license.?key|bridge.?key)/i.test(key);
function collect(value,known,secret=false){if(typeof value==='string'){if(secret&&value.length>=6)known.add(value);}else if(Array.isArray(value)){for(const v of value)collect(v,known,secret);}else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))collect(v,known,secret||sensitive(key));}
function clean(value,known){if(Array.isArray(value))return value.map(v=>clean(v,known));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!sensitive(key)).map(([key,v])=>[key,clean(v,known)]));if(typeof value!=='string')return value;let text=value;for(const secret of known)text=text.replaceAll(secret,'[REDACTED]');return text.replace(/(?:nvapi-|sk-fish-|sk-|AIza)[A-Za-z0-9_.-]{20,}/g,'[REDACTED]').replace(/Bearer\s+[A-Za-z0-9_.-]+/gi,'[REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED]').replace(/([a-z]+:\/\/)[^/\s:@]+:[^/\s@]+@/gi,'$1[REDACTED]@').replace(/(api[_-]?key|password|secret|access[_-]?token)=([^&\s]+)/gi,'$1=[REDACTED]');}
function portable(snapshot){
 const copy=JSON.parse(JSON.stringify(snapshot)),known=new Set();collect(process.env,known);
 for(const table of copy.tables)for(const row of table.rows)row.forEach((v,i)=>{collect(v,known,sensitive(table.columns[i]));if(typeof v==='string')try{collect(JSON.parse(v),known);}catch{}});
 const secrets=[...known].sort((a,b)=>b.length-a.length);
 for(const table of copy.tables)for(const row of table.rows)row.forEach((v,i)=>{
  if(typeof v!=='string')return;const column=table.columns[i];
  if(sensitive(column)){row[i]=column==='license_key'?'REDACTED-'+row[table.columns.indexOf('id')]:'[REDACTED]';return;}
  try{row[i]=JSON.stringify(clean(JSON.parse(v),secrets));}catch{row[i]=clean(v,secrets);}
 });
 copy.credentials_excluded=true;return copy;
}
module.exports={portable,sensitive,clean,collect};
