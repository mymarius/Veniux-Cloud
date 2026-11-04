const db = require('../config/database');
const references = Object.freeze({warehouse_id:'warehouses',target_warehouse_id:'warehouses',product_id:'products',medicine_id:'products',depot_id:'pharmacy_depots',patient_id:'patient_accounts',batch_id:'medicine_batches',staff_id:'pharmacy_staff',supplier_id:'suppliers',location_id:'warehouse_locations',source_location_id:'warehouse_locations',target_location_id:'warehouse_locations',actual_location_id:'warehouse_locations',lot_id:'inventory_lots',handling_unit_id:'handling_units',target_handling_unit_id:'handling_units',parent_hu_id:'handling_units',task_id:'wms_pick_tasks',receipt_id:'wms_inbound_receipts',item_id:'wms_inbound_items',appointment_id:'wms_dock_appointments',assigned_user_id:'users'});

// Validate references at the HTTP boundary, including nested item lists. Never
// accept a tenant supplied by the caller as the ownership authority.
module.exports = async function warehouseBoundary(req,res,next) {
 try {
  const tenant=req.user.tenantId, checked=new Map();
  async function check(table,value) {
   if(value===undefined||value===null||value==='')return;
   if(!['string','number'].includes(typeof value)||!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<1)throw Object.assign(new Error('Geçersiz kayıt kimliği.'),{status:400});
   const key=table+':'+value;if(checked.has(key))return checked.get(key);
   const result=await db.query(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`,[Number(value),tenant]);
   if(!result.rows.length)throw Object.assign(new Error('Kayıt bulunamadı.'),{status:404});
   const module=table==='products'?result.rows[0].module_type:table==='warehouses'?result.rows[0].warehouse_type:null;
   if(module&&['NORMAL','PHARMACY'].includes(req.user.moduleType)&&module!==req.user.moduleType)throw Object.assign(new Error('Bu kayıt lisans modülünüz kapsamında değil.'),{status:403});
   checked.set(key,result.rows[0]);return result.rows[0];
  }
  async function walk(value,depth=0) {
   if(depth>8)throw Object.assign(new Error('İstek çok karmaşık.'),{status:400});
   if(Array.isArray(value)){if(value.length>1000)throw Object.assign(new Error('Çok fazla kalem.'),{status:400});for(const item of value)await walk(item,depth+1);return;}
   if(!value||typeof value!=='object')return;
   for(const [key,item]of Object.entries(value)){if(references[key])await check(references[key],item);else if(item&&typeof item==='object')await walk(item,depth+1);}
  }
  await walk(req.query);await walk(req.body);
  const target=req.path.match(/^\/(locations|reservations|inbound\/receipts|picking\/waves)\/(\d+)(?:\/|$)/);
  if(target)await check({'locations':'warehouse_locations','reservations':'inventory_reservations','inbound/receipts':'wms_inbound_receipts','picking/waves':'wms_pick_waves'}[target[1]],target[2]);
  const product=req.path.match(/^\/ledger\/product\/([^/]+)$/);if(product)await check('products',product[1]);
  if(req.originalUrl.startsWith('/api/pharmacy/')){
   const detail=req.path.match(/^\/(invoices|returns|reconciliations|staff|duty-schedule|depots|medula\/provision|patient-interactions)\/([^/]+)(?:\/|$)/);
   if(detail&&!['summary','balance-summary','inspection-report'].includes(detail[2]))await check({'invoices':'pharmacy_invoices','returns':'medicine_returns','reconciliations':'depot_reconciliations','staff':'pharmacy_staff','duty-schedule':'duty_schedule','depots':'pharmacy_depots','medula/provision':'medula_provisions','patient-interactions':'patient_accounts'}[detail[1]],detail[2]);
  }
  const body=req.body||{};
  if(req.path==='/locations/generate-grid'){
   const counts=[body.rack_count??5,body.tier_count??3,body.bin_count??3].map(Number);
   if(counts.some(n=>!Number.isSafeInteger(n)||n<1||n>100)||counts.reduce((a,b)=>a*b,1)>1000)throw Object.assign(new Error('Bir istekte en fazla 1000 raf gözü oluşturulabilir.'),{status:400});
  }
  for(const field of ['quantity','counted_qty','counted_quantity','requested_qty','picked_qty'])if(body[field]!==undefined&&(!['string','number'].includes(typeof body[field])||!Number.isFinite(Number(body[field]))||Number(body[field])<0&&field!=='quantity'))throw Object.assign(new Error('Geçersiz miktar.'),{status:400});
  for(const [key,row] of checked)if(row.warehouse_id&&body.warehouse_id&&Number(row.warehouse_id)!==Number(req.path==='/locations/relocate'&&key==='warehouse_locations:'+body.target_location_id?(body.target_warehouse_id||body.warehouse_id):body.warehouse_id))throw Object.assign(new Error('Kayıt seçilen depoya ait değil.'),{status:400});
  if(body.item_id&&body.receipt_id&&Number(checked.get('wms_inbound_items:'+body.item_id)?.receipt_id)!==Number(body.receipt_id))throw Object.assign(new Error('Kalem seçilen belgeye ait değil.'),{status:400});
  next();
 }catch(error){next(error);}
};
