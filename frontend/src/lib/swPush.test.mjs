import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// public/sw.js klasik betiktir; sahte ortamda çalıştırıp bildirim işleyicilerini deneriz.
const source = fs.readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://app.veniux.com';

function loadPush() {
  const listeners = {}, shown = [], opened = [], navigated = [], focused = [], windows = [];
  const caches = { open: async () => ({ match: async () => undefined, put: async () => {}, keys: async () => [], delete: async () => {} }), keys: async () => [], delete: async () => {}, match: async () => undefined };
  const self = { location: { origin: ORIGIN }, addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: async () => {}, registration: { showNotification: async (title, options) => { shown.push({ title, options }); } },
    clients: { claim: async () => {}, matchAll: async () => windows, openWindow: async url => { opened.push(url); } } };
  vm.runInNewContext(source, { self, caches, fetch: async () => ({}), URL, setTimeout, clearTimeout, Promise, Array, Map, Set, RegExp, Error, console });
  return { sw: self.__veniuxSw, listeners, shown, opened, navigated, focused, windows };
}
const pushEvent = data => { const waits = []; return { data: data === undefined ? null : { json: () => { if (data instanceof Error) throw data; return data; } }, waitUntil: p => waits.push(p), waits }; };

test('push: bildirim gösterilir; başlık/gövde sınırlanır; bozuk veya boş içerik varsayılana düşer', async () => {
  const { listeners, shown } = loadPush();
  const e1 = pushEvent({ title: 'Sipariş geldi', body: 'Masa 4 · 2× Kıymalı pide', tag: 'order-7', url: '/m/esnaf' }); listeners.push(e1); await Promise.all(e1.waits);
  assert.equal(shown[0].title, 'Sipariş geldi');
  assert.deepEqual({ body: shown[0].options.body, tag: shown[0].options.tag, url: shown[0].options.data.url, renotify: shown[0].options.renotify }, { body: 'Masa 4 · 2× Kıymalı pide', tag: 'order-7', url: '/m/esnaf', renotify: true });
  const e2 = pushEvent(new Error('bozuk json')); listeners.push(e2); await Promise.all(e2.waits);
  assert.equal(shown[1].title, 'Veniux'); assert.equal(shown[1].options.data.url, '/m');
  const e3 = pushEvent({ title: 'x'.repeat(500), body: 'y'.repeat(500) }); listeners.push(e3); await Promise.all(e3.waits);
  assert.equal(shown[2].title.length, 80); assert.equal(shown[2].options.body.length, 240);
  const e4 = pushEvent(undefined); listeners.push(e4); await Promise.all(e4.waits);
  assert.equal(shown[3].title, 'Veniux');
});

test('bildirim adresi yalnız bu uygulamanın sayfası olabilir (açık yönlendirme yok)', () => {
  const { sw } = loadPush();
  assert.equal(sw.safeTarget('/m/esnaf'), '/m/esnaf');
  assert.equal(sw.safeTarget('/m/kritik?x=1'), '/m/kritik?x=1');
  assert.equal(sw.safeTarget('https://app.veniux.com/m/garson'), '/m/garson');
  for (const bad of ['https://evil.example.com/x', '//evil.example.com/x', 'javascript:alert(1)', 'http://evil.com']) assert.equal(sw.safeTarget(bad), '/m', bad);
  for (const empty of [null, undefined, '']) assert.equal(sw.safeTarget(empty), '/m');
});

test('bildirime dokunma: açık uygulama sekmesi varsa oraya gider ve odaklanır; yoksa yeni pencere açılır; yabancı sekmeye dokunulmaz', async () => {
  const h = loadPush();
  const event = url => { const waits = []; return { notification: { closed: false, close() { this.closed = true; }, data: { url } }, waitUntil: p => waits.push(p), waits }; };
  const e1 = event('/m/esnaf'); h.listeners.notificationclick(e1); await Promise.all(e1.waits);
  assert.equal(e1.notification.closed, true); assert.deepEqual(h.opened, ['/m/esnaf']);
  h.windows.push({ url: 'https://baska.example.com/x', navigate: async u => h.navigated.push(['yabanci', u]), focus: async () => h.focused.push('yabanci') });
  h.windows.push({ url: ORIGIN + '/m', navigate: async u => h.navigated.push(['uygulama', u]), focus: async () => h.focused.push('uygulama') });
  const e2 = event('https://evil.example.com/hack'); h.listeners.notificationclick(e2); await Promise.all(e2.waits);
  assert.deepEqual(h.navigated, [['uygulama', '/m']]); assert.deepEqual(h.focused, ['uygulama']); assert.deepEqual(h.opened, ['/m/esnaf']);
});
