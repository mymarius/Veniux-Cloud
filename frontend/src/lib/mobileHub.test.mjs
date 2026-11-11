import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, priceMatches, createLabelLog, createProductList, greeting, initials, roleLabel } from './mobileHub.mjs';

const memory = () => { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; };
const broken = { getItem() { throw new Error('kapalı'); }, setItem() { throw new Error('kapalı'); }, removeItem() { throw new Error('kapalı'); } };

test('fiyat yazımı: Türkçe ve noktalı biçimler, geçersiz girişler reddedilir', () => {
  assert.equal(parsePrice('29,90'), 29.9);
  assert.equal(parsePrice('29.90'), 29.9);
  assert.equal(parsePrice('1.299,90'), 1299.9);
  assert.equal(parsePrice('1.299'), 1299);
  assert.equal(parsePrice('₺ 45'), 45);
  assert.equal(parsePrice('12 TL'), 12);
  for (const bad of ['', 'abc', '1,2,3', '1.2.3', '-5', null, undefined, '1e5']) assert.equal(parsePrice(bad), null, String(bad));
});

test('fiyat eşleşmesi kuruş hassasiyetindedir', () => {
  assert.equal(priceMatches(29.9, '29.90'), true);
  assert.equal(priceMatches(29.9, 29.91), false);
  assert.equal(priceMatches(0.1 + 0.2, 0.3), true);
});

test('etiket kontrolü: doğru sayılır, hatalı etiket listelenir, aynı ürün tekrar hatalıysa güncellenir, gün ve mağaza ayrıdır', () => {
  const storage = memory(), log = createLabelLog(storage, 'A:1'), now = new Date('2026-11-11T10:00:00Z');
  assert.deepEqual(log.load('2026-11-11'), { correct: 0, wrong: [] });
  assert.equal(log.record({ barcode: '1', name: 'Süt', shelf: 20, system: 20 }, now).ok, true);
  const bad = log.record({ barcode: '2', id: 42, name: 'Ekmek', shelf: 5, system: 6 }, now);
  assert.equal(bad.wrong[0].id, 42);
  assert.equal(bad.ok, false); assert.equal(bad.total, 2); assert.equal(bad.wrong.length, 1);
  const again = log.record({ barcode: '2', name: 'Ekmek', shelf: 5.5, system: 6 }, now);
  assert.equal(again.wrong.length, 1); assert.equal(again.wrong[0].shelf, 5.5);
  assert.equal(createLabelLog(storage, 'A:2').load('2026-11-11').correct, 0);
  assert.equal(log.load('2026-11-12').correct, 0);
  log.clear('2026-11-11'); assert.equal(log.load('2026-11-11').correct, 0);
});

test('bozuk veya kapalı depolama uygulamayı bozmaz', () => {
  const storage = memory(); storage.setItem('vx-label-check:S:2026-11-11', '{bozuk');
  assert.deepEqual(createLabelLog(storage, 'S').load('2026-11-11'), { correct: 0, wrong: [] });
  const log = createLabelLog(broken, 'S');
  assert.doesNotThrow(() => log.record({ barcode: '1', name: 'x', shelf: 1, system: 1 }));
  assert.deepEqual(createProductList(broken, 'S').load(), []);
  assert.doesNotThrow(() => createProductList(broken, 'S').add({ barcode: '1', name: 'x', price: 1 }));
});

test('ürün listesi: aynı barkod tek kez ve başa gelir, silinir, sınırı vardır, geçersiz kayıt yok sayılır', () => {
  const list = createProductList(memory(), 'S');
  list.add({ barcode: '1', name: 'A', price: 1 }); list.add({ barcode: '2', name: 'B', price: 2 }); list.add({ barcode: '1', name: 'A2', price: 3 });
  assert.deepEqual(list.load().map(i => i.barcode + i.name), ['1A2', '2B']);
  list.add({ name: 'barkodsuz' }); list.add(null);
  assert.equal(list.load().length, 2);
  assert.deepEqual(list.remove('1').map(i => i.barcode), ['2']);
  for (let i = 0; i < 230; i++) list.add({ barcode: 'b' + i, name: 'x', price: 1 });
  assert.equal(list.load().length, 200);
  assert.deepEqual(list.clear(), []);
});

test('karşılama, baş harfler ve rol adı', () => {
  assert.equal(greeting(new Date('2026-11-11T07:00:00Z')), 'Günaydın');
  assert.equal(greeting(new Date('2026-11-11T12:00:00Z')), 'İyi Günler');
  assert.equal(greeting(new Date('2026-11-11T18:30:00Z')), 'İyi Akşamlar');
  assert.equal(initials('kubilay koyuncu'), 'KK');
  assert.equal(initials(''), 'V');
  assert.equal(roleLabel('manager'), 'Müdür');
  assert.equal(roleLabel('bilinmeyen'), 'Mağaza Personeli');
});
