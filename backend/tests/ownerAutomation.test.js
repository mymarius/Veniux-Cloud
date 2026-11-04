jest.mock('../src/services/ownerSmsService',()=>({configured:()=>false,send:jest.fn().mockResolvedValue({status:'not_configured'})}));
jest.mock('../src/services/aiAnalysisService',()=>({runAIAnalysis:jest.fn().mockResolvedValue({created:0,summary:'Analiz.'})}));
const request=require('supertest');
const app=require('../src/index');
const db=require('../src/config/database');
const phone=require('../src/services/ownerPhone');
const automation=require('../src/services/ownerAutomationService');
let tenant;
beforeAll(async()=>{await db.ready;tenant=Number((await db.query("INSERT INTO tenants (tenant_code,company_name,email,owner_phone) VALUES ('auto-owner','Otomasyon','owner@test.local','+905551234567')")).lastInsertRowid);});
test('normalizes Turkish mobiles and rejects missing, malformed or landline numbers',()=>{
 expect(phone.normalizePhone('0555 123 45 67')).toBe('+905551234567');expect(phone.normalizePhone('00905551234567')).toBe('+905551234567');
 for(const value of [undefined,'','02121234567','abc05551234567'])expect(phone.normalizePhone(value)).toBeNull();
});
test('signup requires phone on the server and saves it for the owner',async()=>{
 expect((await request(app).post('/api/auth/register').send({email:'phone@test.local',password:'Test12345'})).status).toBe(400);
 const response=await request(app).post('/api/auth/register').send({email:'phone@test.local',password:'Test12345',phone:'05551234567'});
 expect(response.status).toBe(201);
 expect((await db.query('SELECT owner_phone FROM tenants WHERE id=$1',[response.body.user.tenant_id])).rows[0].owner_phone).toBe('+905551234567');
});
test('disabled automatic mode skips work; a selected run is persisted without claiming SMS delivery',async()=>{
 expect(await automation.run(tenant,{scheduled:true})).toMatchObject({skipped:true});
 const result=await automation.run(tenant);
 expect(result.status).toBe('completed');expect(result.sms_status).toBe('not_configured');
 expect((await db.query('SELECT status,sms_status FROM assistant_runs WHERE id=$1',[result.id])).rows[0]).toMatchObject({status:'completed',sms_status:'not_configured'});
});
test('scheduled checks do not run again before the configured interval',async()=>{
 await require('../src/services/settingsPolicyService').save(tenant,'automation',{...automation.defaults,enabled:true});
 expect(await automation.run(tenant,{scheduled:true})).toMatchObject({skipped:true});
});
