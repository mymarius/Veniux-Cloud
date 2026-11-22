import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScan, validCheckDigit, scanIntoLines, feedbackFor, feedbackForCount, tally } from './serialScan.mjs';

const products = [
  { id: 1, name: 'Ayran', sku: 'AYR-1', barcode: '8690001844431' },
  { id: 2, name: 'Çay', sku: 'CAY-5', barcode: '4006381333931' },
  { id: 3, name: 'Süt', sku: 'SUT-1' }
];
const make = (p, q) => ({ product_id: p.id, quantity: q, unit_price: 5 });

test('okuyucu soneki, ön eki, Enter ve Tab temizlenir', () => {
  assert.equal(normalizeScan('8690001844431\r\n'), '8690001844431');
  assert.equal(normalizeScan('8690001844431\t'), '8690001844431');
  assert.equal(normalizeScan('*8690001844431#', { prefix: '*', suffix: '#' }), '8690001844431');
  assert.equal(normalizeScan('  SUT-1 \n'), 'SUT-1');
  assert.equal(normalizeScan(null), '');
});

test('kontrol hanesi: geçerli ve bozuk EAN-13', () => {
  assert.equal(validCheckDigit('4006381333931'), true);
  assert.equal(validCheckDigit('4006381333932'), false);
  assert.equal(validCheckDigit('SUT-1'), false);
});

test('arka arkaya okutma: ilk okutma satır ekler, tekrar okutma adedi artırır, farklı ürün yeni satır olur', () => {
  let lines = [{ product_id: '', quantity: 1, unit_price: 0 }];
  let r = scanIntoLines(lines, products, '4006381333931\n', { make });
  assert.equal(r.status, 'added'); assert.deepEqual(r.lines.map(l => l.product_id), [2]); lines = r.lines;
  r = scanIntoLines(lines, products, '4006381333931', { make });
  assert.equal(r.status, 'incremented'); assert.equal(r.quantity, 2); lines = r.lines;
  r = scanIntoLines(lines, products, '4006381333931', { make });
  assert.equal(r.quantity, 3); lines = r.lines;
  r = scanIntoLines(lines, products, 'SUT-1', { make });
  assert.equal(r.status, 'added'); assert.equal(r.lines.length, 2);
  assert.deepEqual(r.lines.map(l => l.quantity), [3, 1]);
});

test('yanlış barkod: bulunamaz; kontrol hanesi bozuksa ipucu verilir; satırlar değişmez', () => {
  const lines = [{ product_id: 1, quantity: 2 }];
  let r = scanIntoLines(lines, products, '4006381333932', { make });
  assert.equal(r.status, 'notfound'); assert.equal(r.hint, 'checksum'); assert.equal(r.lines, lines);
  r = scanIntoLines(lines, products, 'XYZ-999', { make });
  assert.equal(r.status, 'notfound'); assert.equal(r.hint, 'unknown');
  assert.equal(scanIntoLines(lines, products, '\r\n', { make }).status, 'empty');
  assert.match(feedbackFor(scanIntoLines(lines, products, '4006381333932', { make })).text, /yanlış okunmuş/);
});

test('geri bildirim: ekleme/artırma başarılı ses, hata hata sesi ve titreşimi', () => {
  const ok = feedbackFor({ status: 'incremented', product: products[0], quantity: 4, code: 'x' });
  assert.deepEqual([ok.tone, ok.beep], ['ok', 'success']); assert.match(ok.text, /Ayran → 4/);
  const bad = feedbackFor({ status: 'notfound', code: '123', hint: 'unknown' });
  assert.deepEqual([bad.tone, bad.beep], ['error', 'error']); assert.ok(bad.vibrate.length > 1);
  assert.equal(feedbackForCount({ error: 'Yok.' }).beep, 'error');
  assert.equal(feedbackForCount({ shelf: 'A-1' }).text, 'Raf seçildi: A-1');
  assert.equal(feedbackForCount({ row: { product_name: 'Süt' }, quantity: 7 }).text, 'Süt: 7');
});

test('sayaç: toplamlar ve son 5 okutma', () => {
  let t = null;
  for (let i = 0; i < 7; i++) t = tally(t, { status: i % 2 ? 'incremented' : 'added', code: 'c' + i, product: products[0] }, i);
  t = tally(t, { status: 'notfound', code: 'bad' }, 9);
  t = tally(t, { status: 'empty', code: '' }, 10);
  assert.deepEqual([t.total, t.added, t.incremented, t.notfound], [8, 4, 3, 1]);
  assert.equal(t.recent.length, 5); assert.equal(t.recent[0].code, 'bad');
});
