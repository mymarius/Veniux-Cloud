const request=require('supertest'),crypto=require('crypto'),app=require('../src/index'),db=require('../src/config/database'),f=require('./factories');
let owner,other,viewer,manager;
const get=actor=>request(app).get('/api/settings/onboarding').set('Authorization','Bearer '+actor.token);
const put=(actor,body)=>request(app).put('/api/settings/onboarding').set('Authorization','Bearer '+actor.token).send(body);
const editable=data=>Object.fromEntries(['revision','profile','modules','currentStep','steps','completed'].map(k=>[k,data[k]]));
async function actor(role){const u=await f.createUser(owner.tenantId,role);const login=await request(app).post('/api/auth/login').send({email:u.email,password:'password123'});expect(login.status).toBe(200);return {...u,token:login.body.token};}
beforeAll(async()=>{owner=await f.createTenant();other=await f.createTenant();viewer=await actor('viewer');manager=await actor('manager');});
test('authentication required; manager/viewer cannot change setup',async()=>{
 expect((await request(app).get('/api/settings/onboarding')).status).toBe(401);
 const body=editable((await get(owner)).body);
 for(const a of [viewer,manager])expect((await put(a,body)).status).toBe(403);
 expect((await get(viewer)).body.suggestFirstRun).toBe(false);
});
test('initial GET is read-only and never restarts existing stocked businesses',async()=>{
 const first=await get(owner);expect(first.status).toBe(200);expect(first.body).toMatchObject({revision:0,suggestFirstRun:false,completed:false});
 expect((await db.query("SELECT * FROM workspace_collections WHERE tenant_id=$1 AND name='customer_setup'",[owner.tenantId])).rows).toHaveLength(0);
});
test('empty new business gets a first-run suggestion once and may defer without being trapped',async()=>{
 const email='setup-'+crypto.randomUUID()+'@example.invalid',password='PreviewOnly2026!';
 const registration=await request(app).post('/api/auth/register').send({email,password,phone:'05551234567'});expect(registration.status).toBe(201);
 const tenant=registration.body.user.tenant_id;
 await db.query("INSERT INTO licenses(license_key,tenant_id,plan_id,status,max_users,max_warehouses,max_devices,expires_at) VALUES($1,$2,'ENTERPRISE_ANNUAL','ACTIVE',10,10,10,datetime('now','+1 year'))",['SETUP-'+crypto.randomUUID(),tenant]);
 const login=await request(app).post('/api/auth/login').send({email,password});expect(login.status).toBe(200);
 const newOwner={token:login.body.token},first=await get(newOwner);expect(first.body.suggestFirstRun).toBe(true);
 expect((await put(newOwner,editable(first.body))).status).toBe(200);
 const deferred=await get(newOwner);expect(deferred.body.suggestFirstRun).toBe(false);expect(deferred.body.completed).toBe(false);
});
test('progress and skipped steps survive a fresh API read and retain the same tenant',async()=>{
 const body=editable((await get(owner)).body);body.currentStep=6;body.steps[0]='reviewed';body.steps[1]='skipped';body.profile='market';body.modules=['stock','pos'];
 const saved=await put(owner,body);expect(saved.status).toBe(200);expect(saved.body.revision).toBe(1);
 const resumed=await get(owner);expect(resumed.body).toMatchObject({currentStep:6,profile:'market',modules:['stock','pos'],revision:1});expect(resumed.body.steps[1]).toBe('skipped');
 expect((await get(other)).body).toMatchObject({revision:0,profile:'retail',currentStep:1});
});
test('stale and concurrent saves fail without overwriting another screen',async()=>{
 const before=editable((await get(owner)).body);
 const results=await Promise.all([put(owner,{...before,currentStep:7}),put(owner,{...before,currentStep:8})]);
 expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect((await get(owner)).body.revision).toBe(before.revision+1);
 expect((await put(owner,before)).status).toBe(409);
});
test('unknown, tenant spoofing, secrets, invalid module and false completion are rejected',async()=>{
 const body=editable((await get(owner)).body);
 for(const addition of [{tenantId:other.tenantId},{password:'do-not-store'},{profile:'unknown'},{profile:'pharmacy'},{modules:['PHARMACY']},{modules:[]},{completed:true},{currentStep:11}])expect((await put(owner,{...body,...addition})).status).toBe(400);
});
test('profile changes preserve users, licenses, stock, products and financial settings',async()=>{
 const warehouse=await f.createWarehouse(owner.tenantId);await f.openTestShift(owner,warehouse.id);
 const code='SETUP-SALE-'+crypto.randomUUID();
 const product=(await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$2,'Kurulum deneme ürünü','adet',12,20,'NORMAL') RETURNING id",[owner.tenantId,code])).rows[0];
 await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,10)',[owner.tenantId,warehouse.id,product.id]);
 const sale=await request(app).post('/api/scanner/sale').set('Authorization','Bearer '+owner.token).set('Idempotency-Key',crypto.randomUUID()).send({warehouse_id:warehouse.id,payment_method:'cash',items:[{barcode:code,count:1}]});
 expect(sale.status).toBe(201);expect(sale.body.total).toBe(12);
 const snapshotBefore=(await db.query('SELECT snapshot_json FROM retail_sales WHERE tenant_id=$1 AND sale_id=$2',[owner.tenantId,sale.body.sale_id])).rows[0].snapshot_json;
 const tables=['products','stock_records','pos_sales','licenses','users'];
 const before={};for(const table of tables)before[table]=(await db.query('SELECT * FROM '+table+' WHERE tenant_id=$1 ORDER BY id',[owner.tenantId])).rows;
 const initial=editable((await get(owner)).body);
 for(const profile of ['medical','warehouse','retail']){
  const b=editable((await get(owner)).body);expect((await put(owner,{...b,profile})).status).toBe(200);
 }
 for(const table of tables)expect((await db.query('SELECT * FROM '+table+' WHERE tenant_id=$1 ORDER BY id',[owner.tenantId])).rows).toEqual(before[table]);
 expect((await db.query('SELECT snapshot_json FROM retail_sales WHERE tenant_id=$1 AND sale_id=$2',[owner.tenantId,sale.body.sale_id])).rows[0].snapshot_json).toBe(snapshotBefore);
 const retired=await request(app).get('/api/pharmacy').set('Authorization','Bearer '+owner.token);expect(retired.status).toBe(410);
 expect((await get(owner)).body.currentStep).toBe(initial.currentStep);
});
test('repeat completion is metadata-only, auditable and idempotent for business data',async()=>{
 const body=editable((await get(owner)).body);body.steps=Array(10).fill('reviewed');body.steps[6]='skipped';body.completed=true;body.currentStep=10;
 expect((await put(owner,body)).status).toBe(200);
 const again=editable((await get(owner)).body);expect((await put(owner,again)).status).toBe(200);
 expect((await get(owner)).body).toMatchObject({completed:true,currentStep:10});
 expect((await db.query("SELECT * FROM audit_logs WHERE tenant_id=$1 AND action='customer_setup.saved'",[owner.tenantId])).rows.length).toBeGreaterThan(0);
});
test('company/account reads never fabricate contact details or a recent login',async()=>{
 await db.query("UPDATE tenants SET company_name='',tenant_code='',email='',phone='',industry='' WHERE id=$1",[other.tenantId]);
 const company=await request(app).get('/api/settings/company').set('Authorization','Bearer '+other.token);
 expect(company.status).toBe(200);expect(company.body).toMatchObject({companyName:'',tenantCode:'',email:'',phone:'',industry:''});
 await db.query('UPDATE users SET phone=NULL,last_login=NULL WHERE id=$1',[other.userId]);
 const account=await request(app).get('/api/settings/account').set('Authorization','Bearer '+other.token);
 expect(account.status).toBe(200);expect(account.body.phone).toBe('');expect(account.body.lastLogin).toBeNull();
});

