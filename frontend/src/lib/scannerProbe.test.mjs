import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyScan, printerStatusText, looksThermal } from './scannerProbe.mjs';

const stamps = (n, gap) => Array.from({ length: n }, (_, i) => 1000 + i * gap);

test('çok hızlı gelen uzun metin barkod okuyucu sayılır', () => {
  const r = classifyScan(stamps(13, 8), '8690000123456');
  assert.equal(r.kind, 'scanner');
  assert.match(r.message, /8690000123456/);
});

test('yavaş yazılan metin elle yazılmış sayılır', () => {
  assert.equal(classifyScan(stamps(13, 180), '8690000123456').kind, 'manual');
});

test('kısa veya eksik giriş okuyucu sayılmaz', () => {
  assert.equal(classifyScan(stamps(3, 5), '123').kind, 'short');
  assert.equal(classifyScan([], '').kind, 'short');
  assert.equal(classifyScan(stamps(2, 5), '8690000123456').kind, 'short');
});

test('yazıcı durumu ve termal ipucu', () => {
  assert.equal(printerStatusText(0), 'Hazır');
  assert.equal(printerStatusText(8), 'Çevrimdışı');
  assert.equal(printerStatusText(undefined), 'Bilinmiyor');
  assert.equal(looksThermal('EPSON TM-T20II Receipt'), true);
  assert.equal(looksThermal('Microsoft Print to PDF'), false);
});
