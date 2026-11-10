import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheable, cacheKey, save, load, tokenId, isOutage, MAX_AGE_MS, PREFIX } from './offlineReadCache.mjs';

function memoryStorage() {
  const map = new Map();
  return { get length() { return map.size; }, key: i => [...map.keys()][i] ?? null, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
}
const get = (url, params) => ({ method: 'get', url, params });
const now = 1_000_000_000_000;

test('yalnız izinli GET adresleri önbelleğe alınır; yazma ve diğer okumalar alınmaz', () => {
  for (const url of ['/auth/me', '/license/policy', '/normal-depo/warehouses', '/scanner/permissions', '/scanner/shifts/context', '/scanner/pro/preferences', '/api/scanner/pro/categories?x=1']) assert.equal(cacheable(get(url)), true, url);
  for (const url of ['/scanner/sale', '/scanner/sales', '/scanner/pro/accounts', '/products', '/scanner/shifts/5']) assert.equal(cacheable(get(url)), false, url);
  assert.equal(cacheable({ method: 'post', url: '/auth/me' }), false);
  assert.equal(cacheable({ method: 'put', url: '/scanner/permissions' }), false);
});

test('kaydedilen cevap aynı oturumda geri gelir; parametreler ayrı anahtardır', () => {
  const storage = memoryStorage(), id = tokenId('jeton-A');
  save(storage, get('/scanner/shifts/context', { warehouse_id: 1, register_id: 2 }), { shift: 7 }, id, now);
  save(storage, get('/scanner/shifts/context', { warehouse_id: 1 }), { shift: 9 }, id, now);
  assert.deepEqual(load(storage, get('/scanner/shifts/context', { register_id: 2, warehouse_id: 1 }), id, now + 1000), { data: { shift: 7 } });
  assert.deepEqual(load(storage, get('/scanner/shifts/context', { warehouse_id: 1 }), id, now + 1000), { data: { shift: 9 } });
  assert.equal(load(storage, get('/scanner/shifts/context', { warehouse_id: 2 }), id, now), null);
});

test('24 saati geçen veya gelecekten gelen kayıt kullanılmaz', () => {
  const storage = memoryStorage(), id = tokenId('jeton-A');
  save(storage, get('/auth/me'), { id: 1 }, id, now);
  assert.notEqual(load(storage, get('/auth/me'), id, now + MAX_AGE_MS - 1), null);
  assert.equal(load(storage, get('/auth/me'), id, now + MAX_AGE_MS + 1), null);
  assert.equal(load(storage, get('/auth/me'), id, now - 5000), null);
});

test('başka oturumun kayıtları eşleşmez ve yeni oturum kaydedince temizlenir', () => {
  const storage = memoryStorage(), a = tokenId('jeton-A'), b = tokenId('jeton-B');
  save(storage, get('/auth/me'), { id: 1 }, a, now);
  assert.equal(load(storage, get('/auth/me'), b, now), null);
  save(storage, get('/auth/me'), { id: 2 }, b, now);
  assert.equal(load(storage, get('/auth/me'), a, now), null);
  assert.equal([...Array(storage.length).keys()].every(i => storage.key(i).startsWith(PREFIX + b + ':')), true);
  assert.notEqual(tokenId('jeton-A'), tokenId('jeton-B'));
});

test('bozuk veya eksik kayıt sessizce yok sayılır; dolu depo uygulamayı bozmaz', () => {
  const storage = memoryStorage(), id = tokenId('x');
  storage.setItem(cacheKey(get('/auth/me'), id), '{bozuk');
  assert.equal(load(storage, get('/auth/me'), id, now), null);
  const full = { get length() { return 0; }, key: () => null, getItem: () => null, setItem() { throw new Error('dolu'); }, removeItem() {} };
  assert.doesNotThrow(() => save(full, get('/auth/me'), { a: 1 }, id, now));
});

test('kesinti: cevap yok veya 502-504; anlamlı sunucu cevapları (401, 403, 423, 500) kesinti değildir', () => {
  assert.equal(isOutage(new Error('Network Error')), true);
  for (const status of [502, 503, 504]) assert.equal(isOutage({ response: { status } }), true);
  for (const status of [400, 401, 403, 404, 423, 500]) assert.equal(isOutage({ response: { status } }), false);
});
