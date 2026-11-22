// Veniux Tanılama (masaüstü tarafı). Yalnız GERÇEK ölçüm yapar; ölçülemeyen şey "unavailable" olur ve başarısızlıktan ayrı gösterilir.
// Onarım yapmaz, rastgele komut çalıştırmaz. Arayüzden gelen hiçbir metin dosya yoluna ya da komuta karışmaz.
const os = require('os'), fs = require('fs'), path = require('path');

// Durumlar: ok | warn | fail | unavailable (ölçülemedi/desteklenmiyor) | timeout | cancelled | skipped
const STATUSES = ['ok', 'warn', 'fail', 'unavailable', 'timeout', 'cancelled', 'skipped'];
const DEFAULT_TIMEOUT_MS = 15000;
const HISTORY_LIMIT = 20;
const MODES = ['quick', 'full'];
const ID_RE = /^[a-z]+\.[a-z0-9-]{2,40}$/;

// ---------- Kişisel veri ayıklama ----------
const SENSITIVE_KEY = /pass|pwd|token|secret|authorization|cookie|license_?key|lisans_?anahtar|api_?key|iban|e_?mail|phone|telefon|customer|musteri|müşteri|company|firma|owner/i;
const PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, '[TOKEN]'],            // JWT
  [/\bBearer\s+[A-Za-z0-9._~+\/=-]{8,}/gi, 'Bearer [TOKEN]'],
  [/\bVNX(?:[A-Z0-9]*)-[A-Za-z0-9-]{6,}\b/g, '[LISANS-ANAHTARI]'],                         // VNX-... lisans anahtarları
  [/\bVNXM1\.[A-Za-z0-9_-]+/g, '[EŞLEŞTİRME-KODU]'],
  [/\bTR\d{2}(?:[ ]?\d{4}){5}[ ]?\d{2}\b/gi, 'TR[IBAN]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[E-POSTA]'],
  [/(?:\+?90[ -]?)?\(?0?5\d{2}\)?[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}\b/g, '[TELEFON]'],
  [/\b[0-9a-f]{32,}\b/gi, '[ANAHTAR]'],                                                  // uzun onaltılık sırlar/özetler
  [/(password|passwd|pwd|secret|token|api[_-]?key)(["']?\s*[:=]\s*["']?)[^\s"',;}&]+/gi, '$1$2[GİZLİ]'],
  [/C:\\Users\\[^\\\s"']+/gi, 'C:\\Users\\[KULLANICI]']                                     // Windows kullanıcı adı
];

function redactString(text) {
  let out = String(text);
  for (const [re, to] of PATTERNS) out = out.replace(re, to);
  return out;
}

// Derin ayıklama: anahtar adı hassassa değer tamamen maskelenir; kalan metinler desenlerle taranır.
// Boolean/sayı gibi hassas olmayan ölçümler korunur (ör. total_memory).
function redact(value, key = '') {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return SENSITIVE_KEY.test(key) && value ? '[GİZLİ]' : redactString(value);
  if (Array.isArray(value)) return value.map(v => redact(v, key));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const hidden = SENSITIVE_KEY.test(k) && ((typeof v === 'string' && v) || (v && typeof v === 'object'));
      out[k] = hidden ? '[GİZLİ]' : redact(v, k);
    }
    return out;
  }
  return value;
}

// ---------- Test motoru ----------
// test = { id, name, description, group, quick, run(ctx) -> { status, summary, detail?, advice?, data? } }
// ctx = { signal }. Test beklenmedik hata fırlatırsa "fail"; yalnız EngineUnavailable "unavailable" sayılır.
class Unavailable extends Error {}
const unavailable = (why, advice) => { throw Object.assign(new Unavailable(why), { advice }); };

function raceAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(Object.assign(new Error('abort'), { aborted: true }));
    const onAbort = () => reject(Object.assign(new Error('abort'), { aborted: true }));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(v => { signal.removeEventListener('abort', onAbort); resolve(v); }, e => { signal.removeEventListener('abort', onAbort); reject(e); });
  });
}

