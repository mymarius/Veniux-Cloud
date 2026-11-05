import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScan, countKey, countProgress } from './countScan.mjs';

const a1 = { location_id: 1, location_code: 'A-01', product_id: 10, lot_id: null, sku: 'SKU-1', barcode: '869', product_name: 'Kahve' };
const a2 = { location_id: 2, location_code: 'A-02', product_id: 10, lot_id: null, sku: 'SKU-1', barcode: '869', product_name: 'Kahve' };
const b1 = { location_id: 1, location_code: 'A-01', product_id: 20, lot_id: null, sku: 'SKU-2', barcode: '', product_name: 'Çay' };

test('barkod ve SKU sayacı birer artırır', () => {
  let r = applyScan([a1, b1], {}, '869');
  r = applyScan([a1, b1], r.counts, '869');
  assert.equal(r.counts[countKey(a1)], '2');
  r = applyScan([a1, b1], r.counts, 'sku-2');
  assert.equal(r.counts[countKey(b1)], '1');
});
test('aynı ürün iki raftaysa raf okutulmadan saymaz, raf seçilince doğru satırı sayar', () => {
  const ambiguous = applyScan([a1, a2], {}, '869');
  assert.match(ambiguous.error, /Önce raf/);
  assert.deepEqual(ambiguous.counts, {});
  const shelf = applyScan([a1, a2], {}, 'A-02');
  assert.equal(shelf.location, 2);
  const counted = applyScan([a1, a2], shelf.counts, '869', shelf.location);
  assert.equal(counted.counts[countKey(a2)], '1');
  assert.equal(counted.counts[countKey(a1)], undefined);
});
test('listede olmayan ve seçili rafta olmayan ürün sayılmaz', () => {
  assert.match(applyScan([a1], {}, '000').error, /listesinde yok/);
  assert.match(applyScan([a1, b1, a2], {}, 'SKU-2', 2).error, /seçili rafta/);
});
test('boş göz satırı ilerlemeye girmez, boş kod ve boş barkod eşleşmez', () => {
  const empty = { location_id: 3, location_code: 'B-01', product_id: null };
  assert.deepEqual(countProgress([a1, b1, empty], { [countKey(a1)]: '0' }), { done: 1, total: 2, percent: 50 });
  assert.match(applyScan([b1], {}, '  ').error, /boş/);
});
