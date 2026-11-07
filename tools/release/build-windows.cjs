const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
const env={...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false',VENIUX_BUNDLE_SERVER:'1',VENIUX_NODE_PATH:path.join(root,'.local/desktop-installer-2.4.41/win-unpacked/resources/local-server/node.exe')};
delete env.CSC_LINK;delete env.CSC_KEY_PASSWORD;
const cache=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/winCodeSign');
for(const f of fs.readdirSync(cache)){const h=path.join(cache,f,'rcedit-x64.exe');if(fs.existsSync(h)){env.VENIUX_RCEDIT_PATH=h;break;}}
if(!env.VENIUX_RCEDIT_PATH)throw Error('rcedit yok');
const r=spawnSync(process.execPath,[path.join(root,'desktop/node_modules/electron-builder/out/cli/cli.js'),'--config','electron-builder.config.js','--win','nsis','--x64','--publish','never'],{cwd:path.join(root,'desktop'),env,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true});
console.log((r.stdout||'').split('\n').slice(-12).join('\n').slice(0,1500));console.log((r.stderr||'').slice(-800));console.log('exit',r.status);process.exitCode=r.status===0?0:1;
