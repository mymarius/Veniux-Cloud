import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResponse } from '../src/api/normalizeResponse.js';

test('altı basamaklı miktarlar sayı olur, toplama metin birleştirmez', () => {
  const rows = normalizeResponse([{ change_amount: '50.000000' }, { change_amount: '-2.500000' }]);
  assert.deepEqual(rows.map((r) => r.change_amount), [50, -2.5]);
});
test('yalnız _at alanlarındaki UTC zamanı işaretlenir, tarih ve diğer metinler değişmez', () => {
  const row = normalizeResponse({ created_at: '2026-11-05 10:00:00', expiry_date: '2026-12-02', note: '2026-11-05 10:00:00', price: '12.50', barcode: '8690000000000', at: { updated_at: '2026-11-05T10:00:00.000Z' } });
  assert.equal(new Date(row.created_at).toISOString(), '2026-11-05T10:00:00.000Z');
  assert.equal(row.expiry_date, '2026-12-02');
  assert.equal(row.note, '2026-11-05 10:00:00');
  assert.equal(row.price, '12.50');
  assert.equal(row.barcode, '8690000000000');
  assert.equal(row.at.updated_at, '2026-11-05T10:00:00.000Z');
});
test('Blob gibi düz olmayan yanıtlara dokunulmaz', () => {
  const blob = new Blob(['x']);
  assert.equal(normalizeResponse(blob), blob);
});
