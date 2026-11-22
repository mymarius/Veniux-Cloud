import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProducts, mergeProducts, fetchAllPages, pageSlice, PRODUCT_PICK_LIMIT } from './productSearch.js';

test('searchProducts sınırlı sonuç ister; boş aramada search parametresi yok', async () => {
  const calls = [];
  const api = { get: async (url, cfg) => { calls.push([url, cfg.params]); return { data: [{ id: 1 }] }; } };
  assert.deepEqual(await searchProducts(api, '  '), [{ id: 1 }]);
  await searchProducts(api, ' süt ');
  assert.deepEqual(calls[0], ['/products', { limit: PRODUCT_PICK_LIMIT }]);
  assert.deepEqual(calls[1], ['/products', { limit: PRODUCT_PICK_LIMIT, search: 'süt' }]);
});

test('mergeProducts aynı ürünü bir kez tutar, ilk liste önde', () => {
  const out = mergeProducts([{ id: 2 }, { id: '3' }], [{ id: 3 }, { id: 4 }, null]);
  assert.deepEqual(out.map(p => p.id), [2, '3', 4]);
});

test('fetchAllPages sayfa sayfa çeker, kısa sayfada durur', async () => {
  const seen = [];
  const api = { get: async (url, { params }) => { seen.push(params); const n = params.offset === 0 ? 3 : params.offset === 3 ? 3 : 1; return { data: Array.from({ length: n }, (_, i) => ({ id: params.offset + i })) }; } };
  const rows = await fetchAllPages(api, '/stock/records', { pageSize: 3, params: { warehouse_id: 5 } });
  assert.equal(rows.length, 7);
  assert.deepEqual(seen.map(p => [p.limit, p.offset, p.warehouse_id]), [[3, 0, 5], [3, 3, 5], [3, 6, 5]]);
});

test('fetchAllPages tam dolu son sayfadan sonra boş sayfa görünce biter ve sonsuz döngüye girmez', async () => {
  const api = { get: async (u, { params }) => ({ data: params.offset < 4 ? [{}, {}] : [] }) };
  assert.equal((await fetchAllPages(api, '/x', { pageSize: 2 })).length, 4);
  const endless = { get: async () => ({ data: [{}, {}] }) };
  await assert.rejects(fetchAllPages(endless, '/x', { pageSize: 2, maxPages: 5 }), /TOO_MANY_PAGES/);
});

test('pageSlice: 50 bin satırda yalnız 100 satır, sınır dışı sayfa kırpılır', () => {
  const rows = Array.from({ length: 50000 }, (_, i) => i);
  const first = pageSlice(rows, 0);
  assert.equal(first.rows.length, 100); assert.equal(first.pages, 500); assert.equal(first.from, 1); assert.equal(first.to, 100);
  const last = pageSlice(rows, 9999);
  assert.equal(last.page, 499); assert.equal(last.rows[0], 49900);
  const empty = pageSlice([], 3);
  assert.deepEqual([empty.rows.length, empty.pages, empty.page, empty.from, empty.to], [0, 1, 0, 0, 0]);
});
