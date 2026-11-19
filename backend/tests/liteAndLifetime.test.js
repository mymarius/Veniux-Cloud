const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createTenant } = require('./factories/index');
const entitlements = require('../src/services/entitlementService');
const liteDowngrade = require('../src/services/liteDowngrade');

const setLicense = (tenantId, fields) => pool.query(
  "UPDATE licenses SET plan_id=$2, expires_at=$3, status=COALESCE($4,status) WHERE tenant_id=$1",
  [tenantId, fields.plan, fields.expires, fields.status || null]);

describe('Lite ve ömür boyu lisans', () => {
  beforeEach(() => entitlements._clearLite());

  it('süresi (ve ek süresi) dolan ücretli lisans veri silinmeden Lite\'a iner, çalışan lisans etkilenmez', async () => {
    const expired = await createTenant();
    const active = await createTenant();
    await setLicense(expired.tenantId, { plan: 'ENTERPRISE_ANNUAL', expires: "2020-01-01 00:00:00" });
    const result = await liteDowngrade.run();
    expect(result.moved).toContain(expired.tenantId);
    expect(result.moved).not.toContain(active.tenantId);
    const rows = (await pool.query('SELECT plan_id,status FROM licenses WHERE tenant_id=$1 ORDER BY id', [expired.tenantId])).rows;
    expect(rows.map(r => r.plan_id)).toEqual(['ENTERPRISE_ANNUAL', 'LITE_FOREVER']);
    expect(rows[1].status).toBe('ACTIVE');
    // ikinci çalıştırma yeni lisans üretmez
    expect((await liteDowngrade.run()).moved).not.toContain(expired.tenantId);
    // ürünler silinmedi
    expect(Number((await pool.query('SELECT COUNT(*) AS n FROM products WHERE tenant_id=$1', [expired.tenantId])).rows[0].n)).toBeGreaterThan(0);
  });

  it('Lite hesap girebilir ama premium özellikler 402 verir; temel kasa çalışır', async () => {
    const t = await createTenant();
    await setLicense(t.tenantId, { plan: 'LITE_FOREVER', expires: '2125-01-01 00:00:00' });
    const auth = r => r.set('Authorization', `Bearer ${t.token}`);
    const me = await auth(request(app).get('/api/entitlements/me'));
    expect(me.statusCode).toBe(200);
    expect(me.body.plan).toBe('lite');
    const ai = await auth(request(app).get('/api/online-store/products'));
    expect(ai.statusCode).toBe(402);
    expect(ai.body.code).toBe('FEATURE_LOCKED');
    expect((await auth(request(app).get('/api/products'))).statusCode).toBe(200);
  });

  it('ücretli lisanslı hesap kapıdan etkilenmez', async () => {
    const t = await createTenant();
    const res = await request(app).get('/api/entitlements/me').set('Authorization', `Bearer ${t.token}`);
    expect(res.body.plan).toBe('business_wms');
    expect(entitlements.featureFor('/api/online-store/products')).toBe('online_store');
    expect(await entitlements.isLite(t.tenantId)).toBe(false);
  });

  it('ömür boyu lisans: bulut yılı içinde AI açık, bitince kapanır, yerel özellikler kalır', async () => {
    const t = await createTenant();
    const past = '2020-01-01', future = '2125-01-01';
    await pool.query("UPDATE licenses SET plan_id='LIFETIME_DESKTOP', expires_at='2125-01-01 00:00:00', enabled_features_json=$2 WHERE tenant_id=$1", [t.tenantId, JSON.stringify({ module_type: 'NORMAL', cloud_until: future })]);
    let e = await entitlements.forTenant({ tenantId: t.tenantId });
    expect(e.plan).toBe('lifetime_desktop');
    expect(e.has('ai_assistant')).toBe(true);
    await pool.query("UPDATE licenses SET enabled_features_json=$2 WHERE tenant_id=$1", [t.tenantId, JSON.stringify({ module_type: 'NORMAL', cloud_until: past })]);
    e = await entitlements.forTenant({ tenantId: t.tenantId });
    expect(e.has('ai_assistant')).toBe(false);
    expect(e.has('customer_display')).toBe(true);
  });
});
