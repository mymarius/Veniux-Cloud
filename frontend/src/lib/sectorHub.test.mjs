import test from 'node:test';
import assert from 'node:assert/strict';
import { newItems, idsOf, criticalKey, wholesalerText, whatsappLink, cartAdd, cartNote, cartTotal, cartCount, cartPayload, kitchenNew, waitMinutes, waitLevel, feedMessage, pickPrinter } from './sectorHub.mjs';

test('bildirim farkı: yalnız daha önce görülmeyenler yeni; biten ürün ayrıca yeni sayılır', () => {
  const items = [{ id: 1, empty: false }, { id: 2, empty: false }];
  assert.deepEqual(newItems([], items, criticalKey).map(i => i.id), [1, 2]);
  const seen = idsOf(items, criticalKey);
  assert.deepEqual(newItems(seen, items, criticalKey), []);
  assert.deepEqual(newItems(seen, [{ id: 1, empty: true }, { id: 3, empty: false }], criticalKey).map(i => i.id), [1, 3]);
  assert.deepEqual(newItems(null, null), []);
});

test('toptancı mesajı ve WhatsApp bağlantısı: numara biçimleri', () => {
  const text = wholesalerText([{ name: 'Vida M3x20', stock: 12, unit: 'kutu', empty: false }, { name: 'Dübel 8', empty: true }]);
  assert.match(text, /Vida M3x20 \(12 kutu kaldı\)/); assert.match(text, /Dübel 8 \(bitti\)/);
  assert.equal(whatsappLink('0532 123 45 67', 'a b').startsWith('https://wa.me/905321234567?text=a%20b'), true);
  assert.equal(whatsappLink('532 123 45 67', 'x').startsWith('https://wa.me/905321234567'), true);
  assert.equal(whatsappLink('+90 532 123 45 67', 'x').startsWith('https://wa.me/905321234567'), true);
  assert.equal(whatsappLink('', 'x'), 'https://wa.me/?text=x');
  assert.equal(whatsappLink('12', 'x'), 'https://wa.me/?text=x');
});

test('garson sepeti: ekle, artır, azalt, sıfırlanınca çıkar, not, toplam ve sunucu gövdesi', () => {
  const pide = { id: 1, name: 'Kıymalı pide', price: 120 }, ayran = { id: 2, name: 'Ayran', price: 25 };
  let cart = new Map();
  cart = cartAdd(cart, pide); cart = cartAdd(cart, pide); cart = cartAdd(cart, ayran);
  assert.equal(cartCount(cart), 3); assert.equal(cartTotal(cart), 265);
  cart = cartNote(cart, 1, 'bol kaşarlı');
  assert.deepEqual(cartPayload(cart), [{ product_id: 1, quantity: 2, note: 'bol kaşarlı' }, { product_id: 2, quantity: 1 }]);
  cart = cartAdd(cart, ayran, -1);
  assert.equal(cart.has(2), false); assert.equal(cartTotal(cart), 240);
  assert.equal(cartAdd(new Map(), pide, 500).get(1).quantity, 100);
  assert.equal(cartAdd(new Map(), pide, -1).size, 0);
  const original = new Map(); cartAdd(original, pide); assert.equal(original.size, 0); // değişmez
});

test('mutfak: yeni kalem sayılır (ötme), bekleme süresi ve renk seviyesi', () => {
  const orders = [{ items: [{ id: 1 }, { id: 2 }] }, { items: [{ id: 3 }] }];
  assert.deepEqual(kitchenNew([1, 2], orders), { ids: [1, 2, 3], fresh: 1 });
  assert.equal(kitchenNew([], orders).fresh, 3);
  assert.equal(kitchenNew([1, 2, 3], orders).fresh, 0);
  const now = Date.parse('2026-11-11T10:30:00Z');
  assert.equal(waitMinutes('2026-11-11 10:12:00', now), 18);
  assert.equal(waitMinutes('2026-11-11T10:29:30Z', now), 0);
  assert.equal(waitMinutes('bozuk', now), 0);
  assert.deepEqual([5, 10, 20].map(waitLevel), ['ok', 'warn', 'late']);
});

test('esnaf bildirimi ve yazıcı seçimi', () => {
  assert.equal(feedMessage([]), '');
  assert.equal(feedMessage([{ type: 'masa', table: 'Masa 4', text: '2× Kıymalı pide' }]), 'Sipariş geldi: Masa 4 · 2× Kıymalı pide');
  assert.equal(feedMessage([{ type: 'motor', text: 'x' }, { type: 'masa', table: 'M1', text: 'y' }]), '2 yeni sipariş geldi (son: Motor)');
  assert.deepEqual(pickPrinter([{ station_id: 's1', printers: [] }, { station_id: 's2', printers: [{ name: 'A' }, { name: 'B', is_default: true }] }]), { station_id: 's2', printer_name: 'B' });
  assert.equal(pickPrinter([]), null);
});
