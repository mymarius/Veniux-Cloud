const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const d = require('./diagnostics.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vnx-diag-'));
const T = (id, run, extra = {}) => ({ id, name: id, group: 'g', quick: true, run, ...extra });

test('test motoru: başarı, hata, ölçülemeyen ve zaman aşımı ayrı durumlardır', async () => {
  const tests = [
    T('a.ok', async () => ({ status: 'ok', summary: 'iyi' })),
    T('a.warn', async () => ({ status: 'warn', summary: 'uyarı' })),
    T('a.boom', async () => { throw new Error('kırıldı'); }, { advice: 'Kontrol edin' }),
    T('a.none', async () => d.unavailable('Bu ortamda yok', 'Windows gerekir')),
    T('a.slow', () => new Promise(() => {}), { timeoutMs: 40 }),
    T('a.bad', async () => ({ status: 'harika' }))
  ];
  const scan = await d.runTests(tests, { mode: 'full', timeoutMs: 1000 });
  const by = Object.fromEntries(scan.results.map(r => [r.id, r]));
  assert.equal(by['a.ok'].status, 'ok');
  assert.equal(by['a.warn'].status, 'warn');
  assert.deepEqual([by['a.boom'].status, by['a.boom'].detail, by['a.boom'].advice], ['fail', 'kırıldı', 'Kontrol edin']);
  assert.deepEqual([by['a.none'].status, by['a.none'].advice], ['unavailable', 'Windows gerekir']);
  assert.equal(by['a.slow'].status, 'timeout');
  assert.equal(by['a.bad'].status, 'fail');
  assert.ok(typeof by['a.ok'].ms === 'number');
  assert.equal(scan.level, 'fail');
  assert.deepEqual([scan.count.ok, scan.count.warn, scan.count.fail, scan.count.unavailable, scan.count.timeout], [1, 1, 2, 1, 1]);
});

test('ölçülemeyen test başarısızlık sayılmaz: yalnız unavailable içeren tarama "ok" düzeyindedir', async () => {
  const scan = await d.runTests([T('b.ok', async () => ({ status: 'ok', summary: 'x' })), T('b.none', async () => d.unavailable('yok'))]);
  assert.equal(scan.level, 'ok');
  assert.equal(scan.count.unavailable, 1);
});

test('hızlı tarama yalnız quick testleri, tek test yalnız kendi id\'sini çalıştırır', async () => {
  const ran = [];
  const tests = [T('c.q', async () => { ran.push('q'); return { status: 'ok', summary: '' }; }), T('c.full', async () => { ran.push('f'); return { status: 'ok', summary: '' }; }, { quick: false })];
  assert.equal((await d.runTests(tests, { mode: 'quick' })).results.length, 1);
  assert.deepEqual(ran, ['q']);
  const one = await d.runTests(tests, { only: 'c.full' });
  assert.deepEqual([one.mode, one.results.map(r => r.id)], ['single', ['c.full']]);
});

test('iptal: çalışan test cancelled olur (zaman aşımından ayrı), kalanlar çalıştırılmaz', async () => {
  const ctl = new AbortController();
  let thirdRan = false;
  const tests = [T('d.hang', () => new Promise(() => {})), T('d.next', async () => { thirdRan = true; return { status: 'ok', summary: '' }; })];
  setTimeout(() => ctl.abort(), 30);
  const scan = await d.runTests(tests, { signal: ctl.signal, timeoutMs: 5000 });
  assert.deepEqual(scan.results.map(r => r.status), ['cancelled', 'cancelled']);
  assert.equal(thirdRan, false);
});

test('ilerleme bildirimi her test için başlangıç ve bitiş verir', async () => {
  const events = [];
  await d.runTests([T('e.one', async () => ({ status: 'ok', summary: '' })), T('e.two', async () => ({ status: 'ok', summary: '' }))], { onProgress: p => events.push([p.done, p.total, !!p.result]) });
  assert.deepEqual(events, [[0, 2, false], [1, 2, true], [1, 2, false], [2, 2, true]]);
});

test('gerçek ölçümler: sistem, bellek, disk, veritabanı ve yedek testleri geçici klasörde çalışır', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'mysql-data'));
  fs.writeFileSync(path.join(dir, 'mysql-data', 'ibdata1'), Buffer.alloc(2048));
  fs.mkdirSync(path.join(dir, 'backups'));
  fs.writeFileSync(path.join(dir, 'backups', 'yedek-1.sql'), 'x'.repeat(1000));
  const tests = d.buildTests({ dataDir: dir, appVersion: '9.9.9' });
  const scan = await d.runTests(tests.filter(t => /^(sys|data)\./.test(t.id)), { mode: 'full' });
  const by = Object.fromEntries(scan.results.map(r => [r.id, r]));
  assert.match(by['sys.windows'].summary, /Veniux 9\.9\.9/);
  assert.ok(by['sys.memory'].data.total > 0);
  assert.ok(by['sys.disk'].data.free > 0);
  assert.equal(by['data.database'].data.bytes, 2048);
  assert.equal(by['data.backup-last'].status, 'ok');
  assert.equal(by['data.backup-last'].data.ageDays, 0);
  assert.equal(by['data.backup-writable'].status, 'ok');
  assert.deepEqual(fs.readdirSync(path.join(dir, 'backups')), ['yedek-1.sql']); // geçici yazma izi bırakılmaz
  // eski yedek uyarı verir
  const old = new Date(Date.now() - 20 * 86400000);
  fs.utimesSync(path.join(dir, 'backups', 'yedek-1.sql'), old, old);
  assert.equal((await d.runTests(tests, { only: 'data.backup-last' })).results[0].status, 'warn');
});

