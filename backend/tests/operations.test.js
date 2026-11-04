const request=require('supertest');
const jwt=require('jsonwebtoken');
const fs=require('fs');
const path=require('path');
const Database=require('better-sqlite3');
const app=require('../src/index');
const db=require('../src/config/database');
const {JWT_SECRET}=require('../src/middlewares/authMiddleware');
const {createTenant,createUser,createProduct,createWarehouse}=require('./factories');
const {runAlertRuleEngine}=require('../src/services/alertRuleEngine');
let tenant,viewerToken;
beforeAll(async()=>{tenant=await createTenant();const viewer=await createUser(tenant.tenantId);viewerToken=jwt.sign({userId:viewer.id,tenantId:tenant.tenantId},JWT_SECRET);});
test('viewer cannot write CRM or access personnel',async()=>{
 expect((await request(app).put('/api/workspaces/crm').set('Authorization','Bearer '+viewerToken).send({})).status).toBe(403);
 expect((await request(app).get('/api/workspaces/hr').set('Authorization','Bearer '+viewerToken)).status).toBe(403);
});
test('alert preferences are persisted and used without duplicate alerts',async()=>{
 const p=await createProduct(tenant.tenantId),w=await createWarehouse(tenant.tenantId);
 await db.query('UPDATE products SET min_stock_level=5 WHERE id=$1',[p.id]);
 await db.query('INSERT INTO stock_records(tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,1)',[tenant.tenantId,p.id,w.id]);
 const config={minStockAlert:false,expiryRadarAlert:false,expiryDays:30};
 expect((await request(app).put('/api/settings/notifications').set('Authorization','Bearer '+tenant.token).send(config)).status).toBe(200);
 expect((await runAlertRuleEngine(tenant.tenantId)).created).toBe(0);
 await request(app).put('/api/settings/notifications').set('Authorization','Bearer '+tenant.token).send({...config,minStockAlert:true});
 expect((await runAlertRuleEngine(tenant.tenantId)).created).toBe(1);
 expect((await runAlertRuleEngine(tenant.tenantId)).created).toBe(0);
});
test('live SQLite backup can be opened and passes integrity verification',async()=>{
 const target=path.join(__dirname,'../storage/test-restore.db');
 fs.mkdirSync(path.dirname(target),{recursive:true});
 try {
   await db.getDb().backup(target);
   const restored=new Database(target,{readonly:true});
   try {
     expect(restored.pragma('integrity_check',{simple:true})).toBe('ok');
     expect(restored.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(db.getDb().prepare('SELECT COUNT(*) AS n FROM users').get().n);
   }finally{restored.close();}
 }finally{if(fs.existsSync(target))fs.unlinkSync(target);}
});
test('security policy changes new token expiry and rejects weak new passwords',async()=>{
 expect((await request(app).put('/api/settings/security').set('Authorization','Bearer '+tenant.token).send({sessionTimeout:'15m',strictPassword:true})).status).toBe(200);
 const login=await request(app).post('/api/auth/login').send({email:tenant.email,password:'password123'});
 expect(login.status).toBe(200);const token=jwt.decode(login.body.token);expect(token.exp-token.iat).toBe(900);
 const weak=await request(app).put('/api/settings/password').set('Authorization','Bearer '+tenant.token).send({currentPassword:'password123',newPassword:'weakpassword'});
 expect(weak.status).toBe(400);
});
