jest.mock('../src/services/nvidiaAIService',()=>({complete:jest.fn().mockResolvedValue(JSON.stringify({reply:'Test stok analizi.',action:null}))}));
const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');

describe('Suppliers, Transfers & AI Endpoints', () => {
  let authToken;
  let supplierId;
  let productId;
  let warehouse1Id;
  let warehouse2Id;
  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    // Login as admin
    const tenant = await createTenant();
    authToken = tenant.token;

    // Create a supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Test Lojistik ${uniqueSuffix}`,
        contact_name: 'Kemal Test',
        email: `kemal_${uniqueSuffix}@testlojistik.com`,
        phone: '+90 555 123 4567',
        lead_time_days: 4
      });
    supplierId = supRes.body.id;

    // Create 2 warehouses
    const w1Res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: `Transfer Kaynak Depo ${uniqueSuffix}`, type: 'internal' });
    warehouse1Id = w1Res.body.id;

    const w2Res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: `Transfer Hedef Depo ${uniqueSuffix}`, type: 'internal' });
    warehouse2Id = w2Res.body.id;

    // Create a product with supplier
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sku: `TRF-PROD-${uniqueSuffix}`,
        name: 'Transfer Test Ürünü',
        category: 'Test',
        barcode: `86999990${uniqueSuffix.toString().slice(-4)}`,
        purchase_price: 100,
        sale_price: 200,
        min_stock_level: 10,
        supplier_id: supplierId
      });
    productId = prodRes.body.id;

    // Add initial stock to warehouse 1
    await request(app)
      .post('/api/stock/movement')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        warehouse_id: warehouse1Id,
        change_amount: 100,
        movement_type: 'inbound',
        note: 'Initial transfer stock'
      });
  });

  describe('Suppliers API', () => {
    it('should list all suppliers', async () => {
      const res = await request(app)
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should get supplier by ID', async () => {
      const res = await request(app)
        .get(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('name', `Test Lojistik ${uniqueSuffix}`);
      expect(res.body).toHaveProperty('products');
    });

    it('should update supplier', async () => {
      const res = await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `Güncel Test Lojistik ${uniqueSuffix}`,
          lead_time_days: 5
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe(`Güncel Test Lojistik ${uniqueSuffix}`);
    });
  });

  describe('Stock Transfers API', () => {
    it('should transfer stock between warehouses successfully', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          from_warehouse_id: warehouse1Id,
          to_warehouse_id: warehouse2Id,
          quantity: 30,
          note: 'Acil sevkiyat transferi'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.transferred_quantity).toBe(30);

      // Verify stock records in both warehouses
      const recordsRes = await request(app)
        .get('/api/stock/records')
        .set('Authorization', `Bearer ${authToken}`);

      const sourceRecord = recordsRes.body.find(r => r.product_id === productId && r.warehouse_id === warehouse1Id);
      const targetRecord = recordsRes.body.find(r => r.product_id === productId && r.warehouse_id === warehouse2Id);

      expect(sourceRecord.quantity).toBe(70);
      expect(targetRecord.quantity).toBe(30);
    });

    it('should fail transfer if quantity exceeds available stock', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          from_warehouse_id: warehouse1Id,
          to_warehouse_id: warehouse2Id,
          quantity: 9999
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail if source and target warehouse are identical', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          from_warehouse_id: warehouse1Id,
          to_warehouse_id: warehouse1Id,
          quantity: 10
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('AI Assistant & Analytics API', () => {
    it('should answer natural language questions about stock', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Kritik seviyedeki ürünler neler?' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('reply');
      expect(typeof res.body.reply).toBe('string');
    });

    it('should get inventory forecasts and EOQ suggestions', async () => {
      const res = await request(app)
        .get('/api/ai/forecast')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('suggested_reorder_qty');
      expect(res.body[0]).toHaveProperty('days_until_stockout');
    });

    it('should get stock analytics KPIs for dashboard', async () => {
      const res = await request(app)
        .get('/api/stock/analytics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('category_breakdown');
      expect(res.body).toHaveProperty('warehouse_distribution');
      expect(res.body).toHaveProperty('movements_trend');
    });
  });
});

