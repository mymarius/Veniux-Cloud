const db=require('../src/config/database');
const {createTenant}=require('./factories');
const {briefing,compose,parseSince,displayName}=require('../src/services/assistantBriefing');
let a,b;
const count=async table=>Number((await db.query(`SELECT COUNT(*) c FROM ${table}`)).rows[0].c);
beforeAll(async()=>{
 a=await createTenant();b=await createTenant();
 await db.query('UPDATE users SET full_name=$1 WHERE id=$2',['Ayşe Test',a.userId]);
 await db.query("INSERT INTO alerts (tenant_id,alert_type,severity,message,status) VALUES ($1,'test','critical','A','unread')",[a.tenantId]);
 await db.query("INSERT INTO alerts (tenant_id,alert_type,severity,message,status) VALUES ($1,'test','critical','Gizli B','unread')",[b.tenantId]);
 await db.query('INSERT INTO products (tenant_id,sku,name,min_stock_level) VALUES ($1,$2,$3,5)',[b.tenantId,'gizli-b','Gizli B ürünü']);
});
test('greets by name and states recorded facts',async()=>{
 const r=await briefing({tenantId:a.tenantId,userId:a.userId},new Date(Date.now()-3600000).toISOString());
 expect(r.greeting).toBe('Hoş geldiniz Ayşe Test efendim.');
 expect(r.facts.critical).toBe(1);
 expect(r.speech).toContain('1 açık uyarı');
});
test('never includes another tenant',async()=>{
 const r=await briefing({tenantId:a.tenantId,userId:a.userId},null);
 expect(JSON.stringify(r)).not.toContain('Gizli B');
 expect(r.facts.alerts).toBe(1);
});
test('first visit makes no since-last-login claim',async()=>{
 const r=await briefing({tenantId:a.tenantId,userId:a.userId},null);
 expect(r.since).toBeNull();
 expect(r.lines.join(' ')).not.toContain('Son girişinizden');
});
test('reports waiting draft orders of this tenant only',()=>{
 const base={name:'',since:null,movements:0,run:null,critical:0,alerts:0,low:{total:0,names:[]}};
 expect(compose({...base,drafts:2}).speech).toContain('2 sipariş taslağı onayınızı bekliyor.');
 expect(compose({...base,drafts:2}).speech).not.toContain('yeni bir şey görünmüyor');
 expect(compose(base).speech).not.toContain('taslağı');
});
test('counts drafts per tenant',async()=>{
 const before=(await briefing({tenantId:a.tenantId,userId:a.userId},null)).facts.draft_orders;
 const supplier=(await db.query('INSERT INTO suppliers (tenant_id,name) VALUES ($1,$2) RETURNING id',[b.tenantId,'Gizli tedarikçi'])).rows[0].id;
 await db.query("INSERT INTO purchase_orders (tenant_id,supplier_id,order_no,target_warehouse_id,status) VALUES ($1,$2,$3,$4,'draft')",[b.tenantId,supplier,'T-'+b.tenantId,(await db.query('INSERT INTO warehouses (tenant_id,name) VALUES ($1,$2) RETURNING id',[b.tenantId,'Gizli depo'])).rows[0].id]);
 expect((await briefing({tenantId:a.tenantId,userId:a.userId},null)).facts.draft_orders).toBe(before);
 expect((await briefing({tenantId:b.tenantId,userId:b.userId},null)).facts.draft_orders).toBe(1);
});
test('is read-only',async()=>{
 const before=[await count('alerts'),await count('products'),await count('stock_movements')];
 await briefing({tenantId:a.tenantId,userId:a.userId},new Date(0).toISOString());
 expect([await count('alerts'),await count('products'),await count('stock_movements')]).toEqual(before);
});
test('rejects bad input safely',()=>{
 for(const v of ['x',{},undefined,new Date(Date.now()+864e5).toISOString()])expect(parseSince(v)).toBeNull();
 expect(displayName({full_name:'a@b.c'})).toBe('');
});
