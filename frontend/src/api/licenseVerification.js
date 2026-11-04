// Pin the server public key at build time; never trust a key inside the cached token.
export async function verifyOfflineLicense(token,fingerprint,now=Date.now()){
 const pem=import.meta.env.VITE_LICENSE_PUBLIC_KEY?.replace(/\\n/g,'\n');
 if(!pem||!token?.signature||token.payload?.device_fingerprint!==fingerprint)return false;
 const p=token.payload;
 const raw=String(p.expires_at);
 const expires=Date.parse(raw.includes('T')?raw:raw.replace(' ','T')+'Z');
 const grace=Number(p.grace_period_days);
 if(p.status!=='ACTIVE'||!Number.isFinite(expires)||expires<=now||!Number.isFinite(p.timestamp)||p.timestamp>now||!Number.isFinite(grace)||grace<0||now-p.timestamp>=grace*86400000)return false;
 try{
  const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  const der=pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,'');
  const key=await crypto.subtle.importKey('spki',bytes(der),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(token.signature),new TextEncoder().encode(JSON.stringify(p)));
 }catch{return false;}
}
