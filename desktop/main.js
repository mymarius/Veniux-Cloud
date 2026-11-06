const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } = require('electron');
const desktopOriginToken=require('crypto').randomBytes(32).toString('hex');
const path = require('path');
const { pathToFileURL } = require('url');
const os = require('os');
const runtime = require('./runtime').desktopRuntime(process.env, app.isPackaged);
if (runtime.profile) app.setPath('userData', runtime.profile);
process.env.VENIUX_LICENSE_STORAGE = path.join(app.getPath('userData'), 'license');
const { getHardwareFingerprint } = require('./license/hardwareFingerprint');
const secureStorage = require('./license/secureStorage');

let mainWindow = null;
let tray = null;
let localServer = null;
let preparingServer = false;
let setupPending = false;
let quitting = false;
function isBusinessCloud(){return runtime.apiBase==='https://business.veniux.com/api';}

// Single instance lock
// The owner greeting speaks on open, before any click.
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const authorityConfig=path.join(process.resourcesPath,'license-authority.json');
    if(app.isPackaged) {
      const authority=JSON.parse(require('fs').readFileSync(authorityConfig,'utf8'));
      if(new URL(authority.url).protocol!=='https:' || !require('fs').existsSync(path.join(process.resourcesPath,'license-authority-public.pem')))throw new Error('Merkezi lisans HTTPS ayarı geçersiz.');
      process.env.VENIUX_LICENSE_AUTHORITY_URL=authority.url;
      process.env.VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY=path.join(process.resourcesPath,'license-authority-public.pem');
    }
    const bundledNode=path.join(process.resourcesPath,'local-server/node.exe');
    const setupMode=app.isPackaged?require('./runtime').installerMode(path.join(path.dirname(app.getPath('exe')),'veniux-setup-mode.txt')):null;
    const selectionFile=path.join(app.getPath('userData'),'server-selection.json');
    if(app.isPackaged&&!process.env.VENIUX_DESKTOP_API_URL&&!require('fs').existsSync(selectionFile)){
      if(setupMode==='managed')require('./runtime').saveFirstSetup(app.getPath('userData'),{kind:'managed'});
      else setupPending=true;
    }
    if(app.isPackaged && !setupPending && !process.env.VENIUX_DESKTOP_API_URL && require('fs').existsSync(bundledNode)) {
      const selection=await require('./runtime').selectLocalServer(app.getPath('userData'),runtime.apiBase,async()=>{
        try { const r=await fetch(runtime.healthURL,{signal:AbortSignal.timeout(1500)});const health=await r.json();return r.ok&&health.status==='ok'&&health.target_active===true&&health.migrations?.status==='current'&&['mysql','sqlite'].includes(health.database); }catch{return false;}
      },'https://business.veniux.com/api');
      if(selection?.kind==='external')Object.assign(runtime,require('./runtime').desktopRuntime({VENIUX_DESKTOP_API_URL:selection.apiBase},true));
      // Persist the selected target. An unavailable external server must never turn
      // into a new empty local database, and a managed target must not switch back.
      if(selection.kind==='managed') {
        runtime.apiBase='http://127.0.0.1:17849/api';runtime.healthURL='http://127.0.0.1:17849/health';
        preparingServer=true;
        localServer=require('child_process').spawn(bundledNode,[path.join(process.resourcesPath,'local-server/local-server.cjs')],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,VENIUX_DESKTOP_ORIGIN_TOKEN:desktopOriginToken,VENIUX_LOCAL_DATA:path.join(app.getPath('userData'),'local-runtime'),VENIUX_LOCAL_BACKEND:path.join(process.resourcesPath,'backend')}});
        localServer.on('message',state=>{preparingServer=false;if(!state.ready)dialog.showErrorBox('Veniux kurulumu',state.error||'Yerel sunucu hazırlanamadı.');});
        localServer.on('error',()=>{preparingServer=false;dialog.showErrorBox('Veniux kurulumu','Yerel sunucu başlatılamadı.');});
        localServer.on('exit',code=>{if(preparingServer&&code){preparingServer=false;dialog.showErrorBox('Veniux kurulumu','Yerel hazırlık tamamlanamadı; işlemler açılmadı.');}});
      }
    }
    registerIpcHandlers();
    createWindow();
    createTray();
    require('./updater').startUpdater(app);
  }).catch(()=>{dialog.showErrorBox('Veniux bağlantısı','Kayıtlı sunucu seçimi doğrulanamadı. Veritabanı hedefi otomatik değiştirilmedi.');app.quit();});
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    title: 'Veniux Cloud · Çalışma Alanı',
    icon: app.isPackaged ? path.join(process.resourcesPath,'frontend/veniux-logo.png') : path.join(__dirname, '../frontend/public/veniux-logo.png'),
    minWidth: 480,
    minHeight: 440,
    frame: false, // Frameless for custom enterprise titlebar
    backgroundColor: '#f5f7fa',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      additionalArguments: ['--veniux-app-version='+encodeURIComponent(app.getVersion()),'--veniux-api-base='+encodeURIComponent(runtime.apiBase),...(setupPending?['--veniux-setup-required']:[]),...(app.isPackaged && !isBusinessCloud()?['--veniux-central-required']:[])],
      devTools: process.env.NODE_ENV !== 'production'
    }
  });
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders({urls:['http://127.0.0.1:17849/*']},(details,callback)=>callback({requestHeaders:{...details.requestHeaders,'x-veniux-desktop-origin':desktopOriginToken}}));
  mainWindow.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(()=>false);
  if (!process.env.ELECTRON_START_URL) mainWindow.webContents.session.webRequest.onHeadersReceived((details,callback)=>{
    if (!details.url.startsWith('file:')) return callback({responseHeaders:details.responseHeaders});
    const policy=`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ${new URL(runtime.apiBase).origin}; object-src 'none'; frame-src 'none'; base-uri 'none'`;
    callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[policy]}});
  });
  mainWindow.on('page-title-updated',event=>event.preventDefault());
  mainWindow.webContents.on('did-finish-load',()=>console.log('[Desktop] Uygulama ekranı yüklendi.'));
  mainWindow.webContents.on('did-fail-load',(_event,code)=>{console.error('[Desktop] Ekran yüklenemedi, hata kodu:',code); mainWindow.show();});

  // Load URL or File
  if (!app.isPackaged && process.env.ELECTRON_START_URL) mainWindow.loadURL(process.env.ELECTRON_START_URL);
  else mainWindow.loadFile(path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), app.isPackaged ? 'frontend/index.html' : 'frontend/dist/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainWindow.on('close',event=>{if(!setupPending&&!quitting&&tray){event.preventDefault();mainWindow.hide();}});

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: false });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  require('./printing.cjs').register(handle,{app,BrowserWindow,apiBase:runtime.apiBase});
  handle('complete-first-setup', async (_event,input) => {
    if(!setupPending)throw Error('Mevcut sunucu seçimi bu ekrandan değiştirilemez.');
    const selection=require('./runtime').firstSetupSelection(input);
    if(selection.kind==='external'){
      try {
        const healthURL=new URL(selection.apiBase).origin+'/health';
        const response=await fetch(healthURL,{signal:AbortSignal.timeout(10000),redirect:'error'});
        const health=await response.json();
        if(!response.ok||health.status!=='ok'||!['mysql','sqlite'].includes(health.database))throw Error('NOT_VENIUX');
      }catch{throw Error('Veniux sunucusu doğrulanamadı. HTTPS sertifikasını, adresi ve sunucudaki kurulumu kontrol edin.');}
    }
    require('./runtime').saveFirstSetup(app.getPath('userData'),selection);
    setupPending=false;
    setTimeout(()=>{quitting=true;app.relaunch();app.exit(0);},300);
    return {success:true};
  });
  handle('copy-mobile-code', (_event,code) => {
    if(typeof code!=='string'||code.length>2048||!/^VNXM1\.[A-Za-z0-9_-]+$/.test(code))throw Error('Geçersiz eşleştirme kodu.');
    require('electron').clipboard.writeText(code);return true;
  });
  handle('get-connection-status', async () => {
    if(preparingServer)return {connected:false,label:'Yerel sunucu hazırlanıyor'};
    try { const response=await fetch(runtime.healthURL,{signal:AbortSignal.timeout(5000)}); const data=await response.json(); return {connected:response.ok && data.status==='ok',label:response.ok && data.status==='ok'?'Sunucu hazır':'Sunucu hazır değil'}; }
    catch { return {connected:false,label:'Sunucuya ulaşılamıyor'}; }
  });
  handle('get-system-metrics', () => ({
    platform: process.platform,
    architecture: process.arch,
    uptime: os.uptime(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpuCount: os.cpus().length
  }));


  // Window controls
  on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // Hardware Fingerprint
  handle('get-hardware-info', async () => {
    return getHardwareFingerprint();
  });

  // Secure Storage
  handle('load-cached-license', async () => {
    return secureStorage.loadLicenseToken();
  });

  handle('save-cached-license', async (event, tokenData) => {
    return secureStorage.saveLicenseToken(tokenData);
  });

  handle('clear-cached-license', async () => {
    secureStorage.clear();
    return true;
  });

  // External Links
  on('open-external-url', (event, url) => {
    // SENDER VALIDATION
    if (event.sender !== mainWindow?.webContents || !isAllowedNavigation(event.senderFrame.url)) {
      console.warn('Blocked IPC from untrusted frame');
      return;
    }
    
    // ALLOWLIST 
    const allowedDomains = ['docs.veniux.com', 'support.veniux.com', 'api.veniux.com', 'hostimux.com'];
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:' && allowedDomains.includes(parsedUrl.hostname)) {
        shell.openExternal(url);
      } else {
        console.warn('Blocked external navigation to untrusted URL:', url);
      }
    } catch(e) {
      console.warn('Invalid URL:', url);
    }
  });

  // NAVIGATION LOCK
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      if (!isAllowedNavigation(navigationUrl)) {
        event.preventDefault();
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      return { action: 'deny' }; // Prevent arbitrary popups
    });
  });
}

