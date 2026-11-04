const request = require('supertest');
const app = require('../src/index');

describe('Auth Endpoints', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const loginEmail = `login_${Date.now()}@example.com`;

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          phone: '05551234567', password: 'password123',
          role: 'viewer'
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', testEmail);
      expect(res.body.user).toHaveProperty('role', 'admin');
    });

    it('should fail with missing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '05551234567', password: 'password123'
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail with invalid role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `invalid_${Date.now()}@example.com`,
          phone: '05551234567', password: 'password123',
          role: 'invalid_role'
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // First register a user
      const registered = await request(app)
        .post('/api/auth/register')
        .send({
          email: loginEmail,
          phone: '05551234567', password: 'password123',
          role: 'viewer'
        });

      // A valid password alone must not bypass the mandatory license.
      const unlicensed = await request(app).post('/api/auth/login').send({email:loginEmail,password:'password123'});
      expect(unlicensed.statusCode).toBe(423);
      expect(unlicensed.body.token).toBeUndefined();
      await require('./helpers/provisionLicense')(registered.body.user.tenant_id);
      // Then login with an explicitly provisioned synthetic test license.
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginEmail,
          phone: '05551234567', password: 'password123'
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
    });

    it('should fail with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
