// Microsoft Store (MSIX/APPX) paketi. İmzayı Store yükleme sırasında Microsoft yapar; bu dosya yerelde imzasız üretilir.
// Kimlik değerleri Partner Center > Veniux Cloud > Product identity sayfasından (herkese açık paket kimliği, sır değildir).
// Yerel sunucu pakete girmez: Store sürümü yalnız Veniux bulutuna bağlanır (main.js, process.windowsStore).
process.env.VENIUX_BUNDLE_SERVER = '0';
const base = require('./electron-builder.config.js');
module.exports = {
  ...base,
  directories: { output: '../.local/desktop-store-' + require('./package.json').version, buildResources: 'store-assets' },
  win: { ...base.win, target: [{ target: 'appx', arch: ['x64'] }], signAndEditExecutable: false },
  appx: {
    identityName: 'VeniuxCloud.VeniuxCloud',
    publisher: 'CN=F4D0CA21-F47F-4154-9CE5-75177EAF67FE',
    publisherDisplayName: 'Veniux Cloud',
    displayName: 'Veniux Cloud',
    applicationId: 'VeniuxCloud',
    languages: ['tr-TR', 'en-US'],
    backgroundColor: '#17263a',
    artifactName: 'Veniux-Store-${version}.${ext}'
  }
};
