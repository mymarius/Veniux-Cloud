jest.mock('../src/services/nvidiaAIService',()=>({complete:jest.fn()}));
const request=require('supertest');
const app=require('../src/index');
const db=require('../src/config/database');
const monitor=require('../src/services/assistantMonitor');
const {complete}=require('../src/services/nvidiaAIService');
const {createTenant}=require('./factories');
let a,b,sku,actor;
beforeAll(async()=>{a=await createTenant();b=await createTenant();sku=(await db.query('SELECT sku FROM products WHERE tenant_id=$1 LIMIT 1',[a.tenantId])).rows[0].sku;actor={...a,role:'admin',moduleType:'BOTH'};});
test('a natural-language request prepares a card and only explicit approval creates the product',async()=>{
 complete.mockResolvedValue(JSON.stringify({reply:'Ürünü hazırlıyorum.',action:{kind:'product_create',args:{sku:'AI-NEW',name:'Kalem',unit:'adet',sale_price:25}}}));
 const response=await request(app).post('/api/ai/chat').set('Authorization','Bearer '+a.token).send({message:'AI-NEW kodlu Kalem ürününü adet birimiyle, satış fiyatı 25 olarak ekle'});
 expect(response.status).toBe(200);expect(response.body.proposal.confirmation_required).toBe(true);
 expect((await db.query("SELECT id FROM products WHERE sku='AI-NEW'")).rows).toHaveLength(0);
 await monitor.execute(actor,{id:response.body.proposal.id,confirmed:true});
 expect((await db.query("SELECT tenant_id,sale_price FROM products WHERE sku='AI-NEW'")).rows[0]).toMatchObject({tenant_id:a.tenantId,sale_price:25});
});
test('foreign products and stale updates cannot be changed',async()=>{
 const foreign=(await db.query('SELECT sku FROM products WHERE tenant_id=$1 LIMIT 1',[b.tenantId])).rows[0].sku;
 await expect(monitor.prepare(actor,{kind:'product_update',args:{sku:foreign,changes:{sale_price:10}}})).rejects.toMatchObject({status:404});
 const p=await monitor.prepare(actor,{kind:'product_update',args:{sku,changes:{sale_price:12}}});
 await db.query('UPDATE products SET sale_price=99 WHERE tenant_id=$1 AND sku=$2',[a.tenantId,sku]);
 await expect(monitor.execute(actor,{id:p.id,confirmed:true})).rejects.toMatchObject({status:409});
});
test('stock requests reject negative balances and stale quantities',async()=>{
 await expect(monitor.prepare(actor,{kind:'stock_adjust',args:{sku,warehouse_name:'Test Depo',amount:-5,note:'Çıkış'}})).rejects.toMatchObject({status:400});
 const p=await monitor.prepare(actor,{kind:'stock_adjust',args:{sku,warehouse_name:'Test Depo',amount:5,note:'Mal kabul'}});
 await monitor.execute(actor,{id:p.id,confirmed:true});
 const second=await monitor.prepare(actor,{kind:'stock_adjust',args:{sku,warehouse_name:'Test Depo',amount:-2,note:'Çıkış'}});
 await db.query('UPDATE stock_records SET quantity=6 WHERE tenant_id=$1',[a.tenantId]);
 await expect(monitor.execute(actor,{id:second.id,confirmed:true})).rejects.toMatchObject({status:409});
});
test('CRM tasks use revision protection and approved completion',async()=>{
 const p=await monitor.prepare(actor,{kind:'crm_task_create',args:{title:'Tedarikçiyi ara',dueDate:'2026-10-04'}});await monitor.execute(actor,{id:p.id,confirmed:true});
 const finish=await monitor.prepare(actor,{kind:'crm_task_complete',args:{title:'Tedarikçiyi ara'}});await monitor.execute(actor,{id:finish.id,confirmed:true});
 const data=JSON.parse((await db.query("SELECT payload FROM workspace_collections WHERE tenant_id=$1 AND scope='crm'",[a.tenantId])).rows[0].payload);expect(data.tasks[0].status).toBe('completed');
});
test('audit failure rolls back the operation',async()=>{
 const p=await monitor.prepare(actor,{kind:'supplier_create',args:{name:'Yeni Tedarikçi'}});
 const transaction=db.transaction;
 const failure=jest.spyOn(db,'transaction').mockImplementation(work=>transaction(async client=>{
  const query=client.query.bind(client);
  client.query=(sql,params)=>/INSERT INTO audit_logs/i.test(sql)?Promise.reject(new Error('audit unavailable')):query(sql,params);
  return work(client);
 }));
 try{
  await expect(monitor.execute(actor,{id:p.id,confirmed:true})).rejects.toThrow('audit unavailable');
  expect((await db.query("SELECT id FROM suppliers WHERE tenant_id=$1 AND name='Yeni Tedarikçi'",[a.tenantId])).rows).toHaveLength(0);
 }finally{failure.mockRestore();}
});

test('deletion needs separate explicit consent and stays bound to the target and tenant',async()=>{
 const task=await monitor.prepare(actor,{kind:'crm_task_create',args:{title:'Silme testi',dueDate:'2026-10-04'}});
 await monitor.execute(actor,{id:task.id,confirmed:true});
 const removal=await monitor.prepare(actor,{kind:'crm_task_delete',args:{title:'Silme testi'}});
 expect(removal.deletion_required).toBe(true);
 await expect(monitor.execute(actor,{id:removal.id,confirmed:true})).rejects.toMatchObject({status:400});
 await expect(monitor.execute({...actor,tenantId:b.tenantId},{id:removal.id,confirmed:true,deletion_confirmed:true})).rejects.toMatchObject({status:409});
 await monitor.execute(actor,{id:removal.id,confirmed:true,deletion_confirmed:true});
 const data=JSON.parse((await db.query("SELECT payload FROM workspace_collections WHERE tenant_id=$1 AND scope='crm'",[a.tenantId])).rows[0].payload);
 expect(data.tasks.some(t=>t.title==='Silme testi')).toBe(false);
 expect(data.tasks.some(t=>t.title==='Tedarikçiyi ara')).toBe(true);
 await expect(monitor.execute(actor,{id:removal.id,confirmed:true,deletion_confirmed:true})).rejects.toMatchObject({status:409});
});
