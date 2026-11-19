const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createTenant } = require('./factories/index');

describe('Paket hakları (entitlements)', () => {
  const get = token => request(app).get('/api/entitlements/me').set('Authorization', `Bearer ${token}`);

  it('eski lisans özellik kaybetmez: kurumsal lisans İşletme WMS sayılır', async () => {
    const t = await createTenant();
    const res = await get(t.token);
    expect(res.statusCode).toBe(200);
    expect(res.body.plan).toBe('business_wms');
    expect(res.body.features.wms_map).toBe(true);
    expect(res.body.features.edocument).toBe(true);
    expect(res.body.trial).toBe(false);
    expect(res.body.enforced).toBe(false);
  });

  it('süresi dolmuş lisans bugün kilitli kalır (Lite düşüşü ayrı onayla açılacak)', async () => {
    const t = await createTenant();
    await pool.query("UPDATE licenses SET expires_at=datetime('now','-1 day') WHERE tenant_id=$1", [t.tenantId]);
    expect((await get(t.token)).statusCode).toBe(423);
  });

  it('lisanssız ya da süresi dolmuş hesap için matris Lite hak kümesi verir', async () => {
    const svc = require('../src/services/entitlementService');
    const t = await createTenant();
    await pool.query("UPDATE licenses SET expires_at=datetime('now','-1 day') WHERE tenant_id=$1", [t.tenantId]);
    const e = await svc.forTenant({ tenantId: t.tenantId });
    expect(e.plan).toBe('lite');
    expect(e.has('offline_sales')).toBe(true);
    expect(e.has('ai_assistant')).toBe(false);
  });

  it('deneme hesabı tüm modülleri gösterir ve bitiş tarihini verir', async () => {
    const t = await createTenant();
    await pool.query("UPDATE tenants SET company_name='Veniux Demo – Örnek' WHERE id=$1", [t.tenantId]);
    const res = await get(t.token);
    expect(res.body.trial).toBe(true);
    expect(res.body.features.wms_map).toBe(true);
    expect(res.body.trial_ends_at).toBeTruthy();
  });

  it('katalog paketi modüllerden türetilir', () => {
    const { fromModules } = require('../src/services/entitlementService');
    expect(fromModules(['stock', 'pos'])).toBe('lite');
    expect(fromModules(['stock', 'pos', 'credit', 'reports_pro'])).toBe('pro');
    expect(fromModules(['stock', 'pos', 'wms'])).toBe('business_wms');
  });

  it('kimlik doğrulaması ister', async () => {
    expect((await request(app).get('/api/entitlements/me')).statusCode).toBe(401);
  });
});
