const request=require('supertest'),crypto=require('crypto'),app=require('../src/index'),db=require('../src/config/database'),f=require('./factories');
let owner,other,warehouse,shift,product,account,viewer;
const get=(url,actor=owner)=>request(app).get('/api/scanner/pro/'+url).set('Authorization','Bearer '+actor.token);
const post=(url,body,key=crypto.randomUUID(),actor=owner)=>request(app).post('/api/scanner/'+url).set('Authorization','Bearer '+actor.token).set('Idempotency-Key',key).send(body);
const base=()=>({warehouse_id:warehouse.id,shift_id:shift.shift_id,register_id:shift.register_id,items:[{barcode:product.barcode,count:1}],payments:[{method:'cash',amount:12}],cash_received:12});
beforeAll(async()=>{owner=await f.createTenant();other=await f.createTenant();warehouse=await f.createWarehouse(owner.tenantId);shift=await f.openTestShift(owner,warehouse.id);const u=await f.createUser(owner.tenantId,'viewer');viewer={token:(await request(app).post('/api/auth/login').send({email:u.email,password:'password123'})).body.token};product=(await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,$2,$2,'Tartılı test ürünü','kg',12,20,'NORMAL') RETURNING *",[owner.tenantId,'PRO-'+crypto.randomUUID()])).rows[0];await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100)',[owner.tenantId,warehouse.id,product.id]);});
test('catalog is bounded, tenant-scoped and exposes no global catalogue claim or purchase costs',async()=>{
 const r=await get('catalog?limit=1');expect(r.status).toBe(200);expect(r.body.items).toHaveLength(1);expect(r.body.global_catalog_available).toBe(false);expect(r.body.items[0].purchase_price).toBeUndefined();expect((await get('catalog?limit=101')).status).toBe(400);expect((await get('catalog',viewer)).status).toBe(403);
 const found=await get('catalog?q='+encodeURIComponent(product.barcode));expect(found.body.items[0].id).toBe(product.id);expect((await get('catalog?q='+encodeURIComponent(product.barcode),other)).body.items).toHaveLength(0);
 const page=await get('catalog?after='+r.body.next+'&limit=1');expect(page.body.items[0].id).toBeGreaterThan(r.body.items[0].id);
});
test('preferences cannot write another actor/tenant and unsafe image URLs are rejected',async()=>{
 const put=(body,actor=owner)=>request(app).put('/api/scanner/pro/preferences').set('Authorization','Bearer '+actor.token).send(body);
 const body={mode:'visual',favorites:[product.id],categoryStyles:{Test:{color:'#123abc',icon:'leaf'}}};expect((await put(body)).status).toBe(200);expect((await get('preferences')).body).toEqual(body);expect((await get('preferences',other)).body.mode).toBe('standard');expect((await put({...body,tenant_id:other.tenantId})).status).toBe(400);expect((await put({...body,quickActions:['price','hold']})).body.quickActions).toEqual(['price','hold']);expect((await put({...body,quickActions:['admin-delete']})).status).toBe(400);
 expect((await request(app).put('/api/scanner/pro/products/'+product.id+'/media').set('Authorization','Bearer '+owner.token).send({brand:'Test',image_path:'https://tracker.invalid/a.png'})).status).toBe(400);
});
test('manual weighted sale uses exact grams, then partial return restores the same stock once',async()=>{
 const body={...base(),items:[{barcode:product.barcode,count:1,quantity:'0.125'}],payments:[{method:'cash',amount:1.5}],cash_received:2};const key=crypto.randomUUID(),r=await post('sale',body,key);expect(r.status).toBe(201);expect(r.body.total).toBe(1.5);expect((await post('sale',body,key)).body.sale_id).toBe(r.body.sale_id);
 const refund={register_id:shift.register_id,shift_id:shift.shift_id,reason:'Test kısmi iade',items:[{id:1,quantity:.025}]};const k=crypto.randomUUID(),back=await post('sales/'+r.body.sale_id+'/return',refund,k);expect(back.status).toBe(200);expect(back.body.refund).toBe(.3);expect((await post('sales/'+r.body.sale_id+'/return',refund,k)).body).toEqual(back.body);
 expect(Number((await db.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3',[owner.tenantId,warehouse.id,product.id])).rows[0].quantity)).toBe(99.9);
 for(const quantity of ['-1','1e3','0','1.0000001'])expect((await post('sale',{...body,items:[{barcode:product.barcode,count:1,quantity}]})).status).toBe(400);
});
test('credit sale, partial collection, refund and ledger leave cashier cash consistent',async()=>{
 const a=await post('pro/accounts',{name:'Synthetic müşteri',limit:100,tax_number:'1234567890',address:'Test adresi'});expect(a.status).toBe(200);account=a.body;
 const body={...base(),payments:[{method:'on_account',amount:12}],cash_received:0,account_id:account.id,due_date:'2027-01-01'},k=crypto.randomUUID(),r=await post('sale',body,k);expect(r.status).toBe(201);expect((await post('sale',body,k)).body.sale_id).toBe(r.body.sale_id);
 expect((await get('accounts/'+account.id)).body.balance_cents).toBe(1200);
 const movement={kind:'collection',amount:5,reason:'Test nakit tahsilat',warehouse_id:warehouse.id,shift_id:shift.shift_id,register_id:shift.register_id},mk=crypto.randomUUID();expect((await post('pro/accounts/'+account.id+'/movements',movement,mk)).body.balance_cents).toBe(700);expect((await post('pro/accounts/'+account.id+'/movements',movement,mk)).body.balance_cents).toBe(700);
 const refund=await post('sales/'+r.body.sale_id+'/return',{shift_id:shift.shift_id,register_id:shift.register_id,reason:'Test veresiye iade',items:[{id:1,quantity:.5}]});expect(refund.status).toBe(200);expect(refund.body.cash_refund).toBe(0);expect(refund.body.credit_refund).toBe(6);expect((await get('accounts/'+account.id)).body.balance_cents).toBe(100);
 const context=await request(app).get('/api/scanner/shifts/'+shift.shift_id).set('Authorization','Bearer '+owner.token);expect(context.status).toBe(200);expect(context.body.cash_in_cents??context.body.report?.cash_in_cents).toBe(500);
 expect((await post('sale',{...body,payments:[{method:'on_account',amount:120}],items:[{barcode:product.barcode,count:10}]})).status).toBe(409);
 expect((await get('accounts/'+account.id,other)).status).toBe(404);expect((await post('pro/accounts',{name:'Forbidden',limit:100},crypto.randomUUID(),viewer)).status).toBe(403);
});
test('unconfigured hardware fails closed and invoice draft never claims a GIB transmission',async()=>{
 const hardware=await get('hardware');expect(hardware.body.okc.configured).toBe(false);expect((await post('pro/okc',{profile:'unknown',action:'sale',amount:12})).status).toBe(503);
 const sale=await post('sale',base());expect(sale.status).toBe(201);const draft=await get('sales/'+sale.body.sale_id+'/invoice-draft');expect(draft.status).toBe(200);expect(draft.body.status).toBe('internal_draft');expect(draft.body.sent_to_gib).toBe(false);expect(draft.body.total_cents).toBe(1200);
});
test('external timeout/unknown never executes twice and status resolves with the same operation ID',async()=>{
 let calls=0;require('../src/services/retailExternalService').register('test-only',{execute:async()=>{calls++;return {status:'unknown'};},status:async()=>({status:'success'})});
 const key=crypto.randomUUID(),body={profile:'test-only',action:'sale',amount:12};const r=await post('pro/okc',body,key);expect(r.body.status).toBe('unknown');expect((await post('pro/okc',body,key)).body.id).toBe(r.body.id);expect(calls).toBe(1);const poll=await get('okc/'+r.body.id);expect(poll.body.status).toBe('success');expect(calls).toBe(1);
 expect((await get('okc/'+r.body.id,other)).status).toBe(404);expect((await post('pro/okc',{...body,amount:13},key)).status).toBe(409);
});

test('credit limit failure rolls back stock, sale and operation key together',async()=>{
 const before=Number((await db.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3',[owner.tenantId,warehouse.id,product.id])).rows[0].quantity),key=crypto.randomUUID();
 const r=await post('sale',{...base(),items:[{barcode:product.barcode,count:10}],payments:[{method:'on_account',amount:120}],cash_received:0,account_id:account.id,due_date:'2027-01-01'},key);expect(r.status).toBe(409);
 expect(Number((await db.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3',[owner.tenantId,warehouse.id,product.id])).rows[0].quantity)).toBe(before);
 expect((await db.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[owner.tenantId,'scan-sale:'+key])).rows).toHaveLength(0);
});
test('cash/card/credit split refunds keep all three payment totals nonnegative',async()=>{
 const sale=await post('sale',{...base(),items:[{barcode:product.barcode,count:1,quantity:'0.1'}],payments:[{method:'cash',amount:.4},{method:'credit_card',amount:.4},{method:'on_account',amount:.4}],cash_received:.4,account_id:account.id,due_date:'2027-01-01'});expect(sale.status).toBe(201);
 let total=0;for(let i=0;i<10;i++){const back=await post('sales/'+sale.body.sale_id+'/return',{shift_id:shift.shift_id,register_id:shift.register_id,reason:'Test mikro iade',items:[{id:1,quantity:.01}]});expect(back.status).toBe(200);expect(back.body.cash_refund).toBeGreaterThanOrEqual(0);expect(back.body.card_refund).toBeGreaterThanOrEqual(0);expect(back.body.credit_refund||0).toBeGreaterThanOrEqual(0);total+=Math.round(back.body.refund*100);}
 expect(total).toBe(120);
});
test('blind count baseline hides quantities from operators and authenticates encrypted snapshot',async()=>{
 const user={tenantId:owner.tenantId,userId:owner.userId,email:owner.email,role:'warehouse_operator'};
 const loc=(await db.query('SELECT * FROM warehouse_locations WHERE tenant_id=$1 LIMIT 1',[owner.tenantId])).rows[0];
 const row=(await db.query('SELECT * FROM product_bin_records WHERE tenant_id=$1 AND location_id=$2 LIMIT 1',[owner.tenantId,loc.id])).rows[0];
 const counts=require('../src/services/wmsCountReviewService');
 const result=await counts.getManualCountBaseline(user,{warehouse_id:loc.warehouse_id,location_id:loc.id,product_id:row.product_id});expect(result.system_qty).toBeUndefined();expect(result.quantity).toBeUndefined();expect(result.baseline_token.startsWith('v2.')).toBe(true);
 const list=await counts.getCountRows(user,{warehouse_id:loc.warehouse_id});expect(list.some(r=>Object.hasOwn(r,'system_qty'))).toBe(false);
 await expect(counts.previewCountReview(user,{baseline_token:result.baseline_token+'x',counted_qty:1})).rejects.toMatchObject({status:409});
});

test('paid historical debt does not trigger an overdue warning for a later not-yet-due sale',()=>{
 const {overdueAmount}=require('../src/services/retailCreditService');
 expect(overdueAmount([{sale_id:1,kind:'sale',amount_cents:1000,due_date:'2026-01-01'},{kind:'collection',amount_cents:-1000},{sale_id:2,kind:'sale',amount_cents:500,due_date:'2027-01-01'}],'2026-10-18')).toBe(0);
 expect(overdueAmount([{sale_id:1,kind:'sale',amount_cents:1000,due_date:'2026-01-01'},{kind:'collection',amount_cents:-500}],'2026-10-18')).toBe(500);
});

test('product thumbnails are tenant-private and returned only after authorization',async()=>{
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6S8AAAAASUVORK5CYII=';
 const r=await request(app).put('/api/scanner/pro/products/'+product.id+'/media').set('Authorization','Bearer '+owner.token).send({image_data:image,brand:'Test marka'});expect(r.status).toBe(200);
 const imageResponse=await get('products/'+product.id+'/image');expect(imageResponse.status).toBe(200);expect(imageResponse.headers['content-type']).toMatch(/image\/png/);
 expect((await get('products/'+product.id+'/image',other)).status).toBe(404);expect((await request(app).get('/api/scanner/pro/products/'+product.id+'/image')).status).toBe(401);
 const page=await get('catalog?q='+encodeURIComponent(product.barcode));expect(page.body.items[0].image_available).toBe(1);expect(JSON.stringify(page.body)).not.toContain('base64');
});

test('device journal exposes unresolved operations without claiming bank reconciliation',async()=>{
 const r=await get('okc-reconciliation');expect(r.status).toBe(200);expect(r.body.bank_reconciled).toBe(false);expect(r.body.source).toBe('local_device_journal');expect((await get('okc-reconciliation?date=bad')).status).toBe(400);
});

test('warehouse-scoped managers cannot inspect company-wide credit or device journals',async()=>{
 const u=await f.createUser(owner.tenantId,'manager',{mode:'restricted',warehouse_ids:[warehouse.id]});const actor={token:(await request(app).post('/api/auth/login').send({email:u.email,password:'password123'})).body.token};
 expect((await get('accounts',actor)).status).toBe(403);expect((await get('okc-reconciliation',actor)).status).toBe(403);
});


test('terminal reauthentication preserves the current actor and uses real password checks',async()=>{
 const verify=body=>request(app).post('/api/auth/terminal-verify').set('Authorization','Bearer '+owner.token).send(body);
 expect((await verify({mode:'unlock',email:owner.email,password:'wrong-test-password'})).status).toBe(401);
 for(let i=0;i<8;i++)expect((await verify({mode:'unlock',email:owner.email,password:'password123'})).status).toBe(200);
 expect((await request(app).get('/api/auth/me').set('Authorization','Bearer '+owner.token)).body.id).toBe(owner.userId);
 expect((await request(app).post('/api/auth/terminal-verify').send({mode:'unlock',email:owner.email,password:'password123'})).status).toBe(401);
});

test('terminal verification rejects cross-company and wrong-actor approvals',async()=>{
 const verify=body=>request(app).post('/api/auth/terminal-verify').set('Authorization','Bearer '+owner.token).send({...body,password:'password123'});
 expect((await verify({mode:'approve',email:other.email})).status).toBe(403);
 expect((await verify({mode:'unlock',email:other.email})).status).toBe(403);
 expect((await verify({mode:'approve',email:owner.email})).status).toBe(200);
 expect((await verify({mode:'invalid',email:owner.email})).status).toBe(400);
});
