const db=require('../config/database'),daily=require('./retailDailyService'),crypto=require('crypto');
const fail=require('./scannerService').fail;
function manager(user){if(user.accessScope?.mode&&user.accessScope.mode!=='company')fail('Cari işlemler firma genelinde erişim gerektirir.',403);if(!['admin','manager'].includes(user.role))fail('Cari işlemler için yönetici yetkisi gerekli.',403);}
async function balance(tx,user,id){const row=(await tx.query('SELECT COALESCE(SUM(amount_cents),0) AS balance FROM retail_credit_entries WHERE tenant_id=$1 AND account_id=$2',[user.tenantId,id])).rows[0];const value=Number(row.balance);if(!Number.isSafeInteger(value))fail('Cari tutar sınırı aşıldı.',409);return value;}
async function account(tx,user,id){const row=(await tx.query('SELECT * FROM retail_credit_accounts WHERE tenant_id=$1 AND id=$2',[user.tenantId,id])).rows[0];if(!row)fail('Cari hesap bulunamadı.',404);return row;}
async function list(user){manager(user);return (await db.query('SELECT a.*,COALESCE(SUM(e.amount_cents),0) AS balance_cents FROM retail_credit_accounts a LEFT JOIN retail_credit_entries e ON e.account_id=a.id AND e.tenant_id=a.tenant_id WHERE a.tenant_id=$1 GROUP BY a.id ORDER BY a.id DESC LIMIT 200',[user.tenantId])).rows;}
async function create(user,body,key){manager(user);if(typeof body.name!=='string'||!body.name.trim()||body.name.length>160||body.tax_number&&!/^\d{10,11}$/.test(body.tax_number)||typeof(body.address??'')!=='string'||(body.address||'').length>500)fail('Cari adını ve vergi bilgilerini kontrol edin.');const limit=daily.cents(body.limit,'Borç limiti');return db.transaction(async tx=>{await daily.lock(tx,user.tenantId);return daily.idempotent(tx,user.tenantId,key,'credit-account',{...body,actor:user.userId},async()=>{const row=(await tx.query('INSERT INTO retail_credit_accounts(tenant_id,name,tax_number,address,limit_cents) VALUES($1,$2,$3,$4,$5) RETURNING *',[user.tenantId,body.name.trim(),body.tax_number||null,body.address||null,limit])).rows[0];await daily.audit(tx,user,'retail.credit_account',row.id,{account_id:row.id,limit_cents:limit});return row;});});}
async function append(tx,user,{account_id,sale_id=null,shift_id=null,kind,amount_cents,due_date=null,reason}){
 if(!Number.isSafeInteger(amount_cents))fail('Cari tutarı geçersiz.');
 const id=crypto.randomUUID();await tx.query('INSERT INTO retail_credit_entries(id,tenant_id,account_id,sale_id,shift_id,kind,amount_cents,due_date,reason,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,user.tenantId,account_id,sale_id,shift_id,kind,amount_cents,due_date,reason,user.userId]);
 await daily.audit(tx,user,'retail.credit_'+kind,sale_id,{entry_id:id,account_id,amount_cents,shift_id,reason});return id;
}
async function charge(tx,user,body,amount,sale,shift){manager(user);const a=await account(tx,user,body.account_id);if(typeof body.due_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)||!Number.isFinite(Date.parse(body.due_date+'T12:00:00Z'))||new Date(body.due_date+'T12:00:00Z').toISOString().slice(0,10)!==body.due_date||body.due_date<daily.businessDate())fail('Geçerli bir vade tarihi seçin.');if(await balance(tx,user,a.id)+amount>Number(a.limit_cents))fail('Cari borç limiti aşılıyor.',409);await append(tx,user,{account_id:a.id,sale_id:sale,shift_id:shift,kind:'sale',amount_cents:amount,due_date:body.due_date,reason:'Veresiye satış'});return a.id;}
async function statement(user,id){manager(user);return db.transaction(async tx=>{const a=await account(tx,user,id),entries=(await tx.query('SELECT id,sale_id,shift_id,kind,amount_cents,due_date,reason,user_id,created_at FROM retail_credit_entries WHERE tenant_id=$1 AND account_id=$2 ORDER BY sequence',[user.tenantId,id])).rows;const b=await balance(tx,user,id);const overdue=overdueAmount(entries,daily.businessDate());return {...a,balance_cents:b,overdue:overdue>0,overdue_cents:overdue,entries};});}
async function movement(user,id,body,key){manager(user);if(!['collection','adjustment'].includes(body.kind)||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500)fail('İşlem türü ve gerekçe gerekli.');const amount=daily.cents(body.amount);if(!amount)fail('Tutar sıfırdan büyük olmalı.');if(body.kind==='adjustment'&&!['debit','credit'].includes(body.direction))fail('Borç/alacak yönünü seçin.');return db.transaction(async tx=>{await daily.lock(tx,user.tenantId);return daily.idempotent(tx,user.tenantId,key,'credit-movement',{...body,account_id:id,actor:user.userId},async()=>{const a=await account(tx,user,id),b=await balance(tx,user,id);let shift=null;const signed=body.kind==='collection'||body.direction==='credit'?-amount:amount;
 if(body.kind==='collection'){
  if(amount>b)fail('Tahsilat mevcut borcu aşamaz.',409);
  shift=await require('./retailShiftService').requireOpen(tx,user,body.warehouse_id,body);
  await tx.query("INSERT INTO retail_cash_movements(id,tenant_id,shift_id,user_id,user_email,direction,amount_cents,reason) VALUES($1,$2,$3,$4,$5,'in',$6,$7)",[crypto.randomUUID(),user.tenantId,shift.id,user.userId,user.email,amount,'Cari tahsilat: '+body.reason.trim()]);
 }
 if(signed>0&&b+signed>Number(a.limit_cents))fail('Borç limiti aşılıyor.',409);
 const entry=await append(tx,user,{account_id:a.id,kind:body.kind,amount_cents:signed,shift_id:shift?.id||null,reason:body.reason.trim()});return {entry_id:entry,balance_cents:b+signed};
 });});}
function overdueAmount(entries,date){
 const debts=entries.filter(e=>e.amount_cents>0).map(e=>({...e,remaining:Number(e.amount_cents)}));let credit=0;
 for(const e of entries.filter(e=>e.amount_cents<0)){
  if(e.kind==='refund'&&e.sale_id){let left=-e.amount_cents;for(const d of debts.filter(d=>d.sale_id===e.sale_id)){const used=Math.min(left,d.remaining);d.remaining-=used;left-=used;}credit+=left;}
  else credit-=e.amount_cents;
 }
 // Collections settle oldest due debt first. Overdue warnings use unpaid debt,
 // not merely the presence of an old sale in the historical statement.
 debts.sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')));
 for(const d of debts){const used=Math.min(credit,d.remaining);d.remaining-=used;credit-=used;}
 return debts.filter(d=>d.due_date&&d.due_date<date).reduce((sum,d)=>sum+d.remaining,0);
}
module.exports={list,create,statement,movement,charge,append,overdueAmount};