async function runOne(test, { signal, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const started = Date.now();
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort('timeout'), timeoutMs);
  const link = () => { if (signal?.aborted) timer.abort('cancel'); };
  signal?.addEventListener('abort', link, { once: true });
  try {
    const result = await raceAbort(Promise.resolve().then(() => test.run({ signal: timer.signal })), timer.signal);
    if (!STATUSES.includes(result?.status)) throw new Error('Test geçersiz durum döndürdü.');
    return { id: test.id, name: test.name, group: test.group, ...result, ms: Date.now() - started };
  } catch (e) {
    const base = { id: test.id, name: test.name, group: test.group, ms: Date.now() - started };
    if (e.aborted) {
      return timer.signal.reason === 'timeout'
        ? { ...base, status: 'timeout', summary: 'Test ' + Math.round(timeoutMs / 1000) + ' sn içinde bitmedi.', advice: 'Cihaz veya ağ yanıt vermiyor olabilir; bağlantıyı kontrol edip yeniden deneyin.' }
        : { ...base, status: 'cancelled', summary: 'Kullanıcı iptal etti.' };
    }
    if (e instanceof Unavailable) return { ...base, status: 'unavailable', summary: e.message, advice: e.advice };
    return { ...base, status: 'fail', summary: 'Test çalışırken hata verdi.', detail: String(e && e.message || e).slice(0, 300), advice: test.advice };
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', link); }
}

function summarize(results) {
  const count = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const r of results) count[r.status]++;
  const level = count.fail || count.timeout ? 'fail' : count.warn ? 'warn' : 'ok';
  return { count, level };
}

// Testleri sırayla çalıştırır; iptal edilirse kalanlar "cancelled" olarak işaretlenir. onProgress({done,total,current,result}) çağrılır.
async function runTests(tests, { mode = 'full', only = null, signal, timeoutMs, onProgress } = {}) {
  const chosen = only ? tests.filter(t => t.id === only) : mode === 'quick' ? tests.filter(t => t.quick) : tests;
  const results = [];
  for (const [i, test] of chosen.entries()) {
    onProgress?.({ done: i, total: chosen.length, current: test.id });
    const r = signal?.aborted ? { id: test.id, name: test.name, group: test.group, status: 'cancelled', summary: 'Kullanıcı iptal etti.', ms: 0 } : await runOne(test, { signal, timeoutMs: test.timeoutMs || timeoutMs });
    results.push(r);
    onProgress?.({ done: i + 1, total: chosen.length, current: test.id, result: r });
  }
  return { id: 'scan-' + Date.now().toString(36), mode: only ? 'single' : mode, at: new Date().toISOString(), results, ...summarize(results) };
}

// ---------- Ölçüm testleri (hepsi gerçek ölçüm) ----------
const MB = 1024 * 1024, GB = 1024 * MB;
const gb = n => (n / GB).toFixed(1) + ' GB';

function dirSize(dir, limit = 20000) {
  let total = 0, files = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (files >= limit) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.isFile()) { files++; try { total += fs.statSync(p).size; } catch { /* okunamayan dosya atlanır */ } }
    }
  };
  walk(dir);
  return { total, files, truncated: files >= limit };
}

async function timedFetch(url, signal) {
  const t0 = Date.now();
  const res = await fetch(url, { method: 'GET', signal, redirect: 'manual', headers: { Accept: 'application/json,text/plain,*/*' } });
  return { status: res.status, ms: Date.now() - t0 };
}

