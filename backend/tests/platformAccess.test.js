const request=require('supertest');
const app=require('../src/index');
const db=require('../src/config/database');
const {createTenant}=require('./factories');
let owner,other;
beforeAll(async()=>{owner=await createTenant();other=await createTenant();});
test('ordinary tenant admin cannot access platform or select another tenant',async()=>{
 expect((await request(app).get('/api/platform/overview')).status).toBe(401);
 expect((await request(app).get('/api/platform/overview').set('Authorization','Bearer '+other.token)).status).toBe(403);
 expect((await request(app).get('/api/products').set('Authorization','Bearer '+other.token).set('x-tenant-id',String(owner.tenantId))).status).toBe(403);
});
test('explicit platform grant permits overview and scoped administration without exposing credentials',async()=>{
 await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[owner.userId]);
 const r=await request(app).get('/api/platform/overview').set('Authorization','Bearer '+owner.token);
 expect(r.status).toBe(200);expect(r.body.tenants.some(t=>t.id===other.tenantId)).toBe(true);
 expect(JSON.stringify(r.body)).not.toMatch(/password_hash|NVIDIA_API_KEY|license_key/);
 expect((await request(app).get('/api/platform/tenants/99999999').set('Authorization','Bearer '+owner.token)).status).toBe(404);
 // A tenant owner must not take over a platform account through password reset.
 await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[other.userId]);
 await db.query('DELETE FROM platform_admins WHERE user_id=$1',[owner.userId]);
 expect((await request(app).put(`/api/settings/users/${other.userId}`).set('Authorization','Bearer '+owner.token).send({newPassword:'ChangedPassword123'})).status).toBe(403);
 expect((await request(app).delete(`/api/settings/users/${other.userId}`).set('Authorization','Bearer '+owner.token)).status).toBe(403);
 await db.query('DELETE FROM platform_admins WHERE user_id=$1',[other.userId]);
 await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[owner.userId]);
 const me=await request(app).get('/api/auth/me').set('Authorization','Bearer '+owner.token).set('x-tenant-id',String(other.tenantId));
 expect(me.status).toBe(200);expect(me.body.is_platform_admin).toBe(true);expect(me.body.tenant_id).toBe(other.tenantId);expect(me.body.module_type).toBe('BOTH');
 const products=await request(app).get('/api/products').set('Authorization','Bearer '+owner.token).set('x-tenant-id',String(other.tenantId));
 expect(products.status).toBe(200);expect(products.body.every(p=>p.tenant_id===other.tenantId)).toBe(true);
 await db.query('DELETE FROM platform_admins WHERE user_id=$1',[owner.userId]);
 expect((await request(app).get('/api/platform/overview').set('Authorization','Bearer '+owner.token)).status).toBe(403);
});

test('diagnostics and probes are restricted to platform administrators',async()=>{expect((await request(app).get('/api/platform/diagnostics')).status).toBe(401);expect((await request(app).get('/api/platform/diagnostics').set('Authorization','Bearer '+other.token)).status).toBe(403);expect((await request(app).post('/api/platform/diagnostics/gemini/test').set('Authorization','Bearer '+other.token)).status).toBe(403);await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[owner.userId]);try{const r=await request(app).get('/api/platform/diagnostics').set('Authorization','Bearer '+owner.token);expect(r.status).toBe(200);expect(r.body.integrations.map(i=>i.id)).toContain('gemini');expect(JSON.stringify(r.body)).not.toMatch(/GEMINI_API_KEY|password_hash|Authorization/);expect((await request(app).post('/api/platform/diagnostics/invalid/test').set('Authorization','Bearer '+owner.token)).status).toBe(400);}finally{await db.query('DELETE FROM platform_admins WHERE user_id=$1',[owner.userId]);}});

test('platform finance, access controls and draft billing are protected and audited',async()=>{for(const path of ['/api/platform/finance'])expect((await request(app).get(path).set('Authorization','Bearer '+other.token)).status).toBe(403);expect((await request(app).post('/api/platform/billing').set('Authorization','Bearer '+other.token).send({tenant_id:owner.tenantId,amount:10,currency:'TRY'})).status).toBe(403);await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[owner.userId]);const auth='Bearer '+owner.token;try{expect((await request(app).get('/api/platform/finance').set('Authorization',auth)).status).toBe(200);const bill=await request(app).post('/api/platform/billing').set('Authorization',auth).send({tenant_id:other.tenantId,amount:99,currency:'TRY'});expect(bill.status).toBe(201);const row=(await db.query('SELECT status,paid_at FROM invoices WHERE invoice_no=$1',[bill.body.invoice_no])).rows[0];expect(row.status).toBe('DRAFT');expect(row.paid_at).toBeNull();expect((await request(app).patch('/api/platform/tenants/'+owner.tenantId+'/access').set('Authorization',auth).send({active:false,reason:'Test restriction'})).status).toBe(403);expect((await request(app).patch('/api/platform/tenants/'+other.tenantId+'/access').set('Authorization',auth).send({active:false,reason:'Test restriction'})).status).toBe(200);expect((await request(app).get('/api/products').set('Authorization','Bearer '+other.token)).status).toBe(401);expect((await request(app).put('/api/platform/integrations/gemini').set('Authorization',auth).send({key:'bad'})).status).toBe(400);}finally{await db.query('UPDATE tenants SET is_active=1 WHERE id=$1',[other.tenantId]);await db.query('DELETE FROM platform_admins WHERE user_id=$1',[owner.userId]);}});
