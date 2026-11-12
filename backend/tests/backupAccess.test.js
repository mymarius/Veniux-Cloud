const express = require('express'), request = require('supertest');

jest.mock('../src/middlewares/authMiddleware', () => ({ authMiddleware: (req, res, next) => { req.user = JSON.parse(req.get('x-test-user')); next(); } }));
jest.mock('../src/services/backupService', () => ({ summary: () => ({ ok: true }), health: () => mockHealth }));
const mockHealth = { level: 'error', messages: ['Son yedek alınamadı.'] };
const tenants = { count: 1, id: 7 };
jest.mock('../src/config/database', () => ({ query: async sql => ({ rows: [/COUNT/.test(sql) ? { n: tenants.count } : { id: tenants.id }] }) }));

const app = express(); app.use('/api/backups', require('../src/routes/backupRoutes'));
const get = user => request(app).get('/api/backups').set('x-test-user', JSON.stringify(user));
const admin = { role: 'admin', tenantId: 7, accessScope: { mode: 'company' } };
const saved = { ...process.env };
beforeEach(() => { process.env.VENIUX_DESKTOP_RESTORE = '1'; delete process.env.VENIUX_CLOUD_SERVICE; tenants.count = 1; tenants.id = 7; });
afterAll(() => { process.env = saved; });

test('masaüstünde tek firmanın yöneticisi yedeği yönetir', async () => { expect((await get(admin)).status).toBe(200); });
test('müdür, kasiyer ve depo yetkisi sınırlı yönetici yönetemez', async () => {
  for (const user of [{ ...admin, role: 'manager' }, { ...admin, role: 'cashier' }, { ...admin, accessScope: { mode: 'restricted' } }]) expect((await get(user)).status).toBe(403);
});
test('birden çok firmalı veritabanında veya başka firmada izin yok', async () => {
  tenants.count = 2; expect((await get(admin)).status).toBe(403);
  tenants.count = 1; tenants.id = 8; expect((await get(admin)).status).toBe(403);
});
test('bulutta ve masaüstü dışında yalnız platform yöneticisi', async () => {
  process.env.VENIUX_CLOUD_SERVICE = '1'; expect((await get(admin)).status).toBe(403);
  delete process.env.VENIUX_CLOUD_SERVICE; delete process.env.VENIUX_DESKTOP_RESTORE; expect((await get(admin)).status).toBe(403);
  expect((await get({ role: 'admin', isPlatformAdmin: true })).status).toBe(200);
});

test('yedek sağlığı: yalnız platform ve tek firmalı masaüstü yöneticisi gerçek durumu görür, bulut firma yöneticisi her zaman ok görür', async () => {
  const health = user => request(app).get('/api/backups/health').set('x-test-user', JSON.stringify(user));
  // Masaüstü, tek firma: gerçek durum
  expect((await health(admin)).body.level).toBe('error');
  // Bulut firma yöneticisi ve müdür: sistem yedeğini düzeltemez, uyarı görmez
  process.env.VENIUX_CLOUD_SERVICE = '1';
  expect((await health(admin)).body).toEqual({ level: 'ok', messages: [] });
  expect((await health({ ...admin, role: 'manager' })).body.level).toBe('ok');
  // Platform yöneticisi: gerçek durum
  expect((await health({ role: 'admin', isPlatformAdmin: true })).body.level).toBe('error');
  // Kasiyer: yetki yok
  expect((await health({ ...admin, role: 'cashier' })).status).toBe(403);
});