function buildTests(ctx) {
  const { dataDir, appVersion = 'bilinmiyor', versions = process.versions, cloudUrl = 'https://app.veniux.com/health', licenseUrl = 'https://api.veniux.com/health', scanDevices, listPrinters } = ctx;
  const t = [];
  const add = (id, group, name, description, quick, run, extra = {}) => t.push({ id, group, name, description, quick, run, ...extra });

  add('sys.windows', 'Sistem', 'Windows ve program sürümü', 'İşletim sistemi, mimari ve program/Electron/Node/Chromium sürümleri.', true, async () => ({
    status: 'ok', summary: `${os.type()} ${os.release()} (${os.arch()}) · Veniux ${appVersion}`,
    data: { os: os.version?.() || os.type(), release: os.release(), arch: os.arch(), app: appVersion, electron: versions.electron || null, node: versions.node, chrome: versions.chrome || null }
  }));
  add('sys.memory', 'Sistem', 'Bellek (RAM)', 'Toplam ve boş bellek. Boş bellek %10 ya da 500 MB altındaysa uyarır.', true, async () => {
    const total = os.totalmem(), free = os.freemem(), ratio = free / total;
    const status = free < 300 * MB ? 'fail' : (ratio < 0.1 || free < 500 * MB) ? 'warn' : 'ok';
    return { status, summary: `Boş ${gb(free)} / toplam ${gb(total)}`, data: { total, free }, advice: status === 'ok' ? undefined : 'Kullanılmayan programları kapatın; sorun sürerse bilgisayarı yeniden başlatın.' };
  });
  add('sys.disk', 'Sistem', 'Disk boş alanı', 'Veri klasörünün bulunduğu sürücüde boş alan. 5 GB altı uyarı, 1 GB altı hata.', true, async () => {
    if (!dataDir || typeof fs.statfsSync !== 'function') unavailable('Disk bilgisi okunamadı.', 'Windows dosya gezgininden sürücü boş alanına bakın.');
    const s = fs.statfsSync(dataDir), free = Number(s.bavail) * Number(s.bsize), total = Number(s.blocks) * Number(s.bsize);
    const status = free < 1 * GB ? 'fail' : free < 5 * GB ? 'warn' : 'ok';
    return { status, summary: `Boş ${gb(free)} / ${gb(total)}`, data: { free, total, thresholds: { warn: 5 * GB, fail: 1 * GB } }, advice: status === 'ok' ? undefined : 'Gereksiz dosyaları silin veya yedekleri başka sürücüye taşıyın; boş alan bitince veritabanı yazamaz.' };
  });
  add('data.database', 'Veri ve yedek', 'Yerel veritabanı', 'Veritabanı klasörünün okunabilir/yazılabilir olması ve boyutu.', true, async () => {
    const dir = dataDir && path.join(dataDir, 'mysql-data');
    if (!dir || !fs.existsSync(dir)) unavailable('Yerel veritabanı klasörü yok (bu kurulum bulut/harici sunucu kullanıyor olabilir).');
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    const size = dirSize(dir);
    return { status: 'ok', summary: 'Erişilebilir · ' + gb(size.total) + (size.truncated ? ' (en az)' : ''), data: { bytes: size.total, files: size.files } };
  }, { advice: 'Veritabanı klasörü başka bir program tarafından kilitlenmiş ya da izinleri bozulmuş olabilir.' });
  add('data.backup-last', 'Veri ve yedek', 'Son yedek', 'Yedek klasöründeki en yeni yedeğin zamanı ve boyutu. 7 günden eskiyse uyarır.', true, async () => {
    const dir = dataDir && path.join(dataDir, 'backups');
    if (!dir || !fs.existsSync(dir)) unavailable('Yedek klasörü bulunamadı; bu kurulumda yerel yedek alınmamış olabilir.', 'Ayarlar › Yedek bölümünden yedek alın.');
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => ({ name: e.name, ...fs.statSync(path.join(dir, e.name)) }));
    if (!files.length) return { status: 'warn', summary: 'Yedek klasörü boş: hiç yedek yok.', advice: 'Şimdi yedek alın.' };
    const latest = files.sort((a, b) => b.mtimeMs - a.mtimeMs)[0], age = Date.now() - latest.mtimeMs;
    const status = age > 7 * 86400000 ? 'warn' : 'ok';
    return { status, summary: `${new Date(latest.mtimeMs).toISOString()} · ${(latest.size / MB).toFixed(1)} MB`, data: { at: new Date(latest.mtimeMs).toISOString(), bytes: latest.size, ageDays: Math.floor(age / 86400000) }, advice: status === 'warn' ? 'Son yedek 7 günden eski; şimdi yedek alın.' : undefined };
  });
  add('data.backup-writable', 'Veri ve yedek', 'Yedek klasörü yazılabilir mi', 'Yedek klasörüne geçici bir dosya yazıp silerek gerçek yazma denemesi yapar.', false, async () => {
    const dir = dataDir && path.join(dataDir, 'backups');
    if (!dir || !fs.existsSync(dir)) unavailable('Yedek klasörü yok; yazma denenemedi.');
    const probe = path.join(dir, '.tanilama-' + process.pid + '.tmp');
    fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
    return { status: 'ok', summary: 'Yazma ve silme başarılı.' };
  }, { advice: 'Klasör izinlerini ve disk doluluğunu kontrol edin; yedekler yazılamıyor olabilir.' });

  const net = (id, name, description, url, quick) => add(id, 'Ağ ve bulut', name, description, quick, async ({ signal }) => {
    try {
      const r = await timedFetch(url, signal);
      // Sunucudan HTTP yanıtı gelmesi = erişim var. 5xx sunucu tarafı sorunudur.
      const status = r.status >= 500 ? 'fail' : r.ms > 2000 ? 'warn' : 'ok';
      return { status, summary: `HTTP ${r.status} · ${r.ms} ms`, data: { http: r.status, latencyMs: r.ms }, advice: status === 'ok' ? undefined : r.status >= 500 ? 'Sunucu şu an hata veriyor; bir süre sonra yeniden deneyin.' : 'Bağlantı yavaş; ağınızı kontrol edin.' };
    } catch (e) {
      if (e?.name === 'AbortError' || signal.aborted) throw Object.assign(new Error('abort'), { aborted: true });
      return { status: 'fail', summary: 'Ulaşılamadı.', detail: String(e.cause?.code || e.message).slice(0, 120), advice: 'İnternet bağlantınızı, güvenlik duvarını ve proxy ayarlarını kontrol edin.' };
    }
  });
  net('net.internet', 'İnternet', 'Genel internet erişimi (gerçek bir HTTPS isteğinin gecikmesi).', 'https://www.gstatic.com/generate_204', true);
  net('net.cloud', 'Veniux bulut (app.veniux.com)', 'Bulut sunucusunun sağlık ucuna erişim ve gecikme.', cloudUrl, true);
  net('net.license', 'Lisans merkezi (api.veniux.com)', 'Lisans merkezinin sağlık ucuna erişim ve gecikme.', licenseUrl, false);

  add('dev.printers', 'Cihazlar', 'Yazıcılar', 'Windows\'ta tanımlı yazıcıların listesi.', false, async () => {
    const list = listPrinters ? await listPrinters() : null;
    if (!list) unavailable('Yazıcı listesi bu ortamda alınamıyor.');
    return list.length ? { status: 'ok', summary: list.length + ' yazıcı: ' + list.slice(0, 4).map(p => p.name).join(', '), data: { printers: list.map(p => ({ name: p.name, status: p.status })) } }
      : { status: 'warn', summary: 'Tanımlı yazıcı yok.', advice: 'Yazıcıyı Windows\'a ekleyin; deneme fişini ardından yazdırın.' };
  });
  add('dev.ports', 'Cihazlar', 'COM / USB / HID aygıtları', 'Terazi, barkod okuyucu ve yazarkasa için takılı seri, USB ve HID aygıt sayıları.', false, async () => {
    if (!scanDevices) unavailable('Aygıt taraması bu ortamda yok (yalnız Windows masaüstü programı).');
    const r = await scanDevices();
    return { status: 'ok', summary: `${r.ports.length} COM · ${r.usb.length} USB · ${r.hid.length} HID`, data: { com: r.ports.map(p => p.name), usb: r.usb.length, hid: r.hid.length, bluetooth: r.bluetooth.length } };
  }, { timeoutMs: 25000 });
  return t;
}

