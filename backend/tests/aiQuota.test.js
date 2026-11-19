const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createTenant } = require('./factories/index');
const aiQuota = require('../src/services/aiQuota');
const entitlements = require('../src/services/entitlementService');

const addUsage = (tenantId, n) => pool.query(
  `INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) ${Array.from({ length: n }, (_, i) => `SELECT ${Number(tenantId)},'t@t.com','ai.query','ai','{}'`).join(' UNION ALL ')}`);

describe('Yapay zekâ aylık kotası', () => {
  beforeEach(() => entitlements._clearLite());

  it('ömür boyu paket 100 sorguyla sınırlı: doluysa 402, kalan 0', async () => {
    const t = await createTenant();
    await pool.query("UPDATE licenses SET plan_id='LIFETIME_DESKTOP', expires_at='2125-01-01 00:00:00', enabled_features_json=$2 WHERE tenant_id=$1", [t.tenantId, JSON.stringify({ module_type: 'NORMAL', cloud_until: '2125-01-01' })]);
    await addUsage(t.tenantId, 100);
    const s = await aiQuota.status({ tenantId: t.tenantId });
    expect(s).toMatchObject({ limit: 100, used: 100, remaining: 0, plan: 'lifetime_desktop' });
    const res = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${t.token}`).send({ message: 'merhaba' });
    expect(res.statusCode).toBe(402);
    expect(res.body.code).toBe('AI_QUOTA');
    expect(res.body.limit).toBe(100);
  });

  it('kota dolmadan önceki ay kayıtları sayılmaz; sınırsız paket adil kullanım tavanı alır', async () => {
    const t = await createTenant();
    await pool.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details,created_at) VALUES ($1,'t@t.com','ai.query','ai','{}','2020-01-15 10:00:00')", [t.tenantId]);
    const s = await aiQuota.status({ tenantId: t.tenantId });
    expect(s.plan).toBe('business_wms');
    expect(s.limit).toBe(aiQuota.FAIR_USE);
    expect(s.used).toBe(0);
    expect(s.fair_use).toBe(true);
  });

  it('kota ucu oturum ister ve kullanımı döner', async () => {
    const t = await createTenant();
    expect((await request(app).get('/api/ai/quota')).statusCode).toBe(401);
    const res = await request(app).get('/api/ai/quota').set('Authorization', `Bearer ${t.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('remaining');
    expect(res.body).toHaveProperty('resets_on');
  });
});
