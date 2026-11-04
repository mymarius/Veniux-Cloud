// Explicit fixture only. Never weakens application licensing or touches production.
module.exports=async function provisionLicense(tenantId){
 if(process.env.NODE_ENV!=='test')throw Error('Synthetic licenses are test-only');
 const db=require('../../src/config/database');
 await db.query("INSERT INTO licenses (license_key,tenant_id,plan_id,status,max_users,max_warehouses,max_devices,expires_at) VALUES ($1,$2,'ENTERPRISE_ANNUAL','ACTIVE',10,10,10,'2099-01-01 00:00:00')",['VNX-TEST-'+require('crypto').randomUUID(),tenantId]);
};
