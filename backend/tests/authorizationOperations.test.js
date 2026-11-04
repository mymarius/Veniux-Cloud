const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const {createTenant, createUser} = require('./factories');
let owner, other, cashier, operator, product, warehouse, foreignWarehouse;
const call = (actor, method, path, body) => request(app)[method](path).set('Authorization', 'Bearer '+actor.token).send(body);
async function actor(role) {
  const user = await createUser(owner.tenantId, role);
  const login = await request(app).post('/api/auth/login').send({email:user.email,password:'password123'});
  expect(login.status).toBe(200);
  return {...user,token:login.body.token};
}
async function balances() {
  const tables = ['stock_records','stock_movements','retail_sales','retail_reversals'];
  const result = {};
  for (const table of tables) result[table] = (await db.query('SELECT * FROM '+table+' ORDER BY rowid')).rows;
  return result;
}
beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  cashier = await actor('cashier'); operator = await actor('operator');
  product = (await db.query('SELECT * FROM products WHERE tenant_id=$1 LIMIT 1',[owner.tenantId])).rows[0];
  warehouse = (await db.query('SELECT * FROM warehouses WHERE tenant_id=$1 LIMIT 1',[owner.tenantId])).rows[0];
  foreignWarehouse = (await db.query('SELECT * FROM warehouses WHERE tenant_id=$1 LIMIT 1',[other.tenantId])).rows[0];
  await db.query("UPDATE products SET purchase_price=7.43,sale_price=12,barcode='0012345678905' WHERE id=$1",[product.id]);
});
test.each(['cashier','operator'])('%s reads products without any cost values or purchasing documents', async role => {
  const user = role==='cashier'?cashier:operator;
  for (const path of ['/api/products','/api/products/'+product.id,'/api/normal-depo/products','/api/stock/records']) {
    const result=await call(user,'get',path); expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toMatch(/purchase_price|inventory_value|stock_valuation|cost_snapshot/);
  }
  expect((await call(user,'post','/api/scanner/lookup',{barcode:'0012345678905',warehouse_id:warehouse.id})).body.product.purchase_price).toBeUndefined();
  expect((await call(user,'get','/api/purchase-orders')).status).toBe(403);
  expect((await call(user,'get','/api/scanner/gross-profit')).status).toBe(403);
  expect((await call(user,'get','/api/backups')).status).toBe(403);
});
test('administrator retains commercial fields and operational access', async () => {
  expect((await call(owner,'get','/api/products/'+product.id)).body.purchase_price).toBe(7.43);
  expect((await call(owner,'get','/api/purchase-orders')).status).toBe(200);
  const res = await call(owner,'post','/api/stock/movement',{product_id:product.id,warehouse_id:warehouse.id,change_amount:1,movement_type:'inbound',reason:'Yetki kontrolü test kabulü'});
  expect(res.status).toBe(201);
  const adjusted=await call(owner,'post','/api/stock/adjust',{product_id:product.id,warehouse_id:warehouse.id,new_quantity:2,reason:'Yetki testi stok düzeltme gerekçesi'});
  expect(adjusted.status).toBe(200);
  const audit=(await db.query("SELECT * FROM audit_logs WHERE tenant_id=$1 AND action='stock.adjustment' ORDER BY id DESC LIMIT 1",[owner.tenantId])).rows[0];
  expect(audit.user_email).toBe(owner.email);
  expect(JSON.parse(audit.details)).toMatchObject({previous:1,quantity:2,reason:'Yetki testi stok düzeltme gerekçesi',user_id:owner.userId});
});
test.each(['cashier','operator'])('%s denied writes leave all balances and sales unchanged', async role => {
  const user=role==='cashier'?cashier:operator, before=await balances();
  for (const path of ['/api/stock/adjust','/api/stock/transfer','/api/normal-depo/inbound-receive','/api/wms/cycle-count/adjust','/api/purchase-orders']) {
    expect((await call(user,'post',path,{product_id:product.id,warehouse_id:warehouse.id,new_quantity:999})).status).toBe(403);
  }
  expect(await balances()).toEqual(before);
});
test('tampered foreign product and depot IDs cannot read or change another firm', async () => {
  const foreignProduct=(await db.query('SELECT id FROM products WHERE tenant_id=$1 LIMIT 1',[other.tenantId])).rows[0];
  const before=await balances();
  expect((await call(owner,'get','/api/products/'+foreignProduct.id)).status).toBe(404);
  expect((await call(owner,'get','/api/wms/inventory/transfer-options?warehouse_id='+foreignWarehouse.id)).status).toBe(404);
  expect((await call(owner,'post','/api/stock/movement',{product_id:product.id,warehouse_id:foreignWarehouse.id,change_amount:99,movement_type:'inbound'})).status).toBe(404);
  expect((await request(app).get('/api/products').set('Authorization','Bearer '+cashier.token).set('x-tenant-id',String(other.tenantId))).status).toBe(403);
  expect(await balances()).toEqual(before);
});
test.each([{role:'viewer'},{status:'inactive'}])('existing token is invalidated by administrator update %j',async change=>{
  const user=await actor('manager');
  expect((await call(user,'get','/api/purchase-orders')).status).toBe(200);
  expect((await call(owner,'put','/api/settings/users/'+user.id,change)).status).toBe(200);
  const before=await balances();
  expect((await call(user,'post','/api/stock/movement',{product_id:product.id,warehouse_id:warehouse.id,change_amount:9,movement_type:'inbound'})).status).toBe(401);
  expect(await balances()).toEqual(before);
});
test('nested and serialized snapshot costs are removed without changing sale prices',()=>{
  const {redact}=require('../src/middlewares/costVisibility');
  const source={snapshot_json:JSON.stringify({items:[{unit_price:12,cost_snapshot:{parts:[{cost_inc_vat_cents:743}]}}]}),lots:[{unit_purchase_price:7.43,quantity:1}]};
  const result=redact(source);
  expect(JSON.parse(result.snapshot_json).items).toEqual([{unit_price:12}]);
  expect(result.lots).toEqual([{quantity:1}]);
  expect(source.lots[0].unit_purchase_price).toBe(7.43);
});
test('cashier cost snapshots stay private and revoked return permission takes effect on the same token',async()=>{
  await require('./factories').openTestShift(owner,warehouse.id,100);
  const grants={discount:false,price_override:false,return:true,cancel:false,day_close:false};
  expect((await call(owner,'put','/api/scanner/cashiers/'+cashier.id+'/permissions',grants)).status).toBe(200);
  const sale=await request(app).post('/api/scanner/sale').set('Authorization','Bearer '+cashier.token).set('Idempotency-Key','auth-sale').send({warehouse_id:warehouse.id,payment_method:'cash',items:[{barcode:'0012345678905',count:1}]});
  expect(sale.status).toBe(201);
  const detail=await call(cashier,'get','/api/scanner/sales/'+sale.body.sale_id);
  expect(detail.status).toBe(200);
  expect(JSON.stringify(detail.body)).not.toMatch(/cost_snapshot|cost_inc_vat|purchase_price/);
  expect(JSON.stringify((await call(owner,'get','/api/scanner/sales/'+sale.body.sale_id)).body)).toContain('cost_snapshot');
  expect((await call(owner,'put','/api/scanner/cashiers/'+cashier.id+'/permissions',{...grants,return:false})).status).toBe(200);
  const before=await balances();
  const denied=await request(app).post('/api/scanner/sales/'+sale.body.sale_id+'/return').set('Authorization','Bearer '+cashier.token).set('Idempotency-Key','auth-return').send({reason:'Yetki kaldırıldı',items:[{id:1,quantity:1}]});
  expect(denied.status).toBe(403); expect(await balances()).toEqual(before);
  const returned=await request(app).post('/api/scanner/sales/'+sale.body.sale_id+'/return').set('Authorization','Bearer '+owner.token).set('Idempotency-Key','admin-return').send({reason:'Yetkili yönetici iadesi',items:[{id:1,quantity:1}]});
  expect(returned.status).toBe(200);
  const audit=(await db.query("SELECT * FROM audit_logs WHERE tenant_id=$1 AND action='retail.return' ORDER BY id DESC LIMIT 1",[owner.tenantId])).rows[0];
  expect(JSON.stringify(audit)).toContain(owner.email);
  expect(JSON.stringify(audit)).toContain('Yetkili yönetici iadesi');
});
