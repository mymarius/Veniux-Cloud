import test from 'node:test';
import assert from 'node:assert/strict';
import { quickCash } from './quickCash.mjs';
test('hızlı nakit: tutarı karşılayan banknotlar', () => {
  assert.deepEqual(quickCash(63), [100, 200, 500]);
  assert.deepEqual(quickCash(20), [50, 100, 200]);
  assert.deepEqual(quickCash(450), [500]);
  assert.deepEqual(quickCash(900), []);
  assert.deepEqual(quickCash('x'), [50, 100, 200]);
});
