const request = require('supertest');
const app = require('../../src/index');
const pool = require('../../src/config/database');
const bcrypt = require('bcrypt');

async function createTenant() {
  const email = `owner_${Date.now()}_${Math.floor(Math.random()*1000)}@tenant.com`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    phone: '05551234567', password: 'password123',
    role: 'admin'
  });
  
  if(res.statusCode !== 201) throw new Error('Failed to create tenant: ' + JSON.stringify(res.body));
  
  await pool.query(`
    INSERT INTO licenses (license_key, tenant_id, plan_id, status, max_users, max_warehouses, max_devices, expires_at)
    VALUES ($1, $2, 'ENTERPRISE_ANNUAL', 'ACTIVE', 100, 100, 100, datetime('now', '+1 year'))
  `, [`VNX-TEST-${Date.now()}`, res.body.user.tenant_id]);

  const loginRes = await request(app).post('/api/auth/login').send({
    email,
    phone: '05551234567', password: 'password123'
  });
  
  await createWarehouse(res.body.user.tenant_id);
  await createProduct(res.body.user.tenant_id);
  await createSupplier(res.body.user.tenant_id);
  await seedTestData(res.body.user.tenant_id);

  return {
    tenantId: res.body.user.tenant_id,
    userId: res.body.user.id,
    email: res.body.user.email,
    token: loginRes.body.token
  };
}

async function createUser(tenantId, role = 'viewer', accessScope = {mode:'company',warehouse_ids:[]}) {
  const email = `user_${Date.now()}_${Math.floor(Math.random()*1000)}@tenant.com`;
  const hash = await bcrypt.hash('password123', 10);
  const res = await pool.query(
    'INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role, tenant_id',
    [tenantId, email, hash, role]
  );
  // Historical role tests explicitly provision company scope; application-created
  // employees still default to restricted with zero assignments via migration 027.
  await pool.query('UPDATE user_access_scopes SET mode=$1 WHERE user_id=$2',[accessScope.mode,res.rows[0].id]);
  for(const warehouse of accessScope.warehouse_ids)await pool.query('INSERT INTO user_warehouse_access(user_id,warehouse_id,tenant_id) VALUES($1,$2,$3)',[res.rows[0].id,warehouse,tenantId]);
  return res.rows[0];
}

async function createWarehouse(tenantId) {
  const res = await pool.query(
    "INSERT INTO warehouses (tenant_id, name, type) VALUES ($1, 'Test Depo', 'MAIN') RETURNING id",
    [tenantId]
  );
  return res.rows[0];
}

async function createProduct(tenantId) {
  const res = await pool.query(
    "INSERT INTO products (tenant_id, name, sku, category) VALUES ($1, 'Test Product', 'SKU-' || hex(randomblob(4)), 'Medicine') RETURNING id",
    [tenantId]
  );
  return res.rows[0];
}

async function createSupplier(tenantId) {
  const res = await pool.query(
    "INSERT INTO suppliers (tenant_id, name) VALUES ($1, 'Test Supplier') RETURNING id",
    [tenantId]
  );
  return res.rows[0];
}

async function seedTestData(tenantId) {
  await pool.query("INSERT INTO pharmacy_staff (tenant_id, full_name, title) VALUES ($1, 'Test Staff', 'pharmacist')", [tenantId]);
  await pool.query("INSERT INTO cold_chain_devices (tenant_id, device_name) VALUES ($1, 'Fridge 1')", [tenantId]);
  await pool.query("INSERT INTO duty_schedule (tenant_id, duty_date, staff_id) VALUES ($1, date('now', '+1 day'), (SELECT id FROM pharmacy_staff WHERE tenant_id = $1 LIMIT 1))", [tenantId]);
  await pool.query("INSERT INTO wms_business_rules (tenant_id, rule_type, rule_name, condition_json, action_json) VALUES ($1, 'allocation', 'Default', '{}', '{}')", [tenantId]);
  await pool.query("INSERT INTO warehouse_locations (tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position) VALUES ($1, (SELECT id FROM warehouses WHERE tenant_id = $1 LIMIT 1), 'LOC-1-T' || $1, 'A', 'A1', 1, 1, 1)", [tenantId]);
  await pool.query("INSERT INTO product_bin_records (tenant_id, product_id, location_id, quantity) VALUES ($1, (SELECT id FROM products WHERE tenant_id = $1 LIMIT 1), (SELECT id FROM warehouse_locations WHERE tenant_id = $1 LIMIT 1), 100)", [tenantId]);
}

// Explicit fixture step: sales now require a real opening, just like the UI.
async function openTestShift(owner, warehouseId, openingCash = 0) {
  const r = await request(app).post('/api/scanner/shifts/open').set('Authorization','Bearer '+owner.token).set('Idempotency-Key',require('crypto').randomUUID()).send({warehouse_id:warehouseId,opening_cash:openingCash});
  if(r.status !== 201) throw new Error('Test shift opening failed: '+JSON.stringify(r.body));
  return r.body;
}
module.exports = {
  openTestShift,
  createTenant,
  createUser,
  createWarehouse,
  createProduct,
  createSupplier
};
