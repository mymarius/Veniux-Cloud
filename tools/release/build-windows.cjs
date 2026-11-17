const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
const env={...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false',VENIUX_BUNDLE_SERVER:'1',VENIUX_NODE_PATH:path.join(root,'.local/desktop-installer-2.4.41/win-unpacked/resources/local-server/node.exe')};
// İmza: sertifika bilgisi verilmişse imzalı yapılandırma kullanılır (CSC_LINK+CSC_KEY_PASSWORD, ya da Windows deposunda
// VENIUX_SIGNING_THUMBPRINT / VENIUX_SIGNING_SUBJECT). Hiçbiri yoksa mevcut imzasız yayın akışı aynen sürer.
const signed=Boolean(process.env.CSC_LINK||process.env.VENIUX_SIGNING_THUMBPRINT||process.env.VENIUX_SIGNING_SUBJECT);
if(!signed){delete env.CSC_LINK;delete env.CSC_KEY_PASSWORD;}
else{delete env.CSC_IDENTITY_AUTO_DISCOVERY;}
const cache=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/winCodeSign');
for(const f of fs.readdirSync(cache)){const h=path.join(cache,f,'rcedit-x64.exe');if(fs.existsSync(h)){env.VENIUX_RCEDIT_PATH=h;break;}}
if(!env.VENIUX_RCEDIT_PATH)throw Error('rcedit yok');
const r=spawnSync(process.execPath,[path.join(root,'desktop/node_modules/electron-builder/out/cli/cli.js'),'--config',signed?'electron-builder.signed.config.cjs':'electron-builder.config.js','--win','nsis','--x64','--publish','never'],{cwd:path.join(root,'desktop'),env,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true});
console.log((r.stdout||'').split('\n').slice(-12).join('\n').slice(0,1500));console.log((r.stderr||'').slice(-800));console.log('exit',r.status);process.exitCode=r.status===0?0:1;
if(r.status===0){
  const version=require(path.join(root,'desktop/package.json')).version,folder=path.join(root,'.local/desktop-installer-'+version);
  let status='unsigned';
  if(signed){
    // İmza gerçekten geçerli mi? Geçerli değilse yayın durur: imzasız dosyayı imzalı diye göstermeyiz.
    const v=spawnSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'desktop/verify-release-signature.ps1'),'-Installer',path.join(folder,'Veniux-Setup-'+version+'.exe'),'-Application',path.join(folder,'win-unpacked','Veniux Cloud.exe')],{encoding:'utf8'});
    console.log((v.stdout||'').slice(-800));console.log((v.stderr||'').slice(-600));
    if(v.status!==0){console.error('İmza doğrulaması başarısız; yayın durduruldu.');process.exitCode=1;}else status='signed';
  }
  fs.writeFileSync(path.join(folder,'signing.json'),JSON.stringify({version,status,checked_at:new Date().toISOString()}));
  console.log('imza durumu:',status);
}
