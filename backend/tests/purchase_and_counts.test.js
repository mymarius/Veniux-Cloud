const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');
const pool = require('../src/config/database');

describe('Purchase Orders & Physical Stocktaking Endpoints', () => {
  let authToken;
  let testProductId;
  let testWarehouseId;
  let testSupplierId;

  beforeAll(async () => {
    const tenant = await createTenant();
    authToken = tenant.token;

    // Ensure warehouse, supplier and product exist
    let whRes = await pool.query('SELECT id FROM warehouses WHERE tenant_id = $1 LIMIT 1', [tenant.tenantId]);
    if (whRes.rows.length === 0) {
      whRes = await pool.query(`INSERT INTO warehouses (name, type, capacity, tenant_id) VALUES ('Test Depo', 'main', 5000, $1) RETURNING id`, [tenant.tenantId]);
    }
    testWarehouseId = whRes.rows[0].id;

    // Ensure dummy supplier
    let supRes = await pool.query("SELECT id FROM suppliers WHERE tenant_id = $1 LIMIT 1", [tenant.tenantId]);
    if (supRes.rows.length === 0) {
      supRes = await pool.query(`INSERT INTO suppliers (name, contact_name, tenant_id) VALUES ('Global Meda', 'Ahmet Y.', $1) RETURNING id`, [tenant.tenantId]);
    }
    testSupplierId = supRes.rows[0].id;

    let prodRes = await pool.query("SELECT id FROM products WHERE sku = 'TEST-PO-01' AND tenant_id = $1", [tenant.tenantId]);
    if (prodRes.rows.length === 0) {
      prodRes = await pool.query(`
        INSERT INTO products (tenant_id, sku, name, category, barcode, unit, purchase_price, sale_price)
        VALUES ($1, 'TEST-PO-01', 'Test Sipariş Ürünü', 'Genel', '8699999000111', 'adet', 50, 80)
        RETURNING id
      `, [tenant.tenantId]);
    }
    testProductId = prodRes.rows[0].id;
  });

  describe('Purchase Orders Workflow', () => {
    let createdOrderId;

    it('should create a new purchase order', async () => {
      const res = await request(app)
        .post('/api/purchase-orders').set('Idempotency-Key',require('crypto').randomUUID())
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supplier_id: testSupplierId,
          target_warehouse_id: testWarehouseId,
          items: [{ product_id: testProductId, quantity: 20, unit_price: 50 }],
          notes: 'Test Satın Alma Siparişi'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.order).toHaveProperty('id');
      expect(res.body.order.status).toBe('draft');
      createdOrderId = res.body.order.id;
    });

    it('should list all purchase orders', async () => {
      const res = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(o => o.id === createdOrderId)).toBe(true);
    });

    it('should receive purchase order goods into stock', async () => {
      for(const action of ['submit','approve'])expect((await request(app).post(`/api/purchase-orders/${createdOrderId}/status`).set('Authorization',`Bearer ${authToken}`).send({action})).status).toBe(200);
      const line=(await request(app).get(`/api/purchase-orders/${createdOrderId}`).set('Authorization',`Bearer ${authToken}`)).body.items[0];
      const bin=(await pool.query('SELECT id FROM warehouse_locations WHERE warehouse_id=$1',[testWarehouseId])).rows[0];
      const res = await request(app)
        .post(`/api/purchase-orders/${createdOrderId}/receive`).set('Idempotency-Key',require('crypto').randomUUID())
        .set('Authorization', `Bearer ${authToken}`).send({delivery_reference:'LEGACY-PO',items:[{order_item_id:line.id,quantity:20,location_id:bin.id}]});

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('başarıyla');

      // Verify stock incremented
      const stockCheck = await pool.query(
        'SELECT quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2',
        [testProductId, testWarehouseId]
      );
      expect(stockCheck.rows[0].quantity).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Physical Stocktaking (Sayım) Workflow', () => {
    let createdCountId;
    let countItemId;

    it('should start a new physical stock count', async () => {
      const res = await request(app)
        .post('/api/stock-counts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          warehouse_id: testWarehouseId,
          notes: 'Test Fiziksel Sayım'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.stock_count).toHaveProperty('id');
      expect(res.body.stock_count.status).toBe('in_progress');
      createdCountId = res.body.stock_count.id;
    });

    it('should get count details with items', async () => {
      const res = await request(app)
        .get(`/api/stock-counts/${createdCountId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBeGreaterThan(0);
      countItemId = res.body.items[0].id;
    });

    it('should update counted quantity and calculate discrepancy', async () => {
      const res = await request(app)
        .put(`/api/stock-counts/${createdCountId}/items/${countItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          counted_quantity: 35,
          notes: 'Rafta 35 adet bulundu'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('difference');
    });

    it('should finalize count and reconcile stock levels', async () => {
      const res = await request(app)
        .post(`/api/stock-counts/${createdCountId}/finalize`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('kesinleştirildi');
    });
  });
});
