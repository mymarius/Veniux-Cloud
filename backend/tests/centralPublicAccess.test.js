jest.mock('../src/controllers/licenseController',()=>Object.fromEntries(['getPlans','getPublicKey','purchase','activate','validate','deactivate','heartbeat'].map(name=>[name,(req,res)=>res.sendStatus(204)])));
const express=require('express'),request=require('supertest');
const central=require('../src/services/centralLicense');
const previous=process.env.VENIUX_LICENSE_AUTHORITY_URL;
beforeEach(()=>{process.env.VENIUX_LICENSE_AUTHORITY_URL='https://authority.example.invalid/v1';process.env.VENIUX_WEB_ACCESS='1';});
afterEach(()=>{if(previous===undefined)delete process.env.VENIUX_LICENSE_AUTHORITY_URL;else process.env.VENIUX_LICENSE_AUTHORITY_URL=previous;delete process.env.VENIUX_WEB_ACCESS;jest.restoreAllMocks();});
function app(){const a=express();a.use(express.json());a.use('/api',central.gate);a.use('/api/license',require('../src/routes/licenseRoutes'));a.use((req,res)=>res.json({public:true}));return a;}
test('visitor chat and voice remain public; tenant operations and wrong methods stay gated',async()=>{
 const a=app();
 for(const [method,url] of [['get','/api/ai/visitor'],['post','/api/ai/visitor/chat'],['post','/api/ai/speech']])expect((await request(a)[method](url)).status).toBe(200);
 for(const [method,url] of [['get','/api/ai/chat'],['post','/api/ai/actions/execute'],['get','/api/ai/speech'],['post','/api/ai/visitor'],['post','/api/auth/login']]){const r=await request(a)[method](url);expect(r.status).toBe(423);expect(r.body.code).toBe('LICENSE_REQUIRED');}
});
test('device identity is rejected as a license before contacting the authority',async()=>{
 const call=jest.spyOn(central,'request');const r=await request(app()).post('/api/license/activate').send({license_key:'HW-'+'A'.repeat(32),app_version:'web'});
 expect(r.status).toBe(400);expect(r.body.error).toContain('cihaz kimliğidir');expect(call).not.toHaveBeenCalled();
});
test.each([[403,403],[429,429],[503,503]])('authority %i is classified as %i rather than a generic outage',async(status,expected)=>{
 jest.spyOn(central,'request').mockRejectedValue(Object.assign(new Error('private authority details'),{status}));
 const r=await request(app()).post('/api/license/activate').send({license_key:'VNX-'+'A'.repeat(48),app_version:'web'});
 expect(r.status).toBe(expected);expect(JSON.stringify(r.body)).not.toContain('private authority details');
});
