import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openScalePort } from './scalePort.mjs';

const { formatScaleLine } = createRequire(import.meta.url)('../../../tools/hardware-sim/index.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Sahte Web Serial portu: gerçek terazi yok; çerçeveleri simülatörün ürettiği baytlarla verir.
function fakePort() {
  const queue = []; let waiting = null, ended = false, failWith = null;
  const wake = () => { if (waiting) { const w = waiting; waiting = null; w(); } };
  const port = {
    opened: null, closed: false, writes: [],
    open: async options => { port.opened = options; },
    close: async () => { port.closed = true; },
    readable: { getReader: () => ({
      read: async () => {
        for (;;) {
          if (failWith) throw failWith;
          if (queue.length) return { value: queue.shift(), done: false };
          if (ended) return { done: true };
          await new Promise(resolve => { waiting = resolve; });
        }
      },
      cancel: async () => { ended = true; wake(); },
    }) },
    writable: { getWriter: () => ({ write: async bytes => { port.writes.push(Buffer.from(bytes).toString()); }, releaseLock() {} }) },
    push: text => { queue.push(new TextEncoder().encode(text)); wake(); },
    line: text => port.push(text + '\r\n'),
    unplug: () => { failWith = new Error('device lost'); wake(); },
  };
  return port;
}

test('CAS: sürekli akan çerçeveler okunur, parça parça gelen satır birleştirilir, port ayarları doğru açılır', async () => {
  const port = fakePort(), frames = [];
  const scale = await openScalePort(port, { model: 'cas', baud: 9600 }, { onFrame: f => frames.push(f) });
  assert.deepEqual(port.opened, { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
  assert.deepEqual(port.writes, [], 'CAS sorgu göndermez');
  const line = formatScaleLine('cas', { weight: 1.245, stable: true });
  port.push(line.slice(0, 6)); port.push(line.slice(6) + '\r\n'); port.line(formatScaleLine('cas', { weight: 0.5, stable: false }));
  await wait(30);
  assert.deepEqual(frames, [{ weight: 1.245, unit: 'kg', stable: true }, { weight: 0.5, unit: 'kg', stable: false }]);
  await scale.close();
  assert.equal(port.closed, true);
});

test('Toledo: her yoklamada SI isteği gönderilir, yanıt okunur, kapatınca yoklama durur', async () => {
  const port = fakePort(), frames = [];
  const scale = await openScalePort(port, { model: 'toledo', baud: 9600 }, { onFrame: f => frames.push(f), setTimer: (fn, ms) => setInterval(fn, Math.min(ms, 20)) });
  await wait(70);
  assert.ok(port.writes.length >= 2, 'birden çok yoklama');
  assert.ok(port.writes.every(w => w === 'SI\r\n'));
  port.line(formatScaleLine('toledo', { weight: 2.5, stable: true }));
  await wait(30);
  assert.deepEqual(frames.at(-1), { weight: 2.5, unit: 'kg', stable: true });
  await scale.close();
  const count = port.writes.length;
  await wait(60);
  assert.equal(port.writes.length, count, 'kapandıktan sonra istek gitmez');
});

test('Dibal ve genel model satırları okunur; ağırlık olmayan satır yok sayılır', async () => {
  for (const model of ['dibal', 'generic']) {
    const port = fakePort(), frames = [];
    const scale = await openScalePort(port, { model, baud: 9600 }, { onFrame: f => frames.push(f) });
    port.line('HATA SATIRI'); port.line(formatScaleLine(model, { weight: 250, unit: 'g', stable: true }));
    await wait(30);
    assert.deepEqual(frames, [{ weight: 250, unit: 'g', stable: true }], model);
    await scale.close();
  }
});

test('kablo çıkarsa bağlantı kapanır ve kayıp bildirilir; kullanıcı kapatınca kayıp sayılmaz', async () => {
  const port = fakePort(); let lost = null;
  await openScalePort(port, { model: 'cas', baud: 9600 }, { onFrame: () => {}, onLost: value => { lost = value; } });
  port.unplug(); await wait(30);
  assert.equal(lost, true);
  assert.equal(port.closed, true);
  const second = fakePort(); let calls = 0;
  const handle = await openScalePort(second, { model: 'cas', baud: 9600 }, { onFrame: () => {}, onLost: () => { calls += 1; } });
  await handle.close(); await wait(30);
  assert.equal(calls, 0);
});

test('port açılamazsa hata yukarı verilir (başka program kullanıyor)', async () => {
  const port = fakePort(); port.open = async () => { throw new Error('busy'); };
  await assert.rejects(() => openScalePort(port, { model: 'cas', baud: 9600 }, {}), /busy/);
});

test('teşhis: ham satırlar ve okunup okunamadıkları bildirilir', async () => {
  const port = fakePort(), seen = [];
  const scale = await openScalePort(port, { model: 'cas', baud: 9600 }, { onFrame: () => {}, onLine: (line, parsed) => seen.push([line, !!parsed]) });
  port.line('???'); port.line(formatScaleLine('cas', { weight: 1, stable: true }));
  await wait(30);
  assert.deepEqual(seen, [['???', false], ['ST,GS,   1.000 kg', true]]);
  await scale.close();
});
