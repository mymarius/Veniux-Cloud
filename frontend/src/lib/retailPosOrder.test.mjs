import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Kasa ekranı bir kez "Cannot access 'offline' before initialization" ile açılmadı:
// `offline` değişkeni bildirilmeden önce bir efekt bağımlılığında kullanılmıştı.
const source = readFileSync(new URL('../pages/RetailPos.jsx', import.meta.url), 'utf8');

test('RetailPos: offline ve freshCash bildirimden önce kullanılmaz', () => {
  for (const name of ['offline', 'freshCash']) {
    const declared = source.search(new RegExp(String.raw`const\s+${name}\s*=`)) ;
    const firstUse = source.search(new RegExp(`\b${name}\.|\b${name}\b[,\]]`));
    assert.ok(declared >= 0, `${name} bildirimi bulunamadı`);
    assert.ok(declared <= firstUse || firstUse < 0, `${name} bildirimden önce kullanılıyor`);
  }
});
