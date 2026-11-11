import test from 'node:test';
import assert from 'node:assert/strict';
import { urlBase64ToUint8Array, pushStatus, unsupportedReason, subscriptionBody } from './push.mjs';
import { toAscii, ean13Valid, encodeLabel, chunk, money } from './escpos.mjs';
import { CHECKS, summarize, reportText, detect } from './deviceCheck.mjs';

test('VAPID anahtarı base64url -> bayt dizisi (65 bayt, doldurma ve - _ karakterleri)', () => {
  const bytes = Uint8Array.from({ length: 65 }, (_, i) => (i * 7 + 3) % 256);
  const b64u = Buffer.from(bytes).toString('base64url');
  assert.deepEqual([...urlBase64ToUint8Array(b64u)], [...bytes]);
  assert.equal(urlBase64ToUint8Array('').length, 0);
  assert.deepEqual([...urlBase64ToUint8Array('_-8')], [...Buffer.from('_-8', 'base64url')]);
});

test('bildirim durumu ve desteklenmeme nedeni (Android uygulama içi, iPhone, http)', () => {
  assert.equal(pushStatus({ supported: false }), 'unsupported');
  assert.equal(pushStatus({ supported: true, permission: 'denied' }), 'blocked');
  assert.equal(pushStatus({ supported: true, permission: 'default', subscribed: false }), 'off');
  assert.equal(pushStatus({ supported: true, permission: 'granted', subscribed: false }), 'off');
  assert.equal(pushStatus({ supported: true, permission: 'granted', subscribed: true }), 'on');
  const ok = { secure: true, serviceWorker: true, pushManager: true, notification: true };
  assert.equal(unsupportedReason(ok), null);
  assert.match(unsupportedReason({ ...ok, insideApp: true }), /tarayıcısında/);
  assert.match(unsupportedReason({ ...ok, secure: false }), /https/);
  assert.match(unsupportedReason({ ...ok, pushManager: false, ios: true }), /Ana Ekrana Ekle/);
  assert.match(unsupportedReason({ ...ok, pushManager: false }), /Chrome/);
});

test('abonelik gövdesi: toJSON ve düz nesne kabul edilir, eksik anahtar reddedilir', () => {
  const body = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } };
  assert.deepEqual(subscriptionBody({ toJSON: () => ({ ...body, expirationTime: null }) }), body);
  assert.deepEqual(subscriptionBody(body), body);
  for (const bad of [null, {}, { endpoint: 'x' }, { endpoint: 'x', keys: { p256dh: 'a' } }]) assert.throws(() => subscriptionBody(bad), /oluşturulamadı/);
});

test('ESC/POS: Türkçe karakterler ASCII\'ye çevrilir, EAN-13 sağlama basamağı denetlenir', () => {
  assert.equal(toAscii('Çay şekeri ığüöÇ İĞÜÖŞ ₺'), 'Cay sekeri iguoC IGUOS TL');
  assert.equal(toAscii('日本'), '??');
  assert.equal(ean13Valid('8690000000011'), false);
  assert.equal(ean13Valid('4006381333931'), true);
  assert.equal(ean13Valid('123'), false);
  assert.equal(money(149.9), '149,90 TL');
});

test('ESC/POS etiket: başlat, ortala, ad, büyük fiyat, barkod komutu ve kesme sırası', () => {
  const bytes = encodeLabel({ name: "Yemek çatalı 6'lı takım", price: 149.9, barcode: '4006381333931', unit: 'takım' });
  assert.deepEqual([...bytes.slice(0, 2)], [0x1b, 0x40]);
  const buf = Buffer.from(bytes), text = buf.toString('latin1');
  assert.ok(text.includes('Yemek catali'), 'ad ASCII');
  assert.ok(text.includes('149,90 TL'));
  assert.ok(text.includes('4006381333931'));
  assert.ok(buf.indexOf(Buffer.from([0x1d, 0x6b, 2])) >= 0, 'EAN-13 barkod komutu');
  assert.ok(buf.indexOf(Buffer.from([0x1d, 0x21, 0x33])) >= 0, 'büyük fiyat');
  assert.deepEqual([...bytes.slice(-4)], [0x1d, 0x56, 66, 0]);
  const code128 = Buffer.from(encodeLabel({ name: 'Vida', price: 5, barcode: 'V-M3x20' }));
  assert.ok(code128.indexOf(Buffer.from([0x1d, 0x6b, 73, 9])) >= 0, 'Code128 uzunluklu komut');
  assert.ok(code128.toString('latin1').includes('{BV-M3x20'));
  assert.ok(!Buffer.from(encodeLabel({ name: 'x', price: 1, barcode: '1', cut: false })).includes(0x56));
  assert.ok(Buffer.from(encodeLabel({ name: 'x', price: 1 })).indexOf(Buffer.from([0x1d, 0x6b])) < 0, 'barkodsuz etikette barkod komutu yok');
  assert.ok(encodeLabel({ name: 'çok uzun bir ürün adı '.repeat(10), price: 1 }).length < 400);
});

test('Bluetooth yazma parçalama: sınır, kayıpsız birleşme', () => {
  const data = Uint8Array.from({ length: 250 }, (_, i) => i % 256);
  const parts = chunk(data, 100);
  assert.deepEqual(parts.map(p => p.length), [100, 100, 50]);
  assert.deepEqual([...Buffer.concat(parts.map(p => Buffer.from(p)))], [...data]);
  assert.deepEqual(chunk(new Uint8Array(0)), []);
});

test('cihaz testi: özet, rapor metni ve ön tespit', () => {
  assert.equal(CHECKS.length, 8);
  assert.deepEqual(summarize({}), { pass: 0, fail: 0, warn: 0, skip: 0, pending: 8, total: 8, done: 0, allDone: false, healthy: false });
  const all = Object.fromEntries(CHECKS.map(([k]) => [k, { status: 'pass' }]));
  assert.equal(summarize(all).healthy, true);
  assert.equal(summarize({ ...all, sound: { status: 'fail', note: 'duyulmadı' } }).healthy, false);
  const text = reportText({ ...all, sound: { status: 'fail', note: 'duyulmadı' }, vibrate: { status: 'skip', note: 'iPhone' } }, { now: '2026-11-11T10:00:00Z', version: '2.4.63', userAgent: 'Pixel 8' });
  assert.match(text, /Ses: Çalışmıyor — duyulmadı/); assert.match(text, /Titreşim: Desteklenmiyor — iPhone/); assert.match(text, /Özet: 6 çalışıyor, 0 kısmen, 1 çalışmıyor, 1 desteklenmiyor, 0 denenmedi/); assert.match(text, /Sürüm: 2.4.63/);
  const d = detect({ getUserMedia: true, vibrate: false, ios: true, push: false, bluetooth: false, serviceWorker: true, controlled: false, standalone: false });
  assert.equal(d.camera.status, 'pending'); assert.equal(d.vibrate.status, 'skip'); assert.match(d.vibrate.note, /iPhone/);
  assert.equal(d.notify.status, 'skip'); assert.equal(d.bluetooth.status, 'skip'); assert.equal(d.offline.status, 'warn'); assert.equal(d.installed.status, 'warn');
  assert.equal(detect({ serviceWorker: true, controlled: true, standalone: true }).installed.status, 'pass');
});
