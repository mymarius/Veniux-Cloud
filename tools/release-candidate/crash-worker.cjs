// Disposable child process. Parent kills only this process at a known DB boundary.
if(process.env.NODE_ENV!=='test'||process.env.VENIUX_RC_CRASH!=='1')throw Error('RC fixture only');
const fs=require('node:fs'),path=require('node:path'),db=require('../../backend/src/config/database');
let stage="create-tenant";
(async()=>{
 const f=require('../../backend/tests/factories'),owner=await f.createTenant(),wh=await f.createWarehouse(owner.tenantId);await f.openTestShift(owner,wh.id);
 stage='prepare-product';const p=(await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,'RC-CRASH','RC-CRASH','Crash fixture','adet',10,20,'NORMAL') RETURNING *",[owner.tenantId])).rows[0];
 await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,5)',[owner.tenantId,wh.id,p.id]);
 fs.writeFileSync(path.join(process.env.VENIUX_DATA_DIR,'fixture.json'),JSON.stringify({tenant:owner.tenantId,warehouse:wh.id,product:p.id}));
 const original=db.transaction;
 if(process.env.VENIUX_RC_CRASH_POINT==='before-commit')db.transaction=work=>original(tx=>work({...tx,query:async(sql,args)=>{if(/INSERT INTO retail_sales\b/.test(sql)){process.send({point:'before-commit'});await new Promise(()=>{});}return tx.query(sql,args);}}));
 stage='post-sale';const r=await require('../../backend/node_modules/supertest')(require('../../backend/src/index')).post('/api/scanner/sale').set('Authorization','Bearer '+owner.token).set('Idempotency-Key','rc-process-crash').send({warehouse_id:wh.id,payment_method:'cash',items:[{barcode:p.barcode,count:1}]});
 if(r.status!==201)throw Error('Fixture sale failed');process.send({point:'after-commit'});await new Promise(()=>{});
})().catch(e=>{process.send?.({error:e.code||e.name,stage,location:String(e.stack||'').split('\n').filter(x=>x.includes('crash-worker.cjs')).map(x=>x.trim())});process.exit(1);});
