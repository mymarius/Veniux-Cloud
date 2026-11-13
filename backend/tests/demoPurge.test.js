process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const demo = require('../src/services/demoAccount');
const purge = require('../src/services/demoPurge');
const { createTenant } = require('./factories');

const DAY = 86400000;
const sql = ms => new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
const count = async (table, tenantId) => Number((await db.query(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id=$1`, [tenantId])).rows[0].n);
const exists = async tenantId => (await db.query('SELECT id FROM tenants WHERE id=$1', [tenantId])).rows.length === 1;
const expire = (tenantId, ms) => db.query('UPDATE licenses SET expires_at=$1 WHERE tenant_id=$2', [sql(ms), tenantId]);

describe('süresi dolmuş demo işletmelerinin temizliği', () => {
  test('yalnız bekleme süresini aşmış demo işletmeleri silinir; diğerleri ve gerçek müşteri dokunulmaz', async () => {
    const now = Date.now();
    const old = await demo.create(db, { email: `old_${now}@ornek.com`, company: 'Eski', days: 14 });
    const recent = await demo.create(db, { email: `recent_${now}@ornek.com`, company: 'Yeni biten', days: 14 });
    const active = await demo.create(db, { email: `active_${now}@ornek.com`, company: 'Süren', days: 14 });
    await expire(old.tenantId, now - 40 * DAY);
    await expire(recent.tenantId, now - 5 * DAY);
    // Gerçek müşteri (adı demo değil) lisansı çoktan bitmiş olsa bile silinmez
    const real = await createTenant();
    await db.query("UPDATE licenses SET expires_at=$1 WHERE tenant_id=$2", [sql(now - 400 * DAY), real.tenantId]);
    const realProducts = await count('products', real.tenantId);
    const activeProducts = await count('products', active.tenantId);
    expect(activeProducts).toBe(12);

    const dry = await purge.purge(db, { now, graceDays: 30, dryRun: true });
    expect(dry.candidates.map(item => item.id)).toEqual([old.tenantId]);
    expect(await exists(old.tenantId)).toBe(true);

    const result = await purge.purge(db, { now, graceDays: 30 });
    expect(result.failed).toEqual([]);
    expect(result.removed.map(item => item.id)).toEqual([old.tenantId]);

    expect(await exists(old.tenantId)).toBe(false);
    for (const table of ['users', 'products', 'warehouses', 'stock_records', 'stock_movements', 'licenses', 'audit_logs']) expect(await count(table, old.tenantId)).toBe(0);
    expect(await exists(recent.tenantId)).toBe(true);
    expect(await exists(active.tenantId)).toBe(true);
    expect(await count('products', active.tenantId)).toBe(activeProducts);
    expect(await exists(real.tenantId)).toBe(true);
    expect(await count('products', real.tenantId)).toBe(realProducts);

    // Silinen hesap artık giriş yapamaz; süren hesap yapabilir
    expect((await request(app).post('/api/auth/login').send({ email: old.email, password: old.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: active.email, password: active.password })).status).toBe(200);
  });

  test('geçersiz bekleme süresi reddedilir', async () => {
    await expect(purge.purge(db, { graceDays: 0 })).rejects.toThrow();
  });
});
