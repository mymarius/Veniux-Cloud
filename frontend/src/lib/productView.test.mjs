import test from 'node:test';
import assert from 'node:assert/strict';
import { stockState, matchesView, countViews, sortProducts, nextSort } from './productView.mjs';

const list = [
  { id: 1, name: 'Ayran', total_quantity: 114, min_stock_level: 10, barcode: '869', purchase_price: 12, sale_price: 30 },
  { id: 2, name: 'Çay', total_quantity: 4, min_stock_level: 10, barcode: '870', purchase_price: 5, sale_price: 9 },
  { id: 3, name: 'Künefe', total_quantity: 2, min_stock_level: 0, purchase_price: 0, sale_price: 140 },
  { id: 4, name: 'Pide', total_quantity: 0, min_stock_level: 5, gtin: '871', purchase_price: 0, sale_price: 80 }
];

test('stok durumu: tükendi, kritik, normal', () => {
  assert.deepEqual(list.map(stockState), ['ok', 'low', 'ok', 'out']);
  assert.equal(stockState({ total_quantity: 3, min_stock_level: 3 }), 'low');
  assert.equal(stockState({}), 'out');
});

test('hızlı filtreler doğru ürünleri seçer ve sayar', () => {
  assert.deepEqual(list.filter(p => matchesView(p, 'low')).map(p => p.id), [2]);
  assert.deepEqual(list.filter(p => matchesView(p, 'out')).map(p => p.id), [4]);
  assert.deepEqual(list.filter(p => matchesView(p, 'nobarcode')).map(p => p.id), [3]);
  assert.deepEqual(list.filter(p => matchesView(p, 'nocost')).map(p => p.id), [3, 4]);
  assert.deepEqual(countViews(list), { all: 4, low: 1, out: 1, nobarcode: 1, nocost: 2 });
  assert.deepEqual(countViews([]), { all: 0, low: 0, out: 0, nobarcode: 0, nocost: 0 });
});

test('sıralama: Türkçe ad sırası, sayısal sütunlar, azalan yön; liste bozulmaz', () => {
  assert.deepEqual(sortProducts(list, 'name').map(p => p.name), ['Ayran', 'Çay', 'Künefe', 'Pide']);
  assert.deepEqual(sortProducts(list, 'stock', 'desc').map(p => p.id), [1, 2, 3, 4]);
  assert.deepEqual(sortProducts(list, 'price').map(p => p.id), [2, 1, 4, 3]);
  assert.deepEqual(sortProducts(list, 'cost', 'desc').map(p => p.id).slice(0, 2), [1, 2]);
  assert.equal(sortProducts(list, 'bilinmeyen'), list);
  assert.deepEqual(list.map(p => p.id), [1, 2, 3, 4]);
});

test('başlığa tıklama döngüsü: artan, azalan, sıralamasız', () => {
  let s = { key: null, dir: 'asc' };
  s = nextSort(s, 'stock'); assert.deepEqual(s, { key: 'stock', dir: 'asc' });
  s = nextSort(s, 'stock'); assert.deepEqual(s, { key: 'stock', dir: 'desc' });
  s = nextSort(s, 'stock'); assert.deepEqual(s, { key: null, dir: 'asc' });
  assert.deepEqual(nextSort({ key: 'stock', dir: 'desc' }, 'price'), { key: 'price', dir: 'asc' });
});
