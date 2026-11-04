const {test}=require('node:test');
const assert=require('node:assert/strict');
const {desktopRuntime}=require('./runtime');
const {selectLocalServer}=require('./runtime');
const {installerMode,firstSetupSelection,saveFirstSetup}=require('./runtime');
const fs=require('fs'),os=require('os'),path=require('path');
test('installer choices decode UTF-16, and invalid choices fail closed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-installer-choice-')),file=path.join(dir,'mode.txt');
 assert.equal(installerMode(file),null);
 fs.writeFileSync(file,Buffer.from('external','utf16le'));assert.equal(installerMode(file),'external');
 fs.writeFileSync(file,'managed');assert.equal(installerMode(file),'managed');
 fs.writeFileSync(file,'unknown');assert.throws(()=>installerMode(file));
});
test('external first setup accepts only a credential-free HTTPS API target',()=>{
 assert.deepEqual(firstSetupSelection({kind:'external',apiBase:'https://company.example/'}),{kind:'external',apiBase:'https://company.example/api'});
 for(const apiBase of ['http://company.example/api','https://name:secret@company.example/api','https://company.example/other','https://company.example/api?key=private','https://company.example/#part','https://company.example/\napi'])assert.throws(()=>firstSetupSelection({kind:'external',apiBase}));
});
test('new setup cannot overwrite an existing customer target',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-new-choice-'));
 saveFirstSetup(dir,{kind:'managed'});
 assert.throws(()=>saveFirstSetup(dir,{kind:'external',apiBase:'https://other.example/api'}));
 assert.deepEqual(await selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>{throw Error('no probe');},'https://business.veniux.com/api'),{kind:'managed'});
});
test('cloud default applies only to a fresh profile; existing local records keep their target',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-cloud-'));
 const cloud='https://business.veniux.com/api';
 assert.deepEqual(await selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>{throw Error('no local probe');},cloud),{kind:'external',apiBase:cloud});
 fs.writeFileSync(path.join(dir,'server-selection.json'),JSON.stringify({kind:'managed'}));
 assert.equal((await selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>true,cloud)).kind,'managed');
});
test('local defaults isolate development profile',()=>{
 const result=desktopRuntime({},false);
 assert.equal(result.apiBase,'http://127.0.0.1:3000/api');
 assert.match(result.profile,/\.local[\\/]desktop-profile$/);
});
test('HTTPS API has explicit health endpoint',()=>{
 const result=desktopRuntime({VENIUX_DESKTOP_API_URL:'https://server.example/api/'},true);
 assert.equal(result.healthURL,'https://server.example/health'); assert.equal(result.profile,null);
});
test('credentials and insecure remote APIs rejected',()=>{
 for(const url of ['http://server.example/api','https://user:secret@server.example/api','file:///tmp/api','https://server.example/api?token=x']) assert.throws(()=>desktopRuntime({VENIUX_DESKTOP_API_URL:url},false));
});
test('development renderer is loopback only and disabled in packaged app',()=>{
 assert.doesNotThrow(()=>desktopRuntime({ELECTRON_START_URL:'http://127.0.0.1:5173'},false));
 assert.throws(()=>desktopRuntime({ELECTRON_START_URL:'https://server.example'},false));
 assert.throws(()=>desktopRuntime({ELECTRON_START_URL:'http://127.0.0.1:5173'},true));
});
test('external selection survives an unavailable server without creating a managed target',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-selection-'));
 assert.equal((await selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>true)).kind,'external');
 assert.equal((await selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>{throw Error('must not reprobe');})).kind,'external');
});
test('managed selection cannot switch back to another running API on restart',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-selection-'));
 assert.equal((await selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>false)).kind,'managed');
 assert.equal((await selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>{throw Error('must not reprobe');})).kind,'managed');
});
test('invalid persisted target fails closed',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-selection-'));
 fs.writeFileSync(path.join(dir,'server-selection.json'),JSON.stringify({kind:'external',apiBase:'https://user:secret@server.example/api'}));
 await assert.rejects(selectLocalServer(dir,'http://127.0.0.1:3000/api',async()=>true));
});
