import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineQueue, memoryStore, NetworkError } from './offlineQueue.mjs';
import { nextEmergencyReceipt, deviceKey, businessDay } from './emergencyReceipt.mjs';
import { offlineTotals, offlineChange, supportedOffline, lineCents } from './offlineSale.mjs';
import { downloadCatalog, buildIndex, findProduct } from './offlineCatalog.mjs';

const sale = (id, at) => ({ id, created_at: at, receipt_no: 'E1-X-' + id, body: { items: [{ barcode: '1', count: 1 }] } });
const memoryStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('kuyruk: aynı satış iki kez eklenmez; sıra eklenme zamanına göre korunur', async () => {
  const q = createOfflineQueue(memoryStore());
  await q.enqueue(sale('b', '2026-11-10T10:00:02Z'));
  await q.enqueue(sale('a', '2026-11-10T10:00:01Z'));
  await q.enqueue(sale('a', '2026-11-10T10:00:09Z'));
  assert.deepEqual((await q.list()).map(r => r.id), ['a', 'b']);
  assert.deepEqual(await q.counts(), { total: 2, pending: 2, conflict: 0 });
});

test('kuyruk: geçersiz satış reddedilir', async () => {
  const q = createOfflineQueue(memoryStore());
  await assert.rejects(() => q.enqueue({ id: '', body: {} }));
  await assert.rejects(() => q.enqueue({ id: 'x' }));
});

test('gönderim: işlenen satır silinir, ağ kopunca döngü durur ve kalanlar kuyrukta kalır (sıra bozulmaz)', async () => {
  const q = createOfflineQueue(memoryStore());
  for (const [id, at] of [['s1', '1'], ['s2', '2'], ['s3', '3']]) await q.enqueue(sale(id, at));
  const seen = [];
  const summary = await q.flush(async r => { seen.push(r.id); if (r.id === 's2') throw new NetworkError(); return { status: 'done' }; });
  assert.deepEqual(seen, ['s1', 's2']);
  assert.deepEqual(summary, { sent: 1, rejected: 0, stopped: true, remaining: 2 });
  assert.deepEqual((await q.list()).map(r => r.id), ['s2', 's3']);
});

test('gönderim: reddedilen satış silinmez, uyuşmazlık olarak işaretlenir ve sıradakiler yine gönderilir', async () => {
  const q = createOfflineQueue(memoryStore());
  await q.enqueue(sale('s1', '1')); await q.enqueue(sale('s2', '2'));
  const summary = await q.flush(async r => (r.id === 's1' ? { status: 'rejected', message: 'Yetersiz stok' } : { status: 'done' }));
  assert.deepEqual(summary, { sent: 1, rejected: 1, stopped: false, remaining: 1 });
  const [left] = await q.list();
  assert.equal(left.id, 's1'); assert.equal(left.status, 'conflict'); assert.equal(left.last_error, 'Yetersiz stok'); assert.equal(left.attempts, 1);
  // Uyuşmazlık satırı otomatik yeniden gönderilmez.
  let calls = 0;
  await q.flush(async () => { calls++; return { status: 'done' }; });
  assert.equal(calls, 0);
});

test('gönderim: beklenmeyen hata satırı kuyrukta tutar ve deneme sayısını artırır; yanıt kaybolursa aynı kimlikle tekrar gönderilebilir', async () => {
  const q = createOfflineQueue(memoryStore());
  await q.enqueue(sale('s1', '1'));
  await q.flush(async () => { throw new Error('beklenmeyen'); });
  const [row] = await q.list();
  assert.equal(row.status, 'pending'); assert.equal(row.attempts, 1);
  const ids = [];
  await q.flush(async r => { ids.push(r.id); return { status: 'done' }; });
  assert.deepEqual(ids, ['s1']);
  assert.equal((await q.counts()).total, 0);
});

test('geçici fiş numarası: gün başına artar, boşluksuz ve cihaz öneklidir; gün değişince sıfırlanır', () => {
  const storage = memoryStorage(), day = new Date('2026-11-10T10:00:00Z'), next = new Date('2026-11-11T10:00:00Z');
  const a = nextEmergencyReceipt(storage, 'cihaz-1', day), b = nextEmergencyReceipt(storage, 'cihaz-1', day), c = nextEmergencyReceipt(storage, 'cihaz-1', next);
  const key = deviceKey('cihaz-1');
  assert.equal(a, `E${key}-20261110-00001`); assert.equal(b, `E${key}-20261110-00002`); assert.equal(c, `E${key}-20261111-00001`);
  assert.notEqual(deviceKey('cihaz-1'), deviceKey('cihaz-2'));
  assert.equal(businessDay(new Date('2026-11-10T22:30:00Z')), '20261111');
});

test('geçici fiş numarası: sayaç yazılamazsa numara üretilmez', () => {
  const broken = { getItem: () => null, setItem: () => {} };
  assert.throws(() => nextEmergencyReceipt(broken, 'cihaz-1'), /sayacı/);
});

test('tutar: satır başına kuruş yuvarlama, ağırlıklı ürün ve para üstü', () => {
  assert.equal(lineCents(10.1, 3), 3030);
  const items = [{ barcode: '1', count: 2, unit_price: 12.5, product: { name: 'A' } }, { barcode: '2', manual_quantity: true, quantity: 0.35, unit_price: 29.9, product: { name: 'B' } }];
  const t = offlineTotals(items);
  assert.equal(t.total_cents, 2500 + 1047);
  assert.deepEqual(offlineChange(t.total_cents, '40', 'cash'), { cash_cents: 3547, card_cents: 0, change_cents: 453 });
  assert.throws(() => offlineChange(t.total_cents, '30', 'cash'), /az/);
  assert.deepEqual(offlineChange(t.total_cents, '', 'credit_card'), { cash_cents: 0, card_cents: 3547, change_cents: 0 });
  assert.throws(() => offlineTotals([{ barcode: '1', count: 0, unit_price: 1 }]));
});

