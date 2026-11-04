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
  return value;
}
async function gate(req,res,next) {
  if(req.method==='POST'&&req.path==='/mobile/claim'&&require('./mobileGateway').isCompanion(req))return next();
  if(!enabled()) return next();
  // Public sales assistance does not operate on a licensed tenant's data.
  if(process.env.VENIUX_CLOUD_SERVICE!=='1'&&((req.method==='GET'&&req.path==='/ai/visitor') || (req.method==='POST'&&['/ai/visitor/chat','/ai/speech'].includes(req.path))))return next();
  if(['/license/policy','/license/activate','/license/validate','/license/deactivate','/license/plans','/license/bank-details','/license/webhooks/payment','/auth/register'].includes(req.path)) return next();
  try {
    if(!req.get('x-veniux-device-token'))return res.status(423).json({code:'LICENSE_REQUIRED',error:'Bu cihazda lisans etkinleştirilmemiş. Önce VNX- ile başlayan lisans anahtarınızı etkinleştirin.'});
    const license=await verify(req.get('x-veniux-device-token'),req.get('x-device-id'));
    if(!license.valid) return res.status(423).json({code:'LICENSE_BLOCKED',error:'Lisans aktif değil. Veniux yöneticisiyle iletişime geçin.'});
    req.centralLicense=license; return next();
  } catch { return res.status(503).json({code:'LICENSE_UNAVAILABLE',error:'Merkezi lisans doğrulanamadı. Bağlantı sağlanana kadar işlemler kapalı.'}); }
}
module.exports={enabled,verify,request,gate};
