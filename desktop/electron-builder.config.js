const {build}=require('./package.json');
module.exports={...build};
module.exports.publish=[{provider:'generic',url:'https://api.veniux.com/updates/files/'}];
module.exports.directories={output:'../.local/desktop-installer-'+require('./package.json').version};
module.exports.win={...build.win,icon:'assets/icon.ico',signAndEditExecutable:false,artifactName:'Veniux-Setup-${version}.${ext}'};
module.exports.nsis={...build.nsis,allowToChangeInstallationDirectory:true,installerIcon:'assets/icon.ico',uninstallerIcon:'assets/icon.ico',perMachine:false,deleteAppDataOnUninstall:false,runAfterFinish:true,installerLanguages:['tr_TR','en_US']};
module.exports.afterPack=async context=>{
 if(context.electronPlatformName!=='win32')return;
 if(process.env.VENIUX_BUNDLE_SERVER==='1'){
  // electron-builder excludes node_modules from broad extraResources globs.
  // Copy explicitly after packaging, then verify against the bundled Node runtime.
  const fs=require('fs'),path=require('path');
  const resources=path.join(context.appOutDir,'resources');
  const destination=path.join(resources,'backend','node_modules');
  require('./production-dependencies.cjs').copyProductionDependencies(path.join(__dirname,'../backend'),destination);
  const dependencies=Object.keys(require('../backend/package.json').dependencies);
  require('child_process').execFileSync(path.join(resources,'local-server/node.exe'),['-e',
   'const {createRequire}=require("module");const r=createRequire(process.argv[1]);for(const name of JSON.parse(process.argv[2]))r.resolve(name);r("mysql2/promise");r("bcrypt");r("better-sqlite3");',
   path.join(resources,'backend/package.json'),JSON.stringify(dependencies)],{windowsHide:true,stdio:'pipe'});
 }
 const helper=process.env.VENIUX_RCEDIT_PATH;
 if(!helper||!require('fs').existsSync(helper))throw Error('Windows ikon kaynak aracı için VENIUX_RCEDIT_PATH gerekli.');
 require('child_process').execFileSync(helper,[require('path').join(context.appOutDir,context.packager.appInfo.productFilename+'.exe'),'--set-icon',require('path').join(__dirname,'assets/icon.ico')]);
 require('./distribution-safety.cjs').audit(require('path').join(context.appOutDir,'resources'));
};
module.exports.files=[...build.files,'runtime.js','printing.cjs','assets/icon.ico','assets/label-logo.webp'];
module.exports.extraResources=[...(build.extraResources||[]),{from:'../shared',to:'shared',filter:['*.mjs','!*.test.mjs']}];
{
 const url=new URL(process.env.VENIUX_LICENSE_AUTHORITY_URL || 'https://api.veniux.com/v1');
 const key=process.env.VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY || require('path').join(__dirname,'assets/license-authority-public.pem');
 if(url.protocol!=='https:'||!key||!require('fs').existsSync(key))throw Error('Merkezi lisans dağıtımı için HTTPS adresi ve public key gerekli.');
 const config=require('path').join(__dirname,'../.local/license-authority-release.json');
 require('fs').writeFileSync(config,JSON.stringify({url:url.href}));
 module.exports.extraResources=[...module.exports.extraResources,{from:config,to:'license-authority.json'},{from:key,to:'license-authority-public.pem'}];
}
if(process.env.VENIUX_BUNDLE_SERVER==='1'){
 const nodePath=process.env.VENIUX_NODE_PATH;
 if(!nodePath||!require('fs').existsSync(nodePath))throw Error('Yerel sunucu için VENIUX_NODE_PATH gerekli.');
 module.exports.extraResources=[...(module.exports.extraResources||build.extraResources),
  {from:nodePath,to:'local-server/node.exe'},
  {from:'../.local/node-runtime-LICENSE.txt',to:'local-server/NODE-LICENSE.txt'},
  {from:'local-server.cjs',to:'local-server/local-server.cjs'},
  {from:'integration-settings.cjs',to:'local-server/integration-settings.cjs'},
  {from:'license/secureStorage.js',to:'local-server/license-storage.cjs'},
  {from:'Prepare-LocalDatabase.ps1',to:'local-server/Prepare-LocalDatabase.ps1'},
  {from:'../backend',to:'backend',filter:['package.json','src/**/*','scripts/**/*.js','!src/routes/pharmacy*.js','!src/routes/medicine*.js','!src/controllers/pharmacy*.js','!src/controllers/medula*.js','!src/controllers/dutyPharmacy*.js','!src/controllers/medicine*.js','!src/services/pharmacy*.js','!src/services/medula*.js','!src/services/farmakom*.js','!src/services/itsService.js','!src/services/eInvoiceService.js','!src/services/patientReminderService.js']}
 ];
}
