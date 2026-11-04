const request=require('supertest'),crypto=require('crypto'),app=require('../src/index'),db=require('../src/config/database'),f=require('./factories');
let owner,wh,product,cashier;
const post=(route,body,token=owner.token,key=crypto.randomUUID())=>request(app).post('/api/scanner/'+route).set('Authorization','Bearer '+token).set('Idempotency-Key',key).send(body);
beforeAll(async()=>{owner=await f.createTenant();const u=await f.createUser(owner.tenantId,'cashier');cashier=(await request(app).post('/api/auth/login').send({email:u.email,password:'password123'})).body.token;});
beforeEach(async()=>{wh=await f.createWarehouse(owner.tenantId);await f.openTestShift(owner,wh.id,1000);const code='RC-'+crypto.randomUUID();product=(await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$2,'RC fixture','adet',1.25,20,'NORMAL') RETURNING *",[owner.tenantId,code])).rows[0];await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,5)',[owner.tenantId,wh.id,product.id]);});
const sale=items=>({warehouse_id:wh.id,payment_method:'cash',items});
test('receipt money keeps exact integer cents with Turkish grouping',()=>{const {money}=require('../src/services/retailReceipt');expect(money(123456)).toBe('1.234,56 TL');expect(money(-1)).toBe('-0,01 TL');expect(money(0)).toBe('0,00 TL');expect(money(Number.MAX_SAFE_INTEGER)).toBe('90.071.992.547.409,91 TL');});
test.each([15,50,100])('%s distinct cart rows reconcile sale, receipt, stock and shift',async count=>{
 const products=[];await db.transaction(async tx=>{for(let i=0;i<count;i++){const code='000RC-'+crypto.randomUUID();const p=(await tx.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$2,$3,'adet',1.25,20,'NORMAL') RETURNING *",[owner.tenantId,code,'RC uzun ürün adı '+i])).rows[0];await tx.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,3)',[owner.tenantId,wh.id,p.id]);products.push(p);}});
 const body=sale(products.map(p=>({barcode:p.barcode,count:1}))),key=crypto.randomUUID(),r=await post('sale',body,owner.token,key);expect(r.status).toBe(201);expect(r.body.total).toBe(count*1.25);expect((await post('sale',body,owner.token,key)).body.sale_id).toBe(r.body.sale_id);
 const snapshot=JSON.parse((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1',[r.body.sale_id])).rows[0].snapshot_json);expect(snapshot.items).toHaveLength(count);expect(snapshot.net_cents).toBe(count*125);expect(snapshot.vat_breakdown.total_cents).toBe(snapshot.net_cents);
 for(const p of products)expect(Number((await db.query('SELECT quantity FROM stock_records WHERE warehouse_id=$1 AND product_id=$2',[wh.id,p.id])).rows[0].quantity)).toBe(2);
 for(const width of [58,80]){const receipt=await request(app).get('/api/scanner/sales/'+r.body.sale_id+'/receipt?width='+width).set('Authorization','Bearer '+owner.token);expect(receipt.status).toBe(200);expect(receipt.text).toContain('RC uzun ürün adı '+(count-1));}
 const context=await request(app).get('/api/scanner/shifts/context').query({warehouse_id:wh.id}).set('Authorization','Bearer '+owner.token);expect(context.body.active_shift.sale_count).toBe(1);expect(context.body.active_shift.sales_cents).toBe(count*125);
});
test('existing zero-price catalog policy allows authenticated cashier with open shift, but not a hidden override',async()=>{
 await db.query('UPDATE products SET sale_price=0 WHERE id=$1',[product.id]);const body=sale([{barcode:product.barcode,count:1}]);const r=await post('sale',body,cashier);expect(r.status).toBe(201);expect(r.body.total).toBe(0);expect(r.body.payments.cash).toBe(0);
 expect((await post('sale',sale([{barcode:product.barcode,count:1,price_override:0}]),cashier)).status).toBe(403);
 expect(Number((await db.query('SELECT quantity FROM stock_records WHERE warehouse_id=$1 AND product_id=$2',[wh.id,product.id])).rows[0].quantity)).toBe(4);
});
test('zero override and 100 percent discount retain existing manager permissions and exact zero VAT',async()=>{
 const payload=sale([{barcode:product.barcode,count:1,price_override:0}]);const r=await post('sale',payload);expect(r.status).toBe(201);expect(r.body.total).toBe(0);
 const denied=await post('sale',{...sale([{barcode:product.barcode,count:1}]),discount_amount:1.25},cashier);expect(denied.status).toBe(403);
 const approved=await post('sale',{...sale([{barcode:product.barcode,count:1}]),discount_amount:1.25});expect(approved.status).toBe(201);expect(approved.body.total).toBe(0);
 const s=JSON.parse((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1',[approved.body.sale_id])).rows[0].snapshot_json);expect(s.vat_breakdown.total_cents).toBe(0);expect(s.vat_breakdown.groups.every(g=>g.vat_cents===0&&g.base_cents===0)).toBe(true);
});
