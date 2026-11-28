// Microsoft Store paketi (imzasız; Store imzalar). Kullanım: node tools/release/build-store.cjs
// frontend/dist güncel olmalı (yayın aracı derlemeden sonra çağırır). Yükleme ve onaya gönderme ELLE yapılır:
// Partner Center > Veniux Cloud > yeni gönderim > Packages > dosyayı sürükle > "Sertifikasyon için gönderin".
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const version = require(path.join(root, 'desktop/package.json')).version;

if (!fs.existsSync(path.join(root, 'frontend/dist/index.html'))) throw Error('frontend/dist yok; önce arayüzü derleyin.');
const cache = path.join(process.env.LOCALAPPDATA, 'electron-builder/Cache/winCodeSign');
const rcedit = fs.readdirSync(cache).map(name => path.join(cache, name, 'rcedit-x64.exe')).find(file => fs.existsSync(file));
if (!rcedit) throw Error('rcedit bulunamadı; önce normal Windows derlemesini bir kez çalıştırın.');
const env = { ...process.env, VENIUX_RCEDIT_PATH: rcedit, VENIUX_BUNDLE_SERVER: '0', CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
delete env.CSC_LINK; delete env.CSC_KEY_PASSWORD;

const built = spawnSync(process.execPath, [path.join(root, 'desktop/node_modules/electron-builder/out/cli/cli.js'), '--config', 'electron-builder.store.config.cjs', '--win', 'appx', '--x64', '--publish', 'never'],
  { cwd: path.join(root, 'desktop'), env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const file = path.join(root, '.local/desktop-store-' + version, `Veniux-Store-${version}.appx`);
if (built.status !== 0 || !fs.existsSync(file)) {
  console.error((built.stdout || '').slice(-1500));
  console.error((built.stderr || '').slice(-1500));
  throw Error('Store paketi üretilemedi.');
}
console.log('Store paketi hazır:', file, '(' + Math.round(fs.statSync(file).size / 1048576) + ' MB)');
