const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const service = require('../src/services/alertDeliveryService');
const { createTenant } = require('./factories');

let owner;
const as = r => r.set('Authorization', 'Bearer ' + owner.token);
const noon = new Date('2026-11-09T09:00:00Z'); // İstanbul 12:00
const night = new Date('2026-11-09T21:00:00Z'); // İstanbul 00:00
const base = { channels: { email: true, sms: true, whatsapp: false }, types: { low_stock: true, expiry: true, count_variance: false }, quietStart: 22, quietEnd: 8, dailyLimit: 2, extraEmails: [] };
const alert = (type, message, severity = 'warning') => db.query("INSERT INTO alerts (tenant_id,product_id,warehouse_id,alert_type,severity,message,status,created_at) VALUES ($1,NULL,NULL,$2,$3,$4,'unread',$5)", [owner.tenantId, type, severity, message, '2026-11-09 08:30:00']);
const fakeSend = () => { const calls = []; return { calls, email: async (to, text) => { calls.push(['email', to, text]); return 'sent'; }, sms: async (to, text) => { calls.push(['sms', to, text]); return 'accepted'; }, whatsapp: async () => 'accepted' }; };

beforeAll(async () => {
  owner = await createTenant();
  await db.query("UPDATE tenants SET owner_phone='05321112233', company_name='Deneme Market' WHERE id=$1", [owner.tenantId]);
});

test('tercih kaydı: yalnız yönetici; yeni ek alıcı için izin onayı zorunlu ve kayıt altına alınır', async () => {
  expect((await as(request(app).put('/api/settings/alert-delivery')).send({ ...base, extraEmails: ['muhasebe@market.test'] })).status).toBe(400);
  const ok = await as(request(app).put('/api/settings/alert-delivery')).send({ ...base, extraEmails: ['muhasebe@market.test'], consentConfirmed: true });
  expect(ok.status).toBe(200);
  expect(ok.body.consentConfirmedBy).toBe(owner.email);
  expect((await as(request(app).put('/api/settings/alert-delivery')).send({ ...base, quietStart: 30 })).status).toBe(400);
  expect((await as(request(app).put('/api/settings/alert-delivery')).send(base)).status).toBe(200);
});

test('özet bir kez gider, kapalı tür gönderilmez, sessiz saatte beklenir, günlük sınır uygulanır', async () => {
  await alert('low_stock', 'Çay stoğu 2 adet, alt sınır 10', 'critical');
  await alert('expiry', '[lot:5:1] Lot A1: son kullanma tarihi 2026-11-20. Miktar: 4.');
  await alert('count_variance', 'Sayım onay bekliyor: Sabun 3 adet eksik');
  let send = fakeSend();
  expect(await service.deliver(owner.tenantId, { now: night, send })).toEqual({ skipped: 'quiet_hours' });
  expect(send.calls).toHaveLength(0);
  const first = await service.deliver(owner.tenantId, { now: noon, send });
  expect(first.email).toEqual({ status: 'sent', alerts: 2 });
  expect(first.sms).toEqual({ status: 'accepted', alerts: 2 });
  const [, smsTo, smsText] = send.calls.find(c => c[0] === 'sms');
  expect(smsTo).toBe('05321112233');
  expect(smsText).toContain('Kritik stok: Çay stoğu');
  expect(smsText).toContain('Miadı yaklaşan: Lot A1');
  expect(smsText).not.toContain('[lot:');
  expect(smsText).not.toContain('Sabun');
  send = fakeSend();
  expect((await service.deliver(owner.tenantId, { now: noon, send })).email).toBe('nothing');
  expect(send.calls).toHaveLength(0);
  await alert('low_stock', 'Makarna stoğu bitti', 'critical');
  await service.deliver(owner.tenantId, { now: noon, send });
  await alert('low_stock', 'Un stoğu bitti', 'critical');
  const third = await service.deliver(owner.tenantId, { now: noon, send });
  expect(third.email).toBe('daily_limit');
});

test('SMS ayarlı değilse uyarı gönderildi sayılmaz, sonra yeniden denenir', async () => {
  const fresh = await createTenant();
  await db.query("UPDATE tenants SET owner_phone='05329998877' WHERE id=$1", [fresh.tenantId]);
  await require('../src/services/settingsPolicyService').save(fresh.tenantId, 'alert_delivery', { ...base, channels: { email: false, sms: true, whatsapp: false } });
  await db.query("INSERT INTO alerts (tenant_id,alert_type,severity,message,status,created_at) VALUES ($1,'low_stock','critical','Süt bitti','unread','2026-11-09 08:30:00')", [fresh.tenantId]);
  const r = await service.deliver(fresh.tenantId, { now: noon, send: { sms: async () => 'not_configured' } });
  expect(r.sms).toEqual({ status: 'not_configured', alerts: 1 });
  expect((await db.query('SELECT COUNT(*) AS n FROM alert_deliveries WHERE tenant_id=$1', [fresh.tenantId])).rows[0].n).toBe(0);
});
