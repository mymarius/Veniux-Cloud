import test from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin } from './imageFit.mjs';

test('büyük fotoğraf uzun kenara göre küçülür, oran korunur', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1024), { width: 1024, height: 768 });
  assert.deepEqual(fitWithin(3000, 4000, 1024), { width: 768, height: 1024 });
});
test('küçük fotoğraf büyütülmez; geçersiz ölçü sıfır döner', () => {
  assert.deepEqual(fitWithin(640, 480, 1024), { width: 640, height: 480 });
  assert.deepEqual(fitWithin(0, 100), { width: 0, height: 0 });
});
