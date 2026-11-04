const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database');
const {createTenant,createProduct,createUser}=require('./factories');
let owner,other,p1,p2,product,dealer,field;
const call=(who,method,path,body)=>{const r=request(app)[method]('/api/business'+path).set('Authorization','Bearer '+who.token);return body?r.send(body):r;};
beforeAll(async()=>{
 owner=await createTenant();other=await createTenant();
 for(const t of [owner,other])await db.query('INSERT INTO business_portal_settings(tenant_id,enabled) VALUES($1,1)',[t.tenantId]);
 p1=(await call(owner,'post','/partners',{name:'Bayi A'})).body.id;p2=(await call(owner,'post','/partners',{name:'Bayi B'})).body.id;
 product=await createProduct(owner.tenantId);await db.query('UPDATE products SET sale_price=12.345 WHERE id=$1',[product.id]);
 dealer=await createUser(owner.tenantId,'viewer');field=await createUser(owner.tenantId,'viewer');
 for(const u of [dealer,field])u.token=require('jsonwebtoken').sign({userId:u.id,tenantId:owner.tenantId,sessionVersion:0},require('../src/middlewares/authMiddleware').JWT_SECRET,{expiresIn:'1h'});
 await db.query("INSERT INTO business_members(user_id,tenant_id,portal_role,partner_id) VALUES($1,$2,'dealer',$3)",[dealer.userId||dealer.id,owner.tenantId,p1]);
 await db.query("INSERT INTO business_members(user_id,tenant_id,portal_role) VALUES($1,$2,'field')",[field.userId||field.id,owner.tenantId]);
 await db.query('INSERT INTO business_assignments(tenant_id,user_id,partner_id) VALUES($1,$2,$3)',[owner.tenantId,field.userId||field.id,p2]);
});
test('dealer only sees its customer; field only sees assignments',async()=>{
 const d=await call(dealer,'get','/partners');expect(d.status).toBe(200);expect(d.body.map(x=>x.id)).toEqual([p1]);
 const f=await call(field,'get','/partners');expect(f.body.map(x=>x.id)).toEqual([p2]);
});
test('dealer cannot access full warehouse or CRM APIs',async()=>{
 for(const path of ['/api/products','/api/workspaces/crm'])expect((await request(app).get(path).set('Authorization','Bearer '+dealer.token)).status).toBe(403);
});
test('foreign and unassigned customers are rejected',async()=>{
 const foreign=(await call(other,'post','/partners',{name:'Başka firma'})).body.id;
 for(const id of [p2,foreign])expect((await call(dealer,'post','/orders',{partner_id:id,lines:[{product_id:product.id,quantity:1}]}).set('Idempotency-Key','foreign-'+id)).status).toBe(404);
});
test('prices come from server and same submission creates one order',async()=>{
 const body={partner_id:p1,lines:[{product_id:product.id,quantity:2,unit_price:0}]};
 const a=await call(dealer,'post','/orders',body).set('Idempotency-Key','order-replay-1');expect(a.status).toBe(201);
 const b=await call(dealer,'post','/orders',body).set('Idempotency-Key','order-replay-1');expect(b.status).toBe(200);expect(b.body.id).toBe(a.body.id);
 const orders=(await call(dealer,'get','/orders')).body;expect(orders.find(o=>o.id===a.body.id).total_cents).toBe(2470);
 expect((await call(dealer,'post','/orders',{...body,note:'Changed'}).set('Idempotency-Key','order-replay-1')).status).toBe(409);
});
test('order approval is revision checked and cannot be made by dealer',async()=>{
 const r=await call(field,'post','/orders',{partner_id:p2,lines:[{product_id:product.id,quantity:1}]}).set('Idempotency-Key','field-review-1');expect(r.status).toBe(201);
 expect((await call(field,'post','/orders/'+r.body.id+'/review',{status:'approved',revision:0})).status).toBe(403);
 expect((await call(owner,'post','/orders/'+r.body.id+'/review',{status:'approved',revision:0})).status).toBe(200);
 expect((await call(owner,'post','/orders/'+r.body.id+'/review',{status:'rejected',revision:0})).status).toBe(409);
});
test('visits use assigned customers and only own agent history',async()=>{
 expect((await call(field,'post','/visits',{partner_id:p1,note:'Wrong'})).status).toBe(404);
 expect((await call(field,'post','/visits',{partner_id:p2,note:'Görüşme tamamlandı'})).status).toBe(201);
 expect((await call(dealer,'get','/visits')).status).toBe(403);expect((await call(field,'get','/visits')).body.every(v=>v.user_id===(field.userId||field.id))).toBe(true);
});
test('invitation is single use; member cannot invite administrators',async()=>{
 const email='portal-'+Date.now()+'@test.invalid';
 expect((await call(dealer,'post','/invitations',{email,role:'dealer',partner_id:p1})).status).toBe(403);
 expect((await call(owner,'post','/invitations',{email,role:'admin',partner_id:p1})).status).toBe(400);
 const i=await call(owner,'post','/invitations',{email,role:'dealer',partner_id:p1});expect(i.status).toBe(201);
 const body={token:i.body.token,password:'Synthetic-Test-Only-32941!',name:'Test bayi'};
 expect((await request(app).post('/api/business/accept-invitation').send(body)).status).toBe(201);
 expect((await request(app).post('/api/business/accept-invitation').send(body)).status).toBe(400);
});
test('revoke invalidates existing sessions',async()=>{
 expect((await call(owner,'post','/members/'+(dealer.userId||dealer.id)+'/revoke',{})).status).toBe(200);
 expect((await call(dealer,'get','/orders')).status).toBe(401);
});
