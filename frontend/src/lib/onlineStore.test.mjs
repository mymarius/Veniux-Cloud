import test from 'node:test';
import assert from 'node:assert/strict';
import { cartAdd, cartCount, cartPayload, cartSet, cartSubtotal, cartTotals, fitSize, lineStep, loadCart, newIdempotencyKey, orderActions, qtyLabel, shopUrl, statusLabel } from './onlineStore.mjs';

test('fitSize: oranı korur, büyütmez, en az 1 piksel', () => {
  assert.deepEqual(fitSize(4000, 2000, 1200), { width: 1200, height: 600 });
  assert.deepEqual(fitSize(800, 600, 1200), { width: 800, height: 600 });
  assert.deepEqual(fitSize(1, 5000, 1200), { width: 1, height: 1200 });
  assert.deepEqual(fitSize(0, 0, 1200), { width: 1, height: 1 });
});

test('orderActions: sunucudaki durum makinesiyle uyumlu, birincil işlem ilk, iptal sonda', () => {
  assert.deepEqual(orderActions('new').map(a => a.status), ['confirmed', 'cancelled']);
  assert.equal(orderActions('new')[0].primary, true);
  assert.deepEqual(orderActions('preparing').map(a => a.status), ['ready', 'confirmed', 'cancelled']);
  assert.match(orderActions('preparing')[1].label, /Geri al/);
  assert.deepEqual(orderActions('delivered'), []);
  assert.deepEqual(orderActions('cancelled'), []);
  assert.equal(statusLabel('ready'), 'Hazır');
});

test('shopUrl: eğik çizgi tekrarı olmadan', () => {
  assert.equal(shopUrl('https://app.veniux.com/', 'ornek-magaza'), 'https://app.veniux.com/magaza/ornek-magaza');
});

test('sepet: ekle, üst sınır, değiştir, sıfıra düşünce sil', () => {
  let cart = cartAdd({}, { id: 1, name: 'Bardak', price: 10.5, max_per_order: 3 }, 2);
  assert.equal(cart[1].quantity, 2);
  cart = cartAdd(cart, { id: 1, name: 'Bardak', price: 10.5, max_per_order: 3 }, 5);
  assert.equal(cart[1].quantity, 3);
  cart = cartAdd(cart, { id: 2, name: 'Tabak', price: 20 });
  assert.equal(cartCount(cart), 4);
  assert.equal(cartSubtotal(cart), 51.5);
  cart = cartSet(cart, 1, 0);
  assert.equal(cart[1], undefined);
  assert.equal(cartSet(cart, 99, 3), cart);
  assert.equal(cartSet(cart, 2, 9999)[2].quantity, 50);
  assert.deepEqual(cartAdd({}, { id: 1, name: 'x', price: 1 }, 0), {});
});

test('kuruş doğruluğu: 0,1 + 0,2 gibi toplamlar kayar noktaya düşmez', () => {
  const cart = { 1: { id: 1, name: 'a', price: 0.1, quantity: 3, max: 50 }, 2: { id: 2, name: 'b', price: 0.2, quantity: 3, max: 50 } };
  assert.equal(cartSubtotal(cart), 0.9);
});

test('cartTotals: teslimat ücreti, ücretsiz eşik, mağazadan teslim, minimum sepet', () => {
  const store = { delivery_fee: 30, free_delivery_over: 500, min_order: 50 };
  const small = { 1: { id: 1, name: 'a', price: 20, quantity: 1, max: 50 } };
  assert.deepEqual(cartTotals(small, store, 'delivery'), { subtotal: 20, fee: 30, total: 50, belowMin: true, missing: 30 });
  const mid = { 1: { id: 1, name: 'a', price: 100, quantity: 2, max: 50 } };
  assert.deepEqual(cartTotals(mid, store, 'delivery'), { subtotal: 200, fee: 30, total: 230, belowMin: false, missing: 0 });
  assert.equal(cartTotals(mid, store, 'pickup').fee, 0);
  const big = { 1: { id: 1, name: 'a', price: 250, quantity: 2, max: 50 } };
  assert.equal(cartTotals(big, store, 'delivery').fee, 0);
  assert.equal(cartTotals(mid, { delivery_fee: 0, free_delivery_over: null, min_order: 0 }, 'delivery').total, 200);
});

test('cartPayload: beklenen fiyat sunucuya gider (fiyat değişimi onayı için)', () => {
  assert.deepEqual(cartPayload({ 7: { id: 7, name: 'x', price: 12.5, quantity: 2, max: 50 } }), [{ product_id: 7, quantity: 2, expected_price: 12.5 }]);
});

test('loadCart: bozuk kayıtta boş sepet; idempotency anahtarı benzersiz', () => {
  const store = value => ({ getItem: () => value });
  assert.deepEqual(loadCart(store('{bozuk'), 'a'), {});
  assert.deepEqual(loadCart(store('[1,2]'), 'a'), {});
  assert.deepEqual(loadCart(store(null), 'a'), {});
  assert.deepEqual(loadCart(store('{"1":{"id":1,"quantity":2}}'), 'a'), { 1: { id: 1, quantity: 2 } });
  assert.notEqual(newIdempotencyKey(), newIdempotencyKey());
  assert.match(newIdempotencyKey(), /^shop-[a-z0-9]{8,}$/);
});

test('ölçülü ürün: adım, minimum, kuruş yuvarlama ve etiket', () => {
  const tea = { id: 9, name: 'Çay', price: 200, measured: true, step: 0.25, min_qty: 0.5, unit_label: 'kg', max_per_order: 5 };
  let cart = cartAdd({}, tea);
  assert.equal(cart[9].quantity, 0.5);
  cart = cartSet(cart, 9, cart[9].quantity + lineStep(cart[9]));
  assert.equal(cart[9].quantity, 0.75);
  assert.equal(qtyLabel(cart[9]), '0,75 kg');
  assert.equal(cartSubtotal(cart), 150);
  cart = cartSet(cart, 9, 1.1);
  assert.equal(cart[9].quantity, 1);
  cart = cartSet(cart, 9, 99);
  assert.equal(cart[9].quantity, 5);
  assert.deepEqual(cartSet(cartAdd({}, tea), 9, 0.25), {});
  assert.equal(cartCount(cartAdd(cartAdd({}, tea), { id: 1, name: 'Bardak', price: 10, max_per_order: null }, 3)), 4);
  assert.equal(cartPayload(cartAdd({}, tea, 1.75))[0].quantity, 1.75);
  assert.equal(cartSubtotal(cartAdd({}, { id: 2, name: 'x', price: 33.33, measured: true, step: 0.001, min_qty: 0.001, unit_label: 'kg' }, 1.5)), 50);
});
