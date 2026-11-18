import test from 'node:test';
import assert from 'node:assert/strict';
import { movementLabel, inPeriod, countPeriods, quantityText } from './movementView.mjs';

test('hareket türleri Türkçe gösterilir; büyük harf ve kısa kodlar da çevrilir', () => {
  assert.equal(movementLabel('IN'), 'Giriş');
  assert.equal(movementLabel('inbound'), 'Giriş');
  assert.equal(movementLabel('OUTBOUND'), 'Çıkış');
  assert.equal(movementLabel('sale'), 'Satış');
  assert.equal(movementLabel('COUNT_ADJUSTMENT'), 'Sayım düzeltmesi');
  assert.equal(movementLabel('bilinmeyen_tur'), 'bilinmeyen_tur');
  assert.equal(movementLabel(null), '—');
});

const now = new Date(2026, 10, 18, 15, 0, 0); // 18 Kasım 2026 15:00 (yerel)
const at = (d, h = 10) => ({ created_at: new Date(2026, 10, d, h, 0, 0).toISOString().slice(0, 19).replace('T', ' ') });

test('dönem filtresi: bugün, son 7 gün, son 30 gün', () => {
  // created_at yerel saatle yorumlanır; testte yerel biçimle üretiyoruz
  const local = (d, h) => ({ created_at: `2026-11-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:00:00` });
  assert.equal(inPeriod(local(18, 1), 'today', now), true);
  assert.equal(inPeriod(local(17, 23), 'today', now), false);
  assert.equal(inPeriod(local(12, 9), 'week', now), true);   // 6 gün önce
  assert.equal(inPeriod(local(11, 9), 'week', now), false);  // 7 gün önce
  assert.equal(inPeriod(local(1, 9), 'month', now), true);
  assert.equal(inPeriod({ created_at: '2026-10-01 09:00:00' }, 'month', now), false);
  assert.equal(inPeriod({ created_at: '2020-01-01' }, 'all', now), true);
  assert.equal(inPeriod({}, 'today', now), false);
  assert.ok(at(1));
});

test('dönem sayıları ve boş liste', () => {
  const list = [{ created_at: '2026-11-18 08:00:00' }, { created_at: '2026-11-15 08:00:00' }, { created_at: '2026-09-01 08:00:00' }];
  assert.deepEqual(countPeriods(list, now), { today: 1, week: 2, month: 2, all: 3 });
  assert.deepEqual(countPeriods([], now), { today: 0, week: 0, month: 0, all: 0 });
});

test('miktar birimiyle ve Türkçe küsuratla gösterilir', () => {
  assert.equal(quantityText(-0.6, 'kg'), '-0,6 kg');
  assert.equal(quantityText(1629, 'adet'), '+1.629 adet');
  assert.equal(quantityText(-0.36, ''), '-0,36');
  assert.equal(quantityText(0, 'adet'), '0 adet');
});
