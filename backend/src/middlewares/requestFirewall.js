function createFirewall({limit=6000,burst=600,clock=Date.now}={}){
 const clients=new Map();
 return (req,res,next)=>{
  const deny=(status,code)=>{if(status===429)res.set('Retry-After','60');return res.status(status).json({error:status===429?'İstek sınırına ulaşıldı. Bir dakika sonra tekrar deneyin.':'İstek güvenlik denetiminde reddedildi.',code});};
  const uri=req.originalUrl||req.url||'/';let path=uri.split('?')[0];
  if(uri.length>8192||/%(?![a-f0-9]{2})/i.test(path))return deny(403,'REQUEST_PATH');
  try{for(let i=0;i<3;i++){const decoded=decodeURIComponent(path);if(decoded===path)break;path=decoded;}}catch{return deny(403,'REQUEST_PATH');}
  if(/[\x00-\x1f\x7f\\]/.test(path)||/(?:^|\/)\.\.(?:\/|$)|(?:^|\/)(?:\.env(?:\.[^/]*)?|\.git|\.svn)(?:\/|$)|(?:^|\/)(?:wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|vendor\/phpunit)(?:\/|$)/i.test(path))return deny(403,'REQUEST_PATH');
  if(!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method))return deny(405,'REQUEST_METHOD');
  const length=req.get('content-length');const max=/^\/api\/platform\/updates\//.test(path)||path==='/api/ai/actions/files'?500*1048576:path==='/api/backups/validate-upload'?128*1048576:path==='/api/admin/medicines/import'?40*1048576:10*1048576;
  if(length&&(!/^\d+$/.test(length)||Number(length)>max))return deny(413,'REQUEST_SIZE');
  const ip=req.socket.remoteAddress||'unknown'; // Never trust a client-supplied forwarding header.
  const now=clock(),minute=Math.floor(now/60000),tick=Math.floor(now/10000);
  for(const [key,v] of clients)if(v.expires<now)clients.delete(key);
  if(!clients.has(ip)&&clients.size>=4096)clients.delete(clients.keys().next().value);
  const old=clients.get(ip)||{},count=old.minute===minute?old.count+1:1,quick=old.tick===tick?old.quick+1:1;
  clients.set(ip,{minute,tick,count:Math.min(count,limit+1),quick:Math.min(quick,burst+1),expires:now+70000});
  if(count>limit||quick>burst)return deny(429,'REQUEST_RATE');
  next();
 };
}
function safeJson(req,res,next){
 if(!req.body||typeof req.body!=='object'||Buffer.isBuffer(req.body))return next();
 const stack=[[req.body,0]];let count=0;
 while(stack.length){const [value,depth]=stack.pop();if(depth>50||++count>100000)return res.status(413).json({error:'İstek yapısı fazla büyük.',code:'JSON_DEPTH'});
  for(const [key,item] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))return res.status(400).json({error:'İstek alanı geçersiz.',code:'JSON_KEY'});if(item&&typeof item==='object')stack.push([item,depth+1]);}
 }
 next();
}
module.exports={createFirewall,safeJson};
