process.env.JWT_SECRET='isolated-mfa-test-secret-at-least-32-bytes';
const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database'),mfa=require('../src/services/mfaService');
describe('Two-factor authentication',()=>{
 test('RFC TOTP vector, expiry window and authenticated encryption binding',()=>{const secret=mfa.encode(Buffer.from('12345678901234567890'));expect(mfa.totp(secret,1)).toBe('287082');expect(mfa.counter(secret,'287082',-1,59000)).toBe(1);expect(mfa.counter(secret,'287082',1,59000)).toBeNull();const u={id:1,tenant_id:2},box=mfa.seal({secret},u);expect(box).not.toContain(secret);expect(mfa.unseal(box,u).secret).toBe(secret);expect(()=>mfa.unseal(box,{id:2,tenant_id:2})).toThrow();});
 test('real API setup, activation, password gate, replay rejection, recovery and disable',async()=>{
 const email='mfa-isolated@example.invalid',password='Mfa-Isolated-123';let r=await request(app).post('/api/auth/register').send({email,password,phone:'05550000000'});expect(r.status).toBe(201);await require('./helpers/provisionLicense')(r.body.user.tenant_id);r=await request(app).post('/api/auth/login').send({email,password});expect(r.status).toBe(200);const token=r.body.token;
 r=await request(app).post('/api/auth/mfa/setup').set('Authorization','Bearer '+token).send({password:'wrong'});expect(r.status).toBe(403);
 r=await request(app).post('/api/auth/mfa/setup').set('Authorization','Bearer '+token).send({password});expect(r.status).toBe(200);const secret=r.body.secret;const code=mfa.totp(secret,Math.floor(Date.now()/30000));
 r=await request(app).post('/api/auth/mfa/confirm').set('Authorization','Bearer '+token).send({password,code});expect(r.status).toBe(200);const recovery=r.body.recoveryCodes;expect(recovery).toHaveLength(10);
 expect((await request(app).get('/api/auth/me').set('Authorization','Bearer '+token)).status).toBe(401);
 r=await request(app).post('/api/auth/login').send({email,password});expect(r.body.mfa_required).toBe(true);expect(r.body.token).toBeUndefined();
 r=await request(app).post('/api/auth/login').send({email,password,mfa_code:'not-valid'});expect(r.status).toBe(401);
 const concurrent=await Promise.all([0,1].map(()=>request(app).post('/api/auth/login').send({email,password,mfa_code:code})));expect(concurrent.map(x=>x.status).sort()).toEqual([200,401]);
 r=await request(app).post('/api/auth/login').send({email,password,mfa_code:recovery[0]});expect(r.status).toBe(200);const secondToken=r.body.token;
 r=await request(app).post('/api/auth/login').send({email,password,mfa_code:recovery[0]});expect(r.status).toBe(401);
 r=await request(app).get('/api/auth/mfa').set('Authorization','Bearer '+secondToken);expect(r.body).toEqual({enabled:true,recoveryRemaining:9});
 r=await request(app).post('/api/auth/mfa/disable').set('Authorization','Bearer '+secondToken).send({password,code:recovery[1]});expect(r.status).toBe(200);
 expect((await request(app).get('/api/auth/me').set('Authorization','Bearer '+secondToken)).status).toBe(401);
 const stored=(await db.query("SELECT payload FROM workspace_collections WHERE scope='auth_private'")).rows;expect(stored.length).toBe(1);expect(stored[0].payload).not.toContain(secret);expect(stored[0].payload).not.toContain(recovery[0]);
 });
});
