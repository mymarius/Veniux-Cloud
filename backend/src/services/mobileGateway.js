const https=require('node:https'),http=require('node:http'),crypto=require('node:crypto'),os=require('node:os');
let server,token,pin,starting;
const tickets=new Map();
// Compares fixed-size digests: attacker input of any byte length cannot make this throw.
const safeEqual=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(),crypto.createHash('sha256').update(String(b)).digest());
const privateIP=value=>{const ip=String(value||'').replace(/^::ffff:/,'');return /^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip)||ip==='127.0.0.1';};
function addresses(){return Object.values(os.networkInterfaces()).flat().filter(v=>v.family==='IPv4'&&!v.internal&&privateIP(v.address)).map(v=>v.address);}
function status(){return {enabled:Boolean(server),addresses:server?addresses():[],port:17851};}
function pairing(context){
 let ticket,expires_at;
 if(server&&context){for(const [key,value] of tickets)if(value.expires_at<Date.now())tickets.delete(key);while(tickets.size>=16)tickets.delete(tickets.keys().next().value);ticket=crypto.randomBytes(32).toString('hex');expires_at=Date.now()+120000;tickets.set(ticket,{...context,expires_at});}
 return {...status(),expires_at,codes:server?addresses().map(address=>'VNXM1.'+Buffer.from(JSON.stringify({url:`https://${address}:17851`,pin,token,...(ticket?{ticket}: {})})).toString('base64url')):[]};
}
function takeTicket(req){
 if(!isCompanion(req))throw Object.assign(Error('Eşleştirilmiş mobil bağlantı gerekli.'),{status:403});
 const key=req.body?.ticket;const value=typeof key==='string'?tickets.get(key):null;
 if(!value||value.expires_at<Date.now()){if(key)tickets.delete(key);throw Object.assign(Error('QR kodu kullanılmış veya süresi dolmuş. Bilgisayardan yeni QR kodu alın.'),{status:409});}
 tickets.delete(key);return value;
}
async function start(){
 if(server)return pairing();if(starting)return starting;
 if(process.platform!=='win32'||process.env.VENIUX_WEB_ACCESS==='1'||process.env.HOST!=='127.0.0.1')throw Object.assign(Error('Mobil bağlantı yalnız Windows yerel programında açılabilir.'),{status:400});
 starting=(async()=>{
  const cert=await require('selfsigned').generate([{name:'commonName',value:'Veniux Local Companion'}],{keySize:2048,algorithm:'sha256',notAfterDate:new Date(Date.now()+30*86400000)});
  token=crypto.randomBytes(32).toString('hex');pin=new crypto.X509Certificate(cert.cert).fingerprint256.replaceAll(':','').toLowerCase();
  const upstreamPort=Number(process.env.PORT);if(!Number.isInteger(upstreamPort)||upstreamPort<1024)throw Error('Invalid local API port');
  const listener=https.createServer({key:cert.private,cert:cert.cert,minVersion:'TLSv1.2'},(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   const reject=()=>{res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});res.end('Bilgisayardan yeni eşleştirme kodu alın.');};
   const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('veniux_companion='))?.slice(17)||'';
   if(!privateIP(req.socket.remoteAddress)||!token||!safeEqual(cookie,token))return reject();
   const origin=`https://${req.headers.host}`;
   if(req.headers.origin&&req.headers.origin!==origin)return reject();
   let pathname;try{pathname=decodeURIComponent(new URL(req.url,origin).pathname);}catch{return reject();}
   if(/^\/api\/(?:settings\/mobile|runtime)(?:\/|$)/i.test(pathname))return reject();
   const method=req.method==='POST'&&req.headers['x-veniux-method']==='PATCH'?'PATCH':req.method;
   const headers={...req.headers,host:`127.0.0.1:${upstreamPort}`};delete headers['x-veniux-method'];
   for(const name of ['origin','forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-veniux-companion'])delete headers[name];
   headers['x-veniux-companion']=token;
   const proxy=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method,headers,timeout:60000},upstream=>{
    const responseHeaders={...upstream.headers};delete responseHeaders['set-cookie'];
    if(pathname==='/api/license/policy'&&req.method==='GET'){
     const chunks=[];upstream.on('data',chunk=>chunks.push(chunk));upstream.on('end',()=>{try{const policy=JSON.parse(Buffer.concat(chunks));const body=JSON.stringify({...policy,browser_access:true});delete responseHeaders['content-length'];res.writeHead(upstream.statusCode,responseHeaders);res.end(body);}catch{res.writeHead(502);res.end();}});return;
    }
    // Pairing authorizes transport only. Every request still passes the central
    // device license, JWT, role and tenant boundaries on the loopback API.
    res.writeHead(upstream.statusCode,responseHeaders);upstream.pipe(res);
   });
   proxy.on('timeout',()=>proxy.destroy());proxy.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});req.on('aborted',()=>proxy.destroy());req.pipe(proxy);
  });
  await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(17851,'0.0.0.0',resolve);});server=listener;return pairing();
 })();try{return await starting;}finally{starting=null;}
}
async function stop(){if(starting)await starting.catch(()=>{});tickets.clear();const active=server;server=null;token=null;pin=null;if(active){active.closeAllConnections();await new Promise(resolve=>active.close(resolve));}return status();}
function isCompanion(req){const value=req.get('x-veniux-companion')||'';return Boolean(server&&['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)&&token&&safeEqual(value,token));}
module.exports={safeEqual,start,stop,status,pairing,privateIP,isCompanion,takeTicket};
