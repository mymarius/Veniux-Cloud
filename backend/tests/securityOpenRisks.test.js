process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant } = require('./factories');

test('el terminali sayısı lisanstaki cihaz sınırını aşamaz; mevcut cihaz yeniden bağlanabilir', async () => {
  const owner = await createTenant();
  await db.query('UPDATE licenses SET max_pdas=2 WHERE tenant_id=$1', [owner.tenantId]);
  const reg = uid => request(app).post('/api/terminal/register').set('Authorization', 'Bearer ' + owner.token).send({ device_uid: uid });
  expect((await reg('PDA-1')).status).toBe(200);
  expect((await reg('PDA-2')).status).toBe(200);
  const third = await reg('PDA-3');
  expect(third.status).toBe(403);
  expect(third.body.error).toContain('(2)');
  expect((await reg('PDA-1')).status).toBe(200);
});

test('harf farkıyla çift e-posta varsa her hesap kendi parolasıyla girer, diğerini kilitlemez', async () => {
  const owner = await createTenant();
  const email = `cift_${Date.now()}@ornek.com`;
  const add = async (address, password) => (await db.query("INSERT INTO users (tenant_id,email,password_hash,role,status) VALUES ($1,$2,$3,'viewer','active') RETURNING id", [owner.tenantId, address, await bcrypt.hash(password, 10)])).rows[0].id;
  const first = await add(email.replace('cift', 'Cift'), 'birinci-parola-1');
  const second = await add(email, 'ikinci-parola-2');
  const login = password => request(app).post('/api/auth/login').send({ email, password });
  const a = await login('birinci-parola-1'), b = await login('ikinci-parola-2');
  expect(a.status).toBe(200); expect(b.status).toBe(200);
  expect(a.body.user.id).toBe(first); expect(b.body.user.id).toBe(second);
  expect((await login('yanlis-parola')).status).toBe(401);
});
