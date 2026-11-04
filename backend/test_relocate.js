const request = require('supertest');
const app = require('./src/index');
const pool = require('./src/config/database');
const { createTenant, createWarehouse, createProduct } = require('./tests/factories/index');

async function run() {
  const tenant = await createTenant();
  const authToken = tenant.token;
  const warehouse = await createWarehouse(tenant.tenantId);
  const warehouseId = warehouse.id;
  const prod = await createProduct(tenant.tenantId);
  const testProductId = prod.id;
  
  const locRes = await pool.query('INSERT INTO warehouse_locations (tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position) VALUES ($1, $2, $3, $4, $5, 1, 1, 1) RETURNING id', [tenant.tenantId, warehouseId, 'A-01-' + Math.random().toString(), 'Zone A', 'A1']);
  const sampleLocationId = locRes.rows[0].id;
  const targetLoc = await pool.query('INSERT INTO warehouse_locations (tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position) VALUES ($1, $2, $3, $4, $5, 1, 1, 2) RETURNING id', [tenant.tenantId, warehouseId, 'A-02-' + Math.random().toString(), 'Zone A', 'A1']);
  const targetLocId = targetLoc.rows[0].id;

  await pool.query('INSERT INTO product_bin_records (tenant_id, product_id, location_id, quantity) VALUES ($1, $2, $3, 100)', [tenant.tenantId, testProductId, sampleLocationId]);

  const res = await request(app)
    .post('/api/wms/locations/relocate')
    .set('Authorization', 'Bearer ' + authToken)
    .send({
      warehouse_id: warehouseId,
      source_location_id: sampleLocationId,
      target_location_id: targetLocId,
      product_id: testProductId,
      quantity: 5
    });
  
  console.log('Result:', res.statusCode, res.body);
  process.exit(0);
}
run();
