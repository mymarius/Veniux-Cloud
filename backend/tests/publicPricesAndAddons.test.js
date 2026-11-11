process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const app = require('../src/index');
const sectorPacks = require('../src/services/sectorPacks');
const publicPrices = require('../src/routes/publicPrices');
const { createTenant } = require('./factories');

describe('herkese açık fiyat özeti', () => {
  test('oturum olmadan okunur; yalnız satışa açık planlar ve fiyat alanları döner', async () => {
    const response = await request(app).get('/api/public/prices');
    expect(response.status).toBe(200);
    expect(response.body.currency).toBe('TRY');
    expect(response.body.plans.length).toBeGreaterThanOrEqual(13);
    const sector = response.body.sector.map(item => item.pack).sort();
    expect(sector).toEqual(['hardware', 'restaurant', 'tableware']);
    for (const plan of response.body.plans) expect(Object.keys(plan).sort()).toEqual(['annual_cents', 'code', 'discount_percent', 'family', 'modules', 'monthly_cents', 'name']);
    expect(JSON.stringify(response.body)).not.toMatch(/users|warehouses|devices|tenant/i);
  });

  test('satışa kapalı plan listeye girmez ve fiyatlar katalogdan olduğu gibi taşınır', () => {
    const body = publicPrices.shape({ revision: 3, plans: [
      { code: 'RETAIL_HIRDAVAT', family: 'retail', name: 'Hırdavat', modules: ['stock', 'pos', 'hardware'], monthly_cents: 18900, annual_cents: 178800, discount_percent: 0, available: true },
      { code: 'RETAIL_PIDE', family: 'retail', name: 'Pide', modules: ['stock', 'pos', 'restaurant'], monthly_cents: null, annual_cents: null, discount_percent: 0, available: false }
    ] });
    expect(body.revision).toBe(3);
    expect(body.plans.map(plan => plan.code)).toEqual(['RETAIL_HIRDAVAT']);
    expect(body.sector).toEqual([{ pack: 'hardware', code: 'RETAIL_HIRDAVAT', name: 'Hırdavat', monthly_cents: 18900, annual_cents: 178800 }]);
  });
});

describe('lisanstaki sektör paketi', () => {
  let tenant;
  beforeAll(async () => { tenant = await createTenant(); });
  const user = () => ({ tenantId: tenant.tenantId, isPlatformAdmin: false });

  test('lisans merkezi imzalı yanıtında işaretlenen paket açılır, diğerleri kapalı kalır', async () => {
    const central = { valid: true, addons: ['hardware', 'restaurant'] };
    expect(await sectorPacks.has(user(), 'hardware', central)).toBe(true);
    expect(await sectorPacks.has(user(), 'restaurant', central)).toBe(true);
    expect(await sectorPacks.has(user(), 'tableware', central)).toBe(false);
  });

  test('addons yoksa ya da geçersizse hak verilmez', async () => {
    expect(await sectorPacks.has(user(), 'hardware', { valid: true })).toBe(false);
    expect(await sectorPacks.has(user(), 'hardware', { valid: true, addons: 'hardware' })).toBe(false);
    expect(await sectorPacks.has(user(), 'hardware', null)).toBe(false);
    expect(await sectorPacks.has(user(), 'bilinmeyen', { valid: true, addons: ['bilinmeyen'] })).toBe(false);
  });
});
