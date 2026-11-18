const test = require('node:test');
const assert = require('node:assert/strict');
const { isCustomerDisplayUrl, windowOptions } = require('./customerDisplayWindow.cjs');

test('yalnız müşteri ekranı adresi izinli', () => {
  assert.equal(isCustomerDisplayUrl('file:///C:/app/frontend/index.html#/musteri-ekrani'), true);
  assert.equal(isCustomerDisplayUrl('http://localhost:5173/musteri-ekrani'), true);
  assert.equal(isCustomerDisplayUrl('https://evil.example/x'), false);
  assert.equal(isCustomerDisplayUrl('not a url'), false);
});
test('ikinci monitör varsa onda tam ekran, yoksa küçük pencere', () => {
  const d = [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }, { id: 2, bounds: { x: 1920, y: 0, width: 1280, height: 1024 } }];
  const o = windowOptions(d, 1);
  assert.equal(o.fullscreen, true); assert.equal(o.x, 1920); assert.equal(o.width, 1280);
  const single = windowOptions([d[0]], 1);
  assert.equal(single.fullscreen, undefined); assert.equal(single.width, 1024);
});
