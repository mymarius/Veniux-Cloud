const request = require('supertest');
const app = require('../src/index');
const { createTenant } = require('./factories/index');

describe('Product Endpoints', () => {
  let authToken;
  let productId;
  const uniqueSku = `TEST-${Date.now()}`;

  beforeAll(async () => {
    // Login as admin
    const tenant = await createTenant();
    authToken = tenant.token;
  });

  describe('POST /api/products', () => {
    it('should create a new product with valid data', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: uniqueSku,
          name: 'Test Product',
          category: 'Electronics',
          unit: 'adet',
          min_stock_level: 10
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('sku', uniqueSku);
      expect(res.body).toHaveProperty('name', 'Test Product');
      productId = res.body.id;
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          sku: `TEST-NOAUTH-${Date.now()}`,
          name: 'Test Product 2'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: `TEST-NOFIELDS-${Date.now()}`
        });

      expect(res.statusCode).toBe(400);
    });

    it('should fail with duplicate SKU', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: uniqueSku,
          name: 'Duplicate Product'
        });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('GET /api/products', () => {
    it('should get all products with authentication', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/products');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update a product', async () => {
      const res = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: uniqueSku,
          name: 'Updated Test Product',
          min_stock_level: 20
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated Test Product');
    });

    it('should fail for non-existent product', async () => {
      const res = await request(app)
        .put('/api/products/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sku: 'TEST-999',
          name: 'Non-existent'
        });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete a product', async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('should fail for non-existent product', async () => {
      const res = await request(app)
        .delete('/api/products/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});
