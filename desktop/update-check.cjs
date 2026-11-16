const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const events={},sent=[],notices=[];let installs=0,installArgs=null,checks=0,feed;
const updater={setFeedURL:x=>feed=x,on:(event,callback)=>events[event]=callback,quitAndInstall:(...args)=>{installs++;installArgs=args;},checkForUpdates:async()=>checks++};
const timers=[],immediates=[];const app={isPackaged:true,on:()=>{}};
class Notification{constructor(options){notices.push(options);}show(){}}
const win={isDestroyed:()=>false,webContents:{send:(channel,payload)=>sent.push([channel,payload])}};
const sandbox={require:name=>name==='electron-updater'?{autoUpdater:updater}:{BrowserWindow:{getAllWindows:()=>[win]},Notification},module:{exports:{}},console,setImmediate:fn=>{immediates.push(fn);},setTimeout:fn=>{timers.push(fn);return {unref(){}};},setInterval:fn=>{timers.push(fn);return {unref(){}};},clearTimeout(){},clearInterval(){}};
vm.runInNewContext(fs.readFileSync(__dirname+'/updater.js','utf8'),sandbox);
const mod=sandbox.module.exports;mod.startUpdater(app);
(async()=>{
 assert.equal(feed.url,'https://api.veniux.com/updates/files/');assert.equal(updater.autoDownload,true);assert.equal(updater.autoInstallOnAppQuit,true);
 await timers[0]();assert.equal(checks,1);
 assert.equal(mod.install(),false,'hazır değilken kurulum başlamamalı');assert.equal(installs,0);
 events['update-available']({version:'9.0.0'});assert.equal(mod.getState().status,'downloading');
 events['download-progress']({percent:41.6});assert.equal(mod.getState().percent,42);
 events['update-downloaded']({version:'9.0.0'});
 assert.deepEqual(mod.getState(),{status:'ready',version:'9.0.0',percent:100});
 assert.equal(sent.at(-1)[0],'update-state');assert.equal(sent.at(-1)[1].status,'ready');
 assert.equal(installs,0,'kullanıcı tıklamadan yeniden başlatılmamalı');
 assert.equal(mod.install(),true);assert.equal(mod.getState().status,'installing');assert(notices[0].body.includes('9.0.0'));
 immediates.forEach(fn=>fn());assert.equal(installs,1);assert.deepEqual(installArgs,[true,true],'sessiz kurulum ve kurulum sonrası yeniden açma');
 assert.equal(mod.install(),false,'ikinci tıklama tekrar kurmamalı');
 console.log('PASS: central feed, progress, ready state, install only on click (silent + relaunch), install on quit fallback');
})();
