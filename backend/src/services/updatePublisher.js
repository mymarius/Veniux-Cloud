const BASE='https://api.veniux.com/updates';
const sessions=new Map();
async function call(route,options={}){
 const response=await fetch(BASE+route,{...options,redirect:'error',signal:AbortSignal.timeout(600000)});
 const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Merkezi yayın sunucusu yanıt vermedi.'),{status:response.status===401?409:response.status});return data;
}
async function session(userId,password){const result=await call('/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:require('./ownerIdentity').OWNER_EMAIL,password})});sessions.set(userId,{token:result.token,until:Date.now()+3500000});return {success:true};}
function headers(userId){const s=sessions.get(userId);if(!s||s.until<Date.now())throw Object.assign(Error('Sahip şifresiyle yayın oturumunu açın.'),{status:409});return {'X-Veniux-Publish-Token':s.token};}
async function list(userId){return call('/list',{headers:headers(userId)});}
async function upload(userId,name,body){
 if(!/^(?:Veniux-[A-Za-z0-9._-]+\.(?:exe|apk|blockmap)|latest\.yml|android\.json)$/.test(name)||!Buffer.isBuffer(body)||!body.length)throw Object.assign(Error('Geçersiz sürüm dosyası.'),{status:400});
 if(name==='latest.yml'){
  if(body.length>65536)throw Object.assign(Error('Sürüm dosyası fazla büyük.'),{status:400});
  const m=require('yaml').parse(body.toString());const f=m?.files?.[0];
  if(!/^\d+\.\d+\.\d+$/.test(m?.version)||m.files.length!==1||!f||!/^Veniux-[A-Za-z0-9._-]+\.exe$/.test(f.url)||!Number.isSafeInteger(f.size)||!(/^[A-Za-z0-9+/]{86}==$/.test(f.sha512)))throw Object.assign(Error('Geçerli latest.yml gerekli.'),{status:400});
  name='windows.json';body=Buffer.from(JSON.stringify({version:m.version,filename:f.url,bytes:f.size,sha512:f.sha512}));
 }
 const auth=headers(userId);
 if(/\.(exe|apk|blockmap)$/.test(name)){
  const id=require('crypto').randomBytes(16).toString('hex');
  for(let offset=0;offset<body.length;offset+=4*1048576)await call(`/chunk/${id}/${name}/${offset}`,{method:'PUT',headers:{...auth,'Content-Type':'application/octet-stream'},body:body.subarray(offset,Math.min(body.length,offset+4*1048576))});
  return call(`/finish/${id}/${name}`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({bytes:body.length})});
 }
 return call('/upload/'+name,{method:'PUT',headers:{...auth,'Content-Type':'application/octet-stream'},body});
}
module.exports={session,list,upload};
