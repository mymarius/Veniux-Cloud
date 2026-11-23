import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createRequire } from 'node:module';
import { parseScaleLine, LineFramer } from '../../shared/scaleProtocols.mjs';
import { encodeLabel } from '../../frontend/src/lib/escpos.mjs';

const { formatScaleLine, startScaleSim, decodeEscPos, startPrinterSink } = createRequire(import.meta.url)('./index.cjs');

test('terazi çerçeveleri gerçek ayrıştırıcıyla gidiş-dönüş yapar (tüm modeller, kararlı/kararsız)', () => {
  for (const model of ['generic', 'cas', 'toledo', 'dibal']) {
    for (const stable of [true, false]) {
      const parsed = parseScaleLine(model, formatScaleLine(model, { weight: 1.245, unit: 'kg', stable }));
      assert.deepEqual(parsed, { weight: 1.245, unit: 'kg', stable }, model + ' stable=' + stable);
    }
  }
  assert.deepEqual(parseScaleLine('cas', formatScaleLine('cas', { weight: 250, unit: 'g' })), { weight: 250, unit: 'g', stable: true });
  assert.throws(() => formatScaleLine('cas', { weight: -1 }));
});

const readLines = (socket, count, send) => new Promise((resolve, reject) => {
  const lines = []; const framer = new LineFramer(l => { lines.push(l); if (lines.length >= count) { socket.destroy(); resolve(lines); } });
  socket.on('data', d => framer.feed(String(d))); socket.on('error', reject); if (send) socket.write(send);
});

test('sürekli akan terazi (CAS): TCP üzerinden okunur ve çerçeveler sırayla gelir', async () => {
  const sim = await startScaleSim({ model: 'cas', frames: [{ weight: 0.4 }, { weight: 0.85, stable: false }, { weight: 1.245 }], intervalMs: 10 });
  try {
    const socket = net.connect(sim.port, sim.host);
    const lines = await readLines(socket, 3);
    assert.deepEqual(lines.map(l => parseScaleLine('cas', l)), [{ weight: 0.4, unit: 'kg', stable: true }, { weight: 0.85, unit: 'kg', stable: false }, { weight: 1.245, unit: 'kg', stable: true }]);
  } finally { await sim.close(); }
});

test('sorgulamalı terazi (Toledo): yalnız SI isteğine yanıt verir', async () => {
  const sim = await startScaleSim({ model: 'toledo', frames: [{ weight: 2.5 }] });
  try {
    const socket = net.connect(sim.port, sim.host);
    await new Promise(r => socket.once('connect', r));
    // istek göndermeden veri gelmez
    let early = false; socket.once('data', () => { early = true; }); await new Promise(r => setTimeout(r, 80));
    assert.equal(early, false);
    const lines = await readLines(socket, 1, 'SI\r\n');
    assert.deepEqual(parseScaleLine('toledo', lines[0]), { weight: 2.5, unit: 'kg', stable: true });
  } finally { await sim.close(); }
});

test('ESC/POS çözücü: metin satırları, kesme ve çekmece komutu', () => {
  const bytes = Buffer.concat([
    Buffer.from([0x1b, 0x40]), Buffer.from([0x1b, 0x61, 1]), Buffer.from('MARKET\n'), Buffer.from([0x1b, 0x61, 0]),
    Buffer.from('Cay 500 g   15,50 TL\n'), Buffer.from([0x1b, 0x70, 0, 25, 250]), Buffer.from([0x1d, 0x56, 0x42, 0])
  ]);
  const job = decodeEscPos(bytes);
  assert.deepEqual(job.lines, ['MARKET', 'Cay 500 g   15,50 TL']);
  assert.equal(job.cuts, 1); assert.equal(job.drawerKicks, 1); assert.equal(job.inits, 1);
});

test('yazıcı havuzu: uygulamanın etiket üretici baytları TCP ile gönderilir ve okunur biçimde çözülür', async () => {
  const sink = await startPrinterSink();
  try {
    const bytes = encodeLabel({ name: 'Çay 500 g', price: 15.5, barcode: '8690000100019', unit: 'adet' });
    await new Promise((resolve, reject) => { const s = net.connect(sink.port, sink.host, () => s.end(Buffer.from(bytes), resolve)); s.on('error', reject); });
    for (let i = 0; i < 50 && !sink.jobs.length; i++) await new Promise(r => setTimeout(r, 20));
    assert.equal(sink.jobs.length, 1);
    const text = sink.jobs[0].lines.join('\n');
    assert.match(text, /Cay 500 g/); assert.match(text, /15,50 TL/);
    assert.equal(sink.jobs[0].inits, 1);
  } finally { await sink.close(); }
});
