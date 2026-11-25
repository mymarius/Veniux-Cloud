import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineQueue, NetworkError } from './offlineQueue.mjs';

// Gerçek IndexedDB bağdaştırıcısı (offlineStore.js), tarayıcı yerine fake-indexeddb ile denenir.
// "Yeniden açılış" (sayfa yenileme/tarayıcı kapat-aç): modül yeniden yüklenir, veritabanı (indexedDB) aynı kalır.
let n = 0;
const fresh = () => import('./offlineStore.js?reopen=' + (++n));
const sale = (id, at) => ({ id, created_at: at, receipt_no: 'E1-X-' + id, body: { items: [{ barcode: '1', count: 1 }] } });

test('satış deposu: ekle, oku, hepsini oku, sil', async () => {
  const { salesStore } = await fresh();
  await salesStore.put({ id: 'a', v: 1 });
  await salesStore.put({ id: 'b', v: 2 });
  assert.deepEqual(await salesStore.get('a'), { id: 'a', v: 1 });
  assert.equal((await salesStore.getAll()).length, 2);
  await salesStore.delete('a');
  assert.equal(await salesStore.get('a'), undefined);
  await salesStore.delete('b');
});

test('kuyruk kalıcıdır: 50 satış, sayfa yenilenip yeniden açılınca sırayla duruyor; gönderim sonrası boşalır', async () => {
  const first = await fresh();
  const q1 = createOfflineQueue(first.salesStore);
  for (let i = 0; i < 50; i += 1) await q1.enqueue(sale('s' + String(i).padStart(3, '0'), new Date(Date.UTC(2026, 10, 25, 8, 0, i)).toISOString()));
  const reopened = await fresh(); // yenileme
  const q2 = createOfflineQueue(reopened.salesStore);
  const list = await q2.list();
  assert.equal(list.length, 50);
  assert.deepEqual(list.map(r => r.id), list.map(r => r.id).slice().sort());
  const sentIds = [];
  const summary = await q2.flush(async record => { sentIds.push(record.id); return { status: 'done' }; });
  assert.equal(summary.sent, 50);
  assert.equal(summary.remaining, 0);
  assert.deepEqual(sentIds, list.map(r => r.id), 'gönderim sırası kuyruk sırasıyla aynı');
});

test('yinelenen ekleme tekrar kayıt oluşturmaz; ağ kopunca kalanlar kalıcı depoda bekler', async () => {
  const { salesStore } = await fresh();
  const q = createOfflineQueue(salesStore);
  await q.enqueue(sale('d1', '2026-11-25T09:00:00.000Z'));
  await q.enqueue(sale('d1', '2026-11-25T09:00:05.000Z'));
  await q.enqueue(sale('d2', '2026-11-25T09:01:00.000Z'));
  assert.equal((await q.list()).length, 2);
  let calls = 0;
  const summary = await q.flush(async () => { calls += 1; if (calls === 2) throw new NetworkError(); return { status: 'done' }; });
  assert.equal(summary.sent, 1);
  assert.equal(summary.stopped, true);
  const again = createOfflineQueue((await fresh()).salesStore);
  assert.equal((await again.list()).length, 1, 'ağ koptuktan sonra yeniden açılışta kalan satış durur');
  await again.flush(async () => ({ status: 'done' }));
});

test('ürün listesi: tümü tek işlemde değişir; bozuk kayıt gelirse eski liste korunur (kısmi değişim olmaz)', async () => {
  const { catalogStore } = await fresh();
  await catalogStore.replaceAll([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  assert.equal((await catalogStore.getAll()).length, 2);
  await assert.rejects(() => catalogStore.replaceAll([{ id: 3, name: 'C' }, { name: 'anahtarsız' }]));
  const after = await catalogStore.getAll();
  assert.deepEqual(after.map(x => x.id).sort(), [1, 2], 'hata sonrası eski liste aynen duruyor');
  await catalogStore.replaceAll([]);
  assert.equal((await catalogStore.getAll()).length, 0);
});

test('büyük ürün listesi: 20.000 kayıt yazılır ve yeniden açılışta okunur', async () => {
  const { catalogStore } = await fresh();
  await catalogStore.replaceAll(Array.from({ length: 20000 }, (_, i) => ({ id: i + 1, barcode: String(1000000000000 + i), name: 'Ürün ' + i })));
  const reopened = await fresh();
  assert.equal((await reopened.catalogStore.getAll()).length, 20000);
  await reopened.catalogStore.replaceAll([]);
});
