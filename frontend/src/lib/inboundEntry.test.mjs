import test from 'node:test';
import assert from 'node:assert/strict';
import { findProduct, addScanned, cleanWaybill, shortReceiptNo } from './inboundEntry.mjs';

const products = [
  { id: 1, name: 'Ayran', sku: 'AYR-1', barcode: '8690001844431' },
  { id: 2, name: 'Çay 500 g', sku: 'CAY-5', gtin: '8690002222222' },
  { id: 3, name: 'Süt 1 L', sku: 'SUT-1' }
];
const empty = () => [{ product_id: '', expected_qty: 10, lot_number: '', expiry_date: '' }];

test('barkod, GTIN, SKU ve ad ile ürün bulunur; Türkçe büyük/küçük harf sorun olmaz', () => {
  assert.equal(findProduct(products, '8690001844431').id, 1);
  assert.equal(findProduct(products, '8690002222222').id, 2);
  assert.equal(findProduct(products, 'SUT-1').id, 3);
  assert.equal(findProduct(products, 'çay 500 G').id, 2);
  assert.equal(findProduct(products, '  8690001844431  ').id, 1);
  assert.equal(findProduct(products, '000'), null);
  assert.equal(findProduct(products, ''), null);
});

test('ilk boş kalem doldurulur; aynı ürün tekrar okutulunca miktar artar', () => {
  let r = addScanned(empty(), products, '8690001844431', 6);
  assert.equal(r.status, 'added');
  assert.deepEqual(r.items.map(i => [i.product_id, i.expected_qty]), [[1, 6]]);
  r = addScanned(r.items, products, '8690001844431');
  assert.equal(r.status, 'incremented');
  assert.equal(r.items[0].expected_qty, 7);
});

test('farklı ürün yeni kalem olur; arada boş kalem varsa onu doldurur', () => {
  let r = addScanned(empty(), products, 'AYR-1');
  r = addScanned(r.items, products, 'CAY-5');
  assert.deepEqual(r.items.map(i => i.product_id), [1, 2]);
  const withBlank = [...r.items, { product_id: '', expected_qty: 10, lot_number: '', expiry_date: '' }];
  const filled = addScanned(withBlank, products, 'SUT-1');
  assert.deepEqual(filled.items.map(i => i.product_id), [1, 2, 3]);
});

test('bilinmeyen kod listeyi değiştirmez ve bulunamadı döner; özgün dizi bozulmaz', () => {
  const items = empty();
  const r = addScanned(items, products, 'yok');
  assert.equal(r.status, 'notfound');
  assert.equal(r.items, items);
  assert.equal(items[0].product_id, '');
  assert.equal(addScanned(items, products, 'AYR-1', 0).items[0].expected_qty, 1);
});

test('irsaliye numarası boşsa null gider', () => {
  assert.equal(cleanWaybill(''), null);
  assert.equal(cleanWaybill('   '), null);
  assert.equal(cleanWaybill(undefined), null);
  assert.equal(cleanWaybill(' IRS-1 '), 'IRS-1');
});

test('uzun kabul numarası kısaltılır, kısa numara olduğu gibi kalır', () => {
  assert.equal(shortReceiptNo('INB-2026-ef0d91f1-e773-4761-8b6a-401951448aa7'), 'INB-2026-EF0D91F1');
  assert.equal(shortReceiptNo('INB-2026-0001'), 'INB-2026-0001');
  assert.equal(shortReceiptNo(null), '');
});
