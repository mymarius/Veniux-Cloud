const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const lab = require('./lab.cjs');

test('üretim ayarları ve sırlar laboratuvar sunucusuna aktarılmaz', () => {
  const env = lab.labEnv({ PATH: 'x', DB_ENGINE: 'mysql', DB_HOST: 'canli.sunucu', DB_PASSWORD: 'gizli', SMTP_PASS: 'gizli', VENIUX_CLOUD_SERVICE: '1', NODE_ENV: 'production', IYZICO_SECRET: 'gizli' }, '/tmp/veniux-qa-lab', 's'.repeat(48));
  assert.equal(env.DB_ENGINE, 'sqlite');
  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.HOST, '127.0.0.1');
  for (const key of ['DB_HOST', 'DB_PASSWORD', 'SMTP_PASS', 'VENIUX_CLOUD_SERVICE', 'IYZICO_SECRET']) assert.equal(env[key], undefined, key);
  assert.ok(env.VENIUX_DATA_DIR.includes('veniux-qa-lab'));
});

test('sıfırlama yalnız işaretli laboratuvar klasörünü kabul eder', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vx-guard-'));
  try {
    const wrongName = path.join(base, 'veri'); fs.mkdirSync(wrongName); fs.writeFileSync(path.join(wrongName, lab.MARKER), '');
    assert.throws(() => lab.assertLabDir(wrongName), /klasör adı/);
    const unmarked = path.join(base, 'veniux-qa-lab'); fs.mkdirSync(unmarked); fs.writeFileSync(path.join(unmarked, 'onemli.db'), 'x');
    assert.throws(() => lab.assertLabDir(unmarked), /işareti yok/);
    assert.throws(() => lab.assertLabDir(path.resolve(__dirname, '..')), /Reddedildi/);
    fs.writeFileSync(path.join(unmarked, lab.MARKER), '');
    assert.equal(lab.assertLabDir(unmarked), path.resolve(unmarked));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
