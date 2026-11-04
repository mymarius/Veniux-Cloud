const request=require('supertest');
const app=require('../src/index');
const db=require('../src/config/database');
const {createTenant,createUser,createWarehouse}=require('./factories');
let owner,other,warehouse,foreign,viewer;
const headers=(token=owner.token)=>({Authorization:`Bearer ${token}`});
const send=(body,key='retail-1',token=owner.token)=>request(app).post('/api/retail/receive').set(headers(token)).set('Idempotency-Key',key).send(body);
const base=()=>({barcode:'08691234567890',name:'Market Kalemi',purchase_price:10.25,sale_price:15.5,unit:'adet',quantity:4,warehouse_id:warehouse.id});
beforeAll(async()=>{owner=await createTenant();other=await createTenant();warehouse=await createWarehouse(owner.tenantId);foreign=await createWarehouse(other.tenantId);const u=await createUser(owner.tenantId);viewer=(await request(app).post('/api/auth/login').send({email:u.email,password:'password123'})).body.token;});
test('new product, stock and audit commit once; barcode preserves leading zeros',async()=>{
 const result=await send(base());expect(result.status).toBe(201);
 expect((await send(base())).body).toEqual(result.body);
 const lookup=await request(app).get('/api/retail/lookup').query({barcode:base().barcode}).set(headers());
 expect(lookup.body.product.barcode).toBe(base().barcode);
 const id=lookup.body.product.id;
 expect((await db.query('SELECT quantity FROM stock_records WHERE product_id=$1',[id])).rows[0].quantity).toBe(4);
 expect((await db.query("SELECT id FROM audit_logs WHERE tenant_id=$1 AND action='retail.receive'",[owner.tenantId])).rows).toHaveLength(1);
 expect((await send({...base(),quantity:5})).status).toBe(409);
 expect((await send({...base(),product_id:id,quantity:2},'existing')).body.total_quantity).toBe(6);
 expect((await send(base(),'duplicate')).status).toBe(409);
});
test('lookup and mutations remain tenant scoped and writes require a manager',async()=>{
 expect((await request(app).get('/api/retail/lookup').query({barcode:base().barcode}).set(headers(other.token))).body.product).toBeNull();
 expect((await send({...base(),barcode:'foreign',warehouse_id:foreign.id},'foreign')).status).toBe(404);
 expect((await send(base(),'viewer',viewer)).status).toBe(403);
});
test.each([0,-1,1.5,true,'abc'])('invalid quantity %s leaves no new product',async quantity=>{
 expect((await send({...base(),barcode:'INVALID',quantity},`invalid-${quantity}`)).status).toBe(400);
 expect((await db.query("SELECT id FROM products WHERE barcode='INVALID'")).rows).toHaveLength(0);
});
test('failed ledger write rolls back product and stock; same key can then retry',async()=>{
 db.getDb().exec("CREATE TRIGGER reject_retail BEFORE INSERT ON stock_movements WHEN NEW.source='retail_quick_add' BEGIN SELECT RAISE(ABORT,'test failure'); END");
 const data={...base(),barcode:'ROLLBACK'};
 try{expect((await send(data,'rollback')).status).toBe(500);expect((await db.query("SELECT id FROM products WHERE barcode='ROLLBACK'")).rows).toHaveLength(0);}
 finally{db.getDb().exec('DROP TRIGGER reject_retail');}
 expect((await send(data,'rollback')).status).toBe(201);
});
test('barcode-free products and zero purchase price are supported',async()=>{
 expect((await send({...base(),barcode:undefined,name:'Barkodsuz düğme',purchase_price:0},'manual')).status).toBe(201);
 expect((await send({...base(),barcode:'BADPRICE',sale_price:-1},'badprice')).status).toBe(400);
});
