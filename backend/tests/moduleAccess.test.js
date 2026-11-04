const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant } = require('./factories');
let owner;
beforeAll(async () => { owner = await createTenant(); });
const get = path => request(app).get(path).set('Authorization', `Bearer ${owner.token}`);
async function license(type, status='ACTIVE', expiry='2099-01-01 00:00:00') {
  await db.query('UPDATE licenses SET enabled_features_json=$1,status=$2,expires_at=$3 WHERE tenant_id=$4', [JSON.stringify({module_type:type}),status,expiry,owner.tenantId]);
}
test('normal administrator cannot use either pharmacy API or write route', async () => {
  await license('NORMAL');
  expect((await get('/api/normal-depo/products')).status).toBe(200);
  for (const path of ['/api/pharmacy/medicines','/api/eczane-depo/medicines']) expect((await get(path)).status).toBe(410);
  expect((await request(app).post('/api/eczane-depo/inbound').set('Authorization',`Bearer ${owner.token}`).send({})).status).toBe(410);
  expect((await get('/api/auth/me')).body.module_type).toBe('NORMAL');
});
test('pharmacy and both entitlements are checked on every request with the same token', async () => {
  await license('PHARMACY');
  expect((await get('/api/normal-depo/products')).status).toBe(423);
  expect((await get('/api/eczane-depo/medicines')).status).toBe(410);
  await license('BOTH');
  expect((await get('/api/normal-depo/products')).status).toBe(200);
  expect((await get('/api/eczane-depo/medicines')).status).toBe(410);
});
test('expired, revoked, malformed and missing licenses fail closed', async () => {
  for (const [type,status,expiry] of [['NORMAL','ACTIVE','2000-01-01 00:00:00'],['BOTH','REVOKED','2099-01-01 00:00:00'],['INVALID','ACTIVE','2099-01-01 00:00:00']]) {
    await license(type,status,expiry);
    expect((await get('/api/normal-depo/products')).status).toBe(423);
  }
  await db.query("UPDATE licenses SET enabled_features_json='bad-json' WHERE tenant_id=$1",[owner.tenantId]);
  expect((await get('/api/normal-depo/products')).status).toBe(423);
  await db.query('DELETE FROM licenses WHERE tenant_id=$1',[owner.tenantId]);
  expect((await get('/api/eczane-depo/medicines')).status).toBe(410);
});

test('retired APIs reject all roles and HTTP mutations; assistant exposes no sector tools',async()=>{
 await license('BOTH');
 for(const route of ['/api/pharmacy/medicines','/api/eczane-depo/inbound','/api/pharmacy-migration/providers','/api/medicines','/api/admin/medicines/import']){
  for(const method of ['get','post','put','delete']){const response=await request(app)[method](route).set('Authorization',`Bearer ${owner.token}`).send({});expect(response.status).toBe(410);expect(response.body.code).toBe('MODULE_REMOVED');}
 }
 const list=require('../src/services/assistantSystemOperations').list({moduleType:'BOTH',isPlatformAdmin:true});
 expect(list.some(item=>/pharmacy|eczane|medicines/.test(item.scope))).toBe(false);
 const plans=require('../src/services/licenseService').getPlans();expect(plans.every(p=>p.features.module_type==='NORMAL')).toBe(true);expect(plans.some(p=>p.id==='PHARMACY_WMS_ANNUAL')).toBe(false);
});
