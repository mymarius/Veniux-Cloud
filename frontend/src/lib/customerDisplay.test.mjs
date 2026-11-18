import test from 'node:test';
import assert from 'node:assert/strict';
import { displaySnapshot } from './customerDisplay.mjs';

test('müşteri ekranı özeti: satırlar, adet ve toplam', () => {
  const cart = [{ product: { name: 'Süt' }, quantity: 1, count: 2, unit_price: 30 }, { product: { name: 'Ekmek' }, quantity: 1, count: 1, unit_price: 10 }];
  const s = displaySnapshot({ cart, total: 70, discount: 0 });
  assert.equal(s.lines.length, 2);
  assert.equal(s.lines[0].qty, 2);
  assert.equal(s.lines[0].total, 60);
  assert.equal(s.total, 70);
  assert.equal(s.status, 'cart');
});

test('boş sepet ve bozuk girdi çökmez', () => {
  assert.deepEqual(displaySnapshot({ cart: null, total: 'x' }).lines, []);
  assert.equal(displaySnapshot({ cart: [], total: 'x' }).total, 0);
});
