const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createTenant, createProduct, createWarehouse } = require('./factories/index');
const inventoryTransactionService = require('../src/services/inventoryTransactionService');

describe('Deep Tenant Isolation & Concurrency', () => {
  let tenant1, tenant2;
  let p1, w1;

  beforeAll(async () => {
    tenant1 = await createTenant();
    tenant2 = await createTenant();

    p1 = await createProduct(tenant1.tenantId);
    w1 = await createWarehouse(tenant1.tenantId);
  });

  it('should prevent atomic race conditions on stock update', async () => {
    // Let's create a product and set its stock to 10.
    await pool.query(`INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($1, $2, $3, 10)`, [tenant1.tenantId, p1.id, w1.id]);
    
    // Simulate 3 concurrent API requests trying to consume 5 stock each (total 15 > 10).
    const reqs = [];
    for(let i=0; i<3; i++) {
      reqs.push(
        inventoryTransactionService.recordTransaction({
          tenant_id: tenant1.tenantId,
          warehouse_id: w1.id,
          product_id: p1.id,
          location_id: null,
          transaction_type: 'SALE',
          quantity: -5, // outbound
          reference_type: 'API_TEST',
          reference_id: 'R' + i
        })
      );
    }
    
    const results = await Promise.allSettled(reqs);
    const success = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');
    
    // Check if the system correctly rejected one transaction or allowed negative stock.
    // Actually, Veniux might allow negative stock if configured.
    console.log(`Success: ${success.length}, Failures: ${failures.length}`);
    expect(success).toHaveLength(2);
    expect(failures).toHaveLength(1);
    const stock=await pool.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3',[tenant1.tenantId,w1.id,p1.id]);
    expect(Number(stock.rows[0].quantity)).toBe(0);
  });
});
