const {autoUpdater}=require('electron-updater');
const {dialog,BrowserWindow}=require('electron');

function startUpdater(app){
 if(!app.isPackaged)return;
 autoUpdater.setFeedURL({provider:'generic',url:'https://api.veniux.com/updates/files/'});
 // Güncelleme arka planda iner, program kapanınca kurulur; kullanıcı yalnız hemen kurmak isterse yeniden başlatır.
 autoUpdater.disableDifferentialDownload=true;autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
 let checking=false,announced=null;
 autoUpdater.on('update-downloaded',async info=>{
  if(announced===info?.version)return;announced=info?.version;
  const result=await dialog.showMessageBox(BrowserWindow.getAllWindows()[0],{type:'info',title:'Veniux güncellemesi',message:`Veniux ${info?.version||''} indirildi.`,detail:'Program kapanınca kendiliğinden kurulur. Hemen kurmak için açık işlemlerinizi kaydedin.',buttons:['Kapanınca kur','Şimdi yeniden başlat'],defaultId:0,cancelId:0});
  if(result.response===1)autoUpdater.quitAndInstall(false,true);
 });
 autoUpdater.on('error',err=>console.warn('[Updater]',err.message));
 const check=async()=>{if(checking)return;checking=true;try{await autoUpdater.checkForUpdates();}catch(e){console.warn('[Updater]',e.message);}finally{checking=false;}};
 const first=setTimeout(check,15000);const timer=setInterval(check,300000);first.unref();timer.unref();app.on('before-quit',()=>{clearTimeout(first);clearInterval(timer);});
}

module.exports={startUpdater};
