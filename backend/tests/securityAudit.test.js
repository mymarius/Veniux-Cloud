process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const audit = require('../src/services/auditIntegrityService');
const mfa = require('../src/services/mfaService');
const { createTenant } = require('./factories');

const as = (t, r) => r.set('Authorization', 'Bearer ' + t.token);
let A, B;
beforeAll(async () => { A = await createTenant(); B = await createTenant(); });
const log = (tenant, action, created = null) => db.query(`INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details${created ? ',created_at' : ''}) VALUES ($1,'a@b.c',$2,'test',1,'{}'${created ? ',$3' : ''})`, created ? [tenant, action, created] : [tenant, action]);

test('zincir sağlam doğrulanır; değiştirilen, silinen ve araya eklenen kayıt yakalanır', async () => {
  const t = A;
  for (let i = 0; i < 5; i++) await log(t.tenantId, 'test.step' + i);
  const ok = await as(t, request(app).get('/api/audit-logs/integrity'));
  expect(ok.status).toBe(200);
  expect(ok.body.ok).toBe(true);
  const rows = (await db.query("SELECT id FROM audit_logs WHERE tenant_id=$1 AND action LIKE 'test.step%' ORDER BY id", [t.tenantId])).rows;
  await db.query("UPDATE audit_logs SET user_email='sahte@x.y' WHERE id=$1", [rows[2].id]);
  expect(await audit.verify(t.tenantId)).toMatchObject({ ok: false, problem: 'modified', audit_id: rows[2].id });
  await db.query("UPDATE audit_logs SET user_email='a@b.c' WHERE id=$1", [rows[2].id]);
  expect((await audit.verify(t.tenantId)).ok).toBe(true);
  await db.query('DELETE FROM audit_logs WHERE id=$1', [rows[1].id]);
  expect(await audit.verify(t.tenantId)).toMatchObject({ ok: false, problem: 'deleted', audit_id: rows[1].id });
  await db.query('DELETE FROM audit_seals WHERE tenant_id=$1', [t.tenantId]);
});

test('saklama süresi dolan kayıtlar silinir, zincir kontrol noktasından sağlam kalır ve silme kayda geçer', async () => {
  const t = A;
  await log(t.tenantId, 'eski.1', '2020-01-01 10:00:00');
  await log(t.tenantId, 'eski.2', '2020-02-01 10:00:00');
  await log(t.tenantId, 'yeni.1');
  const r = await audit.purge(t.tenantId, 2, new Date('2026-11-09T10:00:00Z'));
  expect(r.purged).toBeGreaterThanOrEqual(2);
  const left = (await db.query('SELECT action FROM audit_logs WHERE tenant_id=$1', [t.tenantId])).rows.map(x => x.action);
  expect(left).not.toContain('eski.1');
  expect(left).toContain('yeni.1');
  expect(left).toContain('audit.retention_purge');
  expect((await audit.verify(t.tenantId)).ok).toBe(true);
  await expect(audit.purge(t.tenantId, 0)).rejects.toThrow();
});

test('yönetici 2FA zorunluluğu: açan kendi 2FA\'sını kurmuş olmalı; kurmayan yönetici yalnız kurulum ekranına girer', async () => {
  const t = B;
  const body = { sessionTimeout: '24h', strictPassword: false, requireAdminMfa: true, auditRetentionYears: 3, newDeviceAlert: true };
  expect((await as(t, request(app).put('/api/settings/security')).send(body)).status).toBe(400);
  await require('../src/services/settingsPolicyService').save(t.tenantId, 'security', body);
  const blocked = await as(t, request(app).get('/api/products'));
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('MFA_SETUP_REQUIRED');
  expect((await as(t, request(app).get('/api/auth/mfa'))).status).toBe(200);
  expect((await as(t, request(app).get('/api/settings/security'))).status).toBe(200);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) process.env.JWT_SECRET = (process.env.JWT_SECRET || '') + 'x'.repeat(32);
  const user = { id: t.userId, tenant_id: t.tenantId, email: t.email };
  const { secret } = await mfa.setup(user);
  const code = require('../src/services/mfaService');
  // Kurulumu tamamlamak için geçerli kodu üret.
  const now = Math.floor(Date.now() / 30000), b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(now));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const out = [];
  for (const ch of secret) { value = (value << 5) | alphabet.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const h = crypto.createHmac('sha1', Buffer.from(out)).update(b).digest(), o = h[19] & 15;
  const otp = String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
  expect((await code.confirm(user, otp)).error).toBeUndefined();
  // 2FA açılınca oturum sürümü artar; yeni oturumla ürünlere erişilir.
  const login = await request(app).post('/api/auth/login').send({ email: t.email, password: 'password123' });
  expect(login.body.mfa_required).toBe(true);
});

test('yeni cihazdan giriş kayda geçer; ilk cihaz bildirim üretmez; cihaz kaldırılınca oturum kapanır', async () => {
  const t = A;
  const login = ua => request(app).post('/api/auth/login').set('User-Agent', ua).send({ email: t.email, password: 'password123' });
  const before = Number((await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE tenant_id=$1 AND action='auth.new_device'", [t.tenantId])).rows[0].n);
  await login('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0');
  const second = await login('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile');
  expect(second.status).toBe(200);
  const after = Number((await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE tenant_id=$1 AND action='auth.new_device'", [t.tenantId])).rows[0].n);
  expect(after - before).toBeGreaterThanOrEqual(1);
  const devices = (await request(app).get('/api/auth/devices').set('Authorization', 'Bearer ' + second.body.token)).body;
  expect(devices.map(d => d.label)).toContain('Chrome · Android');
  expect(JSON.stringify(devices)).not.toMatch(/device_hash|\d+\.\d+\.\d+\.\d+/);
  const removed = await request(app).delete('/api/auth/devices/' + devices[0].id).set('Authorization', 'Bearer ' + second.body.token);
  expect(removed.status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + second.body.token)).status).toBe(401);
});

test('destek ekibinin (platform yöneticisi) firmaya erişimi o firmanın işlem kaydına yazılır', async () => {
  await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [A.userId]);
  const login = await request(app).post('/api/auth/login').send({ email: A.email, password: 'password123' });
  const r = await request(app).get('/api/products').set('Authorization', 'Bearer ' + login.body.token).set('x-tenant-id', String(B.tenantId));
  expect(r.status).toBe(200);
  await request(app).get('/api/products').set('Authorization', 'Bearer ' + login.body.token).set('x-tenant-id', String(B.tenantId));
  const rows = (await db.query("SELECT user_email FROM audit_logs WHERE tenant_id=$1 AND action='support.access'", [B.tenantId])).rows;
  expect(rows).toEqual([{ user_email: A.email }]);
  await db.query('DELETE FROM platform_admins WHERE user_id=$1', [A.userId]);
});
