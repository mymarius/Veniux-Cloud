import { MODELS, LineFramer, parseScaleLine } from '../../../shared/scaleProtocols.mjs';

// Web Serial portunu açar, teraziyi okur. Tarayıcıya bağlı kısım (React durumu) useScale.js'te; bu dosya yalnız port mantığıdır,
// bu yüzden sahte bir port ile (gerçek terazi olmadan) denenebilir.
// onFrame({ weight, unit, stable }), onLost(): bağlantı beklenmedik koptuğunda. Döner: { close }.
export async function openScalePort(port, config, { onFrame, onLost, setTimer = setInterval, clearTimer = clearInterval } = {}) {
  const model = MODELS[config.model] || MODELS.generic;
  let closed = false, reader, writer, timer;
  const framer = new LineFramer(line => {
    const parsed = parseScaleLine(config.model, line);
    if (parsed) onFrame?.(parsed);
  });
  const close = async () => {
    closed = true; clearTimer(timer); framer.reset();
    try { await reader?.cancel(); } catch { /* zaten kapalı */ }
    try { writer?.releaseLock(); } catch { /* zaten kapalı */ }
    try { await port.close(); } catch { /* zaten kapalı */ }
  };
  await port.open({ baudRate: config.baud, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
  if (model.request) {
    writer = port.writable.getWriter();
    const bytes = new TextEncoder().encode(model.request);
    timer = setTimer(() => { writer.write(bytes).catch(() => {}); }, model.pollMs || 300);
  }
  reader = port.readable.getReader();
  const decoder = new TextDecoder();
  const loop = (async () => {
    let lost = false;
    try {
      while (!closed) { const { value, done } = await reader.read(); if (done) break; framer.feed(decoder.decode(value, { stream: true })); }
    } catch { lost = !closed; }
    finally { if (!closed) { await close(); onLost?.(lost); } }
  })();
  return { close, done: loop };
}
