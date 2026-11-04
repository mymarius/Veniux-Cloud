const http=require('node:http'),crypto=require('node:crypto');
const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database'),f=require('./factories');
let owner,wh,p,server;
const post=(body,key)=>request(app).post('/api/scanner/sale').set('Authorization','Bearer '+owner.token).set('Idempotency-Key',key).send(body);
const payload=()=>({warehouse_id:wh.id,payment_method:'cash',items:[{barcode:p.barcode,count:1}]});
const state=async()=>({stock:Number((await db.query('SELECT SUM(quantity) q FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2',[owner.tenantId,wh.id])).rows[0].q),sales:Number((await db.query('SELECT COUNT(*) n FROM retail_sales WHERE tenant_id=$1 AND warehouse_id=$2',[owner.tenantId,wh.id])).rows[0].n)});
beforeAll(async()=>{owner=await f.createTenant();});
beforeEach(async()=>{wh=await f.createWarehouse(owner.tenantId);const code='READINESS-'+crypto.randomUUID();p=(await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,module_type) VALUES($1,$2,$2,'Readiness fixture','adet',10,'NORMAL') RETURNING *",[owner.tenantId,code])).rows[0];await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,3)',[owner.tenantId,wh.id,p.id]);await f.openTestShift(owner,wh.id);});
afterEach(async()=>{jest.restoreAllMocks();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;}});
test('real TCP disconnect before complete request leaves no sale; same key can retry',async()=>{
 server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const entered=new Promise(resolve=>server.once('request',resolve)),key=crypto.randomUUID();
 const req=http.request(origin+'/api/scanner/sale',{method:'POST',headers:{Authorization:'Bearer '+owner.token,'Idempotency-Key':key,'Content-Type':'application/json','Content-Length':'10000'}});req.on('error',()=>{});req.write('{"warehouse_id":');await entered;const closed=new Promise(resolve=>req.once('close',resolve));req.destroy();await closed;
 expect(await state()).toEqual({stock:3,sales:0});expect((await post(payload(),key)).status).toBe(201);expect(await state()).toEqual({stock:2,sales:1});
});
test('real TCP response loss after commit recovers durable result without duplicate stock',async()=>{
 let ended;const committed=new Promise(resolve=>{ended=resolve;});
 server=http.createServer((req,res)=>{const drop=req.url==='/api/scanner/sale'&&req.method==='POST',end=res.end;res.end=function(...args){if(drop){req.socket.destroy();ended();return res;}return end.apply(this,args);};app(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,key=crypto.randomUUID(),body=payload(),raw=JSON.stringify(body);
 const disconnected=new Promise(resolve=>{const req=http.request(origin+'/api/scanner/sale',{method:'POST',headers:{Authorization:'Bearer '+owner.token,'Idempotency-Key':key,'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}},res=>{res.resume();resolve('unexpected response');});req.on('error',()=>resolve('disconnected'));req.end(raw);});
 expect(await disconnected).toBe('disconnected');await committed;expect(await state()).toEqual({stock:2,sales:1});
 const status=await request(app).get('/api/scanner/sale-status').query({operation_key:key}).set('Authorization','Bearer '+owner.token);expect(status.status).toBe(200);
 const replay=await post(body,key);expect(replay.status).toBe(201);expect(replay.body.sale_id).toBe(status.body.sale.sale_id);expect(await state()).toEqual({stock:2,sales:1});
});
test('failure after stock writes rolls back sale, movements and key; retry commits once',async()=>{
 const before=Number((await db.query('SELECT COUNT(*) n FROM pos_sales WHERE tenant_id=$1',[owner.tenantId])).rows[0].n);
 const original=db.transaction;let fail=true;
 jest.spyOn(db,'transaction').mockImplementation(work=>original(tx=>work({...tx,query:async(sql,args)=>{if(fail&&/INSERT INTO retail_sales\b/.test(sql)){fail=false;throw Error('Readiness injected persistence failure');}return tx.query(sql,args);}})));
 const key=crypto.randomUUID(),body=payload();expect((await post(body,key)).status).toBe(500);expect(await state()).toEqual({stock:3,sales:0});
 expect(Number((await db.query('SELECT COUNT(*) n FROM pos_sales WHERE tenant_id=$1',[owner.tenantId])).rows[0].n)).toBe(before);
 expect((await db.query('SELECT * FROM pos_sale_items WHERE tenant_id=$1 AND product_id=$2',[owner.tenantId,p.id])).rows).toHaveLength(0);
 expect((await db.query('SELECT * FROM stock_movements WHERE tenant_id=$1 AND warehouse_id=$2',[owner.tenantId,wh.id])).rows).toHaveLength(0);
 expect((await db.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[owner.tenantId,'scan-sale:'+key])).rows).toHaveLength(0);
 const retry=await post(body,key);expect(retry.status).toBe(201);expect((await post(body,key)).body.sale_id).toBe(retry.body.sale_id);expect(await state()).toEqual({stock:2,sales:1});
});
test('repeated scan lines consume aggregate stock; overselling fails atomically',async()=>{
 const body={...payload(),items:[{barcode:p.barcode,count:2},{barcode:p.barcode,count:2}]};expect((await post(body,crypto.randomUUID())).status).toBe(409);expect(await state()).toEqual({stock:3,sales:0});
 body.items[0].count=1;body.items[1].count=2;expect((await post(body,crypto.randomUUID())).status).toBe(201);expect(await state()).toEqual({stock:0,sales:1});
});
test.each([-1,'NaN',true,0.0000001])('invalid weighted quantity %s never writes stock or sale',async quantity=>{
 await db.query("UPDATE products SET unit='kg' WHERE id=$1",[p.id]);const body=payload();body.items[0].quantity=quantity;expect((await post(body,crypto.randomUUID())).status).toBe(400);expect(await state()).toEqual({stock:3,sales:0});
});
