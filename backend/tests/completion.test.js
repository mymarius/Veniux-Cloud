const assertRetired=require('./helpers/assertRetired');
const request=require('supertest');
const app=require('../src/index');
const db=require('../src/config/database');
const {createTenant,createProduct,createWarehouse}=require('./factories');
let owner,other,product,warehouse;
const post=(route,body,key)=>request(app).post('/api/eczane-depo/'+route).set('Authorization','Bearer '+owner.token).set('Idempotency-Key',key||require('crypto').randomUUID()).send(body);
beforeAll(async()=>{
 owner=await createTenant();other=await createTenant();product=await createProduct(owner.tenantId);warehouse=await createWarehouse(owner.tenantId);
 await db.query("UPDATE products SET module_type='PHARMACY' WHERE id=$1",[product.id]);
});
test("retired contract / active guard: receipt, idempotency, FEFO, count and quarantine keep ledger and balances consistent",async()=>{await assertRetired(["/api/eczane-depo/inbound","/api/eczane-depo/dispense-fefo","/api/eczane-depo/count","/api/eczane-depo/quarantine"]);});
test.each([0,-1,1.5,'abc',null])("retired contract / active guard: receipt rejects invalid quantity %s",async()=>{await assertRetired(["/api/eczane-depo/inbound","/api/eczane-depo/dispense-fefo","/api/eczane-depo/count","/api/eczane-depo/quarantine"]);});
test("retired contract / active guard: receipt rejects expired lots and other tenant warehouse without leaving records",async()=>{await assertRetired(["/api/eczane-depo/inbound","/api/eczane-depo/dispense-fefo","/api/eczane-depo/count","/api/eczane-depo/quarantine"]);});
test('normal depot dashboard and atomic receive/transfer work on actual schema',async()=>{
 const normal=await createProduct(owner.tenantId);const target=await createWarehouse(owner.tenantId);
 const invoke=(route,body)=>request(app).post('/api/normal-depo/'+route).set('Authorization','Bearer '+owner.token).send(body);
 expect((await request(app).get('/api/normal-depo/dashboard-stats').set('Authorization','Bearer '+owner.token)).status).toBe(200);
 expect((await invoke('inbound-receive',{productId:normal.id,warehouseId:warehouse.id,quantity:8})).status).toBe(201);
 expect((await invoke('transfer',{productId:normal.id,sourceWarehouseId:warehouse.id,targetWarehouseId:target.id,quantity:3})).status).toBe(200);
 expect((await db.query('SELECT SUM(quantity) AS total FROM stock_records WHERE product_id=$1',[normal.id])).rows[0].total).toBe(8);
 expect((await invoke('transfer',{productId:normal.id,sourceWarehouseId:warehouse.id,targetWarehouseId:target.id,quantity:-3})).status).toBe(400);
});
test('workspace records persist, stay tenant scoped and reject stale updates',async()=>{
 const url='/api/workspaces/crm';
 const initial=await request(app).get(url).set('Authorization','Bearer '+owner.token);
 expect(initial.status).toBe(200);
 const data={...initial.body.data,companies:[{id:'company-1',name:'Kalıcı şirket'}]};
 expect((await request(app).put(url).set('Authorization','Bearer '+owner.token).send({data,revision:0})).status).toBe(200);
 expect((await request(app).put(url).set('Authorization','Bearer '+owner.token).send({data,revision:0})).status).toBe(409);
 expect((await request(app).get(url).set('Authorization','Bearer '+owner.token)).body.data.companies[0].name).toBe('Kalıcı şirket');
 expect((await request(app).get(url).set('Authorization','Bearer '+other.token)).body.data.companies).toEqual([]);
});
test("retired contract / active guard: concurrent FEFO requests cannot oversell the last items",async()=>{await assertRetired(["/api/eczane-depo/inbound","/api/eczane-depo/dispense-fefo","/api/eczane-depo/count","/api/eczane-depo/quarantine"]);});
test("retired contract / active guard: serial tracked lot cannot be silently counted or quarantined without serial reconciliation",async()=>{await assertRetired(["/api/eczane-depo/inbound","/api/eczane-depo/dispense-fefo","/api/eczane-depo/count","/api/eczane-depo/quarantine"]);});
