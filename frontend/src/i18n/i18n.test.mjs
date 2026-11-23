import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import az from './locales/az.js';
import { translate, resolveLanguage, LOCALES } from './index.js';

const params = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');

test('çeviri: eksik anahtar Türkçe kalır, parametreler yerleşir', () => {
  assert.equal(translate('az', 'Genel Bakış'), 'Ümumi baxış');
  assert.equal(translate('az', 'Bu çeviri yok'), 'Bu çeviri yok');
  assert.equal(translate('tr', 'Genel Bakış'), 'Genel Bakış');
  assert.equal(translate('az', '{0} satır · {1} adet', [3, 7]), '3 sətir · 7 ədəd');
  assert.equal(translate('az', 'Hepsini kaydet ({0} satır)', ['12']), 'Hamısını yadda saxla (12 sətir)');
  assert.equal(translate('yok', 'Raporlar'), 'Raporlar');
});

test('dil seçimi: açık seçim > AZN ise Azerbaycanca > Türkçe', () => {
  assert.equal(resolveLanguage(null, 'TRY'), 'tr');
  assert.equal(resolveLanguage(null, 'AZN'), 'az');
  assert.equal(resolveLanguage('tr', 'AZN'), 'tr');
  assert.equal(resolveLanguage('xx', 'AZN'), 'az');
  assert.ok(LOCALES.az && LOCALES.tr);
});

test('Azerbaycanca sözlük: boş çeviri yok, parametre yer tutucuları kaynakla aynı', () => {
  for (const [source, target] of Object.entries(az)) {
    assert.ok(String(target).trim(), 'boş çeviri: ' + source);
    assert.equal(params(target), params(source), 'yer tutucu farkı: ' + source);
  }
});

test('menü kapsamı: Layout.jsx içindeki tüm menü ve grup adlarının Azerbaycanca karşılığı var', () => {
  const src = fs.readFileSync(new URL('../components/Layout.jsx', import.meta.url), 'utf8');
  const names = [...src.matchAll(/\b(?:name|group): '([^']+)'/g)].map(m => m[1]);
  assert.ok(names.length > 40, 'menü adları okunamadı');
  const missing = [...new Set(names)].filter(n => !(n in az));
  assert.deepEqual(missing, [], 'çevrilmemiş menü adları: ' + missing.join(' | '));
});

test('toplu kabul sayfası: t() ile çağrılan tüm sabit metinlerin çevirisi var', () => {
  const src = fs.readFileSync(new URL('../pages/RetailBulkReceive.jsx', import.meta.url), 'utf8');
  const single = [...src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'"));
  const double = [...src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)].map(m => m[1].replace(/\\"/g, '"'));
  const missing = [...new Set([...single, ...double])].filter(k => !(k in az));
  assert.deepEqual(missing, [], 'çevrilmemiş: ' + missing.join(' | '));
});

test('çevrilen sayfalar: __t() ile sarılan tüm metinlerin Azerbaycanca karşılığı var', () => {
  const files = ['pages/RetailQuickAdd.jsx', 'pages/RetailPos.jsx', 'pages/Dashboard.jsx', 'pages/settings/CompanyTab.jsx'];
  const missing = [];
  for (const f of files) {
    const src = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/__t\('((?:[^'\\]|\\.)*)'/g)) { const k = m[1].replace(/\\'/g, "'"); if (!(k in az)) missing.push(f + ': ' + k); }
  }
  assert.deepEqual(missing, []);
});
