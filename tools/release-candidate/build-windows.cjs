const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.local/release-candidate-1');fs.mkdirSync(out,{recursive:true});
const env={...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false',VENIUX_BUNDLE_SERVER:'1',VENIUX_NODE_PATH:path.join(root,'.local/desktop-installer-2.4.38/win-unpacked/resources/local-server/node.exe')};
const cache=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/winCodeSign');
for(const folder of fs.readdirSync(cache)){const helper=path.join(cache,folder,'rcedit-x64.exe');if(fs.existsSync(helper)){env.VENIUX_RCEDIT_PATH=helper;break;}}
if(!env.VENIUX_RCEDIT_PATH||!fs.existsSync(env.VENIUX_NODE_PATH))throw Error('Existing local build tool or bundled runtime unavailable');
const signingConfigured=Boolean(env.CSC_LINK||env.VENIUX_SIGNING_SUBJECT||env.VENIUX_SIGNING_THUMBPRINT);
// This validation artifact stays unsigned; never consume a signing credential here.
delete env.CSC_LINK;delete env.CSC_KEY_PASSWORD;
const results=[];
for(const [name,args,cwd]of [['frontend',[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'build','--outDir',path.join(out,'frontend')],path.join(root,'frontend')],['windows',[path.join(root,'desktop/node_modules/electron-builder/out/cli/cli.js'),'--config','electron-builder.rc.cjs','--win','nsis','--x64','--publish','never'],path.join(root,'desktop')]]){
 const r=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024,windowsHide:true});
 fs.writeFileSync(path.join(out,'build-'+name+'.log'),(r.stdout||'')+'\n'+(r.stderr||''));results.push({name,exit:r.status,error:r.error?.code});console.log(name,r.status);if(r.status!==0)break;
}
fs.writeFileSync(path.join(out,'windows-build.json'),JSON.stringify({created_at:new Date().toISOString(),signing_environment_configured:signingConfigured,production_signed_build:'BLOCKED pending verified publisher certificate; this is an unsigned validation candidate',published:false,results},null,2));
if(results.some(r=>r.exit!==0))process.exitCode=1;
