const db=require('../../src/config/database'),crypto=require('crypto'),adapter=require('../../src/config/mysqlAdapter');
const daily=require('../../src/services/retailDailyService'),shifts=require('../../src/services/retailShiftService'),procurement=require('../../src/services/procurementService'),scope=require('../../src/services/scopeQueryContext');
let u,w,p,location,supplier;
const insert=async(sql,params)=>(await db.query(sql+' RETURNING *',params)).rows[0],key=()=>crypto.randomUUID();
beforeAll(async()=>{await db.ready;const tenant=await insert('INSERT INTO tenants(tenant_code,company_name,email) VALUES($1,$2,$3)',[key(),'MySQL İş Testi',key()+'@test.invalid']);const user=await insert("INSERT INTO users(tenant_id,email,password_hash,role) VALUES($1,$2,'disabled','admin')",[tenant.id,key()+'@test.invalid']);u={tenantId:tenant.id,homeTenantId:tenant.id,userId:user.id,email:user.email,role:'admin',moduleType:'NORMAL'};w=await insert("INSERT INTO warehouses(tenant_id,name,type,warehouse_type) VALUES($1,'Test','MAIN','NORMAL')",[tenant.id]);p=await insert("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,'Ürün',$3,'adet',1.23,'NORMAL')",[tenant.id,key(),'000-'+key()]);location=await insert("INSERT INTO warehouse_locations(tenant_id,warehouse_id,location_code,aisle_code,rack_number,shelf_tier,bin_position) VALUES($1,$2,$3,'A',1,1,1)",[tenant.id,w.id,key()]);supplier=await insert("INSERT INTO suppliers(tenant_id,name) VALUES($1,'Tedarikçi')",[tenant.id]);});
afterAll(async()=>adapter.getMySQLPool()?.end());
test('real shift/sale retries, last-stock race and over-return use separate connections',async()=>{
 const current=await shifts.open(u,{warehouse_id:w.id,opening_cash:'20.00'},key());
 await db.query('INSERT INTO stock_records(tenant_id,product_id,warehouse_id,quantity) VALUES($1,$2,$3,1)',[u.tenantId,p.id,w.id]);
 const body={warehouse_id:w.id,shift_id:current.shift_id,register_id:current.register_id,items:[{barcode:p.barcode,count:1}],payments:[{method:'cash',amount:'1.23'}],cash_received:'2.00'},same=key();
 const result=await Promise.all([daily.sale(u,body,same),daily.sale(u,body,same)]);expect(result[0].sale_id).toBe(result[1].sale_id);expect((await db.query('SELECT quantity FROM stock_records WHERE product_id=$1',[p.id])).rows[0].quantity).toBe('0.000000');
 const refund={reason:'MySQL iade testi',items:[{id:1,quantity:1}]};const returns=await Promise.allSettled([daily.reverse(u,result[0].sale_id,'return',refund,key()),daily.reverse(u,result[0].sale_id,'return',refund,key())]);expect(returns.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const race=await Promise.allSettled([daily.sale(u,body,key()),daily.sale(u,body,key())]);expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const report=await shifts.detail(u,current.shift_id);expect(report.sales_cents).toBe(246);expect(report.cash_refund_cents).toBe(123);
});
test('purchase receipt retry, over-receipt and lot precision remain atomic',async()=>{
 const created=await procurement.create(u,{supplier_id:supplier.id,target_warehouse_id:w.id,items:[{product_id:p.id,quantity:'2.000001',unit_price:'0.10'}]},key());
 const id=created.order?.id||created.id;expect(id).toBeDefined();
 await procurement.transition(u,id,{action:'submit'});await procurement.transition(u,id,{action:'approve'});const detail=await procurement.detail(u,id),item=detail.items[0];
 const body={delivery_reference:key(),items:[{order_item_id:item.id,quantity:'1.000001',location_id:location.id,lot_number:'LOT-0001',expiry_date:'2030-01-02',unit_price:'0.10'}]},same=key();
 const receipts=await Promise.all([procurement.receive(u,id,body,same),procurement.receive(u,id,body,same)]);expect(receipts[0]).toEqual(receipts[1]);
 await expect(procurement.receive(u,id,{...body,delivery_reference:key(),items:[{...body.items[0],quantity:2}]},key())).rejects.toMatchObject({status:409});
 const lot=(await db.query('SELECT expiry_date FROM inventory_lots WHERE tenant_id=$1 AND lot_number=$2',[u.tenantId,'LOT-0001'])).rows[0];expect(lot.expiry_date).toBe('2030-01-02');
});
test('incoming writes cannot move rows or insert stock outside the assigned warehouse',async()=>{
 const other=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,'Başka','MAIN')",[u.tenantId]);
 await scope.run({tenantId:u.tenantId,mode:'restricted',warehouse_ids:[w.id]},async()=>{
  await expect(db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,1)',[u.tenantId,other.id,p.id])).rejects.toMatchObject({status:403});
  await expect(db.query('UPDATE stock_records SET warehouse_id=$1 WHERE product_id=$2',[other.id,p.id])).rejects.toMatchObject({status:403});
  expect((await db.query('SELECT id FROM warehouses WHERE id=$1',[other.id])).rows).toHaveLength(0);
 });
});
test('lot transfer retries, concurrent depletion and stale count approvals remain safe',async()=>{
 const inventory=require('../../src/services/inventoryTransactionService'),locations=require('../../src/services/warehouseLocationService'),counts=require('../../src/services/wmsCountReviewService');
 const product=await insert("INSERT INTO products(tenant_id,sku,name,module_type) VALUES($1,$2,'Transfer sayım','NORMAL')",[u.tenantId,key()]);
 const lot=await insert("INSERT INTO inventory_lots(tenant_id,product_id,lot_number,expiry_date) VALUES($1,$2,$3,'2030-01-02')",[u.tenantId,product.id,key()]);
 const targetWarehouse=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,'Hedef','MAIN')",[u.tenantId]);const target=await insert("INSERT INTO warehouse_locations(tenant_id,warehouse_id,location_code,aisle_code,rack_number,shelf_tier,bin_position) VALUES($1,$2,$3,'A',1,1,1)",[u.tenantId,targetWarehouse.id,key()]);
 await inventory.recordTransaction({tenant_id:u.tenantId,warehouse_id:w.id,location_id:location.id,product_id:product.id,lot_id:lot.id,quantity:2,transaction_type:'PUTAWAY',user_id:u.userId});
 const body={warehouse_id:w.id,target_warehouse_id:targetWarehouse.id,source_location_id:location.id,target_location_id:target.id,product_id:product.id,lot_id:lot.id,quantity:1,user_id:u.userId,operation_key:key()};const first=await Promise.all([locations.relocateStock(u.tenantId,body),locations.relocateStock(u.tenantId,body)]);expect(first[0].transfer_ref).toBe(first[1].transfer_ref);
 const tuple={warehouse_id:w.id,location_id:location.id,product_id:product.id,lot_id:lot.id},baseline=await counts.getManualCountBaseline(u,tuple),review=await counts.previewCountReview(u,{baseline_token:baseline.baseline_token,counted_qty:2});
 const race=await Promise.allSettled([locations.relocateStock(u.tenantId,{...body,operation_key:key()}),locations.relocateStock(u.tenantId,{...body,operation_key:key()})]);expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 await expect(counts.approveCountReview(u,{review_id:review.id,reason:'Eski sayım testi'},key())).rejects.toMatchObject({status:409});
 const next=await counts.getManualCountBaseline(u,tuple),valid=await counts.previewCountReview(u,{baseline_token:next.baseline_token,counted_qty:1}),same=key();const approved=await Promise.all([counts.approveCountReview(u,{review_id:valid.id,reason:'Güncel sayım testi'},same),counts.approveCountReview(u,{review_id:valid.id,reason:'Güncel sayım testi'},same)]);expect(approved[0]).toEqual(approved[1]);
});
