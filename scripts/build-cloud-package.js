// Plesk'e yüklenecek bulut paketini üretir: node scripts/build-cloud-package.js <önceki-paket-klasörü>
// stage.js, app.js ve authority-public.pem önceki paketten alınır; çıktı .local/cloud-upload-<commit> klasörüdür.
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync, execSync } = require('child_process');

const repo = path.resolve(__dirname, '..');
process.chdir(repo);
const previous = process.argv[2];
if (!previous || !fs.existsSync(path.join(previous, 'source.json'))) throw Error('Önceki paket klasörünü verin.');
if (execFileSync('git', ['status', '--porcelain', 'backend', 'frontend', 'shared'], { encoding: 'utf8' }).trim()) throw Error('Commit edilmemiş değişiklik var.');

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.join('.local', 'cloud-upload-' + commit);
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-cloud-dist-'));
execSync(`npx vite build --base=/ --outDir "${dist}" --emptyOutDir`, { cwd: 'frontend', stdio: 'inherit', env: { ...process.env, VITE_API_URL: '/api', MSYS_NO_PATHCONV: '1' } });

const files = [];
const add = (disk, rel) => files.push({ path: rel, data: fs.readFileSync(disk).toString('base64') });
const walk = (dir, prefix) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name), rel = prefix + '/' + entry.name;
    if (entry.isDirectory()) walk(full, rel); else add(full, rel);
  }
};
walk('backend/src', 'backend/src');
walk(dist, 'frontend/dist');
for (const file of ['backend/package.json', 'backend/scripts/start_cloud.js', 'backend/scripts/mysql_migrate.js', 'backend/scripts/mysql_ledger_backfill.js', 'backend/scripts/grant_platform_owner.js']) add(file, file);
for (const name of fs.readdirSync('shared')) if (/\.mjs$/.test(name) && !/\.test\.mjs$/.test(name)) add('shared/' + name, 'shared/' + name);
files.push(JSON.parse(fs.readFileSync(path.join(previous, 'source.json'))).files.find(f => f.path === 'backend/authority-public.pem'));

const allowed = /^(backend\/(src\/|package\.json$|scripts\/(start_cloud|mysql_migrate|mysql_ledger_backfill|grant_platform_owner)\.js$|authority-public\.pem$)|frontend\/dist\/|shared\/[-a-zA-Z0-9_.]+\.mjs$)/;
const rejected = files.filter(f => !allowed.test(f.path)).map(f => f.path);
if (rejected.length) throw Error('stage.js filtresine takılan dosyalar: ' + rejected.join());
const secrets = files.filter(f => /-----BEGIN [A-Z ]*PRIVATE KEY-----\r?\n[A-Za-z0-9+/]{20,}/.test(Buffer.from(f.data, 'base64').toString('latin1')) || /(^|\/)\.env$|\.db$/.test(f.path)).map(f => f.path);
if (secrets.length) throw Error('Pakette gizli içerik: ' + secrets.join());

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify({ format: 1, files }));
for (const name of ['stage.js', 'app.js']) fs.copyFileSync(path.join(previous, name), path.join(output, name));
const pkg = JSON.parse(fs.readFileSync(path.join(previous, 'package.json'))), backend = JSON.parse(fs.readFileSync('backend/package.json'));
pkg.dependencies = backend.dependencies;
pkg.overrides = backend.overrides;
pkg.version = backend.version;
fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
fs.rmSync(dist, { recursive: true, force: true });
console.log(output, files.length + ' dosya');
