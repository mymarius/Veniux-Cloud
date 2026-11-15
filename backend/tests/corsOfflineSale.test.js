// Çevrimdışı satış, bağlantı gelince başka kaynaktan (telefon uygulaması, masaüstü) gönderilir.
// Tarayıcı önce OPTIONS ile sorar; X-Veniux-Offline başlığına izin verilmezse satış sunucuya hiç ulaşmaz ve cihazda kalır.
const request = require('supertest');
const app = require('../src/index');

test('çevrimdışı satışın başlıkları CORS ön kontrolünde izinli', async () => {
  const origin = 'http://localhost:5173';
  const res = await request(app).options('/api/scanner/sale')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key,x-veniux-offline,x-device-id,x-veniux-device-token');
  expect(res.status).toBeLessThan(300);
  const allowed = String(res.headers['access-control-allow-headers'] || '').toLowerCase().split(',').map(s => s.trim());
  for (const name of ['idempotency-key', 'x-veniux-offline', 'authorization']) expect(allowed).toContain(name);
});
