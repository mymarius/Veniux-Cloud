const request = require('supertest');
const app = require('./src/index');
const { createTenant } = require('./tests/factories/index');
(async () => {
    const tenant = await createTenant();
    const authToken = tenant.token;
    const uniqueSuffix = Date.now();
    
    const productRes = await request(app).post('/api/products').set('Authorization', 'Bearer ' + authToken).send({ sku: 'STOCK-' + uniqueSuffix, name: 'Stock Test Product', min_stock_level: 5 });
    console.log('Product response:', productRes.body);
    
    const warehouseRes = await request(app).post('/api/warehouses').set('Authorization', 'Bearer ' + authToken).send({ name: 'Test Warehouse ' + uniqueSuffix, type: 'internal' });
    console.log('Warehouse response:', warehouseRes.body);
    
    process.exit(0);
})();
