const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database');
const { createTenant, createWarehouse, openTestShift } = require('./factories');
const currency = require('../src/services/currencyService');

async function shop(base) {
  const owner = await createTenant();
  await db.query('UPDATE tenants SET currency=$1 WHERE id=$2', [base, owner.tenantId]);
  const warehouse = await createWarehouse(owner.tenantId);
  const product = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES ($1,$2,'Döviz Testi','000-FX','adet',100,'NORMAL') RETURNING *", [owner.tenantId, 'FX-' + Math.random().toString(36).slice(2)])).rows[0];
  await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,50)', [owner.tenantId, warehouse.id, product.id]);
  await openTestShift(owner, warehouse.id, 100);
  const call = (method, path, body) => request(app)[method](path).set('Authorization', 'Bearer ' + owner.token).send(body);
  return { owner, warehouse, product, call };
}

test('TRY ana birimli işletme: yabancı para listesi eskisi gibi USD/EUR/GBP', async () => {
  const s = await shop('TRY');
  const r = await s.call('get', '/api/products/currency-rates');
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ base: 'TRY', currencies: ['USD', 'EUR', 'GBP'], auto_supported: true });
});

test('AZN ana birimli işletme: yabancı paralar TRY/USD/EUR/GBP, AZN yabancı değil; kur ana birime göre; kasa ödemesi AZN iken döviz sayılmaz', async () => {
  const s = await shop('AZN');
  const r = await s.call('get', '/api/products/currency-rates');
  expect(r.body).toMatchObject({ base: 'AZN', currencies: ['TRY', 'USD', 'EUR', 'GBP'], auto_supported: false });
  // AZN için kur girilemez (ana birim); USD kuru 1.7 AZN
  const put = await s.call('put', '/api/products/currency-rates', { USD: 1.7, AZN: 5 });
  expect(put.status).toBe(200);
  expect(put.body.rates.USD.rate).toBe(1.7);
  expect(put.body.rates.AZN).toBeUndefined();
  expect((await db.query("SELECT COUNT(*) c FROM exchange_rates WHERE tenant_id=$1 AND currency='AZN'", [s.owner.tenantId])).rows[0].c).toBe(0);
  // kasiyer görünümü aynı listeyi ve ana birimi verir
  const cashier = await s.call('get', '/api/scanner/fx');
  expect(cashier.body).toMatchObject({ base: 'AZN', currencies: ['TRY', 'USD', 'EUR', 'GBP'] });
  // ürün döviz fiyatı: USD kabul, AZN reddedilir
  expect((await s.call('put', '/api/products/' + s.product.id + '/currency-price', { currency: 'USD', price: 10 })).status).toBe(200);
  expect((await s.call('put', '/api/products/' + s.product.id + '/currency-price', { currency: 'AZN', price: 10 })).status).toBe(400);
  // ödeme para birimi: ana birim (AZN) döviz değildir, USD ise kur çevrilir, TRY için kur yok
  await db.transaction(async tx => {
    expect(await currency.paymentCurrency(tx, s.owner.tenantId, 'AZN', 1700)).toBeNull();
    expect(await currency.paymentCurrency(tx, s.owner.tenantId, undefined, 1700)).toBeNull();
    expect(await currency.paymentCurrency(tx, s.owner.tenantId, 'USD', 1700)).toEqual({ currency: 'USD', rate: 1.7, amount: 10 });
    await expect(currency.paymentCurrency(tx, s.owner.tenantId, 'TRY', 1700)).rejects.toThrow(/kur girilmemiş/);
    await expect(currency.paymentCurrency(tx, s.owner.tenantId, 'JPY', 1700)).rejects.toThrow(/geçersiz/);
  });
});

test('otomatik kur (TCMB, TL karşılığı) yalnız TRY ana birimli işletmede açılabilir', async () => {
  const s = await shop('AZN');
  const r = await s.call('put', '/api/products/currency-rates/auto', { enabled: true });
  expect(r.status).toBe(400);
  expect(r.body.error).toMatch(/TRY/);
  const t = await shop('TRY');
  expect((await t.call('put', '/api/products/currency-rates/auto', { enabled: false })).status).toBe(200);
});
