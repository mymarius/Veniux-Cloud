const request=require('supertest'),crypto=require('crypto'),app=require('../src/index'),db=require('../src/config/database');
const {createTenant,createWarehouse,createUser,openTestShift}=require('./factories');
let owner,foreign,a,b,c,manager,cashier,operator,empty,p,supplier,locationA,locationB,lotA,lotB,saleA,saleB,registerA,registerB;
const key=()=>crypto.randomUUID();
const api=(user,method,path,body)=>request(app)[method]('/api/'+path).set('Authorization','Bearer '+user.token).set('Idempotency-Key',key()).send(body);
async function account(role,ids){const u=await createUser(owner.tenantId,role,{mode:'restricted',warehouse_ids:ids});const r=await request(app).post('/api/auth/login').send({email:u.email,password:'password123'});expect(r.status).toBe(200);return {...u,token:r.body.token};}
const setScope=(u,mode,ids)=>api(owner,'put','settings/users/'+u.id+'/access-scope',{mode,warehouse_ids:ids});
async function state(){let result={};for(const t of ['stock_records','stock_movements','retail_sales','retail_reversals','retail_cash_movements','inventory_transactions','product_bin_records','purchase_orders','purchase_order_items'])result[t]=(await db.query('SELECT * FROM '+t+' ORDER BY rowid')).rows;return result;}
async function location(wh){return(await db.query("INSERT INTO warehouse_locations(tenant_id,warehouse_id,location_code,aisle_code,rack_number,shelf_tier,bin_position) VALUES($1,$2,$3,'A',1,1,1) RETURNING *",[owner.tenantId,wh.id,key()])).rows[0];}
beforeAll(async()=>{
 owner=await createTenant();foreign=await createTenant();a=await createWarehouse(owner.tenantId);b=await createWarehouse(owner.tenantId);c=await createWarehouse(foreign.tenantId);
 manager=await account('manager',[a.id]);cashier=await account('cashier',[a.id]);operator=await account('operator',[a.id]);empty=await account('manager',[]);
 p=(await db.query("INSERT INTO products(tenant_id,sku,name,barcode,sale_price,purchase_price,kdv_orani,module_type) VALUES($1,$2,'Kapsam ürünü','0001112223334',12,7,20,'NORMAL') RETURNING *",[owner.tenantId,key()])).rows[0];
 supplier=(await db.query('SELECT id FROM suppliers WHERE tenant_id=$1 LIMIT 1',[owner.tenantId])).rows[0];locationA=await location(a);locationB=await location(b);
 const inventory=require('../src/services/inventoryTransactionService');
 for(const [wh,loc,number,quantity]of [[a,locationA,'LOT-A',10],[b,locationB,'LOT-B',20]]){const lot=(await db.query("INSERT INTO inventory_lots(tenant_id,product_id,lot_number,expiry_date) VALUES($1,$2,$3,'2099-01-01') RETURNING *",[owner.tenantId,p.id,number])).rows[0];await inventory.recordTransaction({tenant_id:owner.tenantId,warehouse_id:wh.id,location_id:loc.id,product_id:p.id,lot_id:lot.id,transaction_type:'PUTAWAY',quantity});if(wh===a)lotA=lot;else lotB=lot;}
 const shiftA=await openTestShift(owner,a.id,100),shiftB=await openTestShift(owner,b.id,100);registerA=shiftA.register_id;registerB=shiftB.register_id;
 saleA=(await api(owner,'post','scanner/sale',{warehouse_id:a.id,register_id:registerA,items:[{barcode:p.barcode,count:1}],payment_method:'cash'})).body;
 saleB=(await api(owner,'post','scanner/sale',{warehouse_id:b.id,register_id:registerB,items:[{barcode:p.barcode,count:2}],payment_method:'cash'})).body;
 expect(saleA.sale_id).toBeDefined();expect(saleB.sale_id).toBeDefined();
});
test('company founder has an explicit scope; new unassigned employee is closed',async()=>{
 expect((await api(owner,'get','settings/users/'+owner.userId+'/access-scope')).body.mode).toBe('company');
 for(const path of ['warehouses','stock/records','scanner/search?q=Kapsam'])expect((await api(empty,'get',path)).status).toBe(403);
 const r=await api(owner,'post','settings/users',{email:key()+'@example.com',password:'password123',role:'manager'});expect(r.status).toBe(201);
 expect((await api(owner,'get','settings/users/'+r.body.user.id+'/access-scope')).body).toMatchObject({mode:'restricted',warehouse_ids:[]});
});
test('list, detail, search and stock aggregates only include assigned warehouse',async()=>{
 for(const user of [manager,cashier,operator]){
  const wh=await api(user,'get','warehouses');expect(wh.status).toBe(200);expect(wh.body.map(w=>w.id)).toEqual([a.id]);
  expect((await api(user,'get','warehouses/'+b.id)).status).toBe(404);expect((await api(user,'get','warehouses/'+c.id)).status).toBe(404);
  const rows=await api(user,'get','stock/records');expect(rows.status).toBe(200);expect(rows.body.every(r=>r.warehouse_id===a.id)).toBe(true);
  const lookup=await api(user,'post','scanner/lookup',{barcode:p.barcode});expect(lookup.status).toBe(200);expect(lookup.body.stock).toBe(9);
  const allowed=await api(user,'post','scanner/lookup',{barcode:p.barcode,warehouse_id:a.id});expect(allowed.status).toBe(200);expect(allowed.body.lots.map(l=>l.id)).toEqual([lotA.id]);
  expect((await api(user,'post','scanner/lookup',{barcode:p.barcode,warehouse_id:b.id})).status).toBe(404);
 }
});
test('role and scope must both pass: cashier sale succeeds in A but foreign register and B sale do not',async()=>{
 const before=await state();
 for(const body of [{warehouse_id:b.id,register_id:registerB},{warehouse_id:a.id,register_id:registerB}])expect((await api(cashier,'post','scanner/sale',{...body,items:[{barcode:p.barcode,count:1}],payment_method:'cash'})).status).toBe(404);
 expect((await api(operator,'post','scanner/sale',{warehouse_id:a.id,items:[{barcode:p.barcode,count:1}],payment_method:'cash'})).status).toBe(403);
 expect(await state()).toEqual(before);
 expect((await api(cashier,'post','scanner/sale',{warehouse_id:a.id,register_id:registerA,items:[{barcode:p.barcode,count:1}],payment_method:'cash'})).status).toBe(201);
});
test('transfer requires both source and destination; failed transfer is atomic',async()=>{
 const before=await state();
 expect((await api(manager,'post','wms/locations/relocate',{warehouse_id:a.id,target_warehouse_id:b.id,source_location_id:locationA.id,target_location_id:locationB.id,product_id:p.id,lot_id:lotA.id,quantity:1})).status).toBe(404);
 expect(await state()).toEqual(before);
 expect((await setScope(manager,'restricted',[a.id,b.id])).status).toBe(200);
 const moved=await api(manager,'post','wms/locations/relocate',{warehouse_id:a.id,target_warehouse_id:b.id,source_location_id:locationA.id,target_location_id:locationB.id,product_id:p.id,lot_id:lotA.id,quantity:1});expect(moved.status).toBe(200);
 await setScope(manager,'restricted',[a.id]);
});
test('linked order, receipt, return and lot access cannot bypass warehouse scope',async()=>{
 const own=await api(manager,'post','purchase-orders',{supplier_id:supplier.id,target_warehouse_id:a.id,items:[{product_id:p.id,quantity:1,unit_price:7}]});expect(own.status).toBe(201);
 const foreignOrder=await api(owner,'post','purchase-orders',{supplier_id:supplier.id,target_warehouse_id:b.id,items:[{product_id:p.id,quantity:1,unit_price:7}]});expect(foreignOrder.status).toBe(201);
 expect((await api(manager,'get','purchase-orders')).body.map(o=>o.id)).toContain(own.body.order.id);
 expect((await api(manager,'get','purchase-orders/'+foreignOrder.body.order.id)).status).toBe(404);
 const before=await state();
 expect((await api(manager,'post','purchase-orders/'+foreignOrder.body.order.id+'/status',{status:'cancelled',reason:'Kapsam dışı'})).status).toBe(404);
 expect((await api(manager,'post','scanner/sales/'+saleB.sale_id+'/return',{reason:'Kapsam dışı iade',items:[{id:1,quantity:1}]})).status).toBe(404);
 expect((await api(manager,'get','scanner/sales/'+saleB.sale_id+'/receipt')).status).toBe(404);
 expect((await api(manager,'post','wms/cycle-count/baseline',{warehouse_id:a.id,location_id:locationA.id,product_id:p.id,lot_id:lotB.id})).status).toBe(404);
 expect(await state()).toEqual(before);
});
test('authorized receiving creates a new lot; scoped receipts/items cannot be reused from B',async()=>{
 const own=await api(manager,'post','wms/inbound/receipts',{warehouse_id:a.id,supplier_id:supplier.id,items:[{product_id:p.id,expected_qty:3,lot_number:'RECEIPT-LOT-A',expiry_date:'2099-02-01',unit_purchase_price:8}]});expect(own.status).toBe(201);
 const foreignReceipt=await api(owner,'post','wms/inbound/receipts',{warehouse_id:b.id,supplier_id:supplier.id,items:[{product_id:p.id,expected_qty:3,lot_number:'RECEIPT-LOT-B',expiry_date:'2099-03-01',unit_purchase_price:9}]});expect(foreignReceipt.status).toBe(201);
 const itemA=(await db.query('SELECT id FROM wms_inbound_items WHERE receipt_id=$1',[own.body.id])).rows[0],itemB=(await db.query('SELECT id FROM wms_inbound_items WHERE receipt_id=$1',[foreignReceipt.body.id])).rows[0];
 expect((await api(manager,'get','wms/inbound/receipts/'+foreignReceipt.body.id)).status).toBe(404);
 const before=await state();expect((await api(manager,'post','wms/inbound/putaway',{receipt_id:foreignReceipt.body.id,item_id:itemB.id,actual_location_id:locationA.id,quantity:3})).status).toBe(404);expect(await state()).toEqual(before);
 const received=await api(manager,'post','wms/inbound/putaway',{receipt_id:own.body.id,item_id:itemA.id,actual_location_id:locationA.id,quantity:3});expect(received.status).toBe(200);
 const item=(await db.query('SELECT * FROM wms_inbound_items WHERE id=$1',[itemA.id])).rows[0];expect(item.received_qty).toBe(3);expect(item.lot_id).toBeTruthy();
 expect((await api(manager,'post','scanner/lookup',{barcode:p.barcode,warehouse_id:a.id})).body.lots.some(l=>l.id===item.lot_id)).toBe(true);
 const deniedBefore=await state();expect((await api(manager,'post','suppliers/'+supplier.id+'/returns',{reason:'Başka depo iadesi',items:[{receipt_item_id:itemB.id,quantity:1}]})).status).toBe(404);expect(await state()).toEqual(deniedBefore);
 const returned=await api(manager,'post','suppliers/'+supplier.id+'/returns',{reason:'Yetkili depo tedarikçi iadesi',items:[{receipt_item_id:itemA.id,quantity:1}]});expect(returned.status).toBe(200);
 expect((await api(manager,'get','suppliers/'+supplier.id)).body.returns).toHaveLength(1);
});
test('profit report and Excel/CSV inherit the same warehouse filtering',async()=>{
 const report=await api(manager,'get','scanner/gross-profit');expect(report.status).toBe(200);expect(report.body.summary.net_inc_vat_cents).toBe(2400);
 expect(report.body.rows.every(r=>r.product_id===p.id)).toBe(true);
 expect((await api(manager,'get','scanner/gross-profit?warehouse_id='+b.id)).status).toBe(404);
 const csv=await api(manager,'get','scanner/gross-profit?format=csv');expect(csv.status).toBe(200);expect(csv.text).toContain('Kapsam ürünü');
 const csvRows=require('papaparse').parse(csv.text,{delimiter:';'}).data;expect(csvRows.find(r=>r[0]==='TOPLAM')[11]).toBe('24,00');expect(csv.text).toContain('Yetkili depolar: '+a.id);
 const xlsx=await api(manager,'get','scanner/gross-profit?format=xlsx').buffer(true).parse((res,done)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>done(null,Buffer.concat(chunks)));});expect(xlsx.status).toBe(200);expect(xlsx.headers['content-type']).toContain('spreadsheet');
 const excel=require('xlsx'),book=excel.read(xlsx.body,{type:'buffer'}),rows=excel.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1});
 expect(rows.find(r=>r[0]==='TOPLAM')[11]).toBe(24);
 expect(rows.some(r=>r.includes('0001112223334'))).toBe(true);
});
test('self assignment, other firm assignment and role-only escalation are denied and audited changes retain history',async()=>{
 const before=(await db.query('SELECT * FROM user_warehouse_access ORDER BY user_id,warehouse_id')).rows;
 expect((await api(owner,'put','settings/users/'+owner.userId+'/access-scope',{mode:'restricted',warehouse_ids:[a.id]})).status).toBe(403);
 expect((await api(owner,'put','settings/users/'+foreign.userId+'/access-scope',{mode:'company',warehouse_ids:[]})).status).toBe(404);
 expect((await setScope(manager,'restricted',[c.id])).status).toBe(404);
 expect((await api(manager,'put','settings/users/'+cashier.id+'/access-scope',{mode:'company',warehouse_ids:[]})).status).toBe(403);
 expect((await db.query('SELECT * FROM user_warehouse_access ORDER BY user_id,warehouse_id')).rows).toEqual(before);
 const audit=(await db.query("SELECT * FROM audit_logs WHERE action='access.scope_changed' AND entity_id=$1 ORDER BY id DESC LIMIT 1",[manager.id])).rows[0];expect(audit.user_email).toBe(owner.email);expect(audit.created_at).toBeTruthy();expect(JSON.parse(audit.details)).toMatchObject({user_id:owner.userId,previous:{warehouse_ids:[a.id,b.id]},new:{warehouse_ids:[a.id]}});
});
test('removing an assignment affects the next request using the unchanged session token',async()=>{
 expect((await setScope(cashier,'restricted',[])).status).toBe(200);const before=await state();
 expect((await api(cashier,'post','scanner/sale',{warehouse_id:a.id,items:[{barcode:p.barcode,count:1}],payment_method:'cash'})).status).toBe(403);expect(await state()).toEqual(before);
 expect((await setScope(cashier,'company',[])).status).toBe(200);
 expect((await api(cashier,'get','warehouses')).body.some(w=>w.id===b.id)).toBe(true);
});
test('warehouse deletion removes assignments and audits the actor instead of leaving dangling grants',async()=>{
 const temp=await createWarehouse(owner.tenantId);const worker=await account('operator',[temp.id]);expect((await api(owner,'delete','warehouses/'+temp.id)).status).toBe(200);
 expect((await db.query('SELECT * FROM user_warehouse_access WHERE user_id=$1',[worker.id])).rows).toHaveLength(0);
 expect((await api(worker,'get','warehouses')).status).toBe(403);
 const audit=(await db.query("SELECT details FROM audit_logs WHERE action='access.scope_changed' AND entity_id=$1 ORDER BY id DESC LIMIT 1",[worker.id])).rows[0];expect(JSON.parse(audit.details)).toMatchObject({user_id:owner.userId,previous:{warehouse_ids:[temp.id]},new:{warehouse_ids:[]}});
});
