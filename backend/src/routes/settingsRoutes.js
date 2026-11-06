const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const settingsController = require('../controllers/settingsController');

// All settings require valid JWT auth
router.use(authMiddleware);
// Progress and menu preferences never grant access to operational modules.
router.get('/onboarding',async(req,res,next)=>{try{res.json(await require('../services/customerSetupService').get(req.user));}catch(e){next(e);}});
router.put('/onboarding',requireRole('admin'),async(req,res,next)=>{try{res.json(await require('../services/customerSetupService').save(req.user,req.body));}catch(e){next(e);}});
router.use('/mobile',requireRole('admin'),(req,res,next)=>{
 // A proxied phone also arrives from loopback; pairing is managed only on the computer.
 if(req.ip!=='127.0.0.1'&&req.ip!=='::ffff:127.0.0.1'&&req.ip!=='::1'||require('../services/mobileGateway').isCompanion(req))return res.sendStatus(403);
 next();
});
const mobileContext=req=>({authorization:req.get('authorization'),device_token:req.get('x-veniux-device-token'),device_fingerprint:req.get('x-device-id'),targetTenant:req.get('x-tenant-id')});
router.get('/mobile',async(req,res,next)=>{try{res.json(require('../services/mobileGateway').pairing(mobileContext(req)));}catch(e){next(e);}});
router.post('/mobile/start',async(req,res,next)=>{try{const gateway=require('../services/mobileGateway');await gateway.start();res.json(gateway.pairing(mobileContext(req)));}catch(e){next(e);}});
router.post('/mobile/stop',async(req,res,next)=>{try{res.json(await require('../services/mobileGateway').stop());}catch(e){next(e);}});
// Tenant administrators must never reset, disable or delete a platform administrator.
router.use('/users/:id', async (req,res,next) => {
  if (!['PUT','PATCH','DELETE'].includes(req.method) || req.user.isPlatformAdmin) return next();
  try {
    const db=require('../config/database');
    if((await db.query('SELECT user_id FROM platform_admins WHERE user_id=$1',[req.params.id])).rows.length) return res.status(403).json({error:'Platform yöneticisi hesabını değiştiremezsiniz.'});
    next();
  }catch(e){next(e);}
});
const policies = require('../services/settingsPolicyService');
const automation=require('../services/ownerAutomationService');
const whatsapp=()=>require('../services/ownerWhatsAppService');
const whatsappLimit=require('express-rate-limit')({windowMs:60000,max:5});
router.get('/whatsapp',requireRole('admin'),(req,res)=>res.set('Cache-Control','no-store').json(whatsapp().status(req.user.tenantId)));
router.post('/whatsapp/connect',requireRole('admin'),whatsappLimit,(req,res)=>res.set('Cache-Control','no-store').json(whatsapp().connect(req.user.tenantId)));
router.post('/whatsapp/disconnect',requireRole('admin'),whatsappLimit,async(req,res,next)=>{try{await whatsapp().disconnect(req.user.tenantId);res.json({status:'disconnected'});}catch(e){next(e);}});
router.post('/whatsapp/test',requireRole('admin'),whatsappLimit,async(req,res,next)=>{try{
 const result=await whatsapp().send(req.user.tenantId,'Veniux WhatsApp bildirim bağlantınız hazır. İşlem tamamlanma ve hata bildirimlerini bu numaradan alabilirsiniz.');
 await require('../config/database').query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)',[req.user.tenantId,req.user.email,'owner_whatsapp_test','notification',JSON.stringify({status:result.status})]);
 res.json(result);
}catch(e){next(e);}});
router.get('/automation',requireRole('admin'),async(req,res,next)=>{try{
 const company=(await require('../config/database').query('SELECT owner_phone FROM tenants WHERE id=$1',[req.user.tenantId])).rows[0];
 const runs=(await require('../config/database').query('SELECT id,status,summary,sms_status,whatsapp_status,started_at,finished_at FROM assistant_runs WHERE tenant_id=$1 ORDER BY id DESC LIMIT 20',[req.user.tenantId])).rows;
 res.json({config:await automation.config(req.user.tenantId),ownerPhone:company?.owner_phone?'Kayıtlı (gizli)':'',smsConfigured:require('../services/ownerSmsService').configured(),runs});
}catch(e){next(e);}});
router.put('/automation',requireRole('admin'),async(req,res,next)=>{try{
 const data=req.body;
 if(data.whatsappOnCompletion===undefined)data.whatsappOnCompletion=false;
 if(typeof data.whatsappOnCompletion!=='boolean')return res.status(400).json({error:'Geçersiz WhatsApp ayarı.'});
 if(['enabled','ruleChecks','aiAnalysis','smsOnCompletion'].some(k=>typeof data[k]!=='boolean')||![60,360,1440].includes(data.intervalMinutes)||(!data.ruleChecks&&!data.aiAnalysis))return res.status(400).json({error:'Geçersiz otomasyon ayarı.'});
 if((data.smsOnCompletion||data.whatsappOnCompletion)&&data.enabled){const company=(await require('../config/database').query('SELECT owner_phone FROM tenants WHERE id=$1',[req.user.tenantId])).rows[0];if(!require('../services/ownerPhone').normalizePhone(company?.owner_phone))return res.status(400).json({error:'Önce Şirket Profili bölümünden firma sahibinin cep telefonunu kaydedin.'});}
 res.json(await policies.save(req.user.tenantId,'automation',Object.fromEntries(Object.keys(automation.defaults).map(k=>[k,data[k]]))));
}catch(e){next(e);}});
router.post('/automation/run',requireRole('admin'),async(req,res,next)=>{try{if(!req.user.isPlatformAdmin&&req.user.moduleType==='NONE')return res.status(403).json({error:'Otomatik operasyon kontrolleri için aktif modül lisansı gerekli.'});res.json(await automation.run(req.user.tenantId,{centralLicense:req.centralLicense}));}catch(e){next(e);}});
router.get('/integrations', requireRole('admin'), (req,res) => res.json({
  smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  ai: Boolean(process.env.NVIDIA_API_KEY),
  payment: false
}));
for (const name of ['security','notifications']) {
  router.get('/'+name, requireRole('admin','manager'), async (req,res,next) => {
    try { res.json(await policies.read(req.user.tenantId,name)); } catch(error) {next(error);}
  });
  router.put('/'+name, requireRole('admin'), async (req,res,next) => {
    try {
      let data;
      if(name==='security') {
        if(!['15m','1h','8h','24h','7d'].includes(req.body.sessionTimeout) || typeof req.body.strictPassword!=='boolean') return res.status(400).json({error:'Geçersiz güvenlik ayarı.'});
        data={sessionTimeout:req.body.sessionTimeout,strictPassword:req.body.strictPassword};
      } else {
        if(typeof req.body.minStockAlert!=='boolean' || typeof req.body.expiryRadarAlert!=='boolean' || !Number.isInteger(req.body.expiryDays) || req.body.expiryDays<1 || req.body.expiryDays>365) return res.status(400).json({error:'Geçersiz bildirim ayarı.'});
        data={minStockAlert:req.body.minStockAlert,expiryRadarAlert:req.body.expiryRadarAlert,expiryDays:req.body.expiryDays};
      }
      res.json(await policies.save(req.user.tenantId,name,data));
    }catch(error){next(error);}
  });
}

