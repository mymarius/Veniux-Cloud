const request=require('supertest');
const app=require('../src/index');
const previous=process.env.VENIUX_CLOUD_SERVICE;
afterEach(()=>{if(previous===undefined)delete process.env.VENIUX_CLOUD_SERVICE;else process.env.VENIUX_CLOUD_SERVICE=previous;});
test('cloud activation requires a license key and never grants anonymous access',async()=>{
 process.env.VENIUX_CLOUD_SERVICE='1';
 expect((await request(app).get('/api/license/policy')).body.activation_mode).toBe('license_key');
 expect((await request(app).get('/api/auth/me')).status).toBe(401);
 expect((await request(app).get('/api/normal-depo/products')).status).toBe(401);
});
test('local deployment retains its license-key activation policy',async()=>{
 delete process.env.VENIUX_CLOUD_SERVICE;
 expect((await request(app).get('/api/license/policy')).body.activation_mode).toBe('license_key');
});
