const db = require('../../src/config/database');
const monitor = require('../../src/services/stockLossMonitor');
const { createTenant } = require('../factories');

test('kayıp izleme MySQL üzerinde belgesiz düşüşü bir kez bildirir', async () => {
  await db.ready;
  const owner = await createTenant();
  const warehouse = (await db.query('INSERT INTO warehouses (tenant_id,name,type,warehouse_type,capacity) VALUES ($1,$2,$3,$4,$5) RETURNING *', [owner.tenantId, 'İzleme', 'main', 'NORMAL', 100])).rows[0];
  const product = (await db.query('INSERT INTO products (tenant_id,sku,name,category,unit,purchase_price,sale_price,min_stock_level,max_stock_level,module_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [owner.tenantId, 'L-' + owner.tenantId, 'İzlenen', 'A', 'adet', 10, 20, 1, 100, 'NORMAL'])).rows[0];
  await db.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source) VALUES ($1,$2,$3,-8,'outbound','manual')", [owner.tenantId, product.id, warehouse.id]);
  await monitor.run(owner.tenantId);
  await monitor.run(owner.tenantId);
  const alerts = (await db.query("SELECT * FROM alerts WHERE tenant_id=$1 AND alert_type='loss_suspicion'", [owner.tenantId])).rows;
  expect(alerts).toHaveLength(1);
  expect(alerts[0].message).toContain('belgesiz 8 adet');
});
