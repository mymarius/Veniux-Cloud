const router=require('express').Router(),jwt=require('jsonwebtoken'),central=require('../services/centralLicense');
const {authMiddleware}=require('../middlewares/authMiddleware');
router.post('/claim',async(req,res,next)=>{try{
 req.pairing=require('../services/mobileGateway').takeTicket(req);
 req.headers.authorization=req.pairing.authorization;
 delete req.headers['x-tenant-id'];if(req.pairing.targetTenant)req.headers['x-tenant-id']=req.pairing.targetTenant;
 req.centralLicense=await central.verify(req.pairing.device_token,req.pairing.device_fingerprint);
 if(!req.centralLicense.valid)return res.status(403).json({error:'Bilgisayar lisansı etkin değil.'});
 next();
}catch(e){res.status(e.status||403).json({error:e.message});}},authMiddleware,async(req,res)=>{
 try{
  const p=req.pairing,fp=req.body.device_fingerprint;
  if(!/^HW-[A-F0-9]{32}$/.test(fp||'')||fp===p.device_fingerprint)return res.status(400).json({error:'Mobil cihaz kimliği geçersiz.'});
  const desktop=jwt.verify(p.authorization.slice(7),process.env.JWT_SECRET);
  const ttl=Math.min(3600,desktop.exp-Math.floor(Date.now()/1000));if(!Number.isInteger(ttl)||ttl<=0)return res.status(401).json({error:'Bilgisayar oturumu sona ermiş.'});
  const enrolled=await central.request('/companion',{parent_device_token:p.device_token,parent_device_fingerprint:p.device_fingerprint,device_fingerprint:fp,device_name:'Android telefon/tablet',os_info:'Veniux Android uygulaması'});
  const license=await central.verify(enrolled.device_token,fp);if(!license.valid)throw Error('Mobile license invalid');
  const plan=require('../services/licenseService').getPlans().find(v=>v.id===license.plan_id);if(!plan)throw Error('Unknown plan');
  const token=jwt.sign({userId:req.user.userId,email:req.user.email,role:req.user.role,tenantId:req.user.homeTenantId,sessionVersion:desktop.sessionVersion},process.env.JWT_SECRET,{expiresIn:ttl});
  const module_type=req.user.isPlatformAdmin?'BOTH':await require('../services/moduleAccess').getModuleType(req.user.tenantId,license);
  res.set('Cache-Control','no-store').json({token,user:{id:req.user.userId,email:req.user.email,role:req.user.role,tenant_id:req.user.homeTenantId,is_platform_admin:req.user.isPlatformAdmin,account_type:req.user.isPlatformAdmin?'platform_admin':'customer',module_type},tenant_context:p.targetTenant||null,license:{payload:{...license,enabled_features:plan.features,device_token:enrolled.device_token}}});
 }catch(e){res.status(e.status||503).json({error:e.status===403?'Mobil terminal etkinleştirilemedi. Lisansın terminal hakkını kontrol edin.':e.status===429?'Deneme sınırına ulaşıldı. Bir dakika sonra yeni QR koduyla deneyin.':'Mobil giriş tamamlanamadı. Bilgisayardan yeni QR kodu alın ve bağlantıyı kontrol edin.'});}
});
module.exports=router;
