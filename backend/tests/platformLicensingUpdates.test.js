const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const storage=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-updates-'));
process.env.UPDATE_STORAGE_DIR=storage;
const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database');
const {createTenant}=require('./factories');
let admin,customer,key,license;
const auth=()=>({Authorization:'Bearer '+admin.token});
beforeAll(async()=>{admin=await createTenant();customer=await createTenant();await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[admin.userId]);});
afterAll(()=>fs.rmSync(storage,{recursive:true,force:true}));
test('only platform administrators issue licenses; issued key is shown in tenant details',async()=>{
 const url=`/api/platform/tenants/${customer.tenantId}/license`;
 expect((await request(app).post(url).set('Authorization','Bearer '+customer.token).send({plan_id:'NORMAL_WMS_ANNUAL',days:365})).status).toBe(403);
 const response=await request(app).post(url).set(auth()).send({plan_id:'NORMAL_WMS_ANNUAL',days:365});
 expect(response.status).toBe(201);key=response.body.license_key;expect(key).toMatch(/^VNX-/);
 const details=await request(app).get(`/api/platform/tenants/${customer.tenantId}`).set(auth());
 license=details.body.licenses.find(l=>l.license_key===key);expect(license).toBeDefined();
 expect((await request(app).post('/api/license/activate').send({license_key:key,device_fingerprint:'platform-test-device'})).status).toBe(200);
});
test('module edits reach signed validation and suspension invalidates the device',async()=>{
 const url=`/api/platform/tenants/${customer.tenantId}/licenses/${license.id}`;
 expect((await request(app).patch(url).set(auth()).send({module_type:'PHARMACY'})).status).toBe(400);
 expect((await request(app).patch(url).set(auth()).send({module_type:'NORMAL'})).status).toBe(200);
 let validation=await request(app).post('/api/license/validate').send({license_key:key,device_fingerprint:'platform-test-device'});
 expect(validation.body.token.payload.enabled_features.module_type).toBe('NORMAL');
 expect(validation.body.token.payload.enabled_features.inbound).toBe(true);
 expect(validation.body.token.payload.enabled_features.cold_chain).not.toBe(true);
 expect((await request(app).patch(url).set(auth()).send({status:'SUSPENDED'})).status).toBe(200);
 validation=await request(app).post('/api/license/validate').send({license_key:key,device_fingerprint:'platform-test-device'});
 expect(validation.body.valid).toBe(false);expect(validation.body.status).toBe('SUSPENDED');
 expect((await request(app).patch(`/api/platform/tenants/${admin.tenantId}/licenses/${license.id}`).set(auth()).send({status:'ACTIVE'})).status).toBe(404);
});
test('update publication requires platform admin and delegates to authenticated central publisher',async()=>{
 // Previous test suspended this license. Restore it explicitly so this test
 // reaches the role guard, rather than stopping at the mandatory license gate.
 expect((await request(app).patch(`/api/platform/tenants/${customer.tenantId}/licenses/${license.id}`).set(auth()).send({status:'ACTIVE'})).status).toBe(200);
 const publisher=require('../src/services/updatePublisher');
 const session=jest.spyOn(publisher,'session').mockResolvedValue({success:true});
 const upload=jest.spyOn(publisher,'upload').mockResolvedValue({success:true});
 const list=jest.spyOn(publisher,'list').mockResolvedValue({files:[{name:'android.json',bytes:200}]});
 try{
  expect((await request(app).post('/api/platform/updates/session').set('Authorization','Bearer '+customer.token).send({password:'test-only'})).status).toBe(403);
  expect(session).not.toHaveBeenCalled();
  expect((await request(app).post('/api/platform/updates/session').set(auth()).send({password:'test-only'})).status).toBe(200);
  expect(session).toHaveBeenCalledWith(admin.userId,'test-only');
  const binary=Buffer.from('test-installer');
  expect((await request(app).put('/api/platform/updates/Veniux-test.apk').set(auth()).set('Content-Type','application/octet-stream').send(binary)).status).toBe(200);
  expect(upload).toHaveBeenCalledWith(admin.userId,'Veniux-test.apk',binary);
  const response=await request(app).get('/api/platform/updates').set(auth());expect(response.status).toBe(200);expect(response.body.files[0].name).toBe('android.json');
 }finally{session.mockRestore();upload.mockRestore();list.mockRestore();}
});
