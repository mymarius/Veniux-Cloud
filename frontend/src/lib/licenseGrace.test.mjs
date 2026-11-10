import test from 'node:test';
import assert from 'node:assert/strict';
import { holdLicenseDuringOutage, OUTAGE_GRACE_MS } from './licenseGrace.mjs';

const now = 1_000_000_000_000, networkError = new Error('Network Error'), serverError = Object.assign(new Error('403'), { response: { status: 403 } });

test('lisanslı oturumda ağ kesintisi 24 saat içinde lisansı korur', () => {
  assert.equal(holdLicenseDuringOutage({ error: networkError, licensedBefore: true, lastGoodAt: now - 3600000, now }), true);
  assert.equal(holdLicenseDuringOutage({ error: networkError, licensedBefore: true, lastGoodAt: now - OUTAGE_GRACE_MS + 1, now }), true);
});

test('24 saat dolunca korunmaz', () => {
  assert.equal(holdLicenseDuringOutage({ error: networkError, licensedBefore: true, lastGoodAt: now - OUTAGE_GRACE_MS, now }), false);
});

test('sunucu cevap verip reddederse (iptal, cihaz, süre) asla korunmaz', () => {
  assert.equal(holdLicenseDuringOutage({ error: serverError, licensedBefore: true, lastGoodAt: now - 1000, now }), false);
});

test('daha önce lisanslı doğrulanmamış oturum veya bilinmeyen zaman damgası korunmaz', () => {
  assert.equal(holdLicenseDuringOutage({ error: networkError, licensedBefore: false, lastGoodAt: now - 1000, now }), false);
  assert.equal(holdLicenseDuringOutage({ error: networkError, licensedBefore: true, lastGoodAt: 0, now }), false);
  assert.equal(holdLicenseDuringOutage({ error: networkError, licensedBefore: true, lastGoodAt: undefined, now }), false);
  assert.equal(holdLicenseDuringOutage({ error: networkError, licensedBefore: true, lastGoodAt: now + 5000, now }), false);
});
