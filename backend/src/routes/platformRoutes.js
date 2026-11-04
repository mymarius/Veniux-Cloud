const router=require('express').Router();
const db=require('../config/database');
const {authMiddleware}=require('../middlewares/authMiddleware');
router.use(authMiddleware,(req,res,next)=>req.user.isPlatformAdmin?next():res.status(403).json({error:'Bu alan yalnızca platform yöneticisine açıktır.'}));
router.get('/diagnostics',(req,res)=>res.json(require('../services/platformDiagnostics').snapshot()));
router.post('/diagnostics/:id/test',require('express-rate-limit')({windowMs:60000,limit:10}),async(req,res,next)=>{try{res.json(await require('../services/platformDiagnostics').test(req.params.id));}catch(e){next(e);}});
router.get('/plans',(req,res)=>res.json(require('../services/licenseService').getPlans()));
router.post('/updates/session',async(req,res,next)=>{try{res.json(await require('../services/updatePublisher').session(req.user.userId,req.body.password));}catch(e){next(e);}});
router.get('/updates',async(req,res,next)=>{try{res.json(await require('../services/updatePublisher').list(req.user.userId));}catch(e){next(e);}});
router.put('/updates/:filename',require('express').raw({type:'application/octet-stream',limit:'500mb'}),async(req,res,next)=>{try{res.json(await require('../services/updatePublisher').upload(req.user.userId,req.params.filename,req.body));}catch(e){next(e);}});
router.post('/tenants/:id/license',async(req,res,next)=>{try{
 const id=Number(req.params.id),days=req.body.days;
 const service=require('../services/licenseService');
 const plan=service.getPlans().find(p=>p.id===req.body.plan_id);
 if(!Number.isSafeInteger(id)||id<=0||!plan||!Number.isInteger(days)||days<1||days>366)return res.status(400).json({error:'Geçerli işletme, paket ve 1–366 gün arasında süre seçin.'});
 const expires=new Date(Date.now()+days*86400000).toISOString().replace('T',' ').replace('Z','');
 const licenseKey=service.generateKey();
 await db.transaction(async client=>{
  if(!(await client.query('SELECT id FROM tenants WHERE id=$1',[id])).rows.length)throw Object.assign(new Error('İşletme bulunamadı.'),{status:404});
  await client.query("UPDATE licenses SET status='REVOKED' WHERE tenant_id=$1 AND status='ACTIVE'",[id]);
  await client.query("INSERT INTO licenses (license_key,tenant_id,plan_id,status,max_users,max_warehouses,max_devices,max_pdas,enabled_features_json,expires_at) VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6,$7,$8,$9)",[licenseKey,id,plan.id,plan.max_users,plan.max_warehouses,plan.max_devices,plan.max_pdas,JSON.stringify(plan.features),expires]);
  await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',[id,req.user.email,'license_assigned','tenant',id,JSON.stringify({plan:plan.id,days,actor_user_id:req.user.userId})]);
 });
 res.status(201).json({license_key:licenseKey,plan_id:plan.id,module_type:plan.features.module_type,expires_at:expires});
}catch(e){next(e);}});
router.get('/overview',async(req,res,next)=>{try{
 const start=performance.now();await db.query('SELECT 1');
 const latency=Math.round(performance.now()-start);
 const tenants=(await db.query(`SELECT t.id,t.company_name,t.tenant_code,t.is_active,t.created_at,
 (SELECT COUNT(*) FROM users u WHERE u.tenant_id=t.id) AS user_count,
 (SELECT COUNT(*) FROM products p WHERE p.tenant_id=t.id) AS product_count
 FROM tenants t ORDER BY t.id DESC LIMIT 200`)).rows;
 const totals=(await db.query(`SELECT (SELECT COUNT(*) FROM tenants) AS tenants,(SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM licenses WHERE status='ACTIVE' AND expires_at>CURRENT_TIMESTAMP) AS active_licenses`)).rows[0];
 res.json({checked_at:new Date().toISOString(),database:{engine:db.getEngine(),latency_ms:latency},uptime_seconds:Math.floor(process.uptime()),totals,tenants,limit:200,
 integrations:[{name:'NVIDIA AI',configured:Boolean(process.env.NVIDIA_API_KEY)},{name:'E-posta',configured:Boolean(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS)},{name:'Telegram',configured:Boolean(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID)}]});
}catch(e){next(e);}});
router.get('/tenants/:id',async(req,res,next)=>{try{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Geçersiz işletme.'});
 if(!(await db.query('SELECT id FROM tenants WHERE id=$1',[id])).rows.length)return res.status(404).json({error:'İşletme bulunamadı.'});
 const users=(await db.query('SELECT id,email,role,status,created_at FROM users WHERE tenant_id=$1 ORDER BY id LIMIT 200',[id])).rows;
 const licenses=(await db.query('SELECT id,license_key,plan_id,status,expires_at,enabled_features_json FROM licenses WHERE tenant_id=$1 ORDER BY id DESC LIMIT 30',[id])).rows;
 res.json({users,licenses,limits:{users:200,licenses:30}});
}catch(e){next(e);}});
router.patch('/tenants/:id/licenses/:licenseId',async(req,res,next)=>{try{
 const tenantId=Number(req.params.id),licenseId=Number(req.params.licenseId);
 const {status,module_type}=req.body;
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!Number.isSafeInteger(licenseId)||licenseId<1||
   (status!==undefined&&!['ACTIVE','SUSPENDED','REVOKED'].includes(status))||
   (module_type!==undefined&&!['NORMAL','NONE'].includes(module_type))||
   (status===undefined&&module_type===undefined))return res.status(400).json({error:'Geçerli lisans durumu veya modül seçin.'});
 await db.transaction(async client=>{
  const license=(await client.query('SELECT * FROM licenses WHERE id=$1 AND tenant_id=$2',[licenseId,tenantId])).rows[0];
  if(!license)throw Object.assign(new Error('Lisans bulunamadı.'),{status:404});
  if(status==='ACTIVE'){
   const latest=(await client.query('SELECT id FROM licenses WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1',[tenantId])).rows[0];
   if(latest.id!==licenseId||Date.parse(license.expires_at)<=Date.now())throw Object.assign(new Error('Yalnızca son ve süresi geçmemiş lisans etkinleştirilebilir. Yeni paket atayın.'),{status:409});
  }
  const features=JSON.parse(license.enabled_features_json||'{}');
  if(module_type!==undefined){
   features.module_type=module_type;
   for(const key of ['wms_core','inbound','picking','cold_chain','expiry_radar','its_medula','pda'])features[key]=false;
   const plans=require('../services/licenseService').getPlans();
   const plan=plans.find(p=>p.features.module_type===module_type);
   if(plan)Object.assign(features,plan.features);
  }
  await client.query('UPDATE licenses SET status=$1,enabled_features_json=$2 WHERE id=$3 AND tenant_id=$4',[status||license.status,JSON.stringify(features),licenseId,tenantId]);
  await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',[tenantId,req.user.email,'license_updated','license',licenseId,JSON.stringify({status,module_type,actor_user_id:req.user.userId})]);
 });
 res.json({success:true});
}catch(e){next(e);}});
router.get('/finance',async(req,res,next)=>{try{const rows=(await db.query("SELECT t.id,t.company_name,t.is_active,(SELECT COALESCE(SUM(net_amount),0) FROM pos_sales p WHERE p.tenant_id=t.id AND p.status IN ('completed','partially_returned')) AS pos_revenue_try,(SELECT COUNT(*) FROM pos_sales p WHERE p.tenant_id=t.id AND p.status IN ('completed','partially_returned')) AS completed_sales FROM tenants t ORDER BY t.id DESC LIMIT 200")).rows;const invoices=(await db.query('SELECT i.id,i.invoice_no,i.tenant_id,t.company_name,i.amount,i.currency,i.status,i.created_at FROM invoices i JOIN tenants t ON t.id=i.tenant_id ORDER BY i.id DESC LIMIT 200')).rows;res.json({tenants:rows,invoices,limit:200,revenueScope:'Tamamlanmış POS satışları; şirketin toplam muhasebe cirosu değildir.'});}catch(e){next(e);}});
router.patch('/tenants/:id/access',async(req,res,next)=>{try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1||typeof req.body.active!=='boolean'||typeof req.body.reason!=='string'||req.body.reason.trim().length<5||req.body.reason.length>500)return res.status(400).json({error:'İşletme, erişim durumu ve en az 5 karakter gerekçe gerekli.'});await db.transaction(async c=>{if(!(await c.query('SELECT id FROM tenants WHERE id=$1',[id])).rows.length)throw Object.assign(Error('İşletme bulunamadı.'),{status:404});if((await c.query('SELECT p.user_id FROM platform_admins p JOIN users u ON u.id=p.user_id WHERE u.tenant_id=$1',[id])).rows.length)throw Object.assign(Error('Platform yöneticisi işletmesi kapatılamaz.'),{status:403});await c.query('UPDATE tenants SET is_active=$1 WHERE id=$2',[req.body.active?1:0,id]);await c.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',[id,req.user.email,'tenant_access_changed','tenant',id,JSON.stringify({active:req.body.active,reason:req.body.reason})]);});res.json({success:true});}catch(e){next(e);}});
const billing=require('../services/billingService');
const licenseTarget=req=>{const tenantId=Number(req.params.id),licenseId=Number(req.params.licenseId);
 if(!Number.isSafeInteger(tenantId)||tenantId<=0||!Number.isSafeInteger(licenseId)||licenseId<=0)throw Object.assign(new Error('Geçersiz işletme veya lisans.'),{status:400});
 return {tenantId,licenseId,actor:req.user.email};};
const billingRoute=(work,status=201)=>async(req,res,next)=>{try{res.status(status).json(await db.transaction(client=>work(client,licenseTarget(req),req)));}
 catch(e){e.status?res.status(e.status).json({error:e.message}):next(e);}};
router.post('/tenants/:id/licenses/:licenseId/invoices',billingRoute(async(client,target,req)=>{
 const invoice=await billing.createInvoice(client,{...target,billingPeriod:req.body.billing_period||'ANNUAL',paymentMethod:req.body.payment_method,amount:req.body.amount,currency:req.body.currency});
 return {invoice,payment_metadata:{tenant_id:String(target.tenantId),license_id:String(target.licenseId),invoice_id:String(invoice.id)}};}));
router.post('/tenants/:id/licenses/:licenseId/invoices/:invoiceId/confirm-bank-transfer',billingRoute((client,target,req)=>billing.confirmBankTransfer(client,{...target,invoiceId:Number(req.params.invoiceId),amount:req.body.amount,reference:req.body.reference}),200));
router.post('/tenants/:id/licenses/:licenseId/invoices/:invoiceId/void',billingRoute((client,target,req)=>billing.voidBankInvoice(client,{...target,invoiceId:Number(req.params.invoiceId)}),200));
router.get('/bank-transfers',async(req,res,next)=>{try{
 const pending=(await db.query("SELECT i.id,i.invoice_no,i.tenant_id,i.license_id,i.amount,i.currency,i.billing_period,i.created_at,t.company_name FROM invoices i JOIN tenants t ON t.id=i.tenant_id WHERE i.payment_method=$1 AND i.status='PENDING' ORDER BY i.id DESC LIMIT 200",[billing.BANK_TRANSFER])).rows;
 const licenses=(await db.query("SELECT l.id,l.tenant_id,l.plan_id,l.status,l.expires_at,t.company_name FROM licenses l JOIN tenants t ON t.id=l.tenant_id WHERE l.status IN ('PENDING_PAYMENT','ACTIVE','PAST_DUE','EXPIRED') ORDER BY l.id DESC LIMIT 200")).rows;
 res.json({bank:billing.bankDetails(),pending,licenses});
}catch(e){next(e);}});
router.post('/tenants/:id/licenses/:licenseId/cancel',billingRoute(async(client,target)=>{await billing.cancelLicense(client,target);return {status:'CANCELLED'};}));
router.post('/tenants/:id/licenses/:licenseId/extend',billingRoute(async(client,target,req)=>({expires_at:await billing.extendManually(client,{...target,days:req.body.days,reason:req.body.reason})})));
router.post('/billing',async(req,res,next)=>{try{const {tenant_id,amount,currency}=req.body;if(!Number.isSafeInteger(tenant_id)||tenant_id<1||typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>10000000||!['TRY','USD','EUR'].includes(currency))return res.status(400).json({error:'Geçerli firma, tutar ve para birimi gerekli.'});const number='PRF-'+require('crypto').randomUUID();await db.transaction(async c=>{if(!(await c.query('SELECT id FROM tenants WHERE id=$1',[tenant_id])).rows.length)throw Object.assign(Error('İşletme bulunamadı.'),{status:404});await c.query("INSERT INTO invoices (invoice_no,tenant_id,amount,currency,billing_period,payment_method,status,paid_at) VALUES ($1,$2,$3,$4,'ANNUAL','MANUAL','DRAFT',NULL)",[number,tenant_id,amount,currency]);await c.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)',[tenant_id,req.user.email,'billing_draft_created','invoice',JSON.stringify({invoice_no:number,amount,currency})]);});res.status(201).json({invoice_no:number,status:'DRAFT',legal_invoice:false});}catch(e){next(e);}});
router.put('/integrations/:id',async(req,res,next)=>{try{const keys={gemini:'GEMINI_API_KEY',nvidia:'NVIDIA_API_KEY',fish:'FISH_API_KEY'};const key=keys[req.params.id],value=req.body.key;if(!key||typeof value!=='string'||value.length<10||value.length>500||!/^[-A-Za-z0-9_.]+$/.test(value))return res.status(400).json({error:'Geçerli sağlayıcı ve API anahtarı gerekli.'});const fs=require('fs'),path=require('path');const file=process.env.NODE_ENV==='production'?path.join(require('../config/runtimeConfig').paths().data,'install.env'):path.join(__dirname,'../../.env');let content=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';const pattern=new RegExp('^'+key+'=.*$','m');content=pattern.test(content)?content.replace(pattern,key+'='+value):content+'\n'+key+'='+value+'\n';fs.writeFileSync(file+'.tmp',content,{mode:0o600});fs.renameSync(file+'.tmp',file);process.env[key]=value;await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)',[req.user.homeTenantId,req.user.email,'integration_key_updated','platform',JSON.stringify({provider:req.params.id})]);res.json({success:true});}catch(e){next(e);}});
router.get('/e-invoice', (req,res)=>res.json(require('../integrations/uyumsoft').status()));
router.post('/e-invoice/:action',require('express-rate-limit')({windowMs:60000,limit:20}),async(req,res,next)=>{try{res.json({result:await require('../integrations/uyumsoft').invoke(req.params.action,req.body)});}catch(e){next(e);}});
module.exports=router;
