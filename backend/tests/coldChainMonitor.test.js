const db=require('../src/config/database');
const {createTenant}=require('./factories');
const service=require('../src/services/coldChainService');
test('scheduled monitoring flags missing readings once per tenant without inventing readings',async()=>{
 const a=await createTenant(),b=await createTenant();
 await db.query('UPDATE cold_chain_devices SET is_active=0');
 for(const t of [a,b]) await db.query("INSERT INTO cold_chain_devices (tenant_id,device_name,min_temp,max_temp,is_active) VALUES ($1,'Dolap',2,8,1)",[t.tenantId]);
 const {runColdChainCheck}=service;
 expect((await runColdChainCheck()).created).toBe(2);
 expect((await runColdChainCheck()).created).toBe(0);
 const alerts=(await db.query("SELECT tenant_id FROM alerts WHERE alert_type='cold_chain_stale'")).rows;
 expect(alerts.map(a=>a.tenant_id).sort()).toEqual([a.tenantId,b.tenantId].sort());
 expect((await db.query('SELECT COUNT(*) AS n FROM cold_chain_logs')).rows[0].n).toBe(0);
});
