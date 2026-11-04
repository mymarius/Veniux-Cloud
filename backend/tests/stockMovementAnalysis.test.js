const {classify}=require('../src/services/stockMovementAnalysis');
test('no activity produces no fast-moving product',()=>{expect(classify([{product_id:1,total_outbound_qty:0},{product_id:2,total_outbound_qty:0}]).map(p=>p.abc_class)).toEqual(['D','D']);});
test('one dominant product stays in A and inactive products remain separate',()=>{const rows=classify([{product_id:3,total_outbound_qty:0},{product_id:2,total_outbound_qty:10},{product_id:1,total_outbound_qty:90}]);expect(rows.map(p=>p.abc_class)).toEqual(['A','C','D']);expect(rows[0].volume_share_pct).toBe(90);});
test('threshold-crossing product belongs to the group in which it starts',()=>{expect(classify([60,20,15,5].map((q,i)=>({product_id:i,total_outbound_qty:q}))).map(p=>p.abc_class)).toEqual(['A','A','B','C']);});
test('invalid or negative aggregate cannot become positive activity',()=>{expect(classify([{product_id:1,total_outbound_qty:'bad'},{product_id:2,total_outbound_qty:-3}]).every(p=>p.abc_class==='D'&&p.volume_share_pct===0)).toBe(true);});
const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database');
const {createTenant,createWarehouse,createProduct}=require('./factories');
test('analytics stays within the tenant warehouse and rejects invalid periods',async()=>{
 const owner=await createTenant(),other=await createTenant(),wh=await createWarehouse(owner.tenantId),foreign=await createWarehouse(other.tenantId),p=await createProduct(owner.tenantId);
 await db.query("INSERT INTO inventory_transactions (tenant_id,warehouse_id,product_id,transaction_type,quantity,before_quantity,after_quantity) VALUES ($1,$2,$3,'SHIP',-7,10,3)",[owner.tenantId,wh.id,p.id]);
 const get=(warehouse,period='30d')=>request(app).get('/api/wms/slotting/abc').query({warehouse_id:warehouse,period}).set('Authorization','Bearer '+owner.token);
 const r=await get(wh.id);expect(r.status).toBe(200);expect(r.body.products.find(x=>x.product_id===p.id)).toMatchObject({total_outbound_qty:7,abc_class:'A'});
 expect((await get(foreign.id)).status).toBe(404);expect((await get(wh.id,'all')).status).toBe(400);
});

