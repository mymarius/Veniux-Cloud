const db = require('../src/config/database');
const monitor = require('../src/services/assistantMonitor');
let tenant, otherTenant, alertId;
const actor = () => ({ tenantId: tenant, userId: 10, email: 'manager@test.local', moduleType: 'NORMAL' });
beforeAll(async () => {
  await db.ready;
  tenant = Number((await db.query("INSERT INTO tenants (tenant_code,company_name,email) VALUES ('monitor-a','A','a@test.local')")).lastInsertRowid);
  otherTenant = Number((await db.query("INSERT INTO tenants (tenant_code,company_name,email) VALUES ('monitor-b','B','b@test.local')")).lastInsertRowid);
  alertId = Number((await db.query("INSERT INTO alerts (tenant_id,alert_type,severity,message,status) VALUES ($1,'test','critical','Firma A uyarısı','unread')", [tenant])).lastInsertRowid);
  await db.query("INSERT INTO alerts (tenant_id,alert_type,severity,message,status) VALUES ($1,'test','critical','Firma B özel uyarısı','unread')", [otherTenant]);
  for(let i=0;i<205;i++) await db.query('INSERT INTO products (tenant_id,sku,name,min_stock_level) VALUES ($1,$2,$3,2)', [tenant, `monitor-${i}`, `Ürün ${i}`]);
});
test('overview counts all products and isolates tenant data', async () => {
  const data = await monitor.overview(actor());
  expect(data.totals.product_count).toBe(205);
  expect(data.totals.low_stock).toBe(205);
  expect(data.totals.open_alerts).toBe(1);
  expect(JSON.stringify(data)).not.toContain('Firma B');
});
test('changes require explicit approval, belong to the actor and tenant, and cannot replay', async () => {
  const p = await monitor.prepare(actor(), {kind:'alert_read',alert_id:alertId});
  await expect(monitor.execute(actor(),{id:p.id})).rejects.toMatchObject({status:400});
  await expect(monitor.execute({...actor(),tenantId:otherTenant},{id:p.id,confirmed:true})).rejects.toMatchObject({status:409});
  await expect(monitor.execute({...actor(),userId:11},{id:p.id,confirmed:true})).rejects.toMatchObject({status:409});
  expect((await db.query('SELECT status FROM alerts WHERE id=$1',[alertId])).rows[0].status).toBe('unread');
  await expect(monitor.execute(actor(),{id:p.id,confirmed:true})).resolves.toHaveProperty('reply');
  expect((await db.query('SELECT status FROM alerts WHERE id=$1',[alertId])).rows[0].status).toBe('read');
  expect((await db.query("SELECT COUNT(*) count FROM audit_logs WHERE tenant_id=$1 AND action='assistant_alert_read_approved'",[tenant])).rows[0].count).toBe(1);
  await expect(monitor.execute(actor(),{id:p.id,confirmed:true})).rejects.toMatchObject({status:409});
});
test('unsupported actions and another tenant alert cannot be prepared', async () => {
  await expect(monitor.prepare(actor(),{kind:'delete_products'})).rejects.toMatchObject({status:400});
  await expect(monitor.prepare({...actor(),tenantId:otherTenant},{kind:'alert_read',alert_id:alertId})).rejects.toMatchObject({status:404});
});
test('expired approvals cannot execute', async () => {
  const p = await monitor.prepare(actor(),{kind:'analysis'});
  const now = Date.now(); const spy = jest.spyOn(Date,'now').mockReturnValue(now+6*60000);
  try { await expect(monitor.execute(actor(),{id:p.id,confirmed:true})).rejects.toMatchObject({status:409}); } finally { spy.mockRestore(); }
});
