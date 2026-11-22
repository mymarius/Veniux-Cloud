const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
const fx = require('../src/services/fxAutoService');
let owner;
const auth = r => r.set('Authorization', 'Bearer ' + owner.token);
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="20.11.2026" Date="11/20/2026" Bulten_No="2026/225">
<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><Unit>1</Unit><Isim>ABD DOLARI</Isim><CurrencyName>US DOLLAR</CurrencyName><ForexBuying>38.1000</ForexBuying><ForexSelling>38.1700</ForexSelling><BanknoteBuying>38.07</BanknoteBuying><BanknoteSelling>38.22</BanknoteSelling></Currency>
<Currency CrossOrder="9" Kod="EUR" CurrencyCode="EUR"><Unit>1</Unit><Isim>EURO</Isim><CurrencyName>EURO</CurrencyName><ForexBuying>41.2500</ForexBuying><ForexSelling>41.3200</ForexSelling></Currency>
<Currency CrossOrder="10" Kod="GBP" CurrencyCode="GBP"><Unit>1</Unit><Isim>İNGİLİZ STERLİNİ</Isim><CurrencyName>POUND STERLING</CurrencyName><ForexBuying>48.5000</ForexBuying><ForexSelling>48.6100</ForexSelling></Currency>
<Currency CrossOrder="15" Kod="JPY" CurrencyCode="JPY"><Unit>100</Unit><Isim>JAPON YENİ</Isim><ForexBuying>24.5</ForexBuying><ForexSelling>24.6</ForexSelling></Currency>
</Tarih_Date>`;
const okFetch = async () => ({ ok: true, text: async () => XML });
const badFetch = async () => { throw new Error('ağ yok'); };
const quiet = { warn() {}, info() {} };
beforeAll(async () => { owner = await f.createTenant(); });

test('TCMB XML sınanır: yalnız USD/EUR/GBP, satış ve alış, tarih', () => {
  const p = fx.parseTcmb(XML);
  expect(p.date).toBe('2026-11-20');
  expect(Object.keys(p.rates).sort()).toEqual(['EUR', 'GBP', 'USD']);
  expect(p.rates.USD).toEqual({ selling: 38.17, buying: 38.1 });
  expect(() => fx.parseTcmb('<html>hata</html>')).toThrow();
});

test('otomatik açılınca kur gelir ve "otomatik" işaretlenir; elle girilen kur ezilmez', async () => {
  await auth(request(app).put('/api/products/currency-rates')).send({ EUR: 40 });
  const app2 = app; app2.locals.fxFetch = okFetch;
  const r = await auth(request(app).put('/api/products/currency-rates/auto')).send({ enabled: true });
  app2.locals.fxFetch = undefined;
  expect(r.status).toBe(200);
  expect(r.body.auto).toMatchObject({ auto_enabled: true, last_status: 'ok', rates_date: '2026-11-20' });
  expect(r.body.rates.USD).toMatchObject({ rate: 38.17, source: 'auto', buying: 38.1, rates_date: '2026-11-20' });
  expect(r.body.rates.GBP).toMatchObject({ rate: 48.61, source: 'auto' });
  expect(r.body.rates.EUR).toMatchObject({ rate: 40, source: 'manual' });
});

test('zamanlayıcı: elle kur ezilmez, otomatik kur güncellenir; kapalı işletmeye dokunmaz', async () => {
  const other = await f.createTenant();
  const out = await fx.run({ fetchImpl: async () => ({ ok: true, text: async () => XML.replace('38.1700', '39.0000') }), log: quiet });
  expect(out.updated).toBeGreaterThanOrEqual(1);
  const rows = (await db.query('SELECT currency,rate_try FROM exchange_rates WHERE tenant_id=$1', [owner.tenantId])).rows;
  expect(Number(rows.find(r => r.currency === 'USD').rate_try)).toBe(39);
  expect(Number(rows.find(r => r.currency === 'EUR').rate_try)).toBe(40);
  expect((await db.query('SELECT 1 FROM exchange_rates WHERE tenant_id=$1', [other.tenantId])).rows.length).toBe(0);
});

test('ağ hatasında son kur korunur ve hata durumu yazılır', async () => {
  const out = await fx.run({ fetchImpl: badFetch, log: quiet });
  expect(out.error).toMatch(/ağ yok/);
  const r = await auth(request(app).get('/api/products/currency-rates'));
  expect(r.body.rates.USD.rate).toBe(39);
  expect(r.body.auto).toMatchObject({ last_status: 'error', last_error: 'ağ yok' });
  const bad = await fx.run({ fetchImpl: async () => ({ ok: true, text: async () => '<x/>' }), log: quiet });
  expect(bad.error).toMatch(/okunamadı/);
  const http = await fx.run({ fetchImpl: async () => ({ ok: false, status: 503 }), log: quiet });
  expect(http.error).toMatch(/503/);
});

test('elle değiştirilen otomatik kur "elle" olur; aynı değeri geri göndermek kaynağı bozmaz; silinen kur otomatiğe döner', async () => {
  let r = await auth(request(app).put('/api/products/currency-rates')).send({ USD: 39, EUR: 40, GBP: 48.61 });
  expect(r.body.rates.USD.source).toBe('auto');
  r = await auth(request(app).put('/api/products/currency-rates')).send({ GBP: 50 });
  expect(r.body.rates.GBP).toMatchObject({ rate: 50, source: 'manual' });
  await fx.run({ fetchImpl: okFetch, log: quiet });
  expect((await auth(request(app).get('/api/products/currency-rates'))).body.rates.GBP.rate).toBe(50);
  await auth(request(app).put('/api/products/currency-rates')).send({ GBP: null });
  await fx.run({ fetchImpl: okFetch, log: quiet });
  expect((await auth(request(app).get('/api/products/currency-rates'))).body.rates.GBP).toMatchObject({ rate: 48.61, source: 'auto' });
});

test('otomatik kapatılınca kur güncellenmez; kasiyer kur ayarını değiştiremez', async () => {
  await auth(request(app).put('/api/products/currency-rates/auto')).send({ enabled: false });
  const before = (await auth(request(app).get('/api/products/currency-rates'))).body.rates.USD.rate;
  await fx.run({ fetchImpl: async () => ({ ok: true, text: async () => XML.replace('38.1700', '45.0000') }), log: quiet });
  expect((await auth(request(app).get('/api/products/currency-rates'))).body.rates.USD.rate).toBe(before);
  const cashier = await f.createUser(owner.tenantId, 'cashier');
  const login = await request(app).post('/api/auth/login').send({ email: cashier.email, password: 'password123' });
  const res = await request(app).put('/api/products/currency-rates/auto').set('Authorization', 'Bearer ' + login.body.token).send({ enabled: true });
  expect(res.status).toBe(403);
});
