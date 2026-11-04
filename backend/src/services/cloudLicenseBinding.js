const db=require('../config/database');
const enabled=()=>process.env.VENIUX_CLOUD_SERVICE==='1'&&require('./centralLicense').enabled();
const denied=()=>Object.assign(Error('Bu işletme için geçerli, eşleşen bir lisans gereklidir.'),{status:423,code:'LICENSE_REQUIRED'});
function id(license){if(!license?.valid||!Number.isSafeInteger(Number(license.license_id))||Number(license.license_id)<1)throw denied();return Number(license.license_id);}
async function claim(tenant,license){
 if(!enabled())return;
 const licenseId=id(license);
 try{await db.transaction(async client=>{
  const row=(await client.query('SELECT tenant_id FROM cloud_license_bindings WHERE authority_license_id=$1',[licenseId])).rows[0];
  if(row){if(Number(row.tenant_id)!==Number(tenant))throw denied();return;}
  await client.query('INSERT INTO cloud_license_bindings(authority_license_id,tenant_id) VALUES($1,$2)',[licenseId,tenant]);
 });}catch(e){if(!['SQLITE_CONSTRAINT_PRIMARYKEY','SQLITE_CONSTRAINT_UNIQUE','ER_DUP_ENTRY'].includes(e.code))throw e;await requireBinding(tenant,license);}
}
async function requireBinding(tenant,license){
 if(!enabled())return;
 const row=(await db.query('SELECT tenant_id FROM cloud_license_bindings WHERE authority_license_id=$1',[id(license)])).rows[0];
 if(!row||Number(row.tenant_id)!==Number(tenant))throw denied();
}
module.exports={claim,requireBinding,enabled};
