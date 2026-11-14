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
router.post('/receive',requireRole('admin','manager'),async(req,res,next)=>{try{
 const body=req.body,tenant=req.user.tenantId;
 const key=req.get('Idempotency-Key');
 if(!key||key.length>120)fail('İşlem anahtarı gerekli.');
 const code=body.barcode?barcode(body.barcode):null;
 const qty=Number(body.quantity);
 if(!['number','string'].includes(typeof body.quantity)||!Number.isSafeInteger(qty)||qty<=0||qty>1000000)fail('Miktar 1 ile 1.000.000 arasında tam sayı olmalıdır.');
 if(body.pack_unit!==undefined&&(typeof body.pack_unit!=='string'||!body.pack_unit.trim()||body.pack_unit.length>20))fail('Ambalaj birimi geçersiz.');
 const hash=crypto.createHash('sha256').update('retail-receive:'+JSON.stringify(body)).digest('hex');
 const result=await db.transaction(async client=>{
 const previous=(await client.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[tenant,'retail:'+key])).rows[0];
 if(previous){if(previous.request_hash!==hash)fail('Bu işlem anahtarı başka bilgilerle kullanılmış.',409);return JSON.parse(previous.result_json);}
 const warehouse=(await client.query("SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2 AND warehouse_type='NORMAL'",[body.warehouse_id,tenant])).rows[0];
 if(!warehouse)fail('Mağaza/depo bulunamadı.',404);
 let product;
 if(body.product_id){
 product=(await client.query("SELECT * FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'",[body.product_id,tenant])).rows[0];
 if(!product)fail('Ürün bulunamadı.',404);
 if(code&&product.barcode!==code&&!(await client.query('SELECT id FROM product_uoms WHERE tenant_id=$1 AND product_id=$2 AND barcode=$3',[tenant,product.id,code])).rows.length)fail('Barkod ile ürün eşleşmiyor.',409);
 }else{
 if(body.pack_unit!==undefined)fail('Yeni ürün koli/paket ile kabul edilemez; önce ürünü adet olarak ekleyip birimlerini tanımlayın.');
 if(code&&(await client.query('SELECT id FROM products WHERE tenant_id=$1 AND barcode=$2',[tenant,code])).rows.length)fail('Ürün zaten kayıtlı. Barkodu yeniden sorgulayın.',409);
 if(typeof body.name!=='string'||!body.name.trim()||body.name.length>200)fail('Ürün adı gerekli.');
 for(const field of ['purchase_price','sale_price'])if(!['number','string'].includes(typeof body[field])||String(body[field]).trim()===''||!Number.isFinite(Number(body[field]))||Number(body[field])<0||Number(body[field])>10000000||Math.abs(Number(body[field])*100-Math.round(Number(body[field])*100))>0.00001)fail('Fiyatları en fazla iki ondalık basamakla girin.');
 if(!['adet','paket','kutu','kg','litre','metre'].includes(body.unit))fail('Geçerli bir birim seçin.');
 product=(await client.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,purchase_price,sale_price,category,module_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'NORMAL') RETURNING *",[tenant,'RTL-'+crypto.randomUUID(),body.name.trim(),code,body.unit,Number(body.purchase_price),Number(body.sale_price),'Perakende'])).rows[0];
 }
 // Koli/paket ile kabul: okutulan barkod bir birimse ya da birim adı verildiyse miktar temel birime çevrilir.
 let pack=null;
 if(body.product_id){
  const byCode=code&&product.barcode!==code?(await client.query('SELECT uom_code,conversion_factor FROM product_uoms WHERE tenant_id=$1 AND product_id=$2 AND barcode=$3',[tenant,product.id,code])).rows[0]:null;
  const byName=body.pack_unit!==undefined?(await client.query('SELECT uom_code,conversion_factor FROM product_uoms WHERE tenant_id=$1 AND product_id=$2 AND uom_code=$3',[tenant,product.id,body.pack_unit.trim().toLocaleLowerCase('tr-TR')])).rows[0]:null;
  if(body.pack_unit!==undefined&&!byName)fail('Bu üründe "'+body.pack_unit+'" birimi tanımlı değil.',404);
  if(byCode&&byName&&byCode.uom_code!==byName.uom_code)fail('Okutulan barkod ile seçilen birim farklı.',409);
  pack=byCode||byName||null;
 }
 const units=pack?qty:null,factor=pack?Number(pack.conversion_factor):1,baseQty=Math.round(qty*factor*1e6)/1e6;
 if(!Number.isSafeInteger(baseQty))fail(`1 ${pack.uom_code} = ${factor} ${product.unit||'adet'}; kabul edilen toplam tam sayı olmalı.`);
 const current=(await client.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3',[tenant,product.id,warehouse.id])).rows[0];
 const total=Number(current?.quantity||0)+baseQty;
 if(!Number.isSafeInteger(total))fail('Stok miktarı sınırı aşıldı.');
 if(current)await client.query('UPDATE stock_records SET quantity=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[total,current.id]);
 else await client.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)',[tenant,product.id,warehouse.id,baseQty]);
 const movement=(await client.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'inbound','retail_quick_add','Telefon / terminal hızlı kabul') RETURNING id",[tenant,product.id,warehouse.id,baseQty])).rows[0];
 await require('../services/inventoryTransactionService').recordProjectedEntry(client,{tenant_id:tenant,warehouse_id:warehouse.id,product_id:product.id,transaction_type:'RECEIVE',quantity:baseQty,reference_type:'stock_movement',reference_id:movement.id,user_id:req.user.userId,reason_code:'retail_quick_add'});
 await client.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'retail.receive','stock',$3,$4)",[tenant,req.user.email,movement.id,JSON.stringify({requestId:req.requestId,productId:product.id,warehouseId:warehouse.id,quantity:baseQty,pack:pack?{unit:pack.uom_code,count:units,factor}:null})]);
 const response={product:{id:product.id,name:product.name,unit:product.unit},quantity:baseQty,pack:pack?{unit:pack.uom_code,count:units,factor}:null,total_quantity:total,movement_id:movement.id};
 await client.query('INSERT INTO depot_operation_keys (tenant_id,operation_key,request_hash,result_json) VALUES ($1,$2,$3,$4)',[tenant,'retail:'+key,hash,JSON.stringify(response)]);
 return response;
 });res.status(201).json(result);
}catch(e){next(e);}});
module.exports=router;

