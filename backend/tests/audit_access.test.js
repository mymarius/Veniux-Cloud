const assertRetired=require('./helpers/assertRetired');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const pool = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createUser, createProduct } = require('./factories');

describe('Audit: depot access and tenant isolation', () => {
  let owner, other, viewerToken;
  beforeAll(async () => {
    owner = await createTenant();
    other = await createTenant();
    const viewer = await createUser(owner.tenantId, 'viewer');
    viewerToken = jwt.sign({ userId: viewer.id, tenantId: owner.tenantId }, JWT_SECRET);
  });

  test.each(['dashboard-stats', 'medicines', 'lots-serials', 'returns-quarantine'])(
    "retired contract / active guard: anonymous pharmacy read %s is rejected", async()=>{await assertRetired(["/api/eczane-depo/dashboard-stats","/api/eczane-depo/medicines","/api/eczane-depo/lots-serials","/api/eczane-depo/returns-quarantine"]);}
  );

  test.each([
    '/api/eczane-depo/inbound', '/api/eczane-depo/dispense-fefo',
    '/api/normal-depo/inbound-receive', '/api/normal-depo/transfer',
    '/api/terminal/operations/inbound', '/api/terminal/operations/outbound',
    '/api/terminal/operations/relocate', '/api/terminal/operations/count'
  ])("retired contract / active guard: viewer cannot mutate stock through %s", async (route) => {if(route.startsWith('/api/eczane-depo/')){await assertRetired([route]);return;}expect((await request(app).post(route).set('Authorization', 'Bearer '+viewerToken).send({})).status).toBe(403);expect((await request(app).post(route).send({})).status).toBe(401);});

  test("retired contract / active guard: pharmacy listing returns only the authenticated tenant products", async()=>{await assertRetired(["/api/eczane-depo/medicines"]);});

  test('stock writes and imports cannot use another tenant products or warehouses', async () => {
    const product = (await pool.query('SELECT * FROM products WHERE tenant_id = $1 LIMIT 1', [other.tenantId])).rows[0];
    const warehouse = (await pool.query('SELECT * FROM warehouses WHERE tenant_id = $1 LIMIT 1', [other.tenantId])).rows[0];
    const ownWarehouse = (await pool.query('SELECT * FROM warehouses WHERE tenant_id = $1 LIMIT 1', [owner.tenantId])).rows[0];
    for (const [route, body] of [
      ['movement', { product_id: product.id, warehouse_id: warehouse.id, change_amount: 10, movement_type: 'inbound' }],
      ['adjust', { product_id: product.id, warehouse_id: warehouse.id, new_quantity: 10 }],
      ['transfer', { product_id: product.id, from_warehouse_id: warehouse.id, to_warehouse_id: ownWarehouse.id, quantity: 1 }]
    ]) {
      const res = await request(app).post(`/api/stock/${route}`).set('Authorization', `Bearer ${owner.token}`).send(body);
      expect(res.status).toBe(404);
    }
    const imported = await request(app).post('/api/stock/import').set('Authorization', `Bearer ${owner.token}`)
      .send({ data: [{ sku: product.sku, warehouse_name: warehouse.name, quantity: 99 }] });
    expect(imported.status).toBe(410);
    expect(imported.body.code).toBe('LEGACY_STOCK_IMPORT_DISABLED');
    expect((await pool.query('SELECT * FROM stock_movements WHERE product_id = $1', [product.id])).rows).toHaveLength(0);
  });

  test('low stock movement commits the balance and a tenant-scoped alert', async () => {
    const product = await createProduct(owner.tenantId);
    const warehouse = (await pool.query('SELECT id FROM warehouses WHERE tenant_id = $1 LIMIT 1', [owner.tenantId])).rows[0];
    await pool.query('UPDATE products SET min_stock_level = 5 WHERE id = $1', [product.id]);
    const result = await request(app).post('/api/stock/movement').set('Authorization', `Bearer ${owner.token}`)
      .send({ product_id: product.id, warehouse_id: warehouse.id, change_amount: 2, movement_type: 'inbound' });
    expect(result.status).toBe(201);
    expect(result.body.current_quantity).toBe(2);
    const alerts = await pool.query('SELECT * FROM alerts WHERE product_id = $1', [product.id]);
    expect(alerts.rows).toHaveLength(1);
    expect(alerts.rows[0].tenant_id).toBe(owner.tenantId);
  });
});
