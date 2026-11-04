const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const events={},dialogs=[];let downloads=0,installs=0,checks=0,feed;
const updater={setFeedURL:x=>feed=x,on:(event,callback)=>events[event]=callback,downloadUpdate:async()=>downloads++,quitAndInstall:()=>installs++,checkForUpdates:async()=>checks++};
const timers=[];const app={isPackaged:true,on:()=>{}};
const sandbox={require:name=>name==='electron-updater'?{autoUpdater:updater}:{dialog:{showMessageBox:async(...args)=>{dialogs.push(args.at(-1));return {response:0};},showErrorBox:()=>{}},BrowserWindow:{getAllWindows:()=>[{}]}},module:{exports:{}},console,setTimeout:fn=>{timers.push(fn);return {unref(){}};},setInterval:fn=>{timers.push(fn);return {unref(){}};},clearTimeout(){},clearInterval(){}};
vm.runInNewContext(fs.readFileSync(__dirname+'/updater.js','utf8'),sandbox);sandbox.module.exports.startUpdater(app);
(async()=>{assert.equal(feed.url,'https://api.veniux.com/updates/files/');assert.equal(updater.autoDownload,false);await timers[0]();assert.equal(checks,1);await events['update-available']({version:'9.0.0'});assert.equal(downloads,1);assert(dialogs[0].message.includes('9.0.0'));await events['update-downloaded']();assert.equal(installs,1);console.log('PASS: central feed, startup check, update prompt, download consent, install prompt');})();
