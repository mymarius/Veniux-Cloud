process.env.JWT_SECRET = 'isolated-mfa-lockout-secret-at-least-32-bytes'; // 2FA anahtarı bundan türetilir
const request = require('supertest');
const app = require('../src/index');
const mfa = require('../src/services/mfaService');

test('repeated wrong codes lock the second step, even for the correct code', async () => {
  const email = 'mfa-lockout@example.invalid', password = 'Mfa-Lockout-123';
  const login = extra => request(app).post('/api/auth/login').send({ email, password, ...extra });
  const registered = await request(app).post('/api/auth/register').send({ email, password, phone: '05550000000' });
  expect(registered.status).toBe(201);
  await require('./helpers/provisionLicense')(registered.body.user.tenant_id);
  const token = (await login()).body.token;
  const auth = { Authorization: `Bearer ${token}` };
  const setup = await request(app).post('/api/auth/mfa/setup').set(auth).send({ password });
  expect(setup.status).toBe(200);
  const code = mfa.totp(setup.body.secret, Math.floor(Date.now() / 30000));
  expect((await request(app).post('/api/auth/mfa/confirm').set(auth).send({ password, code })).status).toBe(200);

  for (let i = 0; i < 5; i++) expect((await login({ mfa_code: '000000' })).status).toBe(401);
  // Bir sonraki adımın kodu tekrar kullanım sayılmaz; yalnızca kilit yüzünden reddedilir.
  const next = mfa.totp(setup.body.secret, Math.floor(Date.now() / 30000) + 1);
  expect((await login({ mfa_code: next })).status).toBe(401);
});
