// No vendor transport is bundled. A trusted server module must register one.
const db=require('../config/database'),daily=require('./retailDailyService'),crypto=require('crypto');
const fail=require('./scannerService').fail;
const adapters=new Map();
function register(name,adapter){
 if(!/^[a-z0-9-]{1,40}$/.test(name)||!adapter||typeof adapter.execute!=='function'||typeof adapter.status!=='function')throw Error('Invalid adapter');
 adapters.set(name,adapter);
}
const capabilities=()=>({okc:{profiles:[...adapters.keys()],configured:adapters.size>0,requires:'Üretici SDK/protokolü, yetki ve fiziksel cihaz doğrulaması'},scale:{profiles:[],configured:false,requires:'Model ve protokole özel seri/TCP adaptörü'},edocument:{profiles:[],configured:false,requires:'Yetkili entegratör hesabı, UBL-TR doğrulaması ve kabul testi'}});
async function operation(user,body,key){
 if(!['admin','manager'].includes(user.role)||user.accessScope?.mode&&user.accessScope.mode!=='company')fail('Cihaz işlemi için yönetici gerekli.',403);
 const adapter=adapters.get(body.profile);if(!adapter)fail('Bu cihaz için doğrulanmış adaptör yapılandırılmamış. Tahsilat başlatılmadı.',503);
 if(!['sale','cancel','refund'].includes(body.action))fail('Cihaz işlem türü geçersiz.');
 const amount=daily.cents(body.amount);if(amount<=0)fail('Cihaz işlem tutarı sıfırdan büyük olmalı.');
 // Commit a durable pending reservation before touching external hardware.
 const reserved=await db.transaction(async tx=>{await daily.lock(tx,user.tenantId);return daily.idempotent(tx,user.tenantId,key,'okc-reserve',{...body,actor:user.userId},async()=>{
  const source=body.source_operation_id;
  if(body.action!=='sale'){
   const previous=(await tx.query('SELECT * FROM retail_external_operations WHERE tenant_id=$1 AND id=$2',[user.tenantId,source])).rows[0];
   if(!previous||previous.status!=='success'||previous.action!=='sale'||previous.profile!==body.profile)fail('İptal/iade için doğrulanmış kaynak cihaz işlemi gerekli.',409);
   const used=(await tx.query("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM retail_external_operations WHERE tenant_id=$1 AND source_operation_id=$2 AND status<>'failed'",[user.tenantId,source])).rows[0];
   if(amount+Number(used.amount)>Number(previous.amount_cents))fail('İade/iptal tutarı kaynak işlemi aşamaz.',409);
  }
  const id=crypto.randomUUID();await tx.query("INSERT INTO retail_external_operations(id,tenant_id,user_id,profile,action,amount_cents,status,source_operation_id,business_date) VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8)",[id,user.tenantId,user.userId,body.profile,body.action,amount,source||null,daily.businessDate()]);return {id};
 });});
 // Only the first caller atomically claims execution; unknown never resubmits.
 const claim=await db.query("UPDATE retail_external_operations SET status='unknown' WHERE tenant_id=$1 AND id=$2 AND status='pending'",[user.tenantId,reserved.id]);
 if(claim.rowCount===1){let result;try{result=await Promise.race([adapter.execute({id:reserved.id,action:body.action,amount_cents:amount,source_operation_id:body.source_operation_id,items:Array.isArray(body.items)?body.items.slice(0,200):undefined}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('timeout')),5000);t.unref?.();})]);}catch{result={status:'unknown'};}await update(user,reserved.id,result);}
 return inspect(user,reserved.id,false);
}
async function update(user,id,result){const status=['success','failed','unknown'].includes(result?.status)?result.status:'unknown';await db.transaction(async tx=>{await tx.query("UPDATE retail_external_operations SET status=$1 WHERE tenant_id=$2 AND id=$3 AND status='unknown'",[status,user.tenantId,id]);await daily.audit(tx,user,'retail.okc_status',null,{operation_id:id,status});});}
async function statusWithTimeout(adapter,id){let timer;try{return await Promise.race([Promise.resolve().then(()=>adapter.status({id})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('status timeout')),5000);timer.unref?.();})]);}finally{clearTimeout(timer);}}
async function inspect(user,id,poll=true){if(!['admin','manager'].includes(user.role)||user.accessScope?.mode&&user.accessScope.mode!=='company')fail('Cihaz işlemi erişimi yok.',403);const row=(await db.query('SELECT * FROM retail_external_operations WHERE tenant_id=$1 AND id=$2',[user.tenantId,id])).rows[0];if(!row)fail('Cihaz işlemi bulunamadı.',404);if(poll&&row.status==='unknown'&&adapters.has(row.profile)){try{await update(user,id,await statusWithTimeout(adapters.get(row.profile),id));}catch{}return inspect(user,id,false);}return row;}
async function invoiceDraft(user,id){
 if(!['admin','manager'].includes(user.role)||user.accessScope?.mode&&user.accessScope.mode!=='company')fail('Belge taslağı yetkisi yok.',403);
 const sale=await require('./retailReportingService').detail(user,id),s=sale.snapshot;
 if(s.status!=='completed')fail('İade/iptal içeren satış için ayrı belge değerlendirmesi gerekli.',409);
 if(s.items.some(i=>!Number.isInteger(i.vat_rate)||!Number.isSafeInteger(i.net_ex_vat_cents)))fail('Tarihsel KDV verisi eksik; belge taslağı hazırlanamadı.',409);
 let customer=null;if(s.account_id)customer=await require('./retailCreditService').statement(user,s.account_id);
 return {status:'internal_draft',sent_to_gib:false,document_type:'INVOICE',currency:'TRY',sale_id:sale.sale_id,source_receipt:s.receipt_no,customer:customer?{name:customer.name,tax_number:customer.tax_number,address:customer.address}:null,lines:s.items.map(i=>({product_id:i.product_id,name:i.name,quantity:i.quantity,unit:i.unit,net_cents:i.net_ex_vat_cents,vat_rate:i.vat_rate,vat_cents:i.net_cents-i.net_ex_vat_cents,total_cents:i.net_cents})),tax_totals:s.vat_breakdown,total_cents:s.net_cents,notice:'UBL-TR eşlemesi için iç veri modeli; doğrulanmış XML veya resmî e-belge değildir. Entegratöre gönderilmedi.'};
}
async function reconciliation(user,date=daily.businessDate()){
 if(!['admin','manager'].includes(user.role)||user.accessScope?.mode&&user.accessScope.mode!=='company')fail('Mutabakat yetkisi yok.',403);
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)fail('Geçerli gün seçin.');
 const rows=(await db.query('SELECT id,profile,action,amount_cents,status,source_operation_id FROM retail_external_operations WHERE tenant_id=$1 AND business_date=$2 ORDER BY created_at,id',[user.tenantId,date])).rows;
 return {date,source:'local_device_journal',bank_reconciled:false,success_cents:rows.filter(r=>r.status==='success').reduce((sum,r)=>sum+(r.action==='sale'?1:-1)*Number(r.amount_cents),0),unresolved:rows.filter(r=>['unknown','pending'].includes(r.status)),operations:rows,notice:'Yerel cihaz işlem defteridir; üretici/banka gün sonu kaydıyla gerçek karşılaştırma yapılmadı.'};
}
// Cihaz üreticisinin bildirimi (webhook): yalnız sonucu bekleyen ('unknown') işlemi günceller; kimliği bilinmeyen işlem yok sayılır.
async function applyCallback(id,result){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return false;
 const row=(await db.query('SELECT tenant_id,user_id FROM retail_external_operations WHERE id=$1',[id])).rows[0];
 if(!row)return false;
 await update({tenantId:row.tenant_id,userId:row.user_id,email:'cihaz-bildirimi',role:'system'},id,result);return true;
}
module.exports={capabilities,operation,inspect,invoiceDraft,register,reconciliation,applyCallback};
