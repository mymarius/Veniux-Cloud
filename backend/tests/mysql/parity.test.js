const db=require('../../src/config/database'),scope=require('../../src/services/scopeQueryContext'),crypto=require('crypto');
const mysql=require('../../src/config/mysqlAdapter');
let a,b,wa,wb,wForeign,user;
const insert=async(sql,p)=> (await db.query(sql+' RETURNING *',p)).rows[0];
beforeAll(async()=>{
 await db.ready;
 a=await insert('INSERT INTO tenants(tenant_code,name,company_name,email) VALUES($1,$2,$2,$1)',['T-'+crypto.randomUUID(),'Firma A']);
 b=await insert('INSERT INTO tenants(tenant_code,name,company_name,email) VALUES($1,$2,$2,$1)',['T-'+crypto.randomUUID(),'Firma B']);
 wa=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,$2,'MAIN')",[a.id,'Depo A']);
 wb=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,$2,'MAIN')",[a.id,'Depo B']);
 wForeign=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,$2,'MAIN')",[b.id,'Yabancı']);
 user=await insert('INSERT INTO users(tenant_id,email,password_hash,role) VALUES($1,$2,$3,$4)',[a.id,crypto.randomUUID()+'@test.invalid','disabled','admin']);
});
afterAll(async()=>{await mysql.getMySQLPool()?.end();});
test('all SQLite migration tables, columns, relations and 11 triggers exist in live MySQL',async()=>{
 const {manifest}=require('../../src/database/mysqlMigrator');const pool=mysql.getMySQLPool();
 for(const t of manifest.tables){const [columns]=await pool.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[t.name]);expect(columns.map(v=>v.COLUMN_NAME)).toEqual(expect.arrayContaining(t.columns.map(v=>v.name)));}
 const [triggers]=await pool.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()');expect(triggers).toHaveLength(11);
 expect(await db.migrationStatus()).toMatchObject({status:'current'});
});
test('company and warehouse reads, nested searches, reports and writes are isolated',async()=>{
 await scope.run({tenantId:a.id,mode:'restricted',warehouse_ids:[wa.id]},async()=>{
  expect((await db.query('SELECT id FROM warehouses ORDER BY id')).rows).toEqual([{id:wa.id}]);
  expect((await db.query('SELECT w.id,(SELECT COUNT(*) FROM warehouses) n FROM warehouses w WHERE name LIKE $1',['%Depo%'])).rows).toEqual([{id:wa.id,n:1}]);
  expect((await db.query('WITH chosen AS (SELECT * FROM warehouses) SELECT id FROM chosen')).rows).toEqual([{id:wa.id}]);
  expect((await db.query('UPDATE warehouses SET capacity=77 WHERE id=$1 OR id=$2',[wa.id,wb.id])).rowCount).toBe(1);
  const tx=await db.connect();try{await tx.query('BEGIN');expect((await tx.query('SELECT id FROM warehouses')).rows).toEqual([{id:wa.id}]);expect((await tx.query('DELETE FROM warehouses WHERE id=$1',[wb.id])).rowCount).toBe(0);await tx.query('ROLLBACK');}finally{tx.release();}
  await expect(db.query('SELECT * FROM main.warehouses')).rejects.toMatchObject({status:403});
 });
 await scope.run({tenantId:a.id,mode:'company',warehouse_ids:[]},async()=>expect((await db.query('SELECT id FROM warehouses ORDER BY id')).rows).toEqual([{id:wa.id},{id:wb.id}]));
 await scope.run({tenantId:a.id,mode:'restricted',warehouse_ids:[]},async()=>expect((await db.query('SELECT id FROM warehouses')).rows).toEqual([]));
 await scope.run({tenantId:null,mode:'company',warehouse_ids:[]},async()=>expect(db.query('SELECT id FROM warehouses')).rejects.toMatchObject({status:403}));
});
test('cross-company access assignments fail and new users receive restricted scope',async()=>{
 expect((await db.query('SELECT mode FROM user_access_scopes WHERE user_id=$1',[user.id])).rows[0].mode).toBe('restricted');
 await expect(db.query('INSERT INTO user_warehouse_access(user_id,warehouse_id,tenant_id) VALUES($1,$2,$3)',[user.id,wForeign.id,a.id])).rejects.toMatchObject({code:'ER_SIGNAL_EXCEPTION'});
});
test('separate connections serialize last-stock updates and rollback on release',async()=>{
 const p=await insert('INSERT INTO products(tenant_id,sku,name,barcode) VALUES($1,$2,$3,$4)',[a.id,crypto.randomUUID(),'Sıfırlı barkod','0000123456789']);
 await db.query('INSERT INTO stock_records(tenant_id,product_id,warehouse_id,quantity) VALUES($1,$2,$3,$4)',[a.id,p.id,wa.id,'1.000001']);
 const clients=await Promise.all([db.connect(),db.connect()]);
 try{const results=await Promise.all(clients.map(async tx=>{await tx.query('BEGIN');const stock=(await tx.query('SELECT id,quantity FROM stock_records WHERE product_id=$1',[p.id])).rows[0];const ok=Number(stock.quantity)>=1;if(ok)await tx.query('UPDATE stock_records SET quantity=quantity-1 WHERE id=$1',[stock.id]);await tx.query('COMMIT');return ok;}));expect(results.filter(Boolean)).toHaveLength(1);}finally{clients.forEach(c=>c.release());}
 expect((await db.query('SELECT quantity FROM stock_records WHERE product_id=$1',[p.id])).rows[0].quantity).toBe('0.000001');
 expect((await db.query('SELECT barcode FROM products WHERE id=$1',[p.id])).rows[0].barcode).toBe('0000123456789');
});
test('partial index equivalence and immutable closed shift protect concurrent opening',async()=>{
 const register=await insert('INSERT INTO retail_registers(tenant_id,warehouse_id,name) VALUES($1,$2,$3)',[a.id,wa.id,'Kasa']);
 const sql="INSERT INTO retail_shifts(tenant_id,register_id,warehouse_id,user_id,opened_by_email,opening_cash_cents) VALUES($1,$2,$3,$4,$5,$6)";
 const params=[a.id,register.id,wa.id,user.id,user.email,12345];
 const c1=await mysql.getMySQLPool().getConnection(),c2=await mysql.getMySQLPool().getConnection();
 try{const result=await Promise.allSettled([mysql.executeMySQLQuery(sql,params,c1),mysql.executeMySQLQuery(sql,params,c2)]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(result.find(r=>r.status==='rejected').reason.code).toBe('ER_DUP_ENTRY');}finally{c1.release();c2.release();}
 await db.query("UPDATE retail_shifts SET status='closed' WHERE register_id=$1",[register.id]);
 await expect(db.query('UPDATE retail_shifts SET opening_cash_cents=0 WHERE register_id=$1',[register.id])).rejects.toMatchObject({code:'ER_SIGNAL_EXCEPTION'});
 await db.query(sql,params);
});