// 1. Account Settings
router.get('/account', settingsController.getAccount);
router.put('/account', settingsController.updateAccount);
router.put('/password', settingsController.updatePassword);
router.put('/account/avatar', settingsController.updateAvatar);
router.delete('/account/avatar', settingsController.removeAvatar);

// 2. Company Profile
router.get('/company', settingsController.getCompany);
router.put('/company', requireRole('admin', 'manager'), settingsController.updateCompany);

// 3. User Management
router.get('/users', requireRole('admin', 'manager'), settingsController.getUsers);
router.get('/users/:id/access-scope',requireRole('admin'),async(req,res,next)=>{try{
 if(!(await require('../config/database').query('SELECT id FROM users WHERE id=$1 AND tenant_id=$2',[req.params.id,req.user.tenantId])).rows.length)return res.status(404).json({error:'Kullanıcı bulunamadı.'});
 res.json(await require('../services/accessScopeService').read(req.params.id,req.user.tenantId));
}catch(e){next(e);}});
router.put('/users/:id/access-scope',requireRole('admin'),async(req,res,next)=>{try{res.json(await require('../services/accessScopeService').change(req.user,req.params.id,req.body));}catch(e){next(e);}});
// Same rule as access-scope changes: a warehouse-restricted admin must not control wider accounts.
const companyAdmin=(req,res,next)=>req.user.accessScope?.mode==='company'?next():res.status(403).json({error:'Kullanıcı yönetimi için firma genelinde yönetici erişimi gerekir.'});
router.post('/users', requireRole('admin'), companyAdmin, require('../middlewares/licenseMiddleware')('users'), settingsController.createUser);
router.post('/users/:id/mfa-reset',requireRole('admin'),(...a)=>companyAdmin(...a),require('express-rate-limit')({windowMs:300000,limit:10}),async(req,res,next)=>{try{
 const db=require('../config/database'),bcrypt=require('bcrypt');
 const admin=(await db.query('SELECT password_hash FROM users WHERE id=$1',[req.user.userId])).rows[0];
 if(typeof req.body.password!=='string'||Buffer.byteLength(req.body.password)>72||!admin||!await bcrypt.compare(req.body.password,admin.password_hash))return res.status(403).json({error:'Mevcut parolanızı doğrulayın.'});
 const target=(await db.query('SELECT id,email,tenant_id FROM users WHERE id=$1 AND tenant_id=$2',[req.params.id,req.user.tenantId])).rows[0];
 if(!target)return res.status(404).json({error:'Kullanıcı bulunamadı.'});
 if(!req.user.isPlatformAdmin&&(await db.query('SELECT user_id FROM platform_admins WHERE user_id=$1',[target.id])).rows.length)return res.status(403).json({error:'Platform yöneticisi hesabı değiştirilemez.'});
 res.json({reset:await require('../services/mfaService').reset({...target,actor_email:req.user.email})});
}catch(e){next(e);}});
router.put('/users/:id', requireRole('admin'), companyAdmin, settingsController.updateUser);
router.delete('/users/:id', requireRole('admin'), companyAdmin, settingsController.deleteUser);

// 4. Roles
router.get('/roles', settingsController.getRoles);

// 5. System Engine & Maintenance
router.get('/system-engine', settingsController.getSystemEngine);
const platformMaintenance=(req,res,next)=>req.user.isPlatformAdmin?next():res.status(403).json({error:'Ortak veritabanı bakımı platform yöneticisine açıktır.'});
router.post('/system-engine/vacuum', requireRole('admin'), platformMaintenance,settingsController.runVacuum);
router.post('/system-engine/backup', requireRole('admin'), platformMaintenance,settingsController.runBackup);

module.exports = router;

