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

describe('sektör paketi yönetimi (platform yöneticisi)', () => {
  const jwt = require('jsonwebtoken');
  const db = require('../src/config/database');
  const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
  const { createUser } = require('./factories');
  let admin, customer, plain;
  beforeAll(async () => {
    admin = await createTenant(); customer = await createTenant();
    const a = await createUser(admin.tenantId, 'admin');
    await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [a.id]);
    admin = { ...admin, token: jwt.sign({ userId: a.id, tenantId: admin.tenantId, role: 'admin' }, JWT_SECRET) };
    const c = await createUser(customer.tenantId, 'admin');
    plain = { token: jwt.sign({ userId: c.id, tenantId: customer.tenantId, role: 'admin' }, JWT_SECRET) };
  });
  const get = who => request(app).get('/api/sector/packs/admin').set('Authorization', 'Bearer ' + who.token);

  test('platform dışı kullanıcı listeyi göremez', async () => {
    expect((await get(plain)).status).toBe(403);
  });

  test('yönetici tüm işletmeleri ve verilen paketleri görür; verme ve geri alma listeye yansır', async () => {
    const set = packs => request(app).put('/api/sector/packs/admin/' + customer.tenantId).set('Authorization', 'Bearer ' + admin.token).send({ packs });
    expect((await set(['hardware', 'restaurant'])).status).toBe(200);
    let list = (await get(admin)).body;
    expect(list.packs.sort()).toEqual(['hardware', 'restaurant', 'tableware']);
    const row = list.tenants.find(t => t.id === customer.tenantId);
    expect(row.packs).toEqual(['hardware', 'restaurant']);
    expect(typeof row.company_name).toBe('string');
    expect((await set(['tableware'])).status).toBe(200);
    list = (await get(admin)).body;
    expect(list.tenants.find(t => t.id === customer.tenantId).packs).toEqual(['tableware']);
    expect((await set(['bilinmeyen'])).status).toBe(400);
  });
});