test('klasör yoksa ölçülemeyen "unavailable" olur, uydurma sonuç verilmez', async () => {
  const dir = tmp();
  const scan = await d.runTests(d.buildTests({ dataDir: dir }).filter(t => t.id.startsWith('data.')));
  assert.deepEqual(scan.results.map(r => r.status), ['unavailable', 'unavailable', 'unavailable']);
  const none = await d.runTests(d.buildTests({ dataDir: dir }), { only: 'dev.printers' });
  assert.equal(none.results[0].status, 'unavailable');
  const ports = await d.runTests(d.buildTests({ dataDir: dir }), { only: 'dev.ports' });
  assert.equal(ports.results[0].status, 'unavailable');
});

test('ağ testi: sahte sunucuya gerçek HTTP isteği; yanıt yoksa fail, 5xx fail', async () => {
  const http = require('http');
  const server = http.createServer((req, res) => { if (req.url === '/bad') { res.statusCode = 503; return res.end('x'); } res.end('ok'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const mk = url => d.buildTests({ dataDir: tmp(), cloudUrl: url }).filter(t => t.id === 'net.cloud');
    assert.equal((await d.runTests(mk(base + '/ok'), { mode: 'full' })).results[0].status, 'ok');
    const bad = (await d.runTests(mk(base + '/bad'), { mode: 'full' })).results[0];
    assert.deepEqual([bad.status, bad.data.http], ['fail', 503]);
  } finally { await new Promise(r => server.close(r)); }
  const down = (await d.runTests(d.buildTests({ dataDir: tmp(), cloudUrl: 'http://127.0.0.1:1/x' }).filter(t => t.id === 'net.cloud'))).results[0];
  assert.equal(down.status, 'fail');
});

test('cihaz testleri: enjekte edilen gerçek tarama sonucunu kullanır; boş yazıcı listesi uyarıdır', async () => {
  const tests = d.buildTests({ dataDir: tmp(), listPrinters: async () => [], scanDevices: async () => ({ ports: [{ name: 'COM3' }], usb: [], hid: [{}], bluetooth: [] }) });
  const scan = await d.runTests(tests, { mode: 'full' });
  const by = Object.fromEntries(scan.results.map(r => [r.id, r]));
  assert.equal(by['dev.printers'].status, 'warn');
  assert.match(by['dev.ports'].summary, /1 COM/);
});

test('geçmiş: yalnız son 20 tarama saklanır ve diskte kişisel veri ayıklanır', () => {
  const dir = tmp();
  for (let i = 0; i < 25; i++) d.saveHistory(dir, { id: 's' + i, at: 'x', note: 'ali@firma.com' });
  const h = d.loadHistory(dir);
  assert.equal(h.length, d.HISTORY_LIMIT);
  assert.equal(h[0].id, 's24');
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'diagnostics-history.json'), 'utf8'), /ali@firma\.com/);
  assert.deepEqual(d.loadHistory(tmp()), []);
});

test('veri ayıklama: parola, token, lisans anahtarı, e-posta, müşteri adı/telefonu, IBAN maskelenir', () => {
  const secret = {
    password: 'S3cr3t!', api_token: 'abc', license_key: 'VNX-ABCD-EFGH-1234',
    customer_name: 'Ayşe Yılmaz', customer_phone: '0532 123 45 67', email: 'ayse@ornek.com', iban: 'TR33 0006 1005 1978 6457 8413 26',
    nested: { authorization: 'Bearer abcdefghijklmnop', company_name: 'Yıldız Market', list: [{ owner_email: 'sahip@ornek.com' }] },
    log: 'giriş ayse@ornek.com tel 05321234567 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123_-xyz iban TR330006100519786457841326 anahtar VNX-QWER-TYUI-9999 dosya C:\\Users\\Mehmet\\AppData\\x password=hunter2 sha ' + 'a'.repeat(64),
    ok_number: 42, free_memory: 12345, name: 'Windows testi'
  };
  const out = JSON.stringify(d.redact(secret));
  for (const leak of ['S3cr3t', 'abc"', 'VNX-ABCD', 'Ayşe', 'Yılmaz', '0532', '05321234567', 'ayse@ornek.com', 'sahip@ornek.com', 'TR33 0006', 'TR330006', 'Bearer abcdefghijklmnop', 'Yıldız Market', 'eyJhbGci', 'VNX-QWER', 'Mehmet', 'hunter2', 'a'.repeat(64)]) {
    assert.ok(!out.includes(leak), 'sızdı: ' + leak);
  }
  assert.ok(out.includes('"ok_number":42') && out.includes('"free_memory":12345') && out.includes('Windows testi'));
});

