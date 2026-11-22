// Sanal seri port / klavye-okuyucu akışı: bayt parçaları rastgele bölünerek Framer -> scanIntoLines hattından geçirilir.
// Gerçek okuyucu YOK; yalnız parçalama, ön/son ek, CRLF ve hatalı okuma davranışı simüle edilir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Framer, defaults } from '../../../shared/scanner.mjs';
import { scanIntoLines, tally } from './serialScan.mjs';

const products = [{ id: 1, barcode: '8690000000011', name: 'Kola' }, { id: 2, barcode: '8690000000028', name: 'Su' }, { id: 3, barcode: '4006381333931', name: 'Kalem' }];

function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

function run(codes, { terminator = '\r\n', prefix = '', suffix = '', seed = 1, cfg = {} } = {}) {
  const rand = rng(seed);
  const stream = codes.map(c => prefix + c + suffix + terminator).join('');
  let lines = [], stats = null;
  const framer = new Framer({ ...defaults, terminators: ['Enter', 'Tab'], timeoutMs: 5000 }, raw => {
    const r = scanIntoLines(lines, products, raw, { cfg });
    lines = r.lines; stats = tally(stats, r);
  });
  for (let i = 0; i < stream.length;) { const n = 1 + Math.floor(rand() * 7); framer.feed(stream.slice(i, i + n)); i += n; }
  framer.reset();
  return { lines, stats };
}

test('rastgele parçalanmış seri akış: 300 okutma doğru sayılır (CRLF)', () => {
  const rand = rng(7), codes = [], want = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 300; i++) { const p = products[Math.floor(rand() * 3)]; codes.push(p.barcode); want[p.id]++; }
  for (const seed of [1, 2, 3, 99]) {
    const { lines, stats } = run(codes, { seed });
    assert.equal(stats.total, 300);
    assert.equal(stats.notfound, 0);
    for (const l of lines) assert.equal(l.quantity, want[l.product_id]);
  }
});

test('Tab ile biten klavye okuyucu ve ön/son ek', () => {
  const { lines } = run(['8690000000011', '8690000000011', '8690000000028'], { terminator: '\t', prefix: '~', suffix: '#', cfg: { prefix: '~', suffix: '#' }, seed: 5 });
  assert.deepEqual(lines.map(l => [l.product_id, l.quantity]), [[1, 2], [2, 1]]);
});

test('bilinmeyen ve bozuk barkod sayılır ama satırı bozmaz; kontrol hanesi ipucu gelir', () => {
  const { lines, stats } = run(['8690000000011', '8690000000012', 'XYZ', '8690000000011'], { seed: 3 });
  assert.deepEqual(lines.map(l => [l.product_id, l.quantity]), [[1, 2]]);
  assert.equal(stats.notfound, 2);
});

test('çok hızlı art arda okutma: boş satır (yalnız terminatör) yok sayılır', () => {
  const { lines, stats } = run(['', '8690000000028', ''], { seed: 4 });
  assert.equal(stats.total, 1);
  assert.equal(lines.length, 1);
});
