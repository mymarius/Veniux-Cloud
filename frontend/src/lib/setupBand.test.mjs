import test from 'node:test';
import assert from 'node:assert/strict';
import { setupProgress, bandHidden, snoozeUntil, shouldShowBand, bandKey, SNOOZE_DAYS } from './setupBand.mjs';

test('ilerleme: gözden geçirilen ve sonraya bırakılan adımlar sayılır', () => {
  assert.deepEqual(setupProgress(['reviewed', 'skipped', 'pending', 'pending']), { done: 2, total: 4, percent: 50 });
  assert.deepEqual(setupProgress([]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(setupProgress(undefined), { done: 0, total: 0, percent: 0 });
  assert.equal(setupProgress(['reviewed', 'reviewed', 'reviewed']).percent, 100);
});

test('erteleme: bitiş zamanı gelmeden gizli, sonra tekrar görünür', () => {
  const now = 1_700_000_000_000;
  const until = snoozeUntil(now);
  assert.equal(until, now + SNOOZE_DAYS * 86400000);
  assert.equal(bandHidden(until, now + 1000), true);
  assert.equal(bandHidden(until, until + 1), false);
  assert.equal(bandHidden(null, now), false);
  assert.equal(bandHidden('bozuk', now), false);
});

test('bant yalnız Genel Bakış\'ta, yöneticiye ve tamamlanmamış kurulumda görünür', () => {
  const setup = { completed: false, steps: ['pending'] };
  const base = { setup, role: 'admin', path: '/dashboard', until: null, now: 1000 };
  assert.equal(shouldShowBand(base), true);
  assert.equal(shouldShowBand({ ...base, path: '/normal-depo/dashboard' }), false);
  assert.equal(shouldShowBand({ ...base, role: 'cashier' }), false);
  assert.equal(shouldShowBand({ ...base, setup: { completed: true } }), false);
  assert.equal(shouldShowBand({ ...base, setup: null }), false);
  assert.equal(shouldShowBand({ ...base, until: 5000 }), false);
  assert.equal(shouldShowBand({ ...base, until: 500 }), true);
});

test('erteleme anahtarı kullanıcıya özeldir', () => {
  assert.equal(bandKey(7), 'veniux_setup_band_until:7');
  assert.equal(bandKey(null), 'veniux_setup_band_until:anon');
  assert.notEqual(bandKey(1), bandKey(2));
});
