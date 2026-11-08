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
    // Yönetici hesabı TCP'de kilitli; şema yükseltmesi gerekiyorsa yalnız o açılışta yerel named pipe açılır.
    const deployment=fresh?null:JSON.parse(fs.readFileSync(path.join(data,'deployment.json'),'utf8'));
    const pendingRestore=path.join(data,'pending-restore.json');
    const verifyFile=path.join(data,'backup-verify.json');let lastVerify=null;try{lastVerify=JSON.parse(fs.readFileSync(verifyFile,'utf8'));}catch{}
    const verifyDue=!fresh&&(!lastVerify||lastVerify.status==='skipped'||Date.now()-Date.parse(lastVerify.at)>VERIFY_DAYS*86400000);
    const upgradePipe=!fresh&&(deployment.mysql_schema_spec!==JSON.stringify(manifest)||fs.existsSync(pendingRestore)||verifyDue)?'veniux-upgrade-'+crypto.randomBytes(12).toString('hex'):null;
    fs.writeFileSync(ini,`[mysqld]\nbasedir="${path.dirname(bin).replaceAll('\\','/')}"\ndatadir="${dbDirectory.replaceAll('\\','/')}"\nport=${port}\nbind-address=127.0.0.1\nskip-name-resolve\nlocal-infile=0\ncharacter-set-server=utf8mb4\ncollation-server=utf8mb4_bin\n${upgradePipe?`named-pipe=ON\nsocket=${upgradePipe}\n`:''}`);
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
      if(!fresh&&(await new MySQLMigrator(c).status()).status!=='current'){
        if(!upgradePipe)throw Error('SCHEMA_NOT_CURRENT');
        await upgradeSchema(bin,config,upgradePipe);
        save(path.join(data,'deployment.json'),{...deployment,mysql_schema_spec:JSON.stringify(manifest),schema_upgraded_at:new Date().toISOString()});
      }
      if((await new MySQLMigrator(c).status()).status!=='current')throw Error('SCHEMA_NOT_CURRENT');
    }finally{await c.end();}
    const keys=path.join(data,'keys');fs.mkdirSync(keys,{recursive:true});
    const privateKey=path.join(keys,'license_private_key.pem'),publicKey=path.join(keys,'license_public_key.pem');
    if(fresh){const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});fs.writeFileSync(privateKey,pair.privateKey);fs.writeFileSync(publicKey,pair.publicKey);fs.writeFileSync(path.join(data,'jwt-secret'),crypto.randomBytes(48).toString('base64url'));}
    Object.assign(process.env,{NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(apiPort),DB_ENGINE:'mysql',DB_HOST:'127.0.0.1',DB_PORT:String(port),DB_NAME:config.database,DB_USER:config.user,DB_PASSWORD:config.password,JWT_SECRET:fs.readFileSync(path.join(data,'jwt-secret'),'utf8'),VENIUX_DATA_DIR:data,LICENSE_PRIVATE_KEY_PATH:privateKey,LICENSE_PUBLIC_KEY_PATH:publicKey});
    require(path.join(backend,'src/config/runtimeConfig')).validate();
    process.env.VENIUX_DESKTOP_RESTORE='1';
    if(!fresh&&upgradePipe&&fs.existsSync(pendingRestore))await applyRestore(bin,config,upgradePipe);
    if(verifyDue&&upgradePipe)await verifyBackup(config,upgradePipe,verifyFile);
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
// Önce tam yedek alınır; yedek yoksa şemaya dokunulmaz. Parola komut satırına değil ortam değişkenine verilir.
function dumpLocal(bin,config,pipe,label){
  const backups=path.join(data,'backups');fs.mkdirSync(backups,{recursive:true});
  const file=path.join(backups,label+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sql');
  execFileSync(path.join(bin,'mysqldump.exe'),['--protocol=PIPE','--socket='+pipe,'--user=root','--single-transaction','--routines','--triggers','--result-file='+file,'veniux_local'],{windowsHide:true,stdio:'ignore',env:{...process.env,MYSQL_PWD:config.rootPassword},timeout:600000});
  if(!fs.existsSync(file)||fs.statSync(file).size<1000)throw Error('SCHEMA_BACKUP_FAILED');
  return file;
}
async function upgradeSchema(bin,config,pipe){
  dumpLocal(bin,config,pipe,'before-schema');
  const c=await mysql.createConnection({socketPath:'\\\\.\\pipe\\'+pipe,user:'root',password:config.rootPassword,database:'veniux_local'});
  try{const state=await new MySQLMigrator(c).upgradeAdditive();if(state.status!=='current')throw Error('SCHEMA_NOT_CURRENT');}finally{await c.end().catch(()=>{});}
}
// Geri yükleme: tam yedek → ayrı boş veritabanına yükleme ve doğrulama → tabloların tek RENAME ile yer değiştirmesi.
// Eski tablolar veniux_old_* veritabanında kalır. Herhangi bir adım başarısız olursa program bugünkü verilerle açılır.
async function applyRestore(bin,config,pipe){
  const stamp=Date.now(),recovery='veniux_recovery_'+stamp,old='veniux_old_'+stamp,result=path.join(data,'restore-result.json');
  const pipeConfig={socketPath:'\\\\.\\pipe\\'+pipe,user:'root',password:config.rootPassword};
  let c,swapped=false,safety;
  try{
    safety=dumpLocal(bin,config,pipe,'before-restore');
    c=await mysql.createConnection({...pipeConfig,multipleStatements:false});
    await c.query('CREATE DATABASE `'+recovery+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
    const service=require(path.join(backend,'src/services/mysqlBackupService')).makeMySQLBackupService();
    const outcome=await service.applyPending({...pipeConfig,database:recovery});
    if(!outcome||outcome.restore_failed)throw Error('RESTORE_LOAD_FAILED');
    const tables=async schema=>(await c.query('SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=?',[schema]))[0].map(r=>r.n);
    const current=await tables('veniux_local'),incoming=await tables(recovery);
    if(!incoming.includes('users')||!incoming.includes('veniux_mysql_migrations'))throw Error('RESTORE_TARGET_INVALID');
    const [triggers]=await c.query("SELECT TRIGGER_SCHEMA AS s,TRIGGER_NAME AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA IN ('veniux_local',?)",[recovery]);
    for(const tr of triggers)await c.query('DROP TRIGGER `'+tr.s+'`.`'+tr.n+'`');
    await c.query('CREATE DATABASE `'+old+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
    await c.query('RENAME TABLE '+[...current.map(n=>'`veniux_local`.`'+n+'` TO `'+old+'`.`'+n+'`'),...incoming.map(n=>'`'+recovery+'`.`'+n+'` TO `veniux_local`.`'+n+'`')].join(','));
    swapped=true;
    await c.query('USE `veniux_local`');
    const {triggerDDL}=require(path.join(backend,'src/database/mysqlMigrator'));
    for(const trigger of manifest.triggers)await c.query(triggerDDL(trigger));
    if((await new MySQLMigrator(c).status()).status!=='current')throw Error('RESTORE_SCHEMA_INVALID');
    await c.query('DROP DATABASE `'+recovery+'`');
    // Yalnız bu geri yüklemeden önceki veri saklanır; daha eski önceki-veri kopyaları diski doldurmasın diye silinir.
    const [olds]=await c.query("SELECT SCHEMA_NAME AS n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'veniux\_old\_%'");
    for(const {n} of olds)if(n!==old&&/^veniux_old_\d+$/.test(n))await c.query('DROP DATABASE `'+n+'`');
    if(outcome.candidate_files&&fs.existsSync(outcome.candidate_files)){const target=path.join(require(path.join(backend,'src/config/runtimeConfig')).paths().storage,'medicine-images');fs.mkdirSync(target,{recursive:true});for(const name of fs.readdirSync(outcome.candidate_files))fs.copyFileSync(path.join(outcome.candidate_files,name),path.join(target,name));}
    save(result,{status:'done',at:new Date().toISOString(),previous_database:old,safety_backup:path.basename(safety)});
  }catch(error){
    // Yer değiştirme yapıldıysa geri çevrilir; yapılmadıysa çalışan veri hiç değişmemiştir.
    if(swapped&&c)try{
      const [back]=await c.query('SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=?',[old]),[now]=await c.query("SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA='veniux_local'");
      const [trs]=await c.query("SELECT TRIGGER_NAME AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='veniux_local'");for(const tr of trs)await c.query('DROP TRIGGER `veniux_local`.`'+tr.n+'`');
      await c.query('RENAME TABLE '+[...now.map(r=>'`veniux_local`.`'+r.n+'` TO `'+recovery+'`.`'+r.n+'`'),...back.map(r=>'`'+old+'`.`'+r.n+'` TO `veniux_local`.`'+r.n+'`')].join(','));
      await c.query('USE `veniux_local`');const {triggerDDL}=require(path.join(backend,'src/database/mysqlMigrator'));for(const trigger of manifest.triggers)await c.query(triggerDDL(trigger));
    }catch{save(result,{status:'failed_needs_support',at:new Date().toISOString(),code:'RESTORE_ROLLBACK_FAILED',safety_backup:safety&&path.basename(safety)});throw Error('RESTORE_ROLLBACK_FAILED');}
    if(c&&!swapped)await c.query('DROP DATABASE IF EXISTS `'+recovery+'`').catch(()=>{});
    fs.rmSync(path.join(data,'pending-restore.json'),{force:true});
    save(result,{status:'failed',at:new Date().toISOString(),code:/^[A-Z_]+$/.test(error.message)?error.message:'RESTORE_FAILED',safety_backup:safety&&path.basename(safety)});
  }finally{await c?.end().catch(()=>{});}
}
// Haftalık: en son sağlam yedek geçici boş veritabanına yüklenir, tablo kayıt sayıları yedekle karşılaştırılır, sonra silinir.
// Sonuç yedek sağlığında görünür. Doğrulama hatası programın açılmasını engellemez.
const VERIFY_DAYS=7;
async function verifyBackup(config,pipe,file){
  const name='veniux_verify_'+Date.now();let c;
  try{
    const service=require(path.join(backend,'src/services/mysqlBackupService')).makeMySQLBackupService();
    const latest=service.latestPayload();
    if(!latest){save(file,{status:'skipped',at:new Date().toISOString(),reason:'no_backup'});return;}
    c=await mysql.createConnection({socketPath:'\\\\.\\pipe\\'+pipe,user:'root',password:config.rootPassword,dateStrings:true,decimalNumbers:false,supportBigNumbers:true,bigNumberStrings:false,timezone:'Z'});
    await c.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');await c.query('USE `'+name+'`');
    await require(path.join(backend,'src/database/dataTransfer')).restoreEmptyTarget(c,latest.payload.database);
    for(const table of latest.payload.database.tables){const [[row]]=await c.query('SELECT COUNT(*) AS n FROM `'+table.name.replaceAll('`','')+'`');if(Number(row.n)!==table.rows.length)throw Error('VERIFY_COUNT_MISMATCH');}
    save(file,{status:'ok',at:new Date().toISOString(),backup_id:latest.id,backup_created_at:latest.created_at,tables:latest.payload.database.tables.length});
  }catch(error){save(file,{status:'failed',at:new Date().toISOString(),code:/^[A-Z_]+$/.test(error.message)?error.message:'VERIFY_FAILED'});}
  finally{if(c){await c.query('DROP DATABASE IF EXISTS `'+name+'`').catch(()=>{});await c.end().catch(()=>{});}}
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
