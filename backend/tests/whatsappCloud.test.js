const http = require('http');
const cloud = require('../src/services/whatsappCloudService');
let server, calls = [], reply = { code: 200, body: { messaging_product: 'whatsapp', messages: [{ id: 'wamid.TEST' }] } };
const env = () => ({ WHATSAPP_CLOUD_TOKEN: 'gizli-anahtar', WHATSAPP_CLOUD_PHONE_ID: '106540352242922', WHATSAPP_CLOUD_TEMPLATE: 'veniux_uyari', WHATSAPP_CLOUD_TEST_BASE_URL: 'http://127.0.0.1:' + server.address().port });
beforeAll(async () => {
  server = http.createServer((req, res) => { let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => { calls.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) }); res.writeHead(reply.code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(reply.body)); }); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
});
afterAll(() => new Promise(r => server.close(r)));

test('belgedeki biçimde şablon mesajı gönderir; satır sonları tek satıra çevrilir', async () => {
  expect(await cloud.send('0532 111 22 33', 'Veniux: 2 yeni uyarı\n• Kritik stok: Çay\n• Miat: Süt', env())).toMatchObject({ status: 'accepted' });
  const c = calls[0];
  expect(c.url).toBe('/v27.0/106540352242922/messages');
  expect(c.auth).toBe('Bearer gizli-anahtar');
  expect(c.body).toEqual({ messaging_product: 'whatsapp', recipient_type: 'individual', to: '+905321112233', type: 'template', template: { name: 'veniux_uyari', language: { code: 'tr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Veniux: 2 yeni uyarı · • Kritik stok: Çay · • Miat: Süt' }] }] } });
});

test('ayar yoksa göndermez; geçersiz anahtar ve ret anlaşılır döner; ağ hatası belirsiz sayılır', async () => {
  expect(await cloud.send('05321112233', 'x', {})).toEqual({ status: 'not_configured' });
  expect(await cloud.send('12', 'x', env())).toEqual({ status: 'invalid_phone' });
  reply = { code: 401, body: { error: { code: 190 } } };
  expect((await cloud.send('05321112233', 'x', env())).detail).toContain('anahtarı geçersiz');
  reply = { code: 400, body: { error: { code: 132001 } } };
  expect((await cloud.send('05321112233', 'x', env())).detail).toContain('132001');
  expect(await cloud.send('05321112233', 'x', { ...env(), WHATSAPP_CLOUD_TEST_BASE_URL: 'http://127.0.0.1:1' })).toEqual({ status: 'unknown' });
});
