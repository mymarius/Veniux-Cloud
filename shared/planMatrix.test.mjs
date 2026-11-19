import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, entitlement, withinLimit, TRIAL, FEATURES } from './planMatrix.mjs';

test('her plandaki özellik adı tanımlı listede', () => {
  for (const p of Object.values(PLANS)) for (const f of Object.keys(p.features)) assert.ok(FEATURES.includes(f), f);
});
test('Lite: yerel satış var; maliyet, AI, mobil ve e-fatura yok', () => {
  const e = entitlement({ plan: 'lite' });
  assert.ok(e.has('offline_sales') && e.has('customer_credit'));
  for (const f of ['cost_reports', 'ai_assistant', 'mobile_app', 'edocument', 'multi_staff']) assert.equal(e.has(f), false, f);
});
test('Pro: tüm perakende var, WMS yok; İşletme WMS hepsini kapsar', () => {
  assert.ok(entitlement({ plan: 'pro' }).has('edocument'));
  assert.equal(entitlement({ plan: 'pro' }).has('wms_map'), false);
  const b = entitlement({ plan: 'business_wms' });
  assert.ok(b.has('wms_map') && b.has('edocument') && b.has('open_api'));
});
test('ömür boyu: bulut yılı bitince bulut ve AI kapanır, yerel özellikler kalır', () => {
  const now = Date.UTC(2027, 5, 1), later = Date.UTC(2028, 5, 1);
  const inYear = entitlement({ plan: 'lifetime_desktop', now, cloudUntil: later });
  assert.ok(inYear.has('ai_assistant'));
  const after = entitlement({ plan: 'lifetime_desktop', now: later + 1, cloudUntil: later });
  assert.equal(after.has('ai_assistant'), false);
  assert.ok(after.has('customer_display') && after.has('cost_reports'));
});
test('deneme 30 gün tüm modülleri açar, bitince Lite\'a düşer (veri silinmez)', () => {
  assert.equal(TRIAL.days, 30); assert.equal(TRIAL.card_required, false);
  const now = Date.UTC(2027, 0, 10), ends = now + 30 * 86400000;
  assert.ok(entitlement({ plan: 'lite', now, trialEndsAt: ends }).has('wms_map'));
  assert.equal(entitlement({ plan: 'lite', now: ends + 1, trialEndsAt: ends }).has('wms_map'), false);
});
test('restoran eklentisi yalnız uygun planlarda açılır', () => {
  assert.ok(entitlement({ plan: 'pro', addons: ['restaurant_addon'] }).has('kds'));
  assert.equal(entitlement({ plan: 'lite', addons: ['restaurant_addon'] }).has('kds'), false);
});
test('limitler', () => {
  assert.equal(withinLimit(1, PLANS.lite.limits.admins), true);
  assert.equal(withinLimit(2, PLANS.lite.limits.admins), false);
  assert.equal(withinLimit(500, PLANS.pro.limits.staff), true);
});
