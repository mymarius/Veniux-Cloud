import test from 'node:test';
import assert from 'node:assert/strict';
import { addEntry, setQuantity, removeRow, rowIssues, readiness, toLines, chunk, parseDraft, serializeDraft } from './bulkReceive.mjs';

const existing = (barcode, product_id, extra = {}) => ({ kind: 'existing', barcode, product_id, name: 'Ürün ' + product_id, ...extra });
const fresh = (barcode, extra = {}) => ({ kind: 'new', barcode, name: 'Yeni', unit: 'adet', purchase_price: '5', sale_price: '8', ...extra });

test('aynı barkod miktarı artırır; baştaki sıfırlı eşdeğer aynı ürün', () => {
  let r = addEntry([], existing('8690000100019', 1)).rows;
  let out = addEntry(r, existing('8690000100019', 1), 3);
  assert.equal(out.status, 'incremented'); assert.equal(out.rows[0].quantity, 4); assert.equal(out.rows.length, 1);
  out = addEntry(out.rows, existing('08690000100019', 1));
  assert.equal(out.rows.length, 1); assert.equal(out.rows[0].quantity, 5);
  out = addEntry(out.rows, existing('8690000100026', 2));
  assert.equal(out.status, 'added'); assert.equal(out.rows.length, 2);
});

test('adım geçersizse 1 sayılır; miktar sınırlanır ve tam sayı kalır', () => {
  const r = addEntry([], existing('111', 1), 'x').rows;
  assert.equal(r[0].quantity, 1);
  assert.equal(setQuantity(r, r[0].id, '7.9')[0].quantity, 7);
  assert.equal(setQuantity(r, r[0].id, -5)[0].quantity, 0);
  assert.equal(setQuantity(r, r[0].id, 99999999)[0].quantity, 1000000);
  assert.equal(removeRow(r, r[0].id).length, 0);
});

test('yeni ürün için ad, iki ondalıklı fiyatlar ve birim zorunlu; mevcut ürün yalnız miktar ister', () => {
  const ok = addEntry([], fresh('222')).rows[0];
  assert.deepEqual(rowIssues(ok), []);
  assert.equal(rowIssues({ ...ok, name: ' ' }).length, 1);
  assert.equal(rowIssues({ ...ok, sale_price: '' }).length, 1);
  assert.equal(rowIssues({ ...ok, purchase_price: '1,999' }).length, 1);
  assert.deepEqual(rowIssues({ ...ok, purchase_price: '1,50' }), []);
  assert.equal(rowIssues({ ...ok, unit: 'koli' }).length, 1);
  assert.deepEqual(rowIssues(addEntry([], existing('333', 3)).rows[0]), []);
  assert.equal(rowIssues({ ...addEntry([], existing('333', 3)).rows[0], quantity: 0 }).length, 1);
});

test('hazırlık özeti ve sunucu satırları: virgüllü fiyat sayıya, koli barkodu korunur', () => {
  let rows = addEntry([], existing('8690000100026', 2, { pack: { unit: 'koli', factor: 12 } }), 2).rows;
  rows = addEntry(rows, fresh('444', { sale_price: '8,50' }), 5).rows;
  const state = readiness(rows);
  assert.deepEqual({ ready: state.ready, lines: state.lines, units: state.units, news: state.news }, { ready: true, lines: 2, units: 7, news: 1 });
  assert.deepEqual(toLines(rows), [
    { product_id: 2, barcode: '8690000100026', quantity: 2 },
    { barcode: '444', name: 'Yeni', unit: 'adet', purchase_price: 5, sale_price: 8.5, quantity: 5 }
  ]);
  const bad = readiness([...rows, { ...fresh('555'), id: 'x', sale_price: '', quantity: 1 }]);
  assert.equal(bad.ready, false); assert.equal(bad.problems[0].id, 'x');
  assert.equal(readiness([]).ready, false);
});

test('500 satırlık parçalara bölünür', () => {
  const rows = Array.from({ length: 1203 }, (_, i) => ({ id: 'r' + i }));
  assert.deepEqual(chunk(rows).map(c => c.length), [500, 500, 203]);
});

test('taslak: gidiş-dönüş çalışır, bozuk/eski biçim yok sayılır', () => {
  const rows = addEntry([], existing('111', 1), 4).rows;
  const back = parseDraft(serializeDraft(rows, 7));
  assert.equal(back.warehouse, '7'); assert.equal(back.rows[0].quantity, 4); assert.equal(back.rows[0].barcode, '111');
  assert.equal(parseDraft('{bozuk'), null);
  assert.equal(parseDraft('{"rows":"x"}'), null);
  assert.equal(parseDraft(JSON.stringify({ rows: [{ kind: 'zzz', quantity: 1 }, { kind: 'new', quantity: 'a' }] })).rows.length, 0);
});
