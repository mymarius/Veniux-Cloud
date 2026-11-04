const jwt=require('jsonwebtoken'),express=require('express'),request=require('supertest');
jest.mock('../src/config/database',()=>({query:jest.fn()}));
jest.mock('../src/services/centralLicense',()=>({enabled:()=>true,verify:jest.fn(),request:jest.fn()}));
jest.mock('../src/services/mobileGateway',()=>({takeTicket:jest.fn()}));
jest.mock('../src/middlewares/accessScope',()=>((req,res,next)=>next()));
const db=require('../src/config/database'),central=require('../src/services/centralLicense'),gateway=require('../src/services/mobileGateway');
const secret='isolated-pairing-test-secret-32-characters';const fp='HW-'+ 'B'.repeat(32);
process.env.JWT_SECRET=secret;
const app=express();app.use(express.json());app.use('/api/mobile',require('../src/routes/mobileRoutes'));
beforeEach(()=>{
 process.env.JWT_SECRET=secret;db.query.mockReset();gateway.takeTicket.mockReset();central.verify.mockReset();central.request.mockReset();
 db.query.mockImplementation(async sql=>({rows:sql.includes('FROM users')?[{tenant_id:7,role:'admin',email:'owner@example.invalid',status:'active',session_version:4,is_active:1}]:[{user_id:1}]}));
 gateway.takeTicket.mockReturnValue({authorization:'Bearer '+jwt.sign({userId:1,tenantId:7,sessionVersion:4},secret,{expiresIn:300}),device_token:'a'.repeat(64),device_fingerprint:'HW-'+ 'A'.repeat(32)});
 central.verify.mockResolvedValue({valid:true,plan_id:require('../src/services/licenseService').getPlans()[0].id,expires_at:'2030-01-01T00:00:00Z'});central.request.mockResolvedValue({device_token:'c'.repeat(64)});
});
test('QR claim transfers the verified principal and clamps session lifetime',async()=>{const r=await request(app).post('/api/mobile/claim').send({ticket:'fixture',device_fingerprint:fp});expect(r.status).toBe(200);const claims=jwt.verify(r.body.token,secret);expect(claims.userId).toBe(1);expect(claims.tenantId).toBe(7);expect(claims.sessionVersion).toBe(4);expect(claims.exp-claims.iat).toBeLessThanOrEqual(300);expect(r.body.user.is_platform_admin).toBe(true);expect(r.body.license.payload.device_token).toBe('c'.repeat(64));});
test('disabled desktop user cannot enrol a mobile terminal',async()=>{db.query.mockResolvedValue({rows:[{tenant_id:7,role:'admin',email:'owner@example.invalid',status:'disabled',session_version:4,is_active:1}]});const r=await request(app).post('/api/mobile/claim').send({device_fingerprint:fp});expect(r.status).toBe(401);expect(central.request).not.toHaveBeenCalled();});
test('revoked desktop session cannot enrol a mobile terminal',async()=>{gateway.takeTicket.mockReturnValue({authorization:'Bearer '+jwt.sign({userId:1,tenantId:7,sessionVersion:3},secret,{expiresIn:300})});const r=await request(app).post('/api/mobile/claim').send({device_fingerprint:fp});expect(r.status).toBe(401);expect(central.request).not.toHaveBeenCalled();});
test('full licence terminal capacity blocks automatic login',async()=>{central.request.mockRejectedValue(Object.assign(Error('Seats full'),{status:403}));const r=await request(app).post('/api/mobile/claim').send({device_fingerprint:fp});expect(r.status).toBe(403);expect(r.body.token).toBeUndefined();});
