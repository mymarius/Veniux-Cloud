import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from '../tools/site/export-plans.mjs';
import { FEATURES } from './planMatrix.mjs';

test('website-php/plans.json paket matrisiyle aynı (node tools/site/export-plans.mjs)', () => {
  const file = new URL('../website-php/plans.json', import.meta.url);
  assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(build(), null, 1) + '\n');
});

test('her özelliğin site etiketi ve grubu var', () => {
  const data = build();
  const grouped = new Set(data.groups.flatMap(g => g.keys));
  for (const plan of data.plans) for (const f of plan.features) { assert.ok(data.labels[f], 'etiket: ' + f); assert.ok(grouped.has(f), 'grup: ' + f); }
  for (const f of FEATURES) assert.ok(data.labels[f], 'etiket: ' + f);
});
