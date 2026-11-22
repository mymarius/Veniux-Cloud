import test from 'node:test';
import assert from 'node:assert/strict';
import { exceptionReport, approvalSummary } from './countSummary.mjs';
import { countKey } from './countScan.mjs';

const rows = [{ location_id: 1, product_id: 1, lot_id: null }, { location_id: 1, product_id: 2, lot_id: null }, { location_id: 2, product_id: null }, { location_id: 3, product_id: 3, lot_id: 5 }];
test('istisna: sayılmayan satırlar ayrılır, boş göz sayılmaz', () => {
  const r = exceptionReport(rows, { [countKey(rows[0])]: '4', [countKey(rows[1])]: '' });
  assert.equal(r.total, 3); assert.equal(r.counted.length, 1); assert.equal(r.uncounted.length, 2); assert.equal(r.complete, false);
  assert.equal(exceptionReport([rows[0]], { [countKey(rows[0])]: '0' }).complete, true);
});
test('onay özeti: fazla, eksik, eşleşen, net ve en büyük farklar', () => {
  const s = approvalSummary([{ system_qty: 10, counted_qty: 10 }, { system_qty: 10, counted_qty: 7.5 }, { system_qty: 3, counted_qty: 8 }, { system_qty: 0, counted_qty: 1 }]);
  assert.deepEqual([s.lines, s.match, s.surplus, s.shortage], [4, 1, 2, 1]);
  assert.equal(s.surplusQty, 6); assert.equal(s.shortageQty, -2.5); assert.equal(s.net, 3.5);
  assert.equal(s.largest[0].diff, 5);
  assert.equal(approvalSummary([]).lines, 0);
});