function isAllowedNavigation(url) {
  try {
    const target = new URL(url);
    if (!app.isPackaged && process.env.ELECTRON_START_URL) {
      return target.origin === new URL(process.env.ELECTRON_START_URL).origin;
    }
    const entry = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), app.isPackaged ? 'frontend/index.html' : 'frontend/dist/index.html');
    target.hash = '';
    target.search = '';
    return target.href === pathToFileURL(entry).href;
  } catch { return false; }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
function createTray(){
 tray=new Tray(path.join(__dirname,'assets/icon.ico'));
 tray.setToolTip('Veniux · Program çalışıyor');
 const open=()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}};
 tray.setContextMenu(Menu.buildFromTemplate([{label:'Veniux’u aç',click:open},{label:'Pencereyi küçült',click:()=>mainWindow?.minimize()},{type:'separator'},{label:'Programdan çık',click:()=>{quitting=true;app.quit();}}]));
 tray.on('double-click',open);tray.on('click',open);
}
app.on('before-quit',()=>{quitting=true;if(localServer?.connected)localServer.send({action:'stop'});});

function trusted(event) {
 return event.sender === mainWindow?.webContents && event.senderFrame === mainWindow.webContents.mainFrame && isAllowedNavigation(event.senderFrame.url);
}
function handle(channel, callback) { ipcMain.handle(channel, (event,...args) => { if(!trusted(event)) throw new Error('Yetkisiz masaüstü isteği'); return callback(event,...args); }); }
function on(channel, callback) { ipcMain.on(channel, (event,...args) => { if(trusted(event)) callback(event,...args); }); }
