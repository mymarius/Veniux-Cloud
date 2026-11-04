const express=require('express'),crypto=require('crypto'),bcrypt=require('bcrypt'),db=require('../config/database');
const {authMiddleware}=require('../middlewares/authMiddleware');
const access=require('../services/businessPortalAccess'),router=express.Router();
const safe=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const text=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const inviteLimit=require('express-rate-limit')({windowMs:900000,max:20});
router.post('/accept-invitation',inviteLimit,safe(async(req,res)=>{
 const {token,password}=req.body;if(!/^[a-f0-9]{64}$/.test(token||'')||typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72)access.fail('Geçerli davet ve 12–72 bayt şifre gerekli.',400);
 const hash=crypto.createHash('sha256').update(token).digest('hex'),passwordHash=await bcrypt.hash(password,12);
 await db.transaction(async tx=>{
  const invitation=(await tx.query('SELECT * FROM business_invitations WHERE token_hash=$1',[hash])).rows[0];
  if(!invitation||invitation.redeemed_at||Date.parse(invitation.expires_at)<=Date.now())access.fail('Davet geçersiz veya süresi dolmuş.',400);
  if(!(await tx.query('SELECT tenant_id FROM business_portal_settings WHERE tenant_id=$1 AND enabled=1',[invitation.tenant_id])).rows.length||(invitation.partner_id&&!(await tx.query("SELECT id FROM business_partners WHERE tenant_id=$1 AND id=$2 AND status='active'",[invitation.tenant_id,invitation.partner_id])).rows.length))access.fail('Davetin işletme veya müşteri erişimi kapalı.',403);
  const updated=await tx.query('UPDATE business_invitations SET redeemed_at=CURRENT_TIMESTAMP WHERE id=$1 AND redeemed_at IS NULL',[invitation.id]);if(!updated.rowCount)access.fail('Davet kullanılmış.',409);
  if((await tx.query('SELECT id FROM users WHERE LOWER(email)=$1',[invitation.email])).rows.length)access.fail('Bu e-posta zaten kayıtlı; mevcut hesabı yöneticiye bildirin.',409);
  const u=(await tx.query("INSERT INTO users (tenant_id,email,password_hash,role,full_name,status) VALUES ($1,$2,$3,'viewer',$4,'active') RETURNING id",[invitation.tenant_id,invitation.email,passwordHash,text(req.body.name,100)||invitation.email])).rows[0];
  await tx.query('INSERT INTO business_members(user_id,tenant_id,portal_role,partner_id) VALUES($1,$2,$3,$4)',[u.id,invitation.tenant_id,invitation.portal_role,invitation.partner_id]);
  if(invitation.portal_role==='field'&&invitation.partner_id)await tx.query('INSERT INTO business_assignments(tenant_id,user_id,partner_id) VALUES($1,$2,$3)',[invitation.tenant_id,u.id,invitation.partner_id]);
 });res.status(201).json({success:true});
}));
router.use(authMiddleware);
router.use(async(req,res,next)=>{try{req.business=await access.role({...req.user,centralLicense:req.centralLicense});next();}catch(e){next(e);}});
const admin=(req,res,next)=>req.business.role==='admin'?next():res.status(403).json({error:'Yönetici yetkisi gerekli.'});
router.get('/me',safe(async(req,res)=>res.json({role:req.business.role,email:req.user.email,tenant_id:req.user.tenantId})));
router.get('/partners',safe(async(req,res)=>{
 let rows=(await db.query('SELECT id,name,contact_name,phone,email,status FROM business_partners WHERE tenant_id=$1 ORDER BY name',[req.user.tenantId])).rows;
 if(req.business.role==='dealer')rows=rows.filter(r=>r.id===req.business.partner_id);
 if(req.business.role==='field'){const ids=(await db.query('SELECT partner_id FROM business_assignments WHERE tenant_id=$1 AND user_id=$2',[req.user.tenantId,req.user.id])).rows.map(r=>r.partner_id);rows=rows.filter(r=>ids.includes(r.id));}res.json(rows);
}));
router.post('/partners',admin,safe(async(req,res)=>{
 const name=text(req.body.name,150);if(!name)access.fail('Müşteri/işletme adı gerekli.',400);
 const row=(await db.query('INSERT INTO business_partners(tenant_id,name,contact_name,phone,email) VALUES($1,$2,$3,$4,$5) RETURNING id',[req.user.tenantId,name,text(req.body.contact_name,100),text(req.body.phone,30),text(req.body.email,254)])).rows[0];res.status(201).json(row);
}));
router.get('/catalog',safe(async(req,res)=>res.json((await db.query("SELECT id,name,sku,barcode,unit,sale_price FROM products WHERE tenant_id=$1 AND module_type='NORMAL' ORDER BY name LIMIT 2000",[req.user.tenantId])).rows)));
router.post('/invitations',admin,safe(async(req,res)=>{
 const email=text(req.body.email,254).toLowerCase(),role=req.body.role;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['field','dealer'].includes(role))access.fail('Geçerli e-posta ve rol gerekli.',400);
 const p=await access.partner(req.user,req.business,req.body.partner_id);
 if((await db.query('SELECT id FROM users WHERE LOWER(email)=$1',[email])).rows.length)access.fail('E-posta zaten kayıtlı.',409);
 const token=crypto.randomBytes(32).toString('hex'),expires=new Date(Date.now()+86400000).toISOString().replace('T',' ').replace('Z','');
 await db.query('INSERT INTO business_invitations(tenant_id,email,portal_role,partner_id,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[req.user.tenantId,email,role,p.id,crypto.createHash('sha256').update(token).digest('hex'),expires,req.user.id]);
 res.status(201).json({token,expires_at:expires});
}));
router.get('/members',admin,safe(async(req,res)=>res.json((await db.query('SELECT m.user_id,m.portal_role,m.partner_id,m.active,u.email,u.full_name FROM business_members m JOIN users u ON u.id=m.user_id AND u.tenant_id=m.tenant_id WHERE m.tenant_id=$1',[req.user.tenantId])).rows)));
router.post('/members/:id/revoke',admin,safe(async(req,res)=>{await db.transaction(async tx=>{await tx.query('UPDATE business_members SET active=0 WHERE tenant_id=$1 AND user_id=$2',[req.user.tenantId,req.params.id]);await tx.query('UPDATE users SET session_version=session_version+1 WHERE tenant_id=$1 AND id=$2 AND role=$3',[req.user.tenantId,req.params.id,'viewer']);await tx.query('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',[req.user.tenantId,req.user.email,'business.member_revoked','user',req.params.id,JSON.stringify({user_id:req.params.id})]);});res.json({success:true});}));
router.post('/assignments',admin,safe(async(req,res)=>{
 const p=await access.partner(req.user,req.business,req.body.partner_id),member=(await db.query("SELECT user_id FROM business_members WHERE tenant_id=$1 AND user_id=$2 AND portal_role='field' AND active=1",[req.user.tenantId,req.body.user_id])).rows[0];if(!member)access.fail('Saha personeli bulunamadı.',404);
 if(!(await db.query('SELECT user_id FROM business_assignments WHERE tenant_id=$1 AND user_id=$2 AND partner_id=$3',[req.user.tenantId,member.user_id,p.id])).rows.length)await db.query('INSERT INTO business_assignments(tenant_id,user_id,partner_id) VALUES($1,$2,$3)',[req.user.tenantId,member.user_id,p.id]);res.json({success:true});
}));
router.get('/orders',safe(async(req,res)=>{
 let rows=(await db.query('SELECT o.*,p.name AS partner_name FROM business_orders o JOIN business_partners p ON p.id=o.partner_id AND p.tenant_id=o.tenant_id WHERE o.tenant_id=$1 ORDER BY o.id DESC LIMIT 500',[req.user.tenantId])).rows;
 if(req.business.role==='dealer')rows=rows.filter(r=>r.partner_id===req.business.partner_id);if(req.business.role==='field')rows=rows.filter(r=>r.created_by===req.user.id);
 res.json(rows.map(r=>({...r,lines:JSON.parse(r.lines_json)})));
}));
router.post('/orders',safe(async(req,res)=>{
 const p=await access.partner(req.user,req.business,req.body.partner_id),key=req.get('Idempotency-Key');if(!/^[A-Za-z0-9_-]{8,100}$/.test(key||''))access.fail('İşlem anahtarı gerekli.',400);
 const input=req.body.lines;if(!Array.isArray(input)||!input.length||input.length>100)access.fail('1–100 sipariş satırı gerekli.',400);
 const ids=new Set();for(const l of input){if(!Number.isSafeInteger(l.product_id)||l.product_id<1||!Number.isFinite(l.quantity)||l.quantity<=0||l.quantity>100000||Math.abs(l.quantity*1000-Math.round(l.quantity*1000))>0.000001||ids.has(l.product_id))access.fail('Ürün veya miktar geçersiz; aynı ürünü tek satırda girin.',400);ids.add(l.product_id);}
 const note=text(req.body.note),requestHash=crypto.createHash('sha256').update(JSON.stringify({partner_id:p.id,lines:input,note})).digest('hex');
 const result=await db.transaction(async tx=>{
  const old=(await tx.query('SELECT id,request_hash FROM business_orders WHERE tenant_id=$1 AND created_by=$2 AND request_key=$3',[req.user.tenantId,req.user.id,key])).rows[0];if(old){if(old.request_hash!==requestHash)access.fail('İşlem anahtarı farklı siparişte kullanılmış.',409);return {id:old.id,replayed:true};}
  const lines=[];let total=0n;for(const l of input){const product=(await tx.query("SELECT id,name,unit,sale_price FROM products WHERE tenant_id=$1 AND id=$2 AND module_type='NORMAL'",[req.user.tenantId,l.product_id])).rows[0];if(!product)access.fail('Ürün bulunamadı.',404);const price=String(product.sale_price??'');if(!/^\d{1,12}(?:\.\d{1,6})?$/.test(price))access.fail('Ürün fiyatı doğrulanamadı.',409);const [whole,fraction='']=price.split('.');const cents=Number(BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2))+((fraction[2]||'0')>='5'?1n:0n));if(!Number.isSafeInteger(cents)||cents<0)access.fail('Ürün fiyatı doğrulanamadı.',409);const lineTotal=(BigInt(cents)*BigInt(Math.round(l.quantity*1000))+500n)/1000n;total+=lineTotal;lines.push({product_id:product.id,name:product.name,unit:product.unit,quantity:l.quantity,unit_price_cents:cents,total_cents:Number(lineTotal)});}
  if(total>9007199254740991n)access.fail('Sipariş tutarı sınırı aşıldı.',400);
  const row=(await tx.query('INSERT INTO business_orders(tenant_id,partner_id,created_by,lines_json,total_cents,note,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[req.user.tenantId,p.id,req.user.id,JSON.stringify(lines),Number(total),note,key,requestHash])).rows[0];return row;
 });res.status(result.replayed?200:201).json(result);
}));
router.post('/orders/:id/review',admin,safe(async(req,res)=>{
 if(!['approved','rejected'].includes(req.body.status)||!Number.isSafeInteger(req.body.revision))access.fail('Geçerli durum ve sürüm gerekli.',400);
 await db.transaction(async tx=>{const r=await tx.query("UPDATE business_orders SET status=$1,reviewed_by=$2,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$3 AND id=$4 AND status='submitted' AND revision=$5",[req.body.status,req.user.id,req.user.tenantId,req.params.id,req.body.revision]);if(!r.rowCount)access.fail('Sipariş değişti veya bulunamadı. Listeyi yenileyin.',409);await tx.query('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',[req.user.tenantId,req.user.email,'business.order_reviewed','business_order',req.params.id,JSON.stringify({status:req.body.status,previous_revision:req.body.revision})]);});res.json({success:true});
}));
router.post('/visits',safe(async(req,res)=>{
 if(req.business.role==='dealer')access.fail('Ziyaret kaydı saha personeline aittir.');const p=await access.partner(req.user,req.business,req.body.partner_id),note=text(req.body.note,2000);if(!note)access.fail('Ziyaret notu gerekli.',400);
 const row=(await db.query('INSERT INTO business_visits(tenant_id,partner_id,user_id,note) VALUES($1,$2,$3,$4) RETURNING id',[req.user.tenantId,p.id,req.user.id,note])).rows[0];res.status(201).json(row);
}));
router.get('/visits',safe(async(req,res)=>{
 if(req.business.role==='dealer')access.fail('Ziyaret kayıtları saha personeline aittir.');res.json((await db.query('SELECT v.*,p.name AS partner_name FROM business_visits v JOIN business_partners p ON p.id=v.partner_id AND p.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND ($2=1 OR v.user_id=$3) ORDER BY v.id DESC LIMIT 500',[req.user.tenantId,req.business.role==='admin'?1:0,req.user.id])).rows);
}));
module.exports=router;
