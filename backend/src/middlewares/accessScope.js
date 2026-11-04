const db=require('../config/database'),context=require('../services/scopeQueryContext'),access=require('../services/accessScopeService');
const operational=/^\/api\/(products|warehouses|suppliers|stock|stock-counts|purchase-orders|alerts|normal-depo|eczane-depo|pharmacy|wms|terminal|scanner|retail|ai)(\/|$)/;
const refs={warehouse_id:['warehouses','id'],warehouseId:['warehouses','id'],sourceWarehouseId:['warehouses','id'],targetWarehouseId:['warehouses','id'],from_warehouse_id:['warehouses','id'],to_warehouse_id:['warehouses','id'],source_warehouse_id:['warehouses','id'],target_warehouse_id:['warehouses','id'],location_id:['warehouse_locations','id'],locationId:['warehouse_locations','id'],source_location_id:['warehouse_locations','id'],target_location_id:['warehouse_locations','id'],actual_location_id:['warehouse_locations','id'],lot_id:['inventory_lots','id'],register_id:['retail_registers','id'],shift_id:['retail_shifts','id'],receipt_id:['wms_inbound_receipts','id'],item_id:['wms_inbound_items','id'],purchase_order_id:['purchase_orders','id'],purchase_order_item_id:['purchase_order_items','id'],order_item_id:['purchase_order_items','id'],receipt_item_id:['wms_inbound_items','id'],count_id:['stock_counts','id'],review_id:['wms_count_reviews','id'],handling_unit_id:['handling_units','id'],task_id:['wms_pick_tasks','id'],wave_id:['wms_pick_waves','id']};
const denied=message=>Object.assign(Error(message),{status:403});
module.exports=async(req,res,next)=>{
 try{
  if(operational.test(req.originalUrl)&&!['sqlite','mysql'].includes(db.getEngine()))throw Object.assign(Error('Depo kapsamı bu veritabanı için doğrulanmadı. Operasyon erişimi kapalı.'),{status:503});
  const user=req.user,scope=user.isPlatformAdmin&&user.homeTenantId!==user.tenantId?{mode:'company',warehouse_ids:[]}:await access.read(user.userId,user.tenantId);
  user.accessScope=scope;
  if(scope.mode!=='company'&&/^\/api\/settings\/(automation|whatsapp|company|system-engine)(\/|$)/.test(req.originalUrl))throw denied('Firma genelindeki ayar ve otomasyonlar firma genelinde erişim gerektirir.');
  if(scope.mode!=='company'&&/^\/api\/(audit-logs|notifications)(\/|$)/.test(req.originalUrl))throw denied('Firma genelindeki işlem geçmişi için firma genelinde erişim gerekir.');
  if(!operational.test(req.originalUrl))return next();
  if(scope.mode!=='company'&&!scope.warehouse_ids.length)throw denied('Depo erişiminiz atanmamış. Firma yöneticinizden erişim isteyin.');
  // These resources are company-wide, without a physical warehouse link.
  // Scoped users cannot change shared master/settings data or inspect global AI/audit histories.
  const supplierReturn=req.method==='POST'&&/^\/api\/suppliers\/\d+\/returns(?:\?|$)/.test(req.originalUrl);
  if(scope.mode!=='company'&&(/^\/api\/(ai|pharmacy|eczane-depo)(\/|$)/.test(req.originalUrl)||(!['GET','HEAD'].includes(req.method)&&!supplierReturn&&/^\/api\/(products|suppliers|warehouses)(?:\/|$)/.test(req.originalUrl))||/^\/api\/scanner\/settings/.test(req.originalUrl)&&req.method!=='GET'))throw denied('Bu işlem firma genelinde erişim gerektirir.');
  return context.run({...scope,tenantId:user.tenantId},async()=>{
   try{
    const check=async(table,key,id)=>{
     if(id===undefined||id===null||id==='')return;
     if(!['string','number'].includes(typeof id)||! /^[A-Za-z0-9_-]{1,120}$/.test(String(id)))throw Object.assign(Error('Geçersiz kayıt kimliği.'),{status:400});
     // Preserve the existing company-wide POS 409 response for a stale shift;
     // the shift service still verifies firm, warehouse and active status.
     if(scope.mode==='company'&&table==='retail_shifts')return;
     if(!(await db.query(`SELECT ${key} FROM ${table} WHERE ${key}=$1 AND tenant_id=$2`,[id,user.tenantId])).rows.length)throw Object.assign(Error('Kayıt bulunamadı veya erişim kapsamınız dışında.'),{status:404});
    };
    const walk=async(value,depth=0)=>{if(depth>12)throw Object.assign(Error('İstek çok karmaşık.'),{status:400});if(Array.isArray(value)){for(const item of value)await walk(item,depth+1);}else if(value&&typeof value==='object'&&!Buffer.isBuffer(value))for(const[key,item]of Object.entries(value)){if(refs[key])await check(...refs[key],item);else if(item&&typeof item==='object')await walk(item,depth+1);}};
    await walk(req.query);await walk(req.body);
    const path=req.originalUrl.split('?')[0];let match;
    for(const[pattern,table,key]of [[/^\/api\/warehouses\/(\d+)/,'warehouses','id'],[/^\/api\/purchase-orders\/(\d+)/,'purchase_orders','id'],[/^\/api\/stock-counts\/(\d+)/,'stock_counts','id'],[/^\/api\/scanner\/sales\/(\d+)/,'retail_sales','sale_id'],[/^\/api\/scanner\/shifts\/(\d+)/,'retail_shifts','id']])if((match=path.match(pattern)))await check(table,key,match[1]);
    next();
   }catch(e){next(e);}
  });
 }catch(e){next(e);}
};
