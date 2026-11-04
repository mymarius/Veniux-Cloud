// Runs in bundled Node, not Electron. No customer secrets belong in the installer.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),net=require('net');
const {spawn,execFileSync}=require('child_process');
const data=path.resolve(process.env.VENIUX_LOCAL_DATA),backend=path.resolve(process.env.VENIUX_LOCAL_BACKEND);
let mysql,MySQLMigrator,manifest;
const configFile=path.join(data,'local-database.json');
const port=Number(process.env.VENIUX_LOCAL_DB_PORT||33078),apiPort=Number(process.env.VENIUX_LOCAL_API_PORT||17849); let databaseProcess,apiApp,stopping=false,automationTimer,automationBusy=false;
if(![port,apiPort].every(p=>Number.isInteger(p)&&p>1024&&p<65536)||port===apiPort)throw Error('PORT_CONFIGURATION_INVALID');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(value){for(let attempt=0;attempt<40;attempt++){try{await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(value,'127.0.0.1',()=>server.close(resolve));});return;}catch(error){if(error.code!=='EADDRINUSE')throw error;if(attempt===39)throw Object.assign(Error('PORT_BUSY'),{code:'PORT_BUSY'});await pause(250);}}}
function save(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value),{mode:0o600});fs.renameSync(file+'.tmp',file);}
async function start() {
  mysql=require(path.join(backend,'node_modules/mysql2/promise'));
  ({MySQLMigrator,manifest}=require(path.join(backend,'src/database/mysqlMigrator')));
  fs.mkdirSync(data,{recursive:true});
  require('./integration-settings.cjs').load(data);
  // Windows mode bits alone do not protect secrets: restrict the whole directory ACL.
  execFileSync('icacls.exe',[data,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`],{windowsHide:true,stdio:'ignore'});
  const lock=path.join(data,'setup.lock');
  try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}catch{
    const pid=Number(fs.readFileSync(lock,'utf8'));try{process.kill(pid,0);throw Error('SETUP_BUSY');}catch(e){if(e.code!=='ESRCH')throw e;fs.unlinkSync(lock);fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
  }
  try {
    let config=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):null;
    if(config&&(config.database!=='veniux_local'||config.user!=='veniux_app'||!config.password||!config.rootPassword||!config.controlPassword))throw Error('TARGET_INVALID');
    const dbDirectory=path.join(data,'mysql-data');
    if(!config&&fs.existsSync(dbDirectory))throw Error('INCOMPLETE_SETUP');
    await freePort(port); await freePort(apiPort);
    const bin=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'Prepare-LocalDatabase.ps1'),'-RuntimeDirectory',data],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:900000}).trim();
    if(!path.isAbsolute(bin)||!fs.existsSync(path.join(bin,'mysqld.exe')))throw Error('DATABASE_BINARY_INVALID');
    const fresh=!config;
    if(fresh){
      config={database:'veniux_local',user:'veniux_app',password:crypto.randomBytes(32).toString('base64url'),rootPassword:crypto.randomBytes(32).toString('base64url'),controlPassword:crypto.randomBytes(32).toString('base64url')};
      execFileSync(path.join(bin,'mysql_install_db.exe'),[`--datadir=${dbDirectory}`,`--port=${port}`,'--silent'],{windowsHide:true,stdio:'ignore'});
      save(configFile,{...config,status:'preparing'});
    }else if(config.status!=='ready')throw Error('INCOMPLETE_SETUP');
    const ini=path.join(data,'mysql-local.ini');
    fs.writeFileSync(ini,`[mysqld]\nbasedir="${path.dirname(bin).replaceAll('\\','/')}"\ndatadir="${dbDirectory.replaceAll('\\','/')}"\nport=${port}\nbind-address=127.0.0.1\nskip-name-resolve\nlocal-infile=0\ncharacter-set-server=utf8mb4\ncollation-server=utf8mb4_bin\n`);
    databaseProcess=spawn(path.join(bin,'mysqld.exe'),[`--defaults-file=${ini}`],{windowsHide:true,stdio:'ignore'});
    databaseProcess.on('error',()=>{});
    databaseProcess.on('exit',()=>{if(!stopping){process.send?.({ready:false,error:'Yerel veritabanı durdu. İşlemler kapatıldı; uygulamayı yeniden açın.'});process.exit(1);}});
    let c;
    for(let n=0;n<100;n++){try{c=await mysql.createConnection({host:'127.0.0.1',port,user:fresh?'root':config.user,password:fresh?'':config.password,connectTimeout:1000});break;}catch{await pause(300);}}
    if(!c)throw Error('DATABASE_START_FAILED');
    try{
      const [identity]=await c.query('SELECT @@datadir AS directory, @@port AS port');
      if(path.resolve(identity[0].directory).toLowerCase()!==path.resolve(dbDirectory).toLowerCase()||Number(identity[0].port)!==port)throw Error('TARGET_INVALID');
      if(fresh){
        const [[principal]]=await c.query('SELECT CURRENT_USER() AS identity');
        const [bootstrapUser,bootstrapHost]=principal.identity.split('@');
        if(bootstrapUser!=='root'||!['localhost','127.0.0.1','::1'].includes(bootstrapHost))throw Error('BOOTSTRAP_IDENTITY_INVALID');
        // Root is a bootstrap identity only; runtime always uses the restricted account.
        await c.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[config.rootPassword]);
        const [anonymous]=await c.query("SELECT User,Host FROM mysql.user WHERE User='' OR (User='root' AND Host<>'localhost')");
        for(const row of anonymous)if(row.User!==bootstrapUser||row.Host!==bootstrapHost)await c.query('DROP USER ?@?',[row.User,row.Host]);
        await c.query('ALTER USER ?@? IDENTIFIED BY ?',[bootstrapUser,bootstrapHost,config.rootPassword]);
        await c.query('CREATE DATABASE `veniux_local` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
        await c.query('USE `veniux_local`');await new MySQLMigrator(c).migrate();
        await c.query("CREATE USER 'veniux_app'@'127.0.0.1' IDENTIFIED BY ?",[config.password]);
        await c.query("GRANT SELECT,INSERT,UPDATE,DELETE ON veniux_local.* TO 'veniux_app'@'127.0.0.1'");
        await c.query("CREATE USER 'veniux_control'@'127.0.0.1' IDENTIFIED BY ?",[config.controlPassword]);
        await c.query("GRANT SHUTDOWN ON *.* TO 'veniux_control'@'127.0.0.1'");
        // Keep the trigger definer identity alive; prevent it from signing in.
        if(bootstrapHost!=='localhost')await c.query('ALTER USER ?@? ACCOUNT LOCK',[bootstrapUser,bootstrapHost]);
      }else {await c.query('USE `veniux_local`');}
      if((await new MySQLMigrator(c).status()).status!=='current')throw Error('SCHEMA_NOT_CURRENT');
    }finally{await c.end();}
    const keys=path.join(data,'keys');fs.mkdirSync(keys,{recursive:true});
    const privateKey=path.join(keys,'license_private_key.pem'),publicKey=path.join(keys,'license_public_key.pem');
    if(fresh){const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});fs.writeFileSync(privateKey,pair.privateKey);fs.writeFileSync(publicKey,pair.publicKey);fs.writeFileSync(path.join(data,'jwt-secret'),crypto.randomBytes(48).toString('base64url'));}
    Object.assign(process.env,{NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(apiPort),DB_ENGINE:'mysql',DB_HOST:'127.0.0.1',DB_PORT:String(port),DB_NAME:config.database,DB_USER:config.user,DB_PASSWORD:config.password,JWT_SECRET:fs.readFileSync(path.join(data,'jwt-secret'),'utf8'),VENIUX_DATA_DIR:data,LICENSE_PRIVATE_KEY_PATH:privateKey,LICENSE_PUBLIC_KEY_PATH:publicKey});
    require(path.join(backend,'src/config/runtimeConfig')).validate();
    if(fresh){
      const fields=['NODE_ENV','HOST','PORT','DB_ENGINE','DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','JWT_SECRET','VENIUX_DATA_DIR','LICENSE_PRIVATE_KEY_PATH','LICENSE_PUBLIC_KEY_PATH'];
      fs.writeFileSync(path.join(data,'install.env'),fields.map(k=>k+'='+JSON.stringify(process.env[k].replaceAll('\\','/'))).join('\n')+'\n');
      save(path.join(data,'deployment.json'),{status:'ready',engine:'mysql',app_version:require(path.join(backend,'package.json')).version,mysql_schema_spec:JSON.stringify(manifest),completed_at:new Date().toISOString()});save(configFile,{...config,status:'ready'});
    }
    require(path.join(backend,'src/services/runtimeControl')).configure(crypto.randomBytes(32).toString('base64url'));
    apiApp=require(path.join(backend,'src/index'));
    for(let n=0;n<100;n++){try{const r=await fetch(`http://127.0.0.1:${apiPort}/health`);if(r.ok&&(await r.json()).status==='ok'){
      if(process.env.VENIUX_LICENSE_STORAGE && path.resolve(process.env.VENIUX_LICENSE_STORAGE)===path.resolve(data,'..','license')) {
        automationTimer=setInterval(async()=>{
          if(automationBusy||stopping)return;automationBusy=true;
          try{
            const cached=require('./license-storage.cjs').loadLicenseToken();
            const central=require(path.join(backend,'src/services/centralLicense'));
            if(!central.enabled()||!cached?.payload?.device_token)return;
            const license=await central.verify(cached.payload.device_token,cached.payload.device_fingerprint);
            if(license.valid)await require(path.join(backend,'src/services/ownerAutomationService')).tick({centralLicense:license});
          }catch{/* Retry on the next scheduled check; no offline automation. */}finally{automationBusy=false;}
        },60000);automationTimer.unref();
      }
      process.send?.({ready:true});return;
    }}catch{}await pause(300);}
    throw Error('API_START_FAILED');
  }finally{fs.unlinkSync(lock);}
}
function stop(){databaseProcess?.kill();}
async function shutdown(){
  if(stopping)return;stopping=true;clearInterval(automationTimer);
  await require(path.join(backend,'src/services/mobileGateway')).stop().catch(()=>{});
  await require(path.join(backend,'src/services/ownerWhatsAppService')).shutdown().catch(()=>{});
  try{
    if(apiApp?.locals.server)await new Promise(r=>{apiApp.locals.server.close(r);apiApp.locals.server.closeIdleConnections();});
    await require(path.join(backend,'src/config/database')).close();
    const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
    const c=await mysql.createConnection({host:'127.0.0.1',port,user:'veniux_control',password:config.controlPassword});
    try{await c.query('SHUTDOWN');}finally{await c.end().catch(()=>{});}
  }catch{}finally{stop();process.exit();}
}
process.on('exit',stop);process.on('SIGTERM',shutdown);process.on('disconnect',shutdown);process.on('message',m=>{if(m?.action==='stop')shutdown();});
start().catch(error=>{stop();const safeCode=/^[A-Z][A-Z0-9_]{1,60}$/.test(error.code||'')?error.code:/^[A-Z][A-Z0-9_]{1,60}$/.test(error.message||'')?error.message:'LOCAL_RUNTIME_START_FAILED';try{save(path.join(data,'startup-error.json'),{code:safeCode,at:new Date().toISOString()});}catch{}const failure={ready:false,code:safeCode,error:'Yerel sunucu hazırlanamadı. Mevcut veriler değiştirilmedi; eksik kurulum kontrol edilmeli.'};if(process.connected)process.send(failure,()=>process.exit(1));else process.exit(1);});
