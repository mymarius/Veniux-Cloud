const {autoUpdater}=require('electron-updater');
const {BrowserWindow,Notification}=require('electron');

// Güncelleme durumu arayüze iletilir: idle | downloading | ready | installing.
// Arayüzde yeşil bir ok düğmesi çıkar; kullanıcı tıklayınca program kurulumu yapıp kendiliğinden yeniden açılır.
const state={status:'idle',version:null,percent:0};
function publish(patch){
 Object.assign(state,patch);
 for(const win of BrowserWindow.getAllWindows())if(!win.isDestroyed())win.webContents.send('update-state',{...state});
}
const getState=()=>({...state});

function install(){
 if(state.status!=='ready')return false;
 publish({status:'installing'});
 try{new Notification({title:'Veniux güncelleniyor',body:`Sürüm ${state.version||''} kuruluyor. Program kapanır; kurulum bitince kendiliğinden açılır (birkaç dakika sürebilir).`}).show();}catch{/* bildirim desteklenmiyorsa sessiz geç */}
 // Sessiz kurulum + bittiğinde programı yeniden aç.
 setImmediate(()=>autoUpdater.quitAndInstall(true,true));
 return true;
}

function startUpdater(app){
 if(!app.isPackaged)return;
 if(process.windowsStore)return; // Store sürümünü Microsoft Store günceller
 autoUpdater.setFeedURL({provider:'generic',url:'https://api.veniux.com/updates/files/'});
 // Güncelleme arka planda iner; hazır olunca yeşil ok görünür. Kullanıcı tıklamazsa program kapanınca kurulur.
 autoUpdater.disableDifferentialDownload=true;autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
 let checking=false;
 autoUpdater.on('update-available',info=>publish({status:'downloading',version:info?.version||null,percent:0}));
 autoUpdater.on('download-progress',p=>publish({status:'downloading',percent:Math.round(p?.percent||0)}));
 autoUpdater.on('update-downloaded',info=>publish({status:'ready',version:info?.version||state.version,percent:100}));
 autoUpdater.on('error',err=>{console.warn('[Updater]',err.message);if(state.status==='downloading')publish({status:'idle'});});
 const check=async()=>{if(checking||state.status==='ready'||state.status==='installing')return;checking=true;try{await autoUpdater.checkForUpdates();}catch(e){console.warn('[Updater]',e.message);}finally{checking=false;}};
 const first=setTimeout(check,15000);const timer=setInterval(check,300000);first.unref();timer.unref();app.on('before-quit',()=>{clearTimeout(first);clearInterval(timer);});
}

module.exports={startUpdater,getState,install};
