const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const { createTenant, createUser } = require('./factories');
const { ROLES, CAPABILITIES } = require('../src/config/roleCapabilities');

// Verifies that the role matrix shown on the settings page matches the real route guards.
const tokens = {};
let adminToken;

beforeAll(async () => {
  const owner = await createTenant();
  adminToken = owner.token;
  for (const { id } of ROLES) {
    const user = await createUser(owner.tenantId, id);
    tokens[id] = jwt.sign({ userId: user.id, tenantId: owner.tenantId, role: id }, JWT_SECRET);
  }
});

const cases = CAPABILITIES.flatMap(group => group.items).flatMap(cap => ROLES.map(role => [cap.id, role.id, cap]));

test.each(cases)('%s / %s matches the route guard', async (_cap, role, cap) => {
  const [method, path, body] = cap.probe;
  let call = request(app)[method.toLowerCase()](path).set('Authorization', 'Bearer ' + tokens[role]);
  if (body !== undefined) call = call.send(body);
  const res = await call;
  const deniedByRole = res.status === 403 && res.body?.error === 'Insufficient permissions';
  expect({ role, allowed: !deniedByRole }).toEqual({ role, allowed: cap.roles.includes(role) });
});

test('settings page receives the matrix without test probes', async () => {
  const res = await request(app).get('/api/settings/roles').set('Authorization', 'Bearer ' + adminToken);
  expect(res.status).toBe(200);
  expect(res.body.roles.map(r => r.id)).toEqual(ROLES.map(r => r.id));
  expect(JSON.stringify(res.body)).not.toMatch(/probe/);
  expect(JSON.stringify(res.body)).not.toMatch(/Eczane|Eczacı|pharmacy_records|pharmacy_stock/);
});
