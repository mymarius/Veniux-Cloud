import test from 'node:test';
import assert from 'node:assert/strict';
import { priceOffline, effectiveTier, toCurrency, savePricing, loadPricing } from './offlinePricing.mjs';

const rates = { USD: { rate: 40 } };
test('fiyat türü varsa tür fiyatı, yoksa perakende', () => {
  const p = { sale_price: 100, tiers: { 2: 80 } };
  assert.equal(priceOffline(p, { tier: 2 }).unit_price, 80);
  assert.equal(priceOffline(p, { tier: 3 }).unit_price, 100);
  assert.equal(priceOffline(p, {}).unit_price, 100);
});
test('müşteri kuralı seçilen türü geçersiz kılar ve iskonto uygular', () => {
  const p = { sale_price: 100, tiers: { 2: 80 } };
  const r = priceOffline(p, { tier: 1, customerRule: { price_tier: 2, discount_percent: 10 } });
  assert.deepEqual([r.unit_price, r.price_tier, r.customer_discount], [72, 2, 10]);
  assert.equal(effectiveTier(1, { price_tier: 3 }), 3);
});
test('dövizli ürün kurla çevrilir; tür fiyatı uygulandıysa döviz uygulanmaz; kur yoksa TL fiyat', () => {
  const p = { sale_price: 100, fx: { currency: 'USD', price: 8 }, tiers: { 2: 90 } };
  assert.equal(priceOffline(p, { rates }).unit_price, 320);
  assert.equal(priceOffline(p, { rates }).fx.rate, 40);
  assert.equal(priceOffline(p, { tier: 2, rates }).unit_price, 90);
  assert.equal(priceOffline(p, { rates: {} }).unit_price, 100);
});
test('koli satırına dokunulmaz; döviz karşılığı kuruşa yuvarlanır; depo birleştirir', () => {
  assert.equal(priceOffline({ sale_price: 10, pack: { factor: 6 }, tiers: { 2: 5 } }, { tier: 2 }).unit_price, 10);
  assert.equal(toCurrency(35950, 40), 8.99);
  assert.equal(toCurrency(100, 0), null);
  const mem = new Map(); const st = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  savePricing(st, { rates }); savePricing(st, { customers: [{ id: 1 }] });
  assert.deepEqual(Object.keys(loadPricing(st)).sort(), ['customers', 'rates']);
});
