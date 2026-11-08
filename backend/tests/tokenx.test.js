const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/index');
const tokenx = require('../src/services/tokenxAdapter');
const external = require('../src/services/retailExternalService');
const { createTenant } = require('./factories/index');

// Belgedeki BASKET_COMPLETED örneği (developer.tokeninc.com, Token X Connect Cloud).
const completed = id => ({ terminalId: 'AV00000000001', clientId: 'c', operation: 'BASKET_COMPLETED', operationDate: '2025-03-10T08:42:18.640Z', data: { basketID: id, documentType: 0, invoiceID: '', message: 'OK', paymentCount: 1, paymentItems: [{ amount: 4000, BatchNo: 0, currencyId: 0, description: 'Payment with cash', operatorId: 0, status: -1, TxnNo: 0, type: 1 }], receiptNo: 2, status: 0, zNo: 87 } });
const env = { TOKENX_AUTH_URL: 'https://auth.test', TOKENX_API_URL: 'https://api.test', TOKENX_CLIENT_ID: 'cid', TOKENX_CLIENT_SECRET: 'gizli', TOKENX_TERMINAL_ID: 'AV00000000001', TOKENX_PATH_ADD_INSTANT: '/baskets/instant', TOKENX_PATH_GET_BASKET: '/baskets/{basketID}', TOKENX_CALLBACK_AUTH: 'paylasilan-gizli-deger-123' };
const saved = { ...process.env };
afterAll(() => { process.env = saved; });

test('sepet belgedeki biçimde: kuruş, miktar ×1000, KDV ×100', () => {
  expect(tokenx.toBasket('b1', [{ name: 'Pizza', quantity: 1, unit_price_cents: 15000, vat_rate: 10 }, { name: 'Kıyma', quantity: 1.25, unit_price_cents: 44990, vat_rate: 1 }]))
    .toEqual({ basketID: 'b1', items: [{ name: 'Pizza', price: 15000, sectionNo: 1, taxPercent: 1000, quantity: 1000 }, { name: 'Kıyma', price: 44990, sectionNo: 1, taxPercent: 100, quantity: 1250 }] });
  expect(() => tokenx.toBasket('b', [])).toThrow();
  expect(() => tokenx.toBasket('b', [{ name: 'x', quantity: 1, unit_price_cents: 1.5, vat_rate: 20 }])).toThrow();
});

test('sonuç belgedeki bildirimlerden okunur', () => {
  expect(tokenx.parseResult(completed('b'))).toMatchObject({ status: 'success', receipt_no: 2, z_no: 87, payments: [{ type: 1, amount_cents: 4000 }] });
  expect(tokenx.parseResult({ operation: 'BASKET_COMPLETED', data: { receiptNo: 0, status: -1, message: 'CANCELLED' } }).status).toBe('failed');
  expect(tokenx.parseResult({ operation: 'BASKET_COMPLETED', data: { receiptNo: 3, status: 99 } }).reason).toBe('Fiş iptal edildi');
  expect(tokenx.parseResult({ status: 0, result: { status: 0, isLocked: false, paymentItems: [] } }).status).toBe('unknown');
});

test('adaptör oturum açar, sepeti gönderir, toplam tutmazsa göndermez, iptal ve iadeyi reddeder', async () => {
  const calls = [];
  const fake = async (url, init) => { calls.push({ url, init }); const json = url.endsWith('/v1/auth/token') ? { status: 201, result: { accessToken: 'erisim', expiresIn: 86400, tokenType: 'Bearer' } } : { status: 0, description: 'ok' }; return { ok: true, json: async () => json }; };
  const a = tokenx.adapter(tokenx.config(env), fake);
  const items = [{ name: 'Çay', quantity: 2, unit_price_cents: 1500, vat_rate: 20 }];
  expect((await a.execute({ id: 'id-1', action: 'sale', amount_cents: 3000, items })).status).toBe('unknown');
  expect(calls[0].init.headers.Authorization).toBe('Basic ' + Buffer.from('cid:gizli').toString('base64'));
  expect(calls[1].url).toBe('https://api.test/baskets/instant');
  expect(calls[1].init.headers).toMatchObject({ Authorization: 'Bearer erisim', 'terminal-id': 'AV00000000001' });
  expect(JSON.parse(calls[1].init.body)).toMatchObject({ basketID: 'id-1', items: [{ name: 'Çay', price: 1500, quantity: 2000, taxPercent: 2000 }] });
  await a.execute({ id: 'id-2', action: 'sale', amount_cents: 3000, items });
  expect(calls.filter(c => c.url.endsWith('/v1/auth/token'))).toHaveLength(1);
  const before = calls.length;
  expect((await a.execute({ id: 'id-3', action: 'sale', amount_cents: 2999, items })).status).toBe('failed');
  expect((await a.execute({ id: 'id-4', action: 'refund', amount_cents: 3000, items })).status).toBe('failed');
  expect(calls.length).toBe(before);
});

test('HTTP adres reddedilir; ayar eksikse adaptör kapalıdır', () => {
  expect(() => tokenx.config({ ...env, TOKENX_API_URL: 'http://api.test' })).toThrow('HTTPS');
  expect(tokenx.config({ ...env, TOKENX_PATH_GET_BASKET: '' })).toBe(null);
});

test('satış cihaza gider, bildirimle tamamlanır; yetkisiz bildirim reddedilir', async () => {
  Object.assign(process.env, env);
  const owner = await createTenant();
  external.register('tokenx', tokenx.adapter(tokenx.config(), async url => ({ ok: true, json: async () => url.endsWith('/v1/auth/token') ? { result: { accessToken: 'e', expiresIn: 3600 } } : { status: 0 } })));
  const sale = await request(app).post('/api/scanner/pro/okc').set('Authorization', 'Bearer ' + owner.token).set('Idempotency-Key', crypto.randomUUID())
    .send({ profile: 'tokenx', action: 'sale', amount: 30, items: [{ name: 'Çay', quantity: 2, unit_price_cents: 1500, vat_rate: 20 }] });
  expect(sale.status).toBe(200);
  expect(sale.body.status).toBe('unknown');
  expect((await request(app).post('/integrations/tokenx/callback').set('Authorization', 'yanlis').send(completed(sale.body.id))).status).toBe(401);
  const ok = await request(app).post('/integrations/tokenx/callback').set('Authorization', env.TOKENX_CALLBACK_AUTH).send(completed(sale.body.id));
  expect(ok.body).toEqual({ received: true, matched: true });
  const after = await request(app).get('/api/scanner/pro/okc/' + sale.body.id).set('Authorization', 'Bearer ' + owner.token);
  expect(after.body.status).toBe('success');
  expect((await request(app).post('/integrations/tokenx/callback').set('Authorization', env.TOKENX_CALLBACK_AUTH).send(completed(crypto.randomUUID()))).body.matched).toBe(false);
});
