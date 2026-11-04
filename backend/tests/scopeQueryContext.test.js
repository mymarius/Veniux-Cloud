const db=require('../src/config/database'),request=require('supertest'),app=require('../src/index'),fs=require('fs'),path=require('path'),Database=require('better-sqlite3');
const {createTenant,createWarehouse}=require('./factories');const context=require('../src/services/scopeQueryContext');
let owner,a,b,scope;
beforeAll(async()=>{owner=await createTenant();a=await createWarehouse(owner.tenantId);b=await createWarehouse(owner.tenantId);scope={tenantId:owner.tenantId,mode:'restricted',warehouse_ids:[a.id]};});
test('scope-aware reads preserve joins, aliases, nested subqueries and existing CTEs',async()=>{
 await context.run(scope,async()=>{
  expect((await db.query('SELECT id FROM warehouses ORDER BY id')).rows).toEqual([{id:a.id}]);
  expect((await db.query('WITH chosen AS (SELECT * FROM warehouses) SELECT chosen.id FROM chosen')).rows).toEqual([{id:a.id}]);
  const r=await db.query("SELECT w.id,(SELECT COUNT(*) FROM warehouses) AS amount,'warehouses main.stock_records' AS literal FROM warehouses w");expect(r.rows).toEqual([{id:a.id,amount:1,literal:'warehouses main.stock_records'}]);
 });
});
test('write predicates preserve OR precedence and RETURNING; out-of-scope update/delete change no records',async()=>{
 await context.run(scope,async()=>{
  const changed=await db.query('UPDATE warehouses SET capacity=42 WHERE id=$1 OR id=$2 RETURNING id',[a.id,b.id]);expect(changed.rows).toEqual([{id:a.id}]);
  expect((await db.query('DELETE FROM warehouses WHERE id=$1',[b.id])).rowCount).toBe(0);
 });
 expect((await db.query('SELECT capacity FROM warehouses WHERE id=$1',[b.id])).rows[0].capacity).not.toBe(42);
});
test('parallel request contexts cannot exchange warehouse scope',async()=>{
 const results=await Promise.all([a,b].map(wh=>context.run({...scope,warehouse_ids:[wh.id]},async()=>{await new Promise(resolve=>setImmediate(resolve));return(await db.query('SELECT id FROM warehouses')).rows;})));
 expect(results).toEqual([[{id:a.id}],[{id:b.id}]]);
});
test('raw physical table or unsupported write syntax fails closed',async()=>{
 await context.run(scope,async()=>{
  await expect(db.query('SELECT * FROM main.warehouses')).rejects.toMatchObject({status:403});
  await expect(db.query('WITH x AS (SELECT id FROM warehouses) UPDATE warehouses SET capacity=123')).rejects.toMatchObject({status:403});
 });
});
test('one-time migration explicitly grants legacy admins, closes other users and defaults new employees to no scope',()=>{
 const raw=new Database(':memory:');raw.pragma('foreign_keys=ON');
 raw.exec("CREATE TABLE tenants(id INTEGER PRIMARY KEY);CREATE TABLE users(id INTEGER PRIMARY KEY,tenant_id INTEGER,role TEXT);CREATE TABLE warehouses(id INTEGER PRIMARY KEY,tenant_id INTEGER);CREATE TABLE audit_logs(tenant_id INTEGER,user_email TEXT,action TEXT,entity_type TEXT,entity_id INTEGER,details TEXT);INSERT INTO tenants VALUES(1),(2);INSERT INTO users VALUES(1,1,'admin'),(2,1,'manager'),(3,1,'cashier'),(4,1,'operator');INSERT INTO warehouses VALUES(1,1),(2,2);");
 raw.exec(fs.readFileSync(path.join(__dirname,'../src/database/migrations/027_user_warehouse_scope.sql'),'utf8'));
 expect(raw.prepare('SELECT user_id,mode FROM user_access_scopes ORDER BY user_id').all()).toEqual([{user_id:1,mode:'company'},{user_id:2,mode:'restricted'},{user_id:3,mode:'restricted'},{user_id:4,mode:'restricted'}]);
 expect(raw.prepare('SELECT COUNT(*) n FROM user_warehouse_access').get().n).toBe(0);
 expect(raw.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='access.scope_migrated'").get().n).toBe(4);
 raw.exec("INSERT INTO users VALUES(5,1,'admin')");expect(raw.prepare('SELECT mode FROM user_access_scopes WHERE user_id=5').get().mode).toBe('restricted');
 expect(()=>raw.exec('INSERT INTO user_warehouse_access VALUES(2,2,1)')).toThrow('tenant mismatch');raw.close();
});
