const {autoUpdater}=require('electron-updater');

const {dialog,BrowserWindow}=require('electron');

function startUpdater(app){

 if(!app.isPackaged)return;

 autoUpdater.setFeedURL({provider:'generic',url:'https://api.veniux.com/updates/files/'});

 autoUpdater.disableDifferentialDownload=true;autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=true;

 let checking=false,prompting=false,downloading=false;

 const show=options=>dialog.showMessageBox(BrowserWindow.getAllWindows()[0],options);

 autoUpdater.on('update-available',async info=>{

  if(prompting||downloading)return;prompting=true;

  try{const result=await show({type:'info',title:'Veniux güncellemesi',message:`Veniux ${info.version} sürümü hazır.`,detail:'Güncellemeyi şimdi indirebilirsiniz. Kayıtlarınız korunur; kurulumdan önce açık işlemlerinizi kaydedin.',buttons:['Güncellemeyi indir','Daha sonra'],defaultId:0,cancelId:1});if(result.response===0){downloading=true;await autoUpdater.downloadUpdate();}}catch(e){dialog.showErrorBox('Güncelleme indirilemedi','İnternet bağlantınızı kontrol edin. Güncelleme daha sonra tekrar kontrol edilecek.');}finally{prompting=false;downloading=false;}

 });

 autoUpdater.on('update-downloaded',async()=>{const result=await show({type:'info',title:'Veniux güncellemesi',message:'Güncelleme kurulmaya hazır.',detail:'Açık işlemlerinizi kaydedin. Program kapanıp yeni sürümle yeniden açılacak.',buttons:['Şimdi yeniden başlat ve kur','Program kapanınca kur'],defaultId:0,cancelId:1});if(result.response===0)autoUpdater.quitAndInstall(false,true);});

 autoUpdater.on('error',err=>console.warn('[Updater]',err.message));

 const check=async()=>{if(checking||downloading)return;checking=true;try{await autoUpdater.checkForUpdates();}catch(e){console.warn('[Updater]',e.message);}finally{checking=false;}};

 const first=setTimeout(check,15000);const timer=setInterval(check,300000);first.unref();timer.unref();app.on('before-quit',()=>{clearTimeout(first);clearInterval(timer);});

}

module.exports={startUpdater};

