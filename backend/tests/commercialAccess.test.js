const request=require('supertest');
const app=require('../src/index');
const db=require('../src/config/database');
const {createTenant,createUser}=require('./factories');
let owner,member,token;
const auth=t=>({Authorization:`Bearer ${t}`});
beforeAll(async()=>{owner=await createTenant();member=await createUser(owner.tenantId);token=(await request(app).post('/api/auth/login').send({email:member.email,phone:'05551234567',password:'password123'})).body.token;});
test('suspension blocks login and existing tokens even after reactivation',async()=>{
 expect((await request(app).put(`/api/settings/users/${member.id}`).set(auth(owner.token)).send({status:'suspended'})).status).toBe(200);
 expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(401);
 expect((await request(app).post('/api/auth/login').send({email:member.email,phone:'05551234567',password:'password123'})).status).toBe(401);
 await request(app).put(`/api/settings/users/${member.id}`).set(auth(owner.token)).send({status:'active'});
 expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(401);
});
test('password replacement revokes previous sessions',async()=>{
 expect((await request(app).put('/api/settings/password').set(auth(owner.token)).send({currentPassword:'password123',newPassword:'Replacement123'})).status).toBe(200);
 expect((await request(app).get('/api/auth/me').set(auth(owner.token))).status).toBe(401);
 const login=await request(app).post('/api/auth/login').send({email:owner.email,password:'Replacement123'});
 expect(login.status).toBe(200);owner.token=login.body.token;
});
test('inactive tenant blocks previously authorized access',async()=>{
 await db.query('UPDATE tenants SET is_active=0 WHERE id=$1',[owner.tenantId]);
 expect((await request(app).get('/api/auth/me').set(auth(owner.token))).status).toBe(401);
 await db.query('UPDATE tenants SET is_active=1 WHERE id=$1',[owner.tenantId]);
});
test('admin cannot disable own access or grant an unsupported role',async()=>{
 expect((await request(app).put(`/api/settings/users/${owner.userId}`).set(auth(owner.token)).send({status:'inactive'})).status).toBe(400);
 expect((await request(app).put(`/api/settings/users/${member.id}`).set(auth(owner.token)).send({role:'superadmin'})).status).toBe(400);
});
test('failed signup rolls back the organization',async()=>{
 const before=(await db.query('SELECT COUNT(*) AS n FROM tenants')).rows[0].n;
 db.getDb().exec("CREATE TRIGGER reject_test_signup BEFORE INSERT ON users WHEN NEW.email='rollback@audit.test' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
 try{
 expect((await request(app).post('/api/auth/register').send({email:'rollback@audit.test',phone:'05551234567',password:'password123'})).status).toBe(500);
 expect((await db.query('SELECT COUNT(*) AS n FROM tenants')).rows[0].n).toBe(before);
 }finally{db.getDb().exec('DROP TRIGGER reject_test_signup');}
});
test('support reference is unique and cannot be forged by the caller',async()=>{
 const a=await request(app).get('/health').set('X-Request-Id','forged'),b=await request(app).get('/health');
 expect(a.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);expect(a.headers['cache-control']).toBe('no-store');
});
test('stock mutations and their audit proof commit together',async()=>{
 const {createProduct,createWarehouse}=require('./factories');
 const p=await createProduct(owner.tenantId),w=await createWarehouse(owner.tenantId);
 const payload={product_id:p.id,warehouse_id:w.id,change_amount:4,movement_type:'inbound',source:'manual'};
 const result=await request(app).post('/api/stock/movement').set(auth(owner.token)).send(payload);
 expect(result.status).toBe(201);
 const log=(await db.query("SELECT * FROM audit_logs WHERE tenant_id=$1 AND action='stock.movement' ORDER BY id DESC",[owner.tenantId])).rows[0];
 expect(log.user_email).toBe(owner.email);expect(JSON.parse(log.details).requestId).toBe(result.headers['x-request-id']);
 expect((await request(app).post('/api/stock/movement').set(auth(owner.token)).send({...payload,change_amount:'2bad'})).status).toBe(400);
 expect((await request(app).post('/api/stock/movement').set(auth(owner.token)).send({...payload,change_amount:1.5})).status).toBe(400);
 db.getDb().exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
 try{
 expect((await request(app).post('/api/stock/movement').set(auth(owner.token)).send(payload)).status).toBe(500);
 expect((await db.query('SELECT quantity FROM stock_records WHERE product_id=$1 AND warehouse_id=$2',[p.id,w.id])).rows[0].quantity).toBe(4);
 }finally{db.getDb().exec('DROP TRIGGER reject_audit');}
});
test('legacy stock import rejects the entire batch without orphan ledger entries',async()=>{
 const {createProduct,createWarehouse}=require('./factories');
 const bad=await createProduct(owner.tenantId),good=await createProduct(owner.tenantId),w=await createWarehouse(owner.tenantId);
 bad.sku=(await db.query('SELECT sku FROM products WHERE id=$1',[bad.id])).rows[0].sku;
 good.sku=(await db.query('SELECT sku FROM products WHERE id=$1',[good.id])).rows[0].sku;
 await db.query('UPDATE warehouses SET name=$1 WHERE id=$2',['IMPORT-AUDIT',w.id]);
 db.getDb().exec(`CREATE TRIGGER reject_import BEFORE INSERT ON stock_records WHEN NEW.product_id=${Number(bad.id)} BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END`);
 try{
 const result=await request(app).post('/api/stock/import').set(auth(owner.token)).send({data:[{sku:bad.sku,warehouse_name:'IMPORT-AUDIT',quantity:3},{sku:good.sku,warehouse_name:'IMPORT-AUDIT',quantity:2}]});
 expect(result.status).toBe(410);expect(result.body.code).toBe('LEGACY_STOCK_IMPORT_DISABLED');
 expect((await db.query('SELECT id FROM stock_movements WHERE product_id=$1',[bad.id])).rows).toHaveLength(0);
 expect((await db.query('SELECT quantity FROM stock_records WHERE product_id=$1',[good.id])).rows).toHaveLength(0);
 expect((await db.query('SELECT id FROM stock_movements WHERE product_id=$1',[good.id])).rows).toHaveLength(0);
 }finally{db.getDb().exec('DROP TRIGGER reject_import');}
});
