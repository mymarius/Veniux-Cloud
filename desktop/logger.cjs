'use strict';
// Masaüstü günlük dosyası: <userData>/logs/desktop.log. Yalnız konsol çıktısını ve yakalanmamış hataları yazar.
// Boyut sınırı: 512 KB'ı geçince desktop.log -> desktop.old.log (en fazla 2 dosya). Hata yazma işlemi programı asla düşürmez.
const fs = require('fs');
const path = require('path');
const util = require('util');
const { redactString } = require('./diagnostics.cjs');

const MAX_BYTES = 512 * 1024;

function createLogger(dir, now = () => new Date()) {
  const file = path.join(dir, 'desktop.log');
  const old = path.join(dir, 'desktop.old.log');
  function write(level, args) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      try { if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, old); } catch { /* dosya yok */ }
      const text = redactString(args.map(a => (typeof a === 'string' ? a : util.inspect(a, { depth: 3, breakLength: Infinity }))).join(' ')).slice(0, 4000);
      fs.appendFileSync(file, `${now().toISOString()} ${level} ${text}\n`);
    } catch { /* günlük yazılamazsa sessiz geç */ }
  }
  return { file, write };
}

function install(dir, proc = process, con = console) {
  const log = createLogger(dir);
  for (const [name, level] of [['log', 'INFO'], ['info', 'INFO'], ['warn', 'WARN'], ['error', 'ERROR']]) {
    const original = con[name].bind(con);
    con[name] = (...args) => { log.write(level, args); original(...args); };
  }
  proc.on('uncaughtException', err => log.write('FATAL', ['uncaughtException', err && err.stack || err]));
  proc.on('unhandledRejection', err => log.write('ERROR', ['unhandledRejection', err && err.stack || err]));
  log.write('INFO', ['Günlük başladı']);
  return log;
}

module.exports = { createLogger, install, MAX_BYTES };
