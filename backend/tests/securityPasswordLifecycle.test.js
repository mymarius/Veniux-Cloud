const request=require('supertest'),jwt=require('jsonwebtoken');
const app=require('../src/index'),db=require('../src/config/database');
const {JWT_SECRET}=require('../src/middlewares/authMiddleware');
const {createTenant,createUser}=require('./factories');
let owner,employee,token;
beforeAll(async()=>{owner=await createTenant();employee=await createUser(owner.tenantId,'cashier');token=jwt.sign({userId:employee.id,tenantId:owner.tenantId,sessionVersion:0},JWT_SECRET);});
test.each(['short','a'.repeat(73),123])('administrator cannot create weak/truncated password accounts: %s',async password=>{
 const before=(await db.query('SELECT COUNT(*) n FROM users')).rows[0].n;
 expect((await request(app).post('/api/settings/users').set('Authorization','Bearer '+owner.token).send({email:'new@test.invalid',password,role:'cashier'})).status).toBe(400);
 expect((await db.query('SELECT COUNT(*) n FROM users')).rows[0].n).toBe(before);
});
test.each(['123456','a'.repeat(73),{}])('invalid administrator reset never changes hash or session',async newPassword=>{
 const before=(await db.query('SELECT password_hash,session_version FROM users WHERE id=$1',[employee.id])).rows[0];
 expect((await request(app).put('/api/settings/users/'+employee.id).set('Authorization','Bearer '+owner.token).send({newPassword})).status).toBe(400);
 expect((await db.query('SELECT password_hash,session_version FROM users WHERE id=$1',[employee.id])).rows[0]).toEqual(before);
});
test('valid reset revokes an already open cashier session and exposes no hash',async()=>{
 expect((await request(app).get('/api/auth/me').set('Authorization','Bearer '+token)).status).toBe(200);
 const r=await request(app).put('/api/settings/users/'+employee.id).set('Authorization','Bearer '+owner.token).send({newPassword:'FreshIsolated2026!'});
 expect(r.status).toBe(200);expect(JSON.stringify(r.body)).not.toMatch(/FreshIsolated|password_hash/);
 expect((await request(app).get('/api/auth/me').set('Authorization','Bearer '+token)).status).toBe(401);
});
