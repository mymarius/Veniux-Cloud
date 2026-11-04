const db=require('../config/database');
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
async function role(user){
 const settings=(await db.query('SELECT enabled FROM business_portal_settings WHERE tenant_id=$1',[user.tenantId])).rows[0];
 if(!settings?.enabled)fail('Bu işletmede saha/bayi erişimi açılmamış.');
 if(await require('./moduleAccess').getModuleType(user.tenantId,user.centralLicense)==='NONE')fail('İşletmenin aktif lisansı bulunmuyor.');
 if(user.isPlatformAdmin||['admin','manager'].includes(user.role))return {role:'admin'};
 const member=(await db.query('SELECT portal_role,partner_id FROM business_members WHERE tenant_id=$1 AND user_id=$2 AND active=1',[user.tenantId,user.id])).rows[0];
 if(!member)fail('Saha/bayi yetkiniz bulunmuyor.');return {role:member.portal_role,partner_id:member.partner_id};
}
async function partner(user,access,id){
 if(!Number.isSafeInteger(Number(id))||Number(id)<1)fail('Geçersiz müşteri.',400);
 const row=(await db.query('SELECT * FROM business_partners WHERE tenant_id=$1 AND id=$2 AND status=$3',[user.tenantId,Number(id),'active'])).rows[0];
 if(!row)fail('Müşteri bulunamadı.',404);
 if(access.role==='dealer'&&Number(access.partner_id)!==row.id)fail('Müşteri bulunamadı.',404);
 if(access.role==='field'&&!(await db.query('SELECT user_id FROM business_assignments WHERE tenant_id=$1 AND user_id=$2 AND partner_id=$3',[user.tenantId,user.id,row.id])).rows.length)fail('Müşteri bulunamadı.',404);
 return row;
}
module.exports={role,partner,fail};
