const request=require('supertest'),crypto=require('crypto'),jwt=require('jsonwebtoken'),app=require('../../src/index'),db=require('../../src/config/database'),adapter=require('../../src/config/mysqlAdapter');
let tenant,a,b,foreign,p,owner,limited,empty;
const insert=async(sql,p)=>(await db.query(sql+' RETURNING *',p)).rows[0],key=()=>crypto.randomUUID();
const api=(user,method,path,body)=>request(app)[method]('/api/'+path).set('Authorization','Bearer '+user.token).set('Idempotency-Key',key()).send(body);
async function account(tenantId,mode,warehouses){const u=await insert("INSERT INTO users(tenant_id,email,password_hash,role) VALUES($1,$2,'disabled','manager')",[tenantId,key()+'@test.invalid']);await db.query('UPDATE user_access_scopes SET mode=$1 WHERE user_id=$2',[mode,u.id]);for(const w of warehouses)await db.query('INSERT INTO user_warehouse_access(user_id,warehouse_id,tenant_id) VALUES($1,$2,$3)',[u.id,w.id,tenantId]);return {...u,token:jwt.sign({userId:u.id,tenantId},require('../../src/middlewares/authMiddleware').JWT_SECRET,{expiresIn:'1h'})};}
beforeAll(async()=>{await db.ready;tenant=await insert('INSERT INTO tenants(tenant_code,company_name,email) VALUES($1,$2,$3)',[key(),'Firma A',key()+'@test.invalid']);const other=await insert('INSERT INTO tenants(tenant_code,company_name,email) VALUES($1,$2,$3)',[key(),'Firma B',key()+'@test.invalid']);for(const t of [tenant,other])await db.query("INSERT INTO licenses(tenant_id,license_key,expires_at,enabled_features_json) VALUES($1,$2,'2030-01-01',$3)",[t.id,key(),JSON.stringify({module_type:'NORMAL'})]);a=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,'Depo A','MAIN')",[tenant.id]);b=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,'Depo B','MAIN')",[tenant.id]);foreign=await insert("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,'Depo yabancı','MAIN')",[other.id]);p=await insert("INSERT INTO products(tenant_id,sku,name,barcode,sale_price,module_type) VALUES($1,$2,'API kapsam ürünü',$3,1.23,'NORMAL')",[tenant.id,key(),'000'+key()]);for(const w of [a,b])await db.query('INSERT INTO stock_records(tenant_id,product_id,warehouse_id,quantity) VALUES($1,$2,$3,$4)',[tenant.id,p.id,w.id,w===a?5:9]);owner=await account(tenant.id,'company',[]);limited=await account(tenant.id,'restricted',[a]);empty=await account(tenant.id,'restricted',[]);});
afterAll(async()=>adapter.getMySQLPool()?.end());
test('HTTP lists/details/search reject second warehouse, second firm and empty assignments',async()=>{
 const list=await api(limited,'get','warehouses');expect(list.status).toBe(200);expect(list.body.map(w=>w.id)).toEqual([a.id]);
 expect((await api(owner,'get','warehouses')).body.map(w=>w.id)).toEqual(expect.arrayContaining([a.id,b.id]));
 for(const id of [b.id,foreign.id])expect((await api(limited,'get','warehouses/'+id)).status).toBe(404);
 for(const path of ['warehouses','stock/records','scanner/search?q=API'])expect((await api(empty,'get',path)).status).toBe(403);
 const records=await api(limited,'get','stock/records');expect(records.status).toBe(200);expect(records.body.every(r=>r.warehouse_id===a.id)).toBe(true);
 const search=await api(limited,'get','scanner/search?q=API');expect(search.status).toBe(200);expect(JSON.stringify(search.body)).not.toContain('Depo B');
});
test('HTTP report/export and writes apply server warehouse scope',async()=>{
 const opened=await api(owner,'post','scanner/shifts/open',{warehouse_id:a.id,opening_cash:20});expect(opened.status).toBe(201);
 expect((await api(limited,'post','scanner/sale',{warehouse_id:b.id,items:[{barcode:p.barcode,count:1}],payment_method:'cash'})).status).toBe(404);
 const sale=await api(limited,'post','scanner/sale',{warehouse_id:a.id,items:[{barcode:p.barcode,count:1}],payment_method:'cash'});expect(sale.status).toBe(201);
 expect((await api(limited,'get','scanner/day-report?warehouse_id='+b.id)).status).toBe(404);
 const report=await api(limited,'get','scanner/day-report?warehouse_id='+a.id);expect(report.status).toBe(200);expect(report.body.sales_cents).toBe(123);
 const output=await api(limited,'get','scanner/gross-profit?format=csv&warehouse_id='+a.id);expect(output.status).toBe(200);expect(output.headers['content-type']).toContain('text/csv');
 const denied=await api(limited,'get','scanner/gross-profit?format=csv&warehouse_id='+b.id);expect(denied.status).toBe(404);
});
