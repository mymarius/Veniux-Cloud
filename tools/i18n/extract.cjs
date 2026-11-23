'use strict';
// Çeviri aday çıkarıcı: JSX dosyalarındaki sabit metin düğümlerini (>metin<) ve metin özniteliklerini (placeholder/title/aria-label/label) listeler.
// Kullanım: node tools/i18n/extract.cjs <dosya...>   |   --wrap <dosya...>: yalnız Azerbaycanca sözlükte (az.js) anahtarı olan metinleri t() ile sarar.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const wrap = args[0] === '--wrap';
const files = (wrap ? args.slice(1) : args).map(f => path.resolve(ROOT, f));

// az.js ESM'dir; anahtarları metin olarak okuyoruz.
function dictKeys() {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/src/i18n/locales/az.js'), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/^\s*'((?:[^'\\]|\\.)*)'\s*:/gm)) keys.add(m[1].replace(/\\'/g, "'"));
  for (const m of src.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) keys.add(m[1].replace(/\\"/g, '"'));
  return keys;
}
const TR = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
const TEXT = />([^<>{}\n]*[A-Za-zÇĞİÖŞÜçğıöşü][^<>{}\n]*)</g;
const ATTR = /\b(placeholder|title|aria-label|label)="([^"{}]*[A-Za-zÇĞİÖŞÜçğıöşü][^"{}]*)"/g;

const keys = wrap ? dictKeys() : null;
const found = new Map();
for (const file of files) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n'); t = t.replace(/\r\n/g, '\n');
  let changed = 0;
  const note = (s) => { s = s.trim(); if (s.length > 1) found.set(s, (found.get(s) || 0) + 1); };
  if (!wrap) { for (const m of t.matchAll(TEXT)) note(m[1]); for (const m of t.matchAll(ATTR)) note(m[2]); continue; }
  t = t.replace(TEXT, (all, text) => { const s = text.trim(); if (!keys.has(s)) return all; changed++; const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0]; return '>' + lead + "{__t('" + s.replace(/'/g, "\\'") + "')}" + tail + '<'; });
  t = t.replace(ATTR, (all, attr, text) => { const s = text.trim(); if (!keys.has(s)) return all; changed++; return attr + "={__t('" + s.replace(/'/g, "\\'") + "')}"; });
  if (changed) {
    // Modül düzeyinde t: iç içe bileşenlerde ve "t =>" gibi yerel değişkenlerle çakışmaması için __t takma adı kullanılır.
    if (!/\bt as __t\b/.test(t)) {
      const rel = path.relative(path.dirname(file), path.join(ROOT, 'frontend/src/i18n')).replace(/\\/g, '/');
      t = t.replace(/^(import [^\n]*\n)/, "$1import { t as __t } from '" + (rel.startsWith('.') ? rel : './' + rel) + "';\n");
    }
    fs.writeFileSync(file, t.split('\n').join(crlf ? '\r\n' : '\n'));
  }
  console.log(path.relative(ROOT, file), changed, 'metin sarıldı');
}
if (!wrap) for (const [s, n] of [...found].sort((a, b) => b[1] - a[1])) console.log(n + '\t' + s);
