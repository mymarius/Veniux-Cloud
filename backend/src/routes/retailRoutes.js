const express=require('express');
const crypto=require('crypto');
const db=require('../config/database');
const {authMiddleware,requireRole}=require('../middlewares/authMiddleware');
const router=express.Router();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const barcode=value=>{
 if(typeof value!=='string'||!value.trim()||value.trim().length>128||/[\x00-\x1f]/.test(value)) fail('Geçerli bir barkod girin.');
 return value.trim();
};
router.use(authMiddleware);
router.get('/lookup',async(req,res,next)=>{try{
 const code=barcode(req.query.barcode);
 const rows=(await db.query("SELECT id,name,barcode,unit,purchase_price,sale_price FROM products WHERE tenant_id=$1 AND module_type='NORMAL' AND barcode=$2",[req.user.tenantId,code])).rows;
 if(rows.length>1)fail('Bu barkod birden fazla ürüne atanmış. Ürün kataloğundan düzeltin.',409);
 if(rows[0])return res.json({product:rows[0],pack:null});
 // Koli/paket barkodu: ürünü ve kaç temel birim olduğunu döndürür.
 const packs=(await db.query("SELECT p.id,p.name,p.barcode,p.unit,p.purchase_price,p.sale_price,u.uom_code,u.conversion_factor FROM product_uoms u JOIN products p ON p.id=u.product_id AND p.tenant_id=u.tenant_id WHERE u.tenant_id=$1 AND u.barcode=$2 AND p.module_type='NORMAL'",[req.user.tenantId,code])).rows;
 if(packs.length>1)fail('Bu koli barkodu birden fazla ürüne atanmış. Ürün birimlerini düzeltin.',409);
 const pk=packs[0];
 res.json({product:pk?{id:pk.id,name:pk.name,barcode:pk.barcode,unit:pk.unit,purchase_price:pk.purchase_price,sale_price:pk.sale_price}:null,pack:pk?{unit:pk.uom_code,factor:Number(pk.conversion_factor)}:null});
}catch(e){next(e);}});
// Akıllı arama: kendi katalog → Open Food Facts önerisi → elle. Kayıt yazmaz.
// Sağlayıcı durumu (yalnız platform yöneticisi): sıra, etkinlik, anahtar tanımlı mı (değeri hiç dönmez) ve kullanım sayaçları. Sayaçlar bellektedir.
router.get('/lookup/providers',requireRole('admin'),(req,res)=>{if(!req.user.isPlatformAdmin)return res.status(403).json({error:'Bu bilgiyi yalnız platform yöneticisi görebilir.'});res.set('Cache-Control','no-store').json({providers:require('../services/barcodeLookupService').status(),config:'VENIUX_BARCODE_PROVIDERS (sıra, virgülle), VENIUX_BARCODELOOKUP_KEY'});});
router.get('/lookup/suggest',requireRole('admin','manager'),async(req,res,next)=>{try{res.json(await require('../services/barcodeLookupService').suggest(req.user,req.query.barcode));}catch(e){next(e);}});
router.post('/receive',requireRole('admin','manager'),async(req,res,next)=>{try{
 const body=req.body,tenant=req.user.tenantId;
 const key=req.get('Idempotency-Key');
 if(!key||key.length>120)fail('İşlem anahtarı gerekli.');
 require('../services/retailReceiveService').checkLine(body);
 const hash=crypto.createHash('sha256').update('retail-receive:'+JSON.stringify(body)).digest('hex');
 const result=await db.transaction(async client=>{
 const previous=(await client.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[tenant,'retail:'+key])).rows[0];
 if(previous){if(previous.request_hash!==hash)fail('Bu işlem anahtarı başka bilgilerle kullanılmış.',409);return JSON.parse(previous.result_json);}
 const warehouse=(await client.query("SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2 AND warehouse_type='NORMAL'",[body.warehouse_id,tenant])).rows[0];
 if(!warehouse)fail('Mağaza/depo bulunamadı.',404);
 const {created,...response}=await require('../services/retailReceiveService').receiveLine(client,{tenant,user:req.user,requestId:req.requestId},warehouse,body);
 await client.query('INSERT INTO depot_operation_keys (tenant_id,operation_key,request_hash,result_json) VALUES ($1,$2,$3,$4)',[tenant,'retail:'+key,hash,JSON.stringify(response)]);
 return response;
 });res.status(201).json(result);
}catch(e){next(e);}});
// Toplu mal kabul: tek işlemde en çok 500 satır (hepsi ya da hiçbiri). Tek İşlem anahtarı tüm istek içindir; aynı istek tekrarlanırsa aynı sonuç döner.
// Gövde: { warehouse_id, lines:[ { barcode?, product_id? | name,unit,purchase_price,sale_price, quantity, pack_unit? } ] }
router.post('/receive/batch',requireRole('admin','manager'),async(req,res,next)=>{try{
 const svc=require('../services/retailReceiveService'),body=req.body||{},tenant=req.user.tenantId;
 const key=req.get('Idempotency-Key');
 if(!key||key.length>120)fail('İşlem anahtarı gerekli.');
 if(!Array.isArray(body.lines)||!body.lines.length)fail('En az bir satır gerekli.');
 if(body.lines.length>svc.MAX_BATCH_LINES)fail('Bir toplu kabulde en çok '+svc.MAX_BATCH_LINES+' satır olabilir; listeyi bölün.');
 const errors=[];
 body.lines.forEach((line,index)=>{try{svc.checkLine(line);}catch(e){errors.push({index,error:e.message});}});
 if(errors.length)return res.status(400).json({error:errors.length+' satırda hata var; hiçbir şey kaydedilmedi.',line_errors:errors.slice(0,50)});
 const hash=crypto.createHash('sha256').update('retail-receive-batch:'+JSON.stringify({warehouse_id:body.warehouse_id,lines:body.lines})).digest('hex');
 const result=await db.transaction(async client=>{
  const previous=(await client.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[tenant,'retail-batch:'+key])).rows[0];
  if(previous){if(previous.request_hash!==hash)fail('Bu işlem anahtarı başka bilgilerle kullanılmış.',409);return {...JSON.parse(previous.result_json),replayed:true};}
  const warehouse=(await client.query("SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2 AND warehouse_type='NORMAL'",[body.warehouse_id,tenant])).rows[0];
  if(!warehouse)fail('Mağaza/depo bulunamadı.',404);
  const batchId='RCV-'+crypto.randomUUID();
  const response={batch_id:batchId,...await svc.receiveBatch(client,{tenant,user:req.user,requestId:req.requestId},warehouse,body.lines,batchId)};
  await client.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'retail.receive_batch','stock',$3,$4)",[tenant,req.user.email,0,JSON.stringify({requestId:req.requestId,batchId,warehouseId:warehouse.id,lineCount:response.line_count,totalUnits:response.total_units,newProducts:response.new_products})]);
  await client.query('INSERT INTO depot_operation_keys (tenant_id,operation_key,request_hash,result_json) VALUES ($1,$2,$3,$4)',[tenant,'retail-batch:'+key,hash,JSON.stringify(response)]);
  return response;
 });
 res.status(result.replayed?200:201).json(result);
}catch(e){if(e.line_index!==undefined)return res.status(e.status||400).json({error:e.message,line_index:e.line_index});next(e);}});
module.exports=router;

