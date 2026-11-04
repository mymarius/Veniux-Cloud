const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');

describe('Multi-Tenant Isolation Security Tests', () => {
  let userA_token;
  let userB_token;
  let warehouseA_Id;
  
  it('should prevent Tenant B from accessing Tenant A data', async () => {
    const registerA = await request(app).post('/api/auth/register').send({ email: 'ownerA' + Date.now() + '@tenanta.com', phone: '05551234567', password: 'password123', role: 'admin' });
    expect(registerA.status).toBe(201);
    await require('./helpers/provisionLicense')(registerA.body.user.tenant_id);
    const loginA = await request(app).post('/api/auth/login').send({ email: registerA.body.user.email, phone: '05551234567', password: 'password123' });
    userA_token = loginA.body.token;

    const registerB = await request(app).post('/api/auth/register').send({ email: 'ownerB' + Date.now() + '@tenantb.com', phone: '05551234567', password: 'password123', role: 'admin' });
    expect(registerB.status).toBe(201);
    await require('./helpers/provisionLicense')(registerB.body.user.tenant_id);
    const loginB = await request(app).post('/api/auth/login').send({ email: registerB.body.user.email, phone: '05551234567', password: 'password123' });
    userB_token = loginB.body.token;
    expect(loginA.status).toBe(200);expect(loginB.status).toBe(200);

    const dbUserA = await pool.query('SELECT tenant_id FROM users WHERE email = $1', [registerA.body.user.email]);
    const tenantA_Id = dbUserA.rows[0].tenant_id;
    
    const dbWarehouse = await pool.query('INSERT INTO warehouses (name, type, tenant_id) VALUES ($1, $2, $3) RETURNING id', ['Warehouse A', 'MAIN', tenantA_Id]);
    warehouseA_Id = dbWarehouse.rows[0].id;

    const fetchB = await request(app).get('/api/warehouses/' + warehouseA_Id).set('Authorization', 'Bearer ' + userB_token);

    expect(fetchB.status).toBe(404);
  });
});
