// Veniux sanal market laboratuvarı, hafif mod (Docker gerekmez).
// Komutlar: node qa-lab/lab.cjs start | stop | status | reset
// Güvenlik: sunucu yalnız 127.0.0.1'de, ayrı bir SQLite veri klasöründe çalışır; çağıran kabuğun ortam değişkenleri
// (üretim veritabanı, SMTP, ödeme anahtarı vb.) sunucuya aktarılmaz. Sıfırlama yalnız laboratuvarın kendi işaretlediği klasörü siler.
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MARKER = 'VENIUX_QA_LAB';
const PORT = 3999;
const labDir = () => path.join(os.tmpdir(), 'veniux-qa-lab');
const files = dir => ({ marker: path.join(dir, MARKER), data: path.join(dir, 'data'), pid: path.join(dir, 'server.pid'), log: path.join(dir, 'server.log'), secret: path.join(dir, 'jwt.secret') });

// Sunucuya yalnız işletim sisteminin çalışması için gereken değişkenler geçer.
const PASS = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'windir', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec', 'PATHEXT'];
function labEnv(source, dir, secret) {
  const env = {};
  for (const key of PASS) if (source[key] !== undefined) env[key] = source[key];
  return Object.assign(env, { NODE_ENV: 'development', DB_ENGINE: 'sqlite', HOST: '127.0.0.1', PORT: String(PORT), VENIUX_DATA_DIR: files(dir).data, VENIUX_DISABLE_BACKGROUND_JOBS: '1', JWT_SECRET: secret });
}

// Silinecek klasör laboratuvarın kendisi değilse reddedilir.
function assertLabDir(dir) {
  const full = path.resolve(dir);
  if (path.basename(full) !== 'veniux-qa-lab') throw new Error('Reddedildi: klasör adı laboratuvar klasörü değil: ' + full);
  if (full === ROOT || ROOT.startsWith(full + path.sep) || full.startsWith(ROOT + path.sep)) throw new Error('Reddedildi: proje klasörü silinemez: ' + full);
  if (!fs.existsSync(files(full).marker)) throw new Error('Reddedildi: klasörde laboratuvar işareti yok: ' + full);
  return full;
}

function health() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 2000 }, res => { let body = ''; res.on('data', c => { body += c; }); res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ status: 'yabanci' }); } }); });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readPid = f => (fs.existsSync(f.pid) ? Number(fs.readFileSync(f.pid, 'utf8')) : 0);

async function start(dir = labDir()) {
  const f = files(dir);
  if (await health()) throw new Error(`127.0.0.1:${PORT} zaten kullanılıyor; mevcut sunucuya dokunulmadı.`);
  if (fs.existsSync(dir) && !fs.existsSync(f.marker) && fs.readdirSync(dir).length) throw new Error('Reddedildi: klasör dolu ve laboratuvar işareti yok: ' + dir);
  fs.mkdirSync(f.data, { recursive: true });
  fs.writeFileSync(f.marker, 'Bu klasör Veniux QA laboratuvarına aittir. Gerçek veri koymayın.\n');
  if (!fs.existsSync(f.secret)) fs.writeFileSync(f.secret, crypto.randomBytes(48).toString('base64url'), { mode: 0o600 });
  const out = fs.openSync(f.log, 'a');
  const child = spawn(process.execPath, ['src/index.js'], { cwd: path.join(ROOT, 'backend'), env: labEnv(process.env, dir, fs.readFileSync(f.secret, 'utf8')), detached: true, stdio: ['ignore', out, out], windowsHide: true });
  child.unref();
  fs.writeFileSync(f.pid, String(child.pid));
  for (let i = 0; i < 120; i += 1) {
    const h = await health();
    if (h && h.status === 'ok') return { url: `http://127.0.0.1:${PORT}`, veri: f.data, gunluk: f.log, sema: h.migrations && h.migrations.version };
    if (!alive(child.pid)) break;
    await wait(500);
  }
  throw new Error('Sunucu açılamadı. Günlük: ' + f.log);
}

async function stop(dir = labDir()) {
  const f = files(dir), pid = readPid(f);
  if (!pid || !alive(pid)) { if (fs.existsSync(f.pid)) fs.rmSync(f.pid); return { durdu: false, neden: 'laboratuvar sunucusu çalışmıyor' }; }
  process.kill(pid);
  for (let i = 0; i < 40 && alive(pid); i += 1) await wait(250);
  fs.rmSync(f.pid, { force: true });
  return { durdu: !alive(pid) };
}

async function reset(dir = labDir()) {
  if (!fs.existsSync(dir)) return { silindi: false };
  const full = assertLabDir(dir);
  await stop(full);
  fs.rmSync(full, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
  return { silindi: true };
}

async function status(dir = labDir()) {
  const pid = readPid(files(dir));
  return { klasor: dir, surec: pid && alive(pid) ? pid : null, saglik: (await health())?.status || 'kapalı' };
}

module.exports = { labEnv, assertLabDir, start, stop, reset, status, MARKER };

if (require.main === module) {
  const command = { start, stop, reset, status }[process.argv[2]];
  if (!command) { console.log('Kullanım: node qa-lab/lab.cjs start|stop|status|reset'); process.exit(2); }
  command().then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exit(1); });
}
