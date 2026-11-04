const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');

describe('Stock Endpoints', () => {
  let authToken;
  let productId;
  let warehouseId;
  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    // Login as admin
    const tenant = await createTenant();
    authToken = tenant.token;

    // Create a product
    const productRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sku: `STOCK-${uniqueSuffix}`,
        name: 'Stock Test Product',
        min_stock_level: 5
      });
    productId = productRes.body.id;

    // Create a warehouse
    const warehouseRes = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Test Warehouse ${uniqueSuffix}`,
        type: 'internal'
      });
    warehouseId = warehouseRes.body.id;
  });

  describe('POST /api/stock/movement', () => {
    it('should create a stock movement', async () => {
      const res = await request(app)
        .post('/api/stock/movement')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          warehouse_id: warehouseId,
          change_amount: 50,
          movement_type: 'inbound',
          note: 'Initial stock'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('movement');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/stock/movement')
        .send({
          product_id: productId,
          warehouse_id: warehouseId,
          change_amount: 10,
          movement_type: 'inbound'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/stock/movement')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          change_amount: 10
        });

      expect(res.statusCode).toBe(400);
    });

    it('should fail for non-existent product', async () => {
      const res = await request(app)
        .post('/api/stock/movement')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: 99999,
          warehouse_id: warehouseId,
          change_amount: 10,
          movement_type: 'inbound'
        });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/stock/import', () => {
    it('rejects legacy absolute-quantity imports without changing stock or movements', async () => {
      const db = require('../src/config/database').getDb();
      const before = db.prepare('SELECT * FROM stock_records WHERE product_id=?').all(productId);
      const movementCount = db.prepare('SELECT COUNT(*) AS n FROM stock_movements').get().n;
      for (const data of [[{sku:`STOCK-${uniqueSuffix}`,warehouse_name:`Test Warehouse ${uniqueSuffix}`,quantity:999}], 'invalid']) {
        const res = await request(app).post('/api/stock/import').set('Authorization', `Bearer ${authToken}`).send({data});
        expect(res.statusCode).toBe(410);
        expect(res.body.code).toBe('LEGACY_STOCK_IMPORT_DISABLED');
      }
      expect(db.prepare('SELECT * FROM stock_records WHERE product_id=?').all(productId)).toEqual(before);
      expect(db.prepare('SELECT COUNT(*) AS n FROM stock_movements').get().n).toBe(movementCount);
    });
    it('does not allow unauthenticated legacy imports', async () => {
      expect((await request(app).post('/api/stock/import').send({data:[]})).statusCode).toBe(401);
    });
  });

  describe('GET /api/stock/records', () => {
    it('should get stock records', async () => {
      const res = await request(app)
        .get('/api/stock/records')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/stock/movements', () => {
    it('should get stock movements', async () => {
      const res = await request(app)
        .get('/api/stock/movements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by product_id', async () => {
      const res = await request(app)
        .get(`/api/stock/movements?product_id=${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
