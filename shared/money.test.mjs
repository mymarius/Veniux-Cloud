import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, normalizeCurrency, setActiveCurrency, getActiveCurrency } from './money.mjs';

test('varsayılan TRY: eski tl()/money() çıktısıyla aynı', () => {
  setActiveCurrency('TRY');
  const old = v => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  for (const v of [0, 1, 12.5, 1234.567, 24990, -3.2]) assert.equal(formatMoney(v), old(v));
  const oldTl = v => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);
  for (const v of [0, 1, 24990, 1234.4]) assert.equal(formatMoney(v, { decimals: 0 }), oldTl(v));
});

test('AZN manat simgesiyle biçimlenir', () => {
  const s = formatMoney(1234.5, { currency: 'AZN' });
  assert.ok(s.endsWith('₼'), s);
  assert.ok(!s.includes('₺'), s);
});

test('geçersiz para birimi ve değer güvenli', () => {
  assert.equal(normalizeCurrency('xyz'), 'TRY');
  assert.equal(normalizeCurrency(' azn '), 'AZN');
  assert.equal(formatMoney('abc'), formatMoney(0));
});

test('etkin para birimi değişir', () => {
  setActiveCurrency('AZN');
  assert.equal(getActiveCurrency(), 'AZN');
  assert.ok(formatMoney(5).endsWith('₼'));
  setActiveCurrency('TRY');
});