// ---------- Geçmiş (yerelde son 20 tarama) ----------
const historyFile = dir => path.join(dir, 'diagnostics-history.json');
function loadHistory(dir) { try { const v = JSON.parse(fs.readFileSync(historyFile(dir), 'utf8')); return Array.isArray(v) ? v.slice(0, HISTORY_LIMIT) : []; } catch { return []; } }
function saveHistory(dir, scan) {
  const next = [scan, ...loadHistory(dir).filter(s => s.id !== scan.id)].slice(0, HISTORY_LIMIT);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(historyFile(dir), JSON.stringify(redact(next)));
  return next;
}

// ---------- Destek paketi ----------
function tailFile(file, maxBytes = 64 * 1024) {
  const fd = fs.openSync(file, 'r');
  try { const size = fs.fstatSync(fd).size, len = Math.min(size, maxBytes), buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, size - len); return buf.toString('utf8'); } finally { fs.closeSync(fd); }
}
// Veri klasörü ve altındaki logs/ içinde *.log dosyalarının son kısmı. Hiçbir dosya yolu arayüzden gelmez.
function collectLogs(dataDir) {
  const out = [];
  for (const dir of [dataDir, path.join(dataDir || '', 'logs')]) {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isFile() && /\.log$/i.test(e.name) && out.length < 6) out.push({ file: e.name, tail: redactString(tailFile(path.join(dir, e.name))) });
    } catch { /* klasör yok */ }
  }
  return out;
}

function buildSupportPackage({ scan, extra, dataDir, appVersion, license }) {
  return redact({
    kind: 'veniux-diagnostic-package', version: 1, created_at: new Date().toISOString(),
    notice: 'Kişisel veriler (parola, anahtar, e-posta, telefon, IBAN, müşteri/firma adı) maskelenmiştir. Dosya otomatik gönderilmez.',
    app: { version: appVersion, os: os.type() + ' ' + os.release(), arch: os.arch() },
    license: license || null,
    scan, extra: extra || null,
    logs: dataDir ? collectLogs(dataDir) : []
  });
}

