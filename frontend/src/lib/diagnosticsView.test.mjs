import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, mergeScans, offlineQueueResult, barcodeResult, STATUS_META } from './diagnosticsView.mjs';

test('ölçülemeyen başarısızlık sayılmaz; hata ve zaman aşımı "fail" düzeyi verir', () => {
  assert.equal(summarize([{ status: 'ok' }, { status: 'unavailable' }]).level, 'ok');
  assert.equal(summarize([{ status: 'ok' }, { status: 'warn' }]).level, 'warn');
  assert.equal(summarize([{ status: 'warn' }, { status: 'timeout' }]).level, 'fail');
  assert.equal(summarize([{ status: 'fail' }]).count.fail, 1);
  for (const s of ['ok', 'warn', 'fail', 'timeout', 'unavailable', 'cancelled', 'skipped']) assert.ok(STATUS_META[s].label);
});

test('birleştirme: kaynaklar tek taramada toplanır, tekrar eden kimlik ilk haliyle kalır', () => {
  const m = mergeScans([{ results: [{ id: 'a', status: 'ok' }] }, null, { results: [{ id: 'a', status: 'fail' }, { id: 'b', status: 'warn' }] }], new Date('2026-11-22T10:00:00Z'));
  assert.deepEqual(m.results.map(r => [r.id, r.status]), [['a', 'ok'], ['b', 'warn']]);
  assert.equal(m.level, 'warn');
  assert.equal(m.at, '2026-11-22T10:00:00.000Z');
});

test('çevrimdışı kuyruk: sayaç yoksa ölçülemedi (uydurma 0 değil), çakışma ve yığılma uyarıdır', () => {
  assert.equal(offlineQueueResult(null).status, 'unavailable');
  assert.equal(offlineQueueResult({ total: 0, pending: 0, conflict: 0 }).status, 'ok');
  assert.equal(offlineQueueResult({ total: 3, pending: 3, conflict: 1 }).status, 'warn');
  assert.equal(offlineQueueResult({ total: 30, pending: 30, conflict: 0 }).status, 'warn');
  assert.match(offlineQueueResult({ total: 2, pending: 2, conflict: 0 }).summary, /2 satış/);
});

test('barkod testi: okuyucu algılandı / elle yazıldı / süre doldu ayrıdır', () => {
  assert.equal(barcodeResult({ kind: 'scanner', average: 12 }, false).status, 'ok');
  assert.match(barcodeResult({ kind: 'manual', average: 300 }, false).summary, /elle/);
  assert.match(barcodeResult(null, true).summary, /algılanmadı/);
  assert.equal(barcodeResult({ kind: 'short' }, false).status, 'warn');
});
