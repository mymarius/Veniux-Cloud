const crypto = require('node:crypto');
const fs = require('node:fs');
const enabled = () => Boolean(process.env.VENIUX_LICENSE_AUTHORITY_URL);
function configuration() {
  const url = new URL(process.env.VENIUX_LICENSE_AUTHORITY_URL);
  if (url.protocol !== 'https:' && !(process.env.VENIUX_LICENSE_ALLOW_LOCAL_HTTP === '1' && url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) throw new Error('License HTTPS configuration required');
  return {url:url.href.replace(/\/$/,''),key:fs.readFileSync(process.env.VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY,'utf8')};
}
async function request(path, body) {
  const {url} = configuration();
  const response = await fetch(`${url}${path}`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(4000)});
  if (!response.ok) {
    const error=new Error('Authority rejected request');
    error.status=[400,403,429].includes(response.status)?response.status:503;
    throw error;
  }
  return response.json();
}
async function verify(device_token, device_fingerprint) {
  if (!/^[a-f0-9]{64}$/.test(device_token||'') || !/^HW-[A-F0-9]{32}$/.test(device_fingerprint||'')) return {valid:false,status:'INVALID'};
  const nonce=crypto.randomBytes(16).toString('hex');
  const reply=await request('/verify',{device_token,device_fingerprint,nonce});
  if (typeof reply.signed_payload !== 'string' || reply.signed_payload.length>8192 || !crypto.verify('sha256',Buffer.from(reply.signed_payload),configuration().key,Buffer.from(reply.signature||'','base64'))) throw new Error('Invalid authority signature');
  const value=JSON.parse(reply.signed_payload), now=Math.floor(Date.now()/1000);
  if(value.nonce!==nonce || value.device_fingerprint!==device_fingerprint || !Number.isInteger(value.issued_at) || Math.abs(now-value.issued_at)>35 || value.valid_until<now || value.valid_until>now+35) throw new Error('Invalid authority response');
  if(value.valid)saveLease(device_token,reply);else dropLease(device_token);
  return value;
}

// Çevrimdışı izin: yalnız müşterinin bilgisayarındaki kurulumda. Lisans sunucusunun imzalı son "geçerli" yanıtı saklanır;
// sunucuya ulaşılamazsa imza yeniden doğrulanarak OFFLINE_HOURS boyunca kullanılır. Sunucu açıkça reddederse izin silinir.
const OFFLINE_HOURS=72, CLOCK_TOLERANCE=300;
const leaseAllowed=()=>process.env.VENIUX_CLOUD_SERVICE!=='1'&&Boolean(process.env.VENIUX_DATA_DIR);
const leaseFile=token=>require('node:path').join(process.env.VENIUX_DATA_DIR,'license-lease',crypto.createHash('sha256').update(token).digest('hex')+'.json');
function writeLease(token,data){const file=leaseFile(token);fs.mkdirSync(require('node:path').dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);}
function saveLease(token,reply){if(!leaseAllowed())return;try{writeLease(token,{signed_payload:reply.signed_payload,signature:reply.signature,last_seen:Math.floor(Date.now()/1000)});}catch{}}
function dropLease(token){if(!leaseAllowed())return;try{fs.unlinkSync(leaseFile(token));}catch{}}
function offlineLease(device_token,device_fingerprint){
  if(!leaseAllowed()||!/^[a-f0-9]{64}$/.test(device_token||'')||!/^HW-[A-F0-9]{32}$/.test(device_fingerprint||''))return null;
  let lease;try{lease=JSON.parse(fs.readFileSync(leaseFile(device_token),'utf8'));}catch{return null;}
  if(typeof lease.signed_payload!=='string'||!crypto.verify('sha256',Buffer.from(lease.signed_payload),configuration().key,Buffer.from(lease.signature||'','base64')))return null;
  const value=JSON.parse(lease.signed_payload),now=Math.floor(Date.now()/1000),until=value.issued_at+OFFLINE_HOURS*3600;
  if(!value.valid||value.device_fingerprint!==device_fingerprint||!Number.isInteger(value.issued_at)||!Number.isInteger(lease.last_seen))return null;
  // Saat geri alınırsa izin kullanılmaz; ileri giden saat izni zaten bitirir.
  if(now<lease.last_seen-CLOCK_TOLERANCE||now<value.issued_at-CLOCK_TOLERANCE||now>until)return null;
  try{writeLease(device_token,{...lease,last_seen:Math.max(lease.last_seen,now)});}catch{}
  return {...value,offline:true,offline_until:until};
}
async function gate(req,res,next) {
  if(req.method==='POST'&&req.path==='/mobile/claim'&&require('./mobileGateway').isCompanion(req))return next();
  if(!enabled()) return next();
  // Public sales assistance does not operate on a licensed tenant's data.
  if(process.env.VENIUX_CLOUD_SERVICE!=='1'&&((req.method==='GET'&&req.path==='/ai/visitor') || (req.method==='POST'&&['/ai/visitor/chat','/ai/speech'].includes(req.path))))return next();
  if(['/license/policy','/license/activate','/license/validate','/license/deactivate','/license/plans','/license/bank-details','/license/webhooks/payment','/auth/register'].includes(req.path)) return next();
  try {
    if(!req.get('x-veniux-device-token'))return res.status(423).json({code:'LICENSE_REQUIRED',error:'Bu cihazda lisans etkinleştirilmemiş. Önce VNX- ile başlayan lisans anahtarınızı etkinleştirin.'});
    let license;
    try{license=await verify(req.get('x-veniux-device-token'),req.get('x-device-id'));}
    catch(error){
      // Lisans sunucusu açıkça reddettiyse izin kullanılmaz; yalnız bağlantı sorunu çevrimdışı izne düşer.
      if([400,403].includes(error.status)){dropLease(req.get('x-veniux-device-token'));throw error;}
      license=offlineLease(req.get('x-veniux-device-token'),req.get('x-device-id'));
      if(!license)throw error;
      res.set('X-Veniux-Offline-Until',String(license.offline_until));
    }
    if(!license.valid) return res.status(423).json({code:'LICENSE_BLOCKED',error:'Lisans aktif değil. Veniux yöneticisiyle iletişime geçin.'});
    req.centralLicense=license; return next();
  } catch { return res.status(503).json({code:'LICENSE_UNAVAILABLE',error:'Merkezi lisans doğrulanamadı ve çevrimdışı izin yok veya süresi doldu. İnternet bağlantısını kontrol edin.'}); }
}
module.exports={enabled,verify,request,gate,offlineLease,dropLease,OFFLINE_HOURS};
