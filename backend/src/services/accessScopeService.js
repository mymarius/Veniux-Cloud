const db = require('../config/database');
const fail = (message,status=403) => {throw Object.assign(Error(message),{status});};
async function read(userId,tenant,tx=db) {
 const row=(await tx.query('SELECT mode,updated_at,updated_by FROM user_access_scopes WHERE user_id=$1 AND tenant_id=$2',[userId,tenant])).rows[0];
 const ids=(await tx.query('SELECT warehouse_id FROM user_warehouse_access WHERE user_id=$1 AND tenant_id=$2 ORDER BY warehouse_id',[userId,tenant])).rows.map(r=>r.warehouse_id);
 return {mode:row?.mode||'restricted',warehouse_ids:ids,updated_at:row?.updated_at||null,updated_by:row?.updated_by||null};
}
async function change(actor,id,body) {
 if(actor.role!=='admin')fail('Erişim ataması yalnız firma yöneticisine açıktır.');
 if(Number(id)===Number(actor.userId))fail('Kendi erişim kapsamınızı değiştiremezsiniz.');
 if(actor.homeTenantId!==undefined&&actor.homeTenantId!==actor.tenantId)fail('Yalnız kendi firmanızın erişimlerini yönetebilirsiniz.');
 if(!['company','restricted'].includes(body.mode)||!Array.isArray(body.warehouse_ids)||body.warehouse_ids.length>1000||body.warehouse_ids.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(body.warehouse_ids).size!==body.warehouse_ids.length||body.mode==='company'&&body.warehouse_ids.length)fail('Geçerli erişim modu ve depo listesi gerekli.',400);
 return db.transaction(async tx=>{
  const own=await read(actor.userId,actor.tenantId,tx);
  if(own.mode!=='company')fail('Erişim atamak için firma genelinde yönetici erişimi gerekir.');
  if(!(await tx.query('SELECT id FROM users WHERE id=$1 AND tenant_id=$2',[id,actor.tenantId])).rows.length)fail('Kullanıcı bulunamadı.',404);
  for(const warehouse of body.warehouse_ids)if(!(await tx.query('SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2',[warehouse,actor.tenantId])).rows.length)fail('Depo firmanıza ait değil.',404);
  const previous=await read(id,actor.tenantId,tx);
  await tx.query('DELETE FROM user_warehouse_access WHERE user_id=$1 AND tenant_id=$2',[id,actor.tenantId]);
  await tx.query('UPDATE user_access_scopes SET mode=$1,updated_at=CURRENT_TIMESTAMP,updated_by=$2 WHERE user_id=$3 AND tenant_id=$4',[body.mode,actor.userId,id,actor.tenantId]);
  for(const warehouse of body.warehouse_ids)await tx.query('INSERT INTO user_warehouse_access(user_id,warehouse_id,tenant_id) VALUES($1,$2,$3)',[id,warehouse,actor.tenantId]);
  const result=await read(id,actor.tenantId,tx);
  await tx.query('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',[actor.tenantId,actor.email,'access.scope_changed','user',id,JSON.stringify({user_id:actor.userId,target_user_id:Number(id),previous,new:result})]);
  return result;
 });
}
function warehouseDeleted(raw,actor,warehouse) {
 const users=raw.prepare('SELECT DISTINCT user_id FROM user_warehouse_access WHERE tenant_id=? AND warehouse_id=?').all(actor.tenantId,Number(warehouse));
 for(const {user_id} of users){
  const previous={mode:raw.prepare('SELECT mode FROM user_access_scopes WHERE user_id=? AND tenant_id=?').get(user_id,actor.tenantId)?.mode||'restricted',warehouse_ids:raw.prepare('SELECT warehouse_id FROM user_warehouse_access WHERE user_id=? AND tenant_id=? ORDER BY warehouse_id').all(user_id,actor.tenantId).map(w=>w.warehouse_id)};
  raw.prepare('DELETE FROM user_warehouse_access WHERE user_id=? AND tenant_id=? AND warehouse_id=?').run(user_id,actor.tenantId,Number(warehouse));
  raw.prepare('UPDATE user_access_scopes SET updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE user_id=? AND tenant_id=?').run(actor.userId,user_id,actor.tenantId);
  raw.prepare('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)').run(actor.tenantId,actor.email,'access.scope_changed','user',user_id,JSON.stringify({user_id:actor.userId,target_user_id:user_id,reason:'Warehouse deleted',previous,new:{mode:previous.mode,warehouse_ids:previous.warehouse_ids.filter(id=>id!==Number(warehouse))}}));
 }
}
module.exports={read,change,warehouseDeleted};
