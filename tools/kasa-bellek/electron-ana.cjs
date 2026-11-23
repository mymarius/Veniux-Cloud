const {app,BrowserWindow}=require('electron');
app.commandLine.appendSwitch('remote-debugging-port','9444');
app.commandLine.appendSwitch('enable-precise-memory-info');
app.commandLine.appendSwitch('js-flags','--expose-gc');
app.whenReady().then(()=>{const w=new BrowserWindow({width:1366,height:850,show:true,webPreferences:{contextIsolation:true,backgroundThrottling:false}});w.loadURL(process.env.START_URL||'http://127.0.0.1:3100/magaza/kasa');});
app.on('window-all-closed',()=>app.quit());
