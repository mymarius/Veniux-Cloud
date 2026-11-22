const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
let owner, cashier;
const get = (u, url = '/api/diagnostics/app') => request(app).get(url).set('Authorization', 'Bearer ' + u.token);
beforeAll(async () => {
  owner = await f.createTenant();
  const u = await f.createUser(owner.tenantId, 'cashier');
  cashier = { token: (await request(app).post('/api/auth/login').send({ email: u.email, password: 'password123' })).body.token };
});

test('sunucu tanılaması gerçek ölçümler döndürür; sır içermez', async () => {
  const r = await get(owner);
  expect(r.status).toBe(200);
  const by = Object.fromEntries(r.body.results.map(x => [x.id, x]));
  expect(by['app.database']).toMatchObject({ status: 'ok' });
  expect(by['app.database'].data.latencyMs).toBeGreaterThanOrEqual(0);
  expect(by['app.license']).toMatchObject({ status: 'ok' });
  expect(by['app.license'].data.days_left).toBeGreaterThan(300);
  expect(by['app.sync'].status).toBe('unavailable');
  expect(by['app.offline-sales']).toMatchObject({ status: 'ok' });
  expect(by['app.ecr'].status).toBe('unavailable'); // cihaz kayıtlı değil: başarısızlık değil, ölçülemedi
  for (const x of r.body.results) expect(['ok', 'warn', 'fail', 'unavailable']).toContain(x.status);
  const text = JSON.stringify(r.body);
  expect(text).not.toMatch(/VNX-TEST/);
  expect(text).not.toContain(owner.email);
});

const direct = () => require('../src/services/diagnosticsService').run({ tenantId: owner.tenantId, role: 'admin', email: owner.email });
test('lisans bitmişse fail, yakında bitiyorsa warn, kayıt yoksa unavailable (süresi dolan lisans API yi zaten kapatır, bu yüzden hizmet doğrudan çağrılır)', async () => {
  const lic = id => direct().then(r => r.results.find(x => x.id === id));
  await db.query("UPDATE licenses SET expires_at=datetime('now','-3 day') WHERE tenant_id=$1", [owner.tenantId]);
  const expired = await lic('app.license');
  expect(expired.status).toBe('fail');
  expect(expired.data.days_left).toBeLessThan(0);
  await db.query("UPDATE licenses SET expires_at=datetime('now','+5 day') WHERE tenant_id=$1", [owner.tenantId]);
  expect((await lic('app.license')).status).toBe('warn');
  const saved = (await db.query('SELECT * FROM licenses WHERE tenant_id=$1', [owner.tenantId])).rows[0];
  await db.query('DELETE FROM licenses WHERE tenant_id=$1', [owner.tenantId]);
  expect((await lic('app.license')).status).toBe('unavailable');
  await db.query("INSERT INTO licenses (license_key,tenant_id,plan_id,status,max_users,max_warehouses,max_devices,expires_at) VALUES ($1,$2,$3,'ACTIVE',100,100,100,datetime('now','+1 year'))", [saved.license_key + '-R', owner.tenantId, saved.plan_id]);
});

test('eşitleme hatası ve ÖKC durumu gerçek kayıtlardan okunur; doğrulanmamış sürücüye bağlantı denenmez', async () => {
  await db.query("INSERT INTO store_sync_config (tenant_id,cloud_url,device_key,enabled,last_error) VALUES ($1,'https://x.example','k',1,'ağ yok')", [owner.tenantId]);
  const sync = (await get(owner)).body.results.find(x => x.id === 'app.sync');
  expect(sync).toMatchObject({ status: 'fail', detail: 'ağ yok' });
  await request(app).post('/api/ecr/devices').set('Authorization', 'Bearer ' + owner.token).send({ brand: 'simulator', connection: 'simulated', name: 'Deneme ÖKC' });
  await request(app).post('/api/ecr/devices').set('Authorization', 'Bearer ' + owner.token).send({ brand: 'hugin', connection: 'serial', name: 'Hugin 1' });
  const ecr = (await get(owner)).body.results.find(x => x.id === 'app.ecr');
  expect(ecr.status).toBe('ok');
  expect(ecr.summary).toMatch(/simülatör yanıt verdi/);
  expect(ecr.summary).toMatch(/sürücü kurulu değil \(bağlantı denenemedi\)/);
});

test('yalnız yönetici/müdür erişir', async () => {
  expect((await get(cashier)).status).toBe(403);
  expect((await request(app).get('/api/diagnostics/app')).status).toBe(401);
});
