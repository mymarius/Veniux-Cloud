// Uzun kullanım ölçümü: yalnız TEST veritabanında (TEST_SQLITE_PATH) büyük sentetik veri üretir.
// Kullanım: NODE_ENV=test TEST_SQLITE_PATH=<yol> node scripts/perf-seed.js [ürün] [satış]
process.env.NODE_ENV='test';
if(!process.env.TEST_SQLITE_PATH){console.error('TEST_SQLITE_PATH zorunlu (gerçek veriye dokunulmaz).');process.exit(1);}
const request=require('supertest'),app=require('../src/index'),db=require('../src/config/database');
const {createTenant,createWarehouse,openTestShift}=require('../tests/factories');
const Database=require('better-sqlite3'),path=require('path');
const P=Number(process.argv[2]||50000),S=Number(process.argv[3]||170000);
(async()=>{
 const owner=await createTenant(),wh=await createWarehouse(owner.tenantId);await openTestShift(owner,wh.id,100);
 await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,purchase_price,module_type) VALUES($1,'SEED-0','Ornek','8690000000000','adet',10,5,'NORMAL')",[owner.tenantId]);
 const pid=(await db.query("SELECT id FROM products WHERE sku='SEED-0'")).rows[0].id;
 await db.query("INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,100000)",[owner.tenantId,wh.id,pid]);
 const sale=await request(app).post('/api/scanner/sale').set('Authorization','Bearer '+owner.token).set('Idempotency-Key','seed-1').send({warehouse_id:wh.id,items:[{barcode:'8690000000000',count:1}],payments:[{method:'cash',amount:10}],cash_received:10});
 if(sale.status!==201)throw Error('örnek satış: '+JSON.stringify(sale.body));
 const tpl=(await db.query('SELECT * FROM retail_sales WHERE sale_id=$1',[sale.body.sale_id])).rows[0];
 const raw=new Database(path.resolve(process.env.TEST_SQLITE_PATH));raw.pragma('journal_mode = WAL');
 const T=owner.tenantId,W=wh.id,t0=Date.now();
 const cats=['Gıda','İçecek','Temizlik','Kırtasiye','Bakliyat','Süt Ürünleri','Atıştırmalık','Hırdavat'];
 raw.transaction(()=>{
  const ip=raw.prepare("INSERT INTO products(tenant_id,sku,name,category,barcode,unit,sale_price,purchase_price,module_type) VALUES(?,?,?,?,?,?,?,?,'NORMAL')"),is=raw.prepare('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES(?,?,?,?)');
  for(let i=1;i<=P;i++){const r=ip.run(T,'SKU'+i,'Urun '+i+' '+['Sut','Ekmek','Makas','Pirinc','Cay'][i%5],cats[i%8],String(8690000000000+i),'adet',5+(i%90),3+(i%50));is.run(T,W,r.lastInsertRowid,1000);}
 })();
 const ids=raw.prepare('SELECT id FROM products WHERE tenant_id=? ORDER BY id').all(T).map(r=>r.id);
 const days=730,start=Date.now()-days*864e5;
 raw.transaction(()=>{
  const ps=raw.prepare("INSERT INTO pos_sales(tenant_id,receipt_no,total_amount,net_amount,payment_method,status,created_at) VALUES(?,?,?,?,'cash','completed',?)"),pi=raw.prepare('INSERT INTO pos_sale_items(tenant_id,sale_id,product_id,quantity,unit_price,total_price) VALUES(?,?,?,?,?,?)'),rs=raw.prepare('INSERT INTO retail_sales(sale_id,tenant_id,warehouse_id,user_id,business_date,snapshot_json,created_at,register_id,shift_id) VALUES(?,?,?,?,?,?,?,?,?)'),sm=raw.prepare("INSERT INTO stock_movements(tenant_id,product_id,warehouse_id,change_amount,movement_type,source,created_at) VALUES(?,?,?,?,'sale','pos',?)"),au=raw.prepare("INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details,created_at) VALUES(?,?,'SALE','sale',?,?,?)");
  for(let i=0;i<S/3.4;i++){ // ~3,4 satır/satış
   const ts=new Date(start+Math.floor(i/(S/3.4)*days*864e5)),iso=ts.toISOString().replace('T',' ').slice(0,19),day=iso.slice(0,10);
   const sid=ps.run(T,'PERF-'+i,30,30,iso).lastInsertRowid;
   rs.run(sid,T,W,tpl.user_id,day,tpl.snapshot_json,iso,tpl.register_id,null);
   for(let k=0;k<3+(i%2);k++){const p=ids[(i*7+k*13)%ids.length];pi.run(T,sid,p,1,10,10);sm.run(T,p,W,-1,iso);}
   au.run(T,'x@y.com',sid,'{"n":1}',iso);
  }
 })();
 console.log(JSON.stringify({tenant:T,warehouse:W,token:owner.token,products:P,seconds:(Date.now()-t0)/1000,counts:Object.fromEntries(['products','pos_sales','pos_sale_items','retail_sales','stock_movements','audit_logs'].map(t=>[t,raw.prepare('select count(*) c from '+t).get().c]))}));
 raw.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
