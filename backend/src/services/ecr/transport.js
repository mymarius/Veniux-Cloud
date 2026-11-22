// Taşıyıcı katmanı: TCP, seri (COM) ve testler için "kayıtlı çerçeve" taşıyıcısı. Ortak arayüz:
//   connect() / write(buf) / read(extractFn, timeoutMs) / close()
// extractFn(buffer) -> { consumed, ...sonuç } | null ; read(), tam bir sonuç çıkana kadar bayt toplar.
const net = require('net');
const { EcrError } = require('./errors');

class BufferedTransport {
  constructor() { this.buffer = Buffer.alloc(0); this.waiter = null; this.closed = false; }
  push(chunk) { this.buffer = Buffer.concat([this.buffer, chunk]); this.waiter?.(); }
  async read(extractFn, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = extractFn(this.buffer);
      if (hit) { this.buffer = this.buffer.subarray(hit.consumed); if (hit.kind !== 'invalid') return hit; continue; }
      const left = deadline - Date.now();
      if (left <= 0) throw new EcrError('TIMEOUT', 'Cihaz zamanında yanıt vermedi.', { uncertain: true });
      if (this.closed) throw new EcrError('OFFLINE', 'Cihaz bağlantısı koptu.', { uncertain: true });
      await new Promise(resolve => { const t = setTimeout(done, left); const self = this; function done() { clearTimeout(t); self.waiter = null; resolve(); } this.waiter = done; });
    }
  }
}

class TcpTransport extends BufferedTransport {
  constructor({ host, port, connectTimeoutMs = 5000 }) { super(); Object.assign(this, { host, port, connectTimeoutMs }); }
  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => { socket.destroy(); reject(new EcrError('OFFLINE', 'Cihaza bağlanılamadı (zaman aşımı).', { uncertain: false })); }, this.connectTimeoutMs);
      socket.once('connect', () => { clearTimeout(timer); this.socket = socket; resolve(); });
      socket.once('error', e => { clearTimeout(timer); reject(new EcrError('OFFLINE', 'Cihaza bağlanılamadı: ' + e.message, { uncertain: false, cause: e })); });
      socket.on('data', chunk => this.push(chunk));
      socket.on('close', () => { this.closed = true; this.waiter?.(); });
    });
  }
  write(buf) { return new Promise((resolve, reject) => this.socket.write(buf, e => (e ? reject(new EcrError('OFFLINE', 'Cihaza yazılamadı: ' + e.message, { uncertain: true, cause: e })) : resolve()))); }
  async close() { this.socket?.destroy(); }
}

// COM bağlantısı: `serialport` paketi masaüstü/scanner-bridge tarafında kuruludur; sunucu paketinde yoksa net hata verir.
class SerialTransport extends BufferedTransport {
  constructor({ path, baudRate = 9600, dataBits = 8, stopBits = 1, parity = 'none' }) { super(); Object.assign(this, { path, options: { baudRate, dataBits, stopBits, parity } }); }
  async connect() {
    let SerialPort;
    try { ({ SerialPort } = require('serialport')); } catch { throw new EcrError('NOT_INSTALLED', 'serialport paketi kurulu değil; COM bağlantısı bu ortamda kullanılamaz.', { retryable: false }); }
    await new Promise((resolve, reject) => {
      const port = new SerialPort({ path: this.path, ...this.options, autoOpen: false });
      port.open(e => { if (e) return reject(new EcrError('OFFLINE', this.path + ' açılamadı: ' + e.message, { uncertain: false, cause: e })); this.port = port; port.on('data', c => this.push(c)); port.on('close', () => { this.closed = true; this.waiter?.(); }); resolve(); });
    });
  }
  write(buf) { return new Promise((resolve, reject) => this.port.write(buf, e => (e ? reject(new EcrError('OFFLINE', 'Porta yazılamadı: ' + e.message, { uncertain: true, cause: e })) : resolve()))); }
  async close() { await new Promise(resolve => (this.port?.isOpen ? this.port.close(() => resolve()) : resolve())); }
}

// Kayıtlı çerçeve taşıyıcısı: gerçek cihazdan kaydedilmiş (ya da belgeden elle yazılmış) bayt alışverişini oynatır.
// script: [{ write: 'hex', read: 'hex' | null }]  → sürücü TAM olarak `write` baytlarını göndermelidir; ardından `read` baytları cihazdan gelmiş sayılır.
// read === null: cihaz sessiz (zaman aşımı senaryosu). Sapma PROTOCOL hatasıyla yakalanır; böylece protokol kodu kayda karşı sınanır.
class RecordedTransport extends BufferedTransport {
  constructor(script, { connectError } = {}) { super(); this.script = [...script]; this.connectError = connectError; this.sent = []; }
  async connect() { if (this.connectError) throw new EcrError('OFFLINE', this.connectError, { uncertain: false }); }
  async write(buf) {
    this.sent.push(Buffer.from(buf));
    const step = this.script.shift();
    if (!step) throw new EcrError('PROTOCOL', 'Kayıtta olmayan fazladan gönderim: ' + Buffer.from(buf).toString('hex'));
    if (Buffer.from(step.write.replace(/\s+/g, ''), 'hex').compare(Buffer.from(buf)) !== 0) throw new EcrError('PROTOCOL', `Gönderilen çerçeve kayıtla uyuşmuyor. Beklenen ${step.write}, gönderilen ${Buffer.from(buf).toString('hex')}`);
    if (step.read) this.push(Buffer.from(step.read.replace(/\s+/g, ''), 'hex'));
  }
  async close() { this.closedByDriver = true; }
  remaining() { return this.script.length; }
}

function createTransport(device) {
  const cfg = typeof device.config === 'string' && device.config ? JSON.parse(device.config) : (device.config || {});
  if (device.connection === 'network') return new TcpTransport({ host: cfg.host, port: Number(cfg.port) });
  if (device.connection === 'serial') return new SerialTransport({ path: cfg.path, baudRate: cfg.baudRate });
  throw new EcrError('UNSUPPORTED', 'Bu bağlantı türü için taşıyıcı yok: ' + device.connection, { retryable: false });
}

module.exports = { TcpTransport, SerialTransport, RecordedTransport, createTransport, BufferedTransport };
