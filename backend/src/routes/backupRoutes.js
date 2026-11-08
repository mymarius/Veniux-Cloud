const express=require('express'),router=express.Router(),service=require('../services/backupService');
const {authMiddleware}=require('../middlewares/authMiddleware');
router.use(authMiddleware);
// Yedek sağlığı her firma yöneticisine görünür; yedeğin kendisine yalnız platform yöneticisi erişir.
router.get('/health',(req,res)=>{if(!['admin','manager'].includes(req.user.role)&&!req.user.isPlatformAdmin)return res.status(403).json({error:'Yetki yok.'});res.set('Cache-Control','no-store').json(service.health?service.health():{level:'unknown',messages:[]});});
// Masaüstü kurulumunda veritabanı tek firmaya aittir: firma genelinde yetkili yönetici kendi yedeğini yönetir.
// Bulutta yedek bütün firmaları içerdiği için yalnız platform yöneticisi erişir.
router.use(async(req,res,next)=>{try{
 if(!req.user.isPlatformAdmin&&process.env.VENIUX_DESKTOP_RESTORE==='1'&&process.env.VENIUX_CLOUD_SERVICE!=='1'&&req.user.role==='admin'&&req.user.accessScope?.mode==='company'){
  const db=require('../config/database');const count=Number((await db.query('SELECT COUNT(*) AS n FROM tenants')).rows[0].n);
  if(count===1&&Number((await db.query('SELECT id FROM tenants LIMIT 1')).rows[0].id)===Number(req.user.tenantId))req.user.backupManager=true;
 }next();}catch(e){next(e);}});
router.use((req,res,next)=>req.user.isPlatformAdmin||req.user.backupManager?next():res.status(403).json({error:'Ortak sistem yedeği yalnızca platform yöneticisine açıktır.'}));
const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
router.get('/',handle(async(req,res)=>res.json(service.summary())));
router.put('/config',handle(async(req,res)=>res.json(await service.configure(req.user,req.body))));
router.post('/',handle(async(req,res)=>res.status(201).json(await service.create(req.user,'manual',req))));
router.get('/:id/download',handle(async(req,res)=>{const buffer=await service.exportBackup(req.user,req.params.id);res.type('application/octet-stream').attachment('veniux-'+req.params.id+'.vnxbackup').send(buffer);}));
router.post('/:id/validate',handle(async(req,res)=>res.json(await service.prepare(req.user,null,req.params.id))));
router.post('/validate-upload',express.raw({type:'application/octet-stream',limit:'128mb'}),handle(async(req,res)=>res.json(await service.prepare(req.user,req.body))));
router.post('/restore-copy',express.raw({type:'application/octet-stream',limit:'128mb'}),handle(async(req,res)=>{if(!service.prepareCopy)return res.status(404).json({error:'Bu kurulumda kopyadan geri yükleme yok.'});res.json(await service.prepareCopy(req.user,req.body,req.get('x-veniux-recovery-code')));}));
router.post('/recovery-code',handle(async(req,res)=>{if(!service.recoveryCode)return res.status(404).json({error:'Bu kurulumda kurtarma kodu yok.'});res.set('Cache-Control','no-store').json(service.recoveryCode(req.user));}));
router.post('/restore',handle(async(req,res)=>res.json(await service.restore(req.user,req.body,req))));
module.exports=router;
