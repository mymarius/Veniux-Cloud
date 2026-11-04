jest.mock('../src/services/nvidiaAIService',()=>({complete:jest.fn()}));
const request=require('supertest');
const app=require('../src/index');
const db=require('../src/config/database');
const system=require('../src/services/assistantSystemOperations');
const monitor=require('../src/services/assistantMonitor');
const {createTenant}=require('./factories');
const {complete}=require('../src/services/nvidiaAIService');
let a,b,user,context;
beforeAll(async()=>{a=await createTenant();b=await createTenant();user={...a,role:'admin',moduleType:'BOTH'};context={headers:{authorization:'Bearer '+a.token}};});
test('catalog connects every mounted JSON business route and rejects arbitrary URLs',()=>{
 const list=system.list(user);
 expect(list.some(o=>o.id==='wms:POST:/picking/waves')).toBe(true);
 expect(list.some(o=>/pharmacy|eczane|medicines/.test(o.scope))).toBe(false);
 expect(list.some(o=>o.id==='settings:PUT:/company')).toBe(true);
 expect(list.some(o=>o.scope==='platform')).toBe(false);
 expect(()=>system.resolve(user,{operation:'http://evil.example'})).toThrow();
 expect(()=>system.resolve(user,{operation:'products:DELETE:/:id',params:{id:'../settings/users'}})).toThrow();
});
test('preparation never enters a controller; execution reuses its validation and tenant isolation',async()=>{
 const p=await monitor.prepare(user,{kind:'system_operation',args:{operation:'suppliers:POST:/',body:{name:'Sistem asistanı tedarikçisi',lead_time_days:4}}},context);
 expect((await db.query('SELECT id FROM suppliers WHERE tenant_id=$1 AND name=$2',[a.tenantId,'Sistem asistanı tedarikçisi'])).rows).toHaveLength(0);
 await expect(monitor.execute(user,{id:p.id,confirmed:false},context)).rejects.toMatchObject({status:400});
 const result=await monitor.execute(user,{id:p.id,confirmed:true},context);
 expect(result.source_operation).toBe('suppliers:POST:/');
 expect((await db.query('SELECT id FROM suppliers WHERE tenant_id=$1 AND name=$2',[a.tenantId,'Sistem asistanı tedarikçisi'])).rows).toHaveLength(1);
 const foreign=(await db.query('SELECT id FROM products WHERE tenant_id=$1 LIMIT 1',[b.tenantId])).rows[0].id;
 await expect(monitor.prepare(user,{kind:'system_operation',args:{operation:'products:DELETE:/:id',params:{id:foreign}}},context)).rejects.toMatchObject({status:404});
 expect((await db.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2',[foreign,b.tenantId])).rows).toHaveLength(1);
});
test('real route permissions and changed records are checked before execution',async()=>{
 await expect(monitor.prepare(user,{kind:'system_operation',args:{operation:'settings:PUT:/company',body:{name:'X'}}},{headers:{authorization:'Bearer invalid'}})).rejects.toMatchObject({status:401});
 const p=await monitor.prepare(user,{kind:'system_operation',args:{operation:'suppliers:POST:/',body:{name:'Güncelliğini yitiren öneri'}}},context);
 await db.query('UPDATE products SET sale_price=sale_price+1 WHERE tenant_id=$1',[a.tenantId]);
 await expect(monitor.execute(user,{id:p.id,confirmed:true},context)).rejects.toMatchObject({status:409});
});
test('CRM and HR edits preserve other collections and deletion requires separate consent',async()=>{
 const create=await monitor.prepare(user,{kind:'workspace_record',args:{scope:'crm',collection:'companies',mode:'create',values:{name:'Örnek firma'}}},context);
 await monitor.execute(user,{id:create.id,confirmed:true},context);
 const task=await monitor.prepare(user,{kind:'workspace_record',args:{scope:'crm',collection:'tasks',mode:'create',values:{title:'Korunacak görev',dueDate:'2026-10-05'}}},context);
 await monitor.execute(user,{id:task.id,confirmed:true},context);
 const remove=await monitor.prepare(user,{kind:'workspace_record',args:{scope:'crm',collection:'companies',mode:'delete',target:'Örnek firma'}},context);
 expect(remove.deletion_required).toBe(true);
 await expect(monitor.execute(user,{id:remove.id,confirmed:true},context)).rejects.toMatchObject({status:400});
 await monitor.execute(user,{id:remove.id,confirmed:true,deletion_confirmed:true},context);
 const data=(await system.read(user,{operation:'workspaces:GET:/:scope',params:{scope:'crm'}},context)).data;
 expect(data.companies).toHaveLength(0);expect(data.tasks[0].title).toBe('Korunacak görev');
});
test('AI routes accept operation proposals but query cannot mutate or expose secrets',async()=>{
 await expect(system.read(user,{operation:'suppliers:POST:/',body:{name:'No'}},context)).rejects.toMatchObject({status:400});
 expect(system.sanitize({password:'secret',nested:{api_key:'secret',name:'Visible'}})).toEqual({nested:{name:'Visible'}});
 const response=await request(app).get('/api/ai/capabilities').set('Authorization','Bearer '+a.token);
 expect(response.status).toBe(200);expect(response.body.operations.length).toBeGreaterThan(50);
});

test('warehouse, cold-chain and HR operations use the existing controllers',async()=>{
 const warehouse=await monitor.prepare(user,{kind:'system_operation',args:{operation:'warehouses:POST:/',body:{name:'Asistan deposu',type:'MAIN',capacity:100}}},context);
 await monitor.execute(user,{id:warehouse.id,confirmed:true},context);
 const id=(await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 AND name=$2',[a.tenantId,'Asistan deposu'])).rows[0].id;
 await expect(monitor.prepare(user,{kind:'system_operation',args:{operation:'pharmacy:POST:/cold-chain/devices',body:{warehouse_id:id}}},context)).rejects.toMatchObject({status:403});
 const employee=await monitor.prepare(user,{kind:'workspace_record',args:{scope:'hr',collection:'employees',mode:'create',values:{fullName:'Örnek çalışan',status:'aktif'}}},context);
 await monitor.execute(user,{id:employee.id,confirmed:true},context);
 expect((await system.read(user,{operation:'workspaces:GET:/:scope',params:{scope:'hr'}},context)).data.employees[0].fullName).toBe('Örnek çalışan');
});
test('foreign related IDs, missing inputs and identity mismatches are blocked',async()=>{
 const foreign=(await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 LIMIT 1',[b.tenantId])).rows[0].id;
 await expect(monitor.prepare(user,{kind:'system_operation',args:{operation:'pharmacy:POST:/cold-chain/devices',body:{device_name:'Foreign',warehouse_id:foreign}}},context)).rejects.toMatchObject({status:403});
 await expect(monitor.prepare(user,{kind:'system_operation',args:{operation:'warehouses:POST:/',body:{name:'Missing type'}}},context)).rejects.toMatchObject({status:400});
 await expect(monitor.prepare(user,{kind:'system_operation',args:{operation:'suppliers:POST:/',body:{name:'Identity mismatch'}}},{headers:{authorization:'Bearer '+b.token}})).rejects.toMatchObject({status:403});
});
test('uploaded files are tenant-bound and raw operations demand a file before approval',async()=>{
 const uploaded=await system.upload(user,Buffer.from('test-file'),'example.csv','text/csv');
 await expect(system.prepare({...user,tenantId:b.tenantId},{operation:'suppliers:POST:/',body:{name:'No'},file:{upload_id:uploaded.id}},context)).rejects.toMatchObject({status:403});
 const mine=(await request(app).post('/api/ai/actions/files').set('Authorization','Bearer '+a.token).set('Content-Type','application/octet-stream').set('x-file-name','test.csv').send(Buffer.from('example')));
 expect(mine.status).toBe(201);expect(mine.body.id).toBeDefined();
 await expect(system.prepare({...user,...b},{operation:'pharmacy:POST:/import-file',file:{upload_id:uploaded.id}},{headers:{authorization:'Bearer '+b.token}})).rejects.toMatchObject({status:403});
 await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)',[a.userId]);
 try{
  const platform={...user,isPlatformAdmin:true};
  await expect(monitor.prepare(platform,{kind:'system_operation',args:{operation:'admin/medicines:POST:/import'}},context)).rejects.toMatchObject({status:403});
 }finally{await db.query('DELETE FROM platform_admins WHERE user_id=$1',[a.userId]);}
});

test('partial product updates retain unrequested prices and unit',async()=>{
 const p=(await db.query('SELECT id,sku FROM products WHERE tenant_id=$1 LIMIT 1',[a.tenantId])).rows[0];
 await db.query('UPDATE products SET sale_price=125,purchase_price=75,unit=$1 WHERE id=$2',['kutu',p.id]);
 const update=await monitor.prepare(user,{kind:'system_operation',args:{operation:'products:PUT:/:id',params:{id:p.id},body:{name:'Yeniden adlandırılan ürün'}}},context);
 expect(update.impact).toContain('125');
 await monitor.execute(user,{id:update.id,confirmed:true},context);
 expect((await db.query('SELECT sale_price,purchase_price,unit FROM products WHERE id=$1',[p.id])).rows[0]).toEqual({sale_price:125,purchase_price:75,unit:'kutu'});
});
test('WMS wave creation is connected and read results cannot include other tenants',async()=>{
 const warehouse=(await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 LIMIT 1',[a.tenantId])).rows[0].id;
 const product=(await db.query('SELECT id FROM products WHERE tenant_id=$1 LIMIT 1',[a.tenantId])).rows[0].id;
 const p=await monitor.prepare(user,{kind:'system_operation',args:{operation:'wms:POST:/picking/waves',body:{warehouse_id:warehouse,items:[{product_id:product,requested_qty:1}]}}},context);
 const result=await monitor.execute(user,{id:p.id,confirmed:true},context);
 expect(result.result.tenant_id).toBe(a.tenantId);
 const foreignWarehouse=(await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 LIMIT 1',[b.tenantId])).rows[0].id;
 await db.query("INSERT INTO wms_pick_waves (tenant_id,warehouse_id,wave_no) VALUES ($1,$2,'FOREIGN-WAVE')",[b.tenantId,foreignWarehouse]);
 const rows=await system.read(user,{operation:'wms:GET:/picking/waves'},context);
 expect(rows.some(r=>r.wave_no==='FOREIGN-WAVE')).toBe(false);
 expect(rows.every(r=>r.tenant_id===a.tenantId)).toBe(true);
});

test('exports remain tenant-bound and produce an authenticated downloadable artifact',async()=>{
 const result=await system.exportFile(user,{operation:'products:GET:/',format:'csv'},context);
 const id=result.download.url.split('/').at(-1);
 expect(require('fs').existsSync(system.download(user,id).path)).toBe(true);
 expect((await request(app).get('/api'+result.download.url)).status).toBe(401);
 expect(()=>system.download({...user,tenantId:b.tenantId},id)).toThrow();
 const response=await request(app).get('/api'+result.download.url).set('Authorization','Bearer '+a.token);
 expect({status:response.status,error:response.body?.error}).toEqual({status:200,error:undefined});expect(response.headers['content-disposition']).toContain('veniux-products.csv');
 const wrong=await request(app).get('/api'+result.download.url).set('Authorization','Bearer '+b.token);
 expect(wrong.status).toBe(404);
});

test('natural-language system requests prepare a card and invalid model tool names are corrected',async()=>{
 complete.mockResolvedValueOnce(JSON.stringify({reply:'Hazırlıyorum.',action:{kind:'warehouse_create',args:{name:'Sohbet deposu'}}}));
 complete.mockResolvedValueOnce(JSON.stringify({reply:'Hazırlıyorum.',action:{kind:'system_operation',args:{operation:'warehouses:POST:/',body:{name:'Sohbet deposu',type:'MAIN',capacity:250}}}}));
 const response=await request(app).post('/api/ai/chat').set('Authorization','Bearer '+a.token).send({message:'Sohbet deposu adında MAIN türünde, kapasitesi 250 olan yeni depo ekle'});
 expect(response.status).toBe(200);expect(response.body.proposal.confirmation_required).toBe(true);
 expect(response.body.reply).toContain('Onaylıyor musunuz?');
 expect((await db.query('SELECT id FROM warehouses WHERE tenant_id=$1 AND name=$2',[a.tenantId,'Sohbet deposu'])).rows).toHaveLength(0);
});
