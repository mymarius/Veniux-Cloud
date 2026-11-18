import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVariant, groupVariants, collapseVariants, cellQty } from './variantGroups.mjs';

const P = (id, name, q) => ({ id, name, sku: 'S' + id, total_quantity: q });
const list = [P(1, 'Tişört · S · Kırmızı', 3), P(2, 'Tişört · M · Kırmızı', 0), P(3, 'Tişört · S · Mavi', 5), P(4, 'Ekmek', 9), P(5, 'Tek · X', 1)];

test('ad ayrıştırma', () => {
  assert.deepEqual(parseVariant('Tişört · M · Mavi'), { base: 'Tişört', size: 'M', color: 'Mavi' });
  assert.equal(parseVariant('Ekmek'), null);
});
test('gruplama: en az iki çeşit, toplam stok, beden ve renkler', () => {
  const g = groupVariants(list);
  assert.equal(g.length, 1);
  assert.equal(g[0].total, 8);
  assert.deepEqual(g[0].sizes, ['S', 'M']);
  assert.deepEqual(g[0].colors, ['Kırmızı', 'Mavi']);
  assert.equal(cellQty(g[0], 'S', 'Mavi'), 5);
  assert.equal(cellQty(g[0], 'M', 'Mavi'), null);
});
test('liste daraltma: grup tek satır, diğerleri aynen', () => {
  const out = collapseVariants(list);
  assert.deepEqual(out.map(p => p.name), ['Tişört', 'Ekmek', 'Tek · X']);
  assert.equal(out[0].total_quantity, 8);
  assert.equal(out[0].sku, '3 çeşit');
});
