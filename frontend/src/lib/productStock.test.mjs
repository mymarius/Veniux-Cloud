import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProductStock } from './productStock.mjs';

test('empty bin ledger cannot erase warehouse stock', () => {
  assert.equal(summarizeProductStock({warehouse_stocks: [{quantity: '25'}]}, {on_hand: 0}).total_quantity, 25);
});
test('warehouse and bin quantities are not counted twice', () => {
  assert.equal(summarizeProductStock({warehouse_stocks: [{quantity: 0}]}, {on_hand: 100}).total_quantity, 0);
});
test('fractional warehouse quantities and reservations are preserved', () => {
  const result = summarizeProductStock({warehouse_stocks: [{quantity: '2.5'}, {quantity: '1.25'}]}, {reserved: '0.5'});
  assert.equal(result.total_quantity, 3.75);
  assert.equal(result.available_quantity, 3.25);
});
test('bin quantity is a fallback only when warehouse records are unavailable', () => {
  assert.equal(summarizeProductStock({}, {on_hand: 5, reserved: 8}).available_quantity, 0);
  assert.equal(summarizeProductStock({}, {on_hand: 5}).total_quantity, 5);
});
