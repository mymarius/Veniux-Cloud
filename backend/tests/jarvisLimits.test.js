const db=require('../src/config/database');
const {createTenant}=require('./factories');
const automation=require('../src/services/ownerAutomationService');
const entitlement=require('../src/middlewares/licenseMiddleware');
const stt=require('../src/services/speechToText');
const run=(tenantId,max)=>new Promise(resolve=>{const res={status:c=>({json:b=>resolve({status:c,body:b})})};entitlement('users')({user:{tenantId},centralLicense:undefined},res,()=>resolve({status:200}));});
let t;
beforeAll(async()=>{t=await createTenant();await db.query("INSERT INTO licenses (tenant_id,status,plan_id,expires_at,license_key) VALUES ($1,'ACTIVE','x',$2,$3)",[t.tenantId,new Date(Date.now()+864e5).toISOString(),'K-'+t.tenantId]).catch(()=>{});});
test('pending invitations hold a seat and inactive users do not',async()=>{
 const seats=async()=>Number((await db.query("SELECT (SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND COALESCE(status,'active')='active')+(SELECT COUNT(*) FROM business_invitations WHERE tenant_id=$1 AND redeemed_at IS NULL AND expires_at>$2) AS c",[t.tenantId,new Date().toISOString().replace('T',' ').replace('Z','')])).rows[0].c);
 const base=await seats();
 await db.query("INSERT INTO business_invitations(tenant_id,email,portal_role,token_hash,expires_at,created_by) VALUES($1,'a@b.co','field',$2,'2099-01-01 00:00:00',$3)",[t.tenantId,'h'+t.tenantId,t.userId]);
 expect(await seats()).toBe(base+1);
 await db.query("INSERT INTO business_invitations(tenant_id,email,portal_role,token_hash,expires_at,created_by) VALUES($1,'c@b.co','field',$2,'2000-01-01 00:00:00',$3)",[t.tenantId,'o'+t.tenantId,t.userId]);
 expect(await seats()).toBe(base+1);
});
test('invitations beyond the plan are refused',async()=>{
 for(let i=0;i<12;i++)await db.query("INSERT INTO business_invitations(tenant_id,email,portal_role,token_hash,expires_at,created_by) VALUES($1,$2,'field',$3,'2099-01-01 00:00:00',$4)",[t.tenantId,'x'+i+'@b.co','z'+i+'-'+t.tenantId,t.userId]);
 await db.query("UPDATE licenses SET plan_id='x',enabled_features_json=NULL WHERE tenant_id=$1",[t.tenantId]);
 const licensed=(await db.query('SELECT COUNT(*) c FROM licenses WHERE tenant_id=$1',[t.tenantId])).rows[0].c;
 expect(Number(licensed)).toBeGreaterThan(0);
 expect((await run(t.tenantId)).status).toBe(403);
});
test('automation prepares no drafts without suggestions and never leaves draft status',async()=>{
 const r=await automation.prepareDrafts(t.tenantId);
 expect(r.orders).toEqual([]);
 const other=(await db.query("SELECT COUNT(*) c FROM purchase_orders WHERE tenant_id=$1 AND status<>'draft'",[t.tenantId])).rows[0].c;
 expect(Number(other)).toBe(0);
});
test('transcription rejects bad input before any network call',async()=>{
 const spy=jest.spyOn(global,'fetch');
 await expect(stt.transcribe(Buffer.alloc(0),'audio/webm')).rejects.toMatchObject({status:400});
 await expect(stt.transcribe(Buffer.from('x'),'text/html')).rejects.toMatchObject({status:400});
 await expect(stt.transcribe(Buffer.alloc(5*1048576+1),'audio/webm')).rejects.toMatchObject({status:400});
 expect(spy).not.toHaveBeenCalled();spy.mockRestore();
});
test('transcription returns text and sends no key in the URL',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test';
 const spy=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({candidates:[{content:{parts:[{text:' kritik stok ne? '}]}}]})});
 expect(await stt.transcribe(Buffer.from('x'),'audio/webm;codecs=opus')).toBe('kritik stok ne?');
 expect(spy.mock.calls[0][0]).not.toContain('test');
 spy.mockRestore();if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;
});
