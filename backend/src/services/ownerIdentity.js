const OWNER_EMAIL='mymarius1@gmail.com';
async function verify(email,password){
  const authority=process.env.VENIUX_OWNER_AUTHORITY_URL||process.env.VENIUX_LICENSE_AUTHORITY_URL;
  if(!authority)return null;
  const base=new URL(authority);
  if(base.protocol!=='https:'||base.hostname!=='api.veniux.com')throw Object.assign(Error('Yönetici doğrulama adresi geçersiz.'),{status:503});
  const response=await fetch(new URL('/v1/owner/login',base),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(6000)});
  if(response.status===401)return false;
  if(response.status===429)throw Object.assign(Error('Yönetici giriş denemesi sınırına ulaşıldı. Bir dakika sonra deneyin.'),{status:429});
  if(!response.ok)throw Object.assign(Error('Merkezi yönetici hesabı şu anda doğrulanamıyor.'),{status:503});
  const identity=await response.json();
  return identity.valid===true&&identity.email===OWNER_EMAIL&&email===OWNER_EMAIL;
}
module.exports={OWNER_EMAIL,verify};
