process.env.JWT_SECRET = 'isolated-user-admin-secret-at-least-32-bytes'; // 2FA anahtarı bundan türetilir
jest.mock('express-rate-limit', () => () => (req, res, next) => next()); // sınırlar başka testlerde denenir
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const mfa = require('../src/services/mfaService');
const { createTenant, createUser } = require('./factories');
const provisionLicense = require('./helpers/provisionLicense');

const login = (email, password = 'password123', extra = {}) => request(app).post('/api/auth/login').send({ email, password, ...extra });
const as = (token, method, url, body) => request(app)[method](url).set('Authorization', `Bearer ${token}`).send(body);
const enableMfa = async user => {
  const token = (await login(user.email)).body.token;
  const setup = await as(token, 'post', '/api/auth/mfa/setup', { password: 'password123' });
  const code = mfa.totp(setup.body.secret, Math.floor(Date.now() / 30000));
  expect((await as(token, 'post', '/api/auth/mfa/confirm', { password: 'password123', code })).status).toBe(200);
  // Kurulum açık oturumları düşürür; geçerli oturum ikinci adımla alınır.
  const next = mfa.totp(setup.body.secret, Math.floor(Date.now() / 30000) + 1);
  const signedIn = await login(user.email, 'password123', { mfa_code: next });
  expect(signedIn.status).toBe(200);
  return signedIn.body.token;
};

describe('admin resets two factor for a lost device', () => {
  let owner, other, adminToken;
  beforeAll(async () => {
    owner = await createTenant();
    other = await createTenant();
    await provisionLicense(owner.tenantId);
    await provisionLicense(other.tenantId);
    const admin = await createUser(owner.tenantId, 'admin');
    adminToken = (await login(admin.email)).body.token;
  });

  test('wrong password and non admin are refused, nothing changes', async () => {
    const user = await createUser(owner.tenantId, 'manager');
    const token = await enableMfa(user);
    expect((await as(adminToken, 'post', `/api/settings/users/${user.id}/mfa-reset`, { password: 'wrong-password' })).status).toBe(403);
    const manager = await createUser(owner.tenantId, 'manager');
    expect((await as((await login(manager.email)).body.token, 'post', `/api/settings/users/${user.id}/mfa-reset`, { password: 'password123' })).status).toBe(403);
    expect((await login(user.email)).body.mfa_required).toBe(true);
    expect((await as(token, 'get', '/api/auth/me')).status).toBe(200);
  });

  test('reset opens login with password only, drops sessions and leaves an audit record', async () => {
    const user = await createUser(owner.tenantId, 'manager');
    const token = await enableMfa(user);
    const res = await as(adminToken, 'post', `/api/settings/users/${user.id}/mfa-reset`, { password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.reset).toBe(true);
    expect((await as(token, 'get', '/api/auth/me')).status).toBe(401);
    const after = await login(user.email);
    expect(after.body.mfa_required).toBeUndefined();
    expect(after.body.token).toBeTruthy();
    const audit = (await db.query("SELECT details FROM audit_logs WHERE tenant_id=$1 AND action='user.mfa_reset' AND entity_id=$2", [owner.tenantId, user.id])).rows;
    expect(audit).toHaveLength(1);
    // İkinci çağrı bir şey değiştirmez.
    expect((await as(adminToken, 'post', `/api/settings/users/${user.id}/mfa-reset`, { password: 'password123' })).body.reset).toBe(false);
  });

  test("another company's user is not found and stays protected", async () => {
    const foreign = await createUser(other.tenantId, 'manager');
    await enableMfa(foreign);
    expect((await as(adminToken, 'post', `/api/settings/users/${foreign.id}/mfa-reset`, { password: 'password123' })).status).toBe(404);
    expect((await login(foreign.email)).body.mfa_required).toBe(true);
  });
});

describe('user limit of the license', () => {
  const add = (token, email) => as(token, 'post', '/api/settings/users', { email, password: 'Password-123456', role: 'viewer' });

  test('the add user screen stops at the limit and opens again when a seat is freed', async () => {
    const owner = await createTenant();
    await provisionLicense(owner.tenantId);
    const admin = await createUser(owner.tenantId, 'admin');
    const token = (await login(admin.email)).body.token;
    const seats = Number((await db.query('SELECT COUNT(*) AS n FROM users WHERE tenant_id=$1', [owner.tenantId])).rows[0].n);
    const plan = require('../src/services/licenseService').getPlans().find(item => item.max_users === 5);
    await db.query('UPDATE licenses SET plan_id=$1, enabled_features_json=$2 WHERE tenant_id=$3', [plan.id, JSON.stringify(plan.features), owner.tenantId]);
    const limit = plan.max_users;
    expect(seats).toBeLessThan(limit);
    let last;
    for (let i = seats; i < limit; i++) {
      last = await add(token, `seat-${owner.tenantId}-${i}@example.invalid`);
      expect(last.status).toBe(201);
    }
    const blocked = await add(token, `over-${owner.tenantId}@example.invalid`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toContain('limit');
    expect(Number((await db.query('SELECT COUNT(*) AS n FROM users WHERE tenant_id=$1', [owner.tenantId])).rows[0].n)).toBe(limit);
    expect((await as(token, 'delete', `/api/settings/users/${last.body.user.id}`)).status).toBe(200);
    expect((await add(token, `after-${owner.tenantId}@example.invalid`)).status).toBe(201);
  });
});