test('destek paketi: sonuç, sürüm ve günlük sonu birleşir; günlükteki sırlar ayıklanır; otomatik gönderim alanı yok', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'logs'));
  fs.writeFileSync(path.join(dir, 'logs', 'app.log'), 'x\n'.repeat(70000) + 'son satır müşteri ali@firma.com token=abcdef123456 VNX-ZZZZ-AAAA-0001\n');
  fs.writeFileSync(path.join(dir, 'kisisel.txt'), 'bu .log değil');
  const pkg = d.buildSupportPackage({ scan: { id: 's1', results: [{ id: 'x.y', status: 'ok' }] }, extra: { server: { license_key: 'VNX-1111-2222-3333' } }, dataDir: dir, appVersion: '2.4.102', license: { status: 'active', customer_name: 'Ali' } });
  const text = JSON.stringify(pkg);
  assert.equal(pkg.kind, 'veniux-diagnostic-package');
  assert.equal(pkg.app.version, '2.4.102');
  assert.equal(pkg.logs.length, 1);
  assert.ok(pkg.logs[0].tail.length <= 70000 && pkg.logs[0].tail.includes('son satır'));
  for (const leak of ['ali@firma.com', 'abcdef123456', 'VNX-ZZZZ', 'VNX-1111', '"Ali"']) assert.ok(!text.includes(leak), 'sızdı: ' + leak);
  assert.ok(!/upload|http:\/\/|https:\/\//.test(JSON.stringify({ ...pkg, logs: [] }).replace(/https?:\/\/[^"]*gstatic/g, '')));
});

test('IPC girdi doğrulama: yalnız bilinen tarama türü ve test kimliği; fazladan alan, yol ve komut reddedilir', () => {
  assert.deepEqual(d.validateRunRequest({ mode: 'quick' }), { mode: 'quick' });
  assert.deepEqual(d.validateRunRequest({ id: 'net.cloud' }), { only: 'net.cloud' });
  for (const bad of [null, 'quick', [], {}, { mode: 'deep' }, { mode: 'quick', cmd: 'calc' }, { id: '../../etc' }, { id: 'net.cloud; rm -rf' }, { id: 5 }, { id: 'NET.cloud' }, { mode: 'quick', id: 'net.cloud', path: 'C:\\' }]) {
    assert.throws(() => d.validateRunRequest(bad), undefined, JSON.stringify(bad));
  }
  assert.deepEqual(Object.keys(d.validateExportRequest({ scan: { a: 1 }, path: 'C:\\x' })), ['scan', 'extra', 'license']); // yol yok sayılır
  assert.throws(() => d.validateExportRequest('x'));
  assert.throws(() => d.validateExportRequest({ scan: 'x' }));
  assert.throws(() => d.validateExportRequest({ scan: { big: 'x'.repeat(600 * 1024) } }));
});

test('IPC kaydı: kanal listesi sabit, içinde kabuk/dosya/kod çalıştırma kanalı yok; dışa aktarma yolu yalnız kayıt penceresinden gelir', async () => {
  const channels = {};
  const saved = [];
  const dir = tmp();
  const target = path.join(dir, 'secilen.json');
  d.register((name, fn) => { channels[name] = fn; }, {
    app: { getPath: () => dir, getVersion: () => '1.0.0' },
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: target }) },
    getMainWindow: () => null, scanDevices: null, getPrinters: null
  });
  assert.deepEqual(Object.keys(channels).sort(), ['diag-cancel', 'diag-export', 'diag-history', 'diag-list', 'diag-printers', 'diag-run', 'diag-test-print']);
  assert.ok((await channels['diag-list']()).length >= 8);
  const out = await channels['diag-export']({}, { scan: { id: 's', results: [] }, extra: { password: 'x', who: 'a@b.com' }, path: 'C:\\Windows\\hack.json' });
  assert.deepEqual([out.saved, out.name], [true, 'secilen.json']);
  const file = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.equal(file.extra.password, '[GİZLİ]');
  assert.ok(!fs.existsSync('C:\\Windows\\hack.json'));
  await assert.rejects(channels['diag-run']({ sender: { send() {} } }, { mode: 'rm' }));
  await assert.rejects(channels['diag-run']({ sender: { send() {} } }, { id: 'x' }));
  // deneme fişi: yalnız Windows listesindeki yazıcı; yol/komut benzeri girdiler reddedilir
  await assert.rejects(channels['diag-test-print']({}, { printer: 'Olmayan Yazici' }), /listesinde/);
  await assert.rejects(channels['diag-test-print']({}, { printer: 'X', cmd: 'calc' }), /Geçersiz/);
  await assert.rejects(channels['diag-test-print']({}, 'x'), /Geçersiz/);
  saved.push(1);
});
