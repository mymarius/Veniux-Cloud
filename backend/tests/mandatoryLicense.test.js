const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database'),{createTenant}=require('./factories');
const binding=require('../src/services/cloudLicenseBinding');
let owner,other;const priorCloud=process.env.VENIUX_CLOUD_SERVICE,priorAuthority=process.env.VENIUX_LICENSE_AUTHORITY_URL;
beforeAll(async()=>{owner=await createTenant();other=await createTenant();await db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[owner.userId]);});
afterEach(()=>{for(const [k,v]of [['VENIUX_CLOUD_SERVICE',priorCloud],['VENIUX_LICENSE_AUTHORITY_URL',priorAuthority]])if(v===undefined)delete process.env[k];else process.env[k]=v;});
test('revoked license blocks owner login and existing owner sessions',async()=>{
 await db.query("UPDATE licenses SET status='REVOKED' WHERE tenant_id=$1",[owner.tenantId]);
 const login=await request(app).post('/api/auth/login').send({email:owner.email,password:'password123'});
 expect(login.status).toBe(423);expect(login.body.token).toBeUndefined();
 for(const path of ['/api/auth/me','/api/products','/api/settings'])expect((await request(app).get(path).set('Authorization','Bearer '+owner.token)).status).toBe(423);
});
test('license belongs to one tenant; administrator role cannot change the binding',async()=>{
 process.env.VENIUX_CLOUD_SERVICE='1';process.env.VENIUX_LICENSE_AUTHORITY_URL='https://authority.invalid/v1';
 const license={valid:true,license_id:901};await binding.claim(owner.tenantId,license);await binding.requireBinding(owner.tenantId,license);
 await expect(binding.claim(other.tenantId,license)).rejects.toMatchObject({status:423});
 await expect(binding.requireBinding(other.tenantId,license)).rejects.toMatchObject({status:423});
 await expect(binding.requireBinding(owner.tenantId,{valid:false,license_id:901})).rejects.toMatchObject({status:423});
});
test('JWT alone cannot bypass cloud device licensing',async()=>{
 process.env.VENIUX_CLOUD_SERVICE='1';process.env.VENIUX_LICENSE_AUTHORITY_URL='https://authority.invalid/v1';
 const r=await request(app).post('/api/auth/login').set('Authorization','Bearer '+owner.token).send({email:owner.email,password:'password123'});
 expect(r.status).toBe(423);expect(r.body.code).toBe('LICENSE_REQUIRED');expect(r.body.token).toBeUndefined();
});
