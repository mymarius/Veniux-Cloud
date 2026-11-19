import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCategory, categoryOptions, inCategory } from './categoryTree.mjs';

test('yazım tek biçime çevrilir, en çok iki seviye', () => {
  assert.equal(normalizeCategory('İçecek>Gazlı'), 'İçecek › Gazlı');
  assert.equal(normalizeCategory(' İçecek  ›  Gazlı '), 'İçecek › Gazlı');
  assert.equal(normalizeCategory('A › B › C'), 'A › B');
  assert.equal(normalizeCategory(''), '');
});

test('filtre listesinde üst grup alt grubundan önce gelir ve girintilidir', () => {
  const o = categoryOptions(['İçecek › Gazlı', 'Gıda', 'İçecek › Su', 'Gıda']);
  assert.deepEqual(o.map(x => x.value), ['Gıda', 'İçecek', 'İçecek › Gazlı', 'İçecek › Su']);
  assert.equal(o[2].depth, 1);
  assert.equal(o[2].label, '— Gazlı');
});

test('üst grup seçilince alt grup ürünleri de gelir', () => {
  assert.equal(inCategory('İçecek › Gazlı', 'İçecek'), true);
  assert.equal(inCategory('İçecek', 'İçecek'), true);
  assert.equal(inCategory('İçecekler', 'İçecek'), false);
  assert.equal(inCategory('Gıda', 'İçecek › Gazlı'), false);
  assert.equal(inCategory('Gıda', ''), true);
});
