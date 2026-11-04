const path = require('path');
const fs = require('fs');
function desktopRuntime(env, packaged) {
 const settingsPath=path.resolve(__dirname,'../.local/desktop-connection.json');
 let settings={};
 if(!packaged && fs.existsSync(settingsPath)) settings=JSON.parse(fs.readFileSync(settingsPath,'utf8').replace(/^\uFEFF/,''));
 const api = new URL(env.VENIUX_DESKTOP_API_URL || settings.apiBase || 'http://127.0.0.1:3000/api');
 const loopback = ['127.0.0.1','localhost','[::1]'].includes(api.hostname);
 if (api.username || api.password || api.search || api.hash || (api.protocol !== 'https:' && !(api.protocol === 'http:' && loopback))) throw new Error('API adresi HTTPS veya yerel HTTP olmalıdır; parola içermemelidir.');
 if (env.ELECTRON_START_URL) {
  const dev = new URL(env.ELECTRON_START_URL);
  if (packaged || !['127.0.0.1','localhost','[::1]'].includes(dev.hostname) || dev.protocol !== 'http:' || dev.username || dev.password) throw new Error('Geliştirme ekranı yalnız yerel HTTP adresinden açılabilir.');
 }
 return {apiBase:api.href.replace(/\/$/,''),healthURL:api.origin+'/health',profile:packaged?null:path.resolve(__dirname,'../.local/desktop-profile')};
}
module.exports={desktopRuntime};
async function selectLocalServer(directory,apiBase,probe,newInstallApi){
 const file=path.join(directory,'server-selection.json');
 if(fs.existsSync(file)){
  const selected=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!['external','managed'].includes(selected.kind))throw Error('SERVER_SELECTION_INVALID');
  if(selected.kind==='external')desktopRuntime({VENIUX_DESKTOP_API_URL:selected.apiBase},true);
  return selected;
 }
 if(newInstallApi)desktopRuntime({VENIUX_DESKTOP_API_URL:newInstallApi},true);
 const selected=newInstallApi?{kind:'external',apiBase:newInstallApi}:await probe()?{kind:'external',apiBase}:{kind:'managed'};
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file,JSON.stringify(selected),{flag:'wx',mode:0o600});
 return selected;
}
module.exports.selectLocalServer=selectLocalServer;

function installerMode(file) {
 if(!fs.existsSync(file))return null;
 const bytes=fs.readFileSync(file);
 const text=bytes.toString(bytes[1]===0||bytes[0]===0xff&&bytes[1]===0xfe?'utf16le':'utf8').replace(/^\uFEFF/,'').trim();
 if(!['managed','external'].includes(text))throw Error('INSTALLER_MODE_INVALID');
 return text;
}
function firstSetupSelection(input) {
 if(input?.kind==='managed')return {kind:'managed'};
 if(input?.kind!=='external'||typeof input.apiBase!=='string'||/[\s\x00-\x1f"<>]/.test(input.apiBase.trim()))throw Error('Geçerli HTTPS Veniux sunucu adresini girin.');
 const url=new URL(input.apiBase.trim());
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/','/api','/api/'].includes(url.pathname))throw Error('Sunucu HTTPS olmalı; kullanıcı bilgisi, sorgu veya farklı bir yol içermemelidir.');
 url.pathname='/api';
 return {kind:'external',apiBase:url.href};
}
function saveFirstSetup(directory,input) {
 const selected=firstSetupSelection(input),file=path.join(directory,'server-selection.json');
 fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(file,JSON.stringify(selected),{flag:'wx',mode:0o600});
 return selected;
}
module.exports.installerMode=installerMode;
module.exports.firstSetupSelection=firstSetupSelection;
module.exports.saveFirstSetup=saveFirstSetup;
