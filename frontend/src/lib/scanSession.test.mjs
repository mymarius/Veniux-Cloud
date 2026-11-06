import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySession, parseSession, recordCheck, addToList, removeFromList, checkTotals } from './scanSession.mjs';

const found = { barcode: '869', product: { id: 7, name: 'Kahve', sale_price: 46 } };

test('aynı barkodda son karar geçerli olur, sayaç şişmez', () => {
  let s = recordCheck(emptySession('2026-11-07'), found, '869', true);
  s = recordCheck(s, found, '869', false);
  assert.deepEqual(checkTotals(s), { total: 1, right: 0, wrong: 1 });
});

test('kayıtsız barkod da hatalı olarak tutulabilir', () => {
  const s = recordCheck(emptySession('2026-11-07'), { barcode: '111', product: null }, '111', false);
  assert.equal(s.checks[0].name, 'Kayıtlı olmayan barkod');
  assert.equal(s.checks[0].price, null);
});

test('liste tekrar eklemez, silinebilir', () => {
  let s = addToList(emptySession('2026-11-07'), found, '869');
  s = addToList(s, found, '869');
  assert.equal(s.list.length, 1);
  assert.equal(removeFromList(s, '869').list.length, 0);
});

test('başka günün ve bozuk kaydın sayaçları taşınmaz', () => {
  const old = JSON.stringify(recordCheck(emptySession('2026-11-06'), found, '869', true));
  assert.equal(parseSession(old, '2026-11-07').checks.length, 0);
  assert.equal(parseSession('{bozuk', '2026-11-07').checks.length, 0);
  assert.equal(parseSession(old, '2026-11-06').checks.length, 1);
});
