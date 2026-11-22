'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLogger, install, MAX_BYTES } = require('./logger.cjs');

test('günlük satır yazar ve boyut aşılınca eski dosyaya döner', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnx-log-'));
  const log = createLogger(dir, () => new Date('2026-11-22T10:00:00Z'));
  log.write('INFO', ['merhaba', { a: 1 }]);
  assert.match(fs.readFileSync(log.file, 'utf8'), /2026-11-22T10:00:00.000Z INFO merhaba \{ a: 1 \}/);
  fs.writeFileSync(log.file, 'x'.repeat(MAX_BYTES + 1));
  log.write('WARN', ['yeni']);
  assert.ok(fs.existsSync(path.join(dir, 'desktop.old.log')));
  assert.match(fs.readFileSync(log.file, 'utf8'), /WARN yeni/);
});

test('install konsolu yansıtır, yazılamayan klasörde çökmez', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnx-log-'));
  const calls = [];
  const con = { log: m => calls.push(m), info() {}, warn() {}, error() {} };
  const handlers = {};
  install(dir, { on: (n, f) => { handlers[n] = f; } }, con);
  con.log('selam');
  assert.deepStrictEqual(calls, ['selam']);
  handlers.uncaughtException(new Error('boom'));
  const text = fs.readFileSync(path.join(dir, 'desktop.log'), 'utf8');
  assert.match(text, /selam/);
  assert.match(text, /FATAL uncaughtException Error: boom/);
  const bad = createLogger(path.join(dir, 'desktop.log', 'altinda'));
  assert.doesNotThrow(() => bad.write('INFO', ['x']));
});

test('günlük kişisel veriyi diske yazmadan maskeler', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnx-log-'));
  const log = createLogger(dir);
  log.write('INFO', ['ali@example.com 0532 123 45 67 token=abc123secretXYZ Bearer abcdefgh12345678 TR330006100519786457841326']);
  const text = fs.readFileSync(log.file, 'utf8');
  for (const leak of ['ali@example.com', '123 45 67', 'abc123secretXYZ', 'abcdefgh12345678', '0006100519786457841326']) assert.ok(!text.includes(leak), leak);
});