test('setup shows assigned package and tenant-specific limits without license secrets',async()=>{
 const before=(await get(other)).body;
 await db.query("UPDATE licenses SET plan_id='STARTER_ANNUAL',max_users=2,max_warehouses=1,max_devices=2 WHERE tenant_id=$1",[other.tenantId]);
 const response=await get(other);expect(response.status).toBe(200);
 expect(response.body.plan).toMatchObject({id:'STARTER_ANNUAL',limits:{max_users:2,max_warehouses:1,max_devices:2}});
 expect(response.body.plan.features).not.toContain('cold_chain');
 expect(JSON.stringify(response.body.plan)).not.toMatch(/license_key|signature|token/);
 expect(response.body.modules).toEqual(before.modules);
 const saved=await put(other,editable(response.body));expect(saved.status).toBe(200);expect(saved.body.plan).toEqual(response.body.plan);
 expect((await get(owner)).body.plan.id).toBe('ENTERPRISE_ANNUAL');
});

test('retired saved profile falls back to general warehouse without rewriting existing records',async()=>{
 const saved=(await get(owner)).body;
 const legacy={...editable(saved),profile:'pharmacy'};
 await db.query("UPDATE workspace_collections SET payload=$1 WHERE tenant_id=$2 AND scope='settings' AND name='customer_setup'",[JSON.stringify(legacy),owner.tenantId]);
 const response=await get(owner);expect(response.status).toBe(200);expect(response.body.profile).toBe('warehouse');expect(response.body.modules).toEqual(saved.modules);
 const stored=(await db.query("SELECT payload FROM workspace_collections WHERE tenant_id=$1 AND name='customer_setup'",[owner.tenantId])).rows[0];expect(JSON.parse(stored.payload).profile).toBe('pharmacy');
 expect((await put(owner,legacy)).status).toBe(400);
});
