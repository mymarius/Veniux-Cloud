'use strict';
// Donanım simülatörleri: fiziksel cihaz olmadan POS iş akışlarını denemek için.
//  - Terazi: TCP üzerinden CAS / Mettler Toledo (SICS) / Dibal / genel satır biçiminde ağırlık yayar (shared/scaleProtocols.mjs ayrıştırıcısıyla birebir uyumlu).
//  - ESC/POS yazıcı: TCP 9100 gibi bir portta gelen baytları fiş metnine, kesme ve çekmece açma komutlarına çevirir.
// Bunlar GERÇEK cihaz değildir: kod sayfaları, hata durumları, kağıt bitti, sıcaklık gibi gerçek cihaz davranışlarını taklit etmez.
// Üretici belgesindeki gerçek protokolle ve cihazla doğrulama yerine geçmez.
const net = require('net');

// --- Terazi ---------------------------------------------------------------
const pad = (n, w) => n.toFixed(3).padStart(w, ' ');
function formatScaleLine(model, { weight, unit = 'kg', stable = true }) {
  const w = Number(weight);
  if (!Number.isFinite(w) || w < 0) throw new Error('Geçersiz ağırlık.');
  const value = unit === 'g' ? String(Math.round(w)) : pad(w, 7);
  if (model === 'cas') return `${stable ? 'ST' : 'US'},GS,${value.padStart(8, ' ')} ${unit}`;
  if (model === 'toledo') return `S ${stable ? 'S' : 'D'} ${value.padStart(9, ' ')} ${unit}`;
  if (model === 'dibal') return `${stable ? '' : 'M '}${value.trim()} ${unit}`;
  return `${stable ? '' : '? '}${value.trim()} ${unit}`;
}

// frames: [{weight, unit?, stable?}] döngüsel yayınlanır. Toledo modeli yalnız "SI" isteğine yanıt verir (sorgulamalı terazi); diğerleri sürekli akıtır.
function startScaleSim({ model = 'cas', port = 0, host = '127.0.0.1', frames = [{ weight: 1.245, stable: true }], intervalMs = 200 } = {}) {
  let i = 0;
  const sockets = new Set();
  const next = () => formatScaleLine(model, frames[i++ % frames.length]) + '\r\n';
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    if (model === 'toledo') { socket.on('data', d => { if (/SI/.test(String(d))) socket.write(next()); }); return; }
    const timer = setInterval(() => { if (!socket.destroyed) socket.write(next()); }, intervalMs);
    socket.on('close', () => clearInterval(timer));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ port: server.address().port, host, close: () => new Promise(r => { sockets.forEach(s => s.destroy()); server.close(() => r()); }) }));
  });
}

// --- ESC/POS yazıcı -------------------------------------------------------
// Baytları çözer: ESC @ (başlat), ESC a n (hizalama), ESC E n (kalın), GS ! n (boyut), GS V (kes), ESC p (çekmece), LF.
function decodeEscPos(bytes) {
  const b = Buffer.from(bytes), out = { lines: [], cuts: 0, drawerKicks: 0, inits: 0, raw: b.length };
  let line = '';
  const flush = () => { out.lines.push(line); line = ''; };
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c === 0x1b) {
      const n = b[i + 1];
      if (n === 0x40) { out.inits++; i += 1; } else if (n === 0x61 || n === 0x45 || n === 0x2d || n === 0x74 || n === 0x4d || n === 0x33 || n === 0x64) { i += 2; if (n === 0x64) { flush(); } }
      else if (n === 0x70) { out.drawerKicks++; i += 4; } else i += 1;
    } else if (c === 0x1d) {
      const n = b[i + 1];
      if (n === 0x56) { out.cuts++; i += b[i + 2] === 0x41 || b[i + 2] === 0x42 ? 3 : 2; }
      else if (n === 0x21 || n === 0x42) i += 2; else i += 1;
    } else if (c === 0x0a) flush();
    else if (c >= 0x20 && c < 0x7f) line += String.fromCharCode(c);
  }
  if (line) flush();
  return out;
}

// Her TCP bağlantısı bir yazdırma işidir; bağlantı kapanınca iş çözülür ve jobs listesine eklenir.
function startPrinterSink({ port = 0, host = '127.0.0.1', onJob } = {}) {
  const jobs = [];
  const server = net.createServer(socket => {
    const chunks = [];
    socket.on('data', d => chunks.push(d));
    socket.on('error', () => {});
    socket.on('close', () => { const job = decodeEscPos(Buffer.concat(chunks)); jobs.push(job); if (onJob) onJob(job); });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ port: server.address().port, host, jobs, close: () => new Promise(r => server.close(() => r())) }));
  });
}

module.exports = { formatScaleLine, startScaleSim, decodeEscPos, startPrinterSink };

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
  (async () => {
    if (args.scale) {
      const s = await startScaleSim({ model: args.scale, port: Number(args.port || 9001), frames: [{ weight: 0.4 }, { weight: 0.85, stable: false }, { weight: 1.245 }] });
      console.log(`Terazi simülatörü (${args.scale}) 127.0.0.1:${s.port}`);
    }
    if (args.printer !== undefined) {
      const p = await startPrinterSink({ port: Number(args.printer || 9100), onJob: j => console.log('--- yazdırma işi ---\n' + j.lines.join('\n') + `\n[kesme: ${j.cuts}, çekmece: ${j.drawerKicks}]`) });
      console.log(`ESC/POS yazıcı simülatörü 127.0.0.1:${p.port}`);
    }
    if (!args.scale && args.printer === undefined) console.log('Kullanım: node tools/hardware-sim/index.cjs --scale=cas|toledo|dibal|generic [--port=9001] --printer=9100');
  })();
}