// ---------- IPC girdi doğrulama ----------
function validateRunRequest(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) throw new Error('Geçersiz tanılama isteği.');
  const keys = Object.keys(req);
  if (keys.some(k => !['mode', 'id'].includes(k))) throw new Error('Geçersiz tanılama isteği.');
  if (req.id !== undefined) { if (typeof req.id !== 'string' || !ID_RE.test(req.id)) throw new Error('Geçersiz test kimliği.'); return { only: req.id }; }
  if (!MODES.includes(req.mode)) throw new Error('Geçersiz tarama türü.');
  return { mode: req.mode };
}
function validateExportRequest(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) throw new Error('Geçersiz dışa aktarma isteği.');
  if (JSON.stringify(req).length > 512 * 1024) throw new Error('Dışa aktarılacak veri çok büyük.');
  const { scan = null, extra = null, license = null } = req;
  for (const v of [scan, extra, license]) if (v !== null && (typeof v !== 'object' || Array.isArray(v))) throw new Error('Geçersiz dışa aktarma verisi.');
  return { scan, extra, license };
}

// ---------- Electron kaydı ----------
// deps: { app, dialog, BrowserWindow, getMainWindow } — kanal listesi sabit; her kanal 'handle' sarmalayıcısıyla güvenilir pencereye kısıtlıdır.
function register(handle, deps) {
  const { app, dialog, getMainWindow, scanDevices, getPrinters } = deps;
  const dataDir = app.getPath('userData');
  const tests = () => buildTests({ dataDir, appVersion: app.getVersion(), scanDevices, listPrinters: getPrinters });
  let current = null;
  handle('diag-list', () => tests().map(({ id, group, name, description, quick }) => ({ id, group, name, description, quick })));
  handle('diag-history', () => loadHistory(dataDir));
  handle('diag-run', async (event, req) => {
    const opts = validateRunRequest(req);
    if (current) throw new Error('Başka bir tarama sürüyor.');
    const ctl = new AbortController();
    current = ctl;
    try {
      const scan = await runTests(tests(), { ...opts, signal: ctl.signal, onProgress: p => { try { event.sender.send('diag-progress', { done: p.done, total: p.total, current: p.current, result: p.result }); } catch { /* pencere kapandı */ } } });
      saveHistory(dataDir, scan);
      return scan;
    } finally { current = null; }
  });
  handle('diag-cancel', () => { current?.abort('cancel'); return true; });
  // Deneme fişi: yazıcı adı yalnız Windows'un bildirdiği listeden seçilebilir; içerik sabittir (arayüzden metin alınmaz).
  handle('diag-printers', async () => (getPrinters ? getPrinters() : []));
  handle('diag-test-print', async (_event, req) => {
    if (!req || typeof req !== 'object' || typeof req.printer !== 'string' || req.printer.length > 200 || Object.keys(req).some(k => k !== 'printer')) throw new Error('Geçersiz yazıcı isteği.');
    const list = getPrinters ? await getPrinters() : [];
    if (!list.some(p => p.name === req.printer)) throw new Error('Yazıcı Windows listesinde bulunamadı.');
    const html = '<meta charset="utf-8"><body style="font:12px monospace;width:48ch"><h3>VENIUX DENEME FİŞİ</h3><p>' + new Date().toLocaleString('tr-TR') + '</p><p>Türkçe karakter: ğüşıöçĞÜŞİÖÇ</p><p>Barkod yok · mali fiş değildir</p><p>------------------------</p><p>Bu fiş okunuyorsa yazıcı çalışıyor.</p></body>';
    const win = new deps.BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      return await new Promise(resolve => win.webContents.print({ silent: true, deviceName: req.printer }, (success, reason) => resolve({ printed: !!success, reason: success ? null : String(reason || 'bilinmiyor') })));
    } finally { win.destroy(); }
  });
  // Kaydetme yeri kullanıcı tarafından sistem penceresinden seçilir; yol arayüzden alınmaz. Otomatik yükleme yoktur.
  handle('diag-export', async (_event, req) => {
    const input = validateExportRequest(req);
    const pkg = buildSupportPackage({ ...input, dataDir, appVersion: app.getVersion() });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow?.() || undefined, { title: 'Destek paketini kaydet', defaultPath: `veniux-tanilama-${stamp}.json`, filters: [{ name: 'Veniux tanılama paketi', extensions: ['json'] }] });
    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2), { mode: 0o600 });
    return { saved: true, name: path.basename(filePath) };
  });
}

module.exports = { register, runTests, runOne, buildTests, redact, redactString, buildSupportPackage, collectLogs, validateRunRequest, validateExportRequest, loadHistory, saveHistory, summarize, STATUSES, HISTORY_LIMIT, unavailable, Unavailable };