test('çevrimdışı desteklenmeyenler: indirim, sadakat, veresiye, fiyat değişikliği', () => {
  const base = { payment: 'cash', discount: '0', loyaltyCard: '', items: [{}] };
  assert.equal(supportedOffline(base), null);
  assert.match(supportedOffline({ ...base, payment: 'on_account' }), /nakit ve kart/);
  assert.match(supportedOffline({ ...base, discount: '5' }), /indirim/);
  assert.match(supportedOffline({ ...base, loyaltyCard: '123' }), /sadakat/);
  assert.match(supportedOffline({ ...base, items: [{ override: 3 }] }), /fiyat/);
});

test('ürün listesi: sayfalar sonuna kadar indirilir, yarıda kalan indirme tamamlandı sayılmaz, barkod ve SKU ile bulunur', async () => {
  const pages = { 0: { items: [{ id: 1, name: 'A', barcode: '111', sku: 'S1', sale_price: 5, gizli: 'x' }], next: 1 }, 1: { items: [{ id: 2, name: 'B', barcode: null, sku: 'S2', sale_price: 7 }], next: null } };
  const full = await downloadCatalog(async after => pages[after]);
  assert.equal(full.complete, true); assert.equal(full.items.length, 2); assert.equal('gizli' in full.items[0], false);
  const index = buildIndex(full.items);
  assert.equal(findProduct(index, '111').name, 'A'); assert.equal(findProduct(index, 'S2').name, 'B'); assert.equal(findProduct(index, '999'), null);
  const partial = await downloadCatalog(async after => ({ items: [{ id: after + 1, name: 'x' }], next: after + 1 }), { maxPages: 3 });
  assert.equal(partial.complete, false);
});

test('ürün listesi: sayfalama ilerlemezse sonsuz döngüye girmez', async () => {
  await assert.rejects(() => downloadCatalog(async () => ({ items: [{ id: 1 }], next: 5 }), { maxPages: 10 }), /ilerlemedi/);
});

import { createSender, isNetworkFailure } from './offlineQueue.mjs';
const post = result => async () => { if (result instanceof Error) throw result; return result; };
const httpError = (status, error) => Object.assign(new Error('http'), { response: { status, data: { error } } });

test('gönderici: sunucu satışı işlerse işlendi; kimlik Idempotency-Key olarak gider', async () => {
  let seen;
  const send = createSender(async (path, body, config) => { seen = { path, key: config.headers['Idempotency-Key'], body }; return { data: {} }; });
  assert.deepEqual(await send({ id: 'k-1', body: { a: 1 } }), { status: 'done' });
  assert.deepEqual(seen, { path: '/scanner/sale', key: 'k-1', body: { a: 1 } });
});

test('gönderici: yanıt yok veya 502-504 ağ hatasıdır (kuyrukta beklesin); 400-422 reddedilmedir ve mesajı taşır', async () => {
  const net = createSender(post(new Error('network')));
  await assert.rejects(() => net({ id: 'a', body: {} }), { name: 'NetworkError' });
  for (const status of [502, 503, 504]) await assert.rejects(() => createSender(post(httpError(status)))({ id: 'a', body: {} }), { name: 'NetworkError' });
  const rejected = await createSender(post(httpError(409, 'Yetersiz stok')))({ id: 'a', body: {} });
  assert.deepEqual(rejected, { status: 'rejected', message: 'Yetersiz stok' });
  assert.equal(isNetworkFailure(httpError(500)), false);
  assert.equal(isNetworkFailure(httpError(422)), false);
  assert.equal(isNetworkFailure(new Error('x')), true);
});

test('uçtan uca: ağ kesilip gelince kuyruk sırayla boşalır; yanıtı kaybolan satış aynı anahtarla tekrar gidince çift kayıt oluşmaz', async () => {
  const q = createOfflineQueue(memoryStore());
  for (const id of ['x1', 'x2', 'x3']) await q.enqueue({ id, created_at: id, body: { id } });
  const server = new Set(); let online = false, dropResponseFor = 'x1';
  const wire = async (path, body, config) => {
    if (!online) throw new Error('network');
    server.add(config.headers['Idempotency-Key']);               // sunucu satışı işler (aynı anahtar bir kez sayılır)
    if (dropResponseFor === config.headers['Idempotency-Key']) { dropResponseFor = null; throw new Error('yanıt kayboldu'); }
    return { data: {} };
  };
  const send = createSender(wire);
  assert.equal((await q.flush(send)).stopped, true);              // internet yok
  online = true;
  const first = await q.flush(send);                              // x1 işlendi ama yanıt kayboldu → ağ hatası sayılır, sıra durur
  assert.equal(first.stopped, true); assert.equal((await q.counts()).total, 3);
  const second = await q.flush(send);                              // aynı anahtarla tekrar
  assert.deepEqual(second, { sent: 3, rejected: 0, stopped: false, remaining: 0 });
  assert.deepEqual([...server].sort(), ['x1', 'x2', 'x3']);       // sunucuda her satış bir kez
});
