const fs=require('fs'),path=require('path'),crypto=require('crypto'),Database=require('better-sqlite3'),Migrator=require('../database/migrator'),snapshot=require('./deploymentSnapshot'),runtime=require('../config/runtimeConfig');
const stateFile=data=>path.join(data,'deployment.json');
const writeState=(data,value)=>{const temp=stateFile(data)+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(temp,stateFile(data));};
function alive(pid){try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
function assertStopped(data){const file=path.join(data,'server.json');if(fs.existsSync(file)){const running=JSON.parse(fs.readFileSync(file,'utf8'));if(alive(running.pid))throw Error('API çalışıyor. Önce Stop-Production.ps1 ile durdurun.');}}
function lock(data){fs.mkdirSync(data,{recursive:true,mode:0o700});assertStopped(data);const file=path.join(data,'maintenance.lock');
 if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file,'utf8'));if(alive(old.pid))throw Error('Başka bir kurulum/güncelleme işlemi sürüyor.');fs.unlinkSync(file);}
 fs.writeFileSync(file,JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}),{flag:'wx',mode:0o600});return()=>fs.unlinkSync(file);
}
function configure(data){
 const config=path.join(data,'install.env');if(fs.existsSync(config))return config;
 const locations=runtime.paths({VENIUX_DATA_DIR:data});fs.mkdirSync(locations.keys,{recursive:true,mode:0o700});
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 fs.writeFileSync(path.join(locations.keys,'license_private_key.pem'),pair.privateKey,{mode:0o600,flag:'wx'});fs.writeFileSync(path.join(locations.keys,'license_public_key.pem'),pair.publicKey,{mode:0o600,flag:'wx'});
 const quote=value=>JSON.stringify(String(value).replaceAll('\\','/'));
 fs.writeFileSync(config,`NODE_ENV=production\nDB_ENGINE=sqlite\nHOST=127.0.0.1\nPORT=3000\nJWT_SECRET=${crypto.randomBytes(48).toString('base64url')}\nVENIUX_DATA_DIR=${quote(data)}\nLICENSE_PRIVATE_KEY_PATH=${quote(path.join(locations.keys,'license_private_key.pem'))}\nLICENSE_PUBLIC_KEY_PATH=${quote(path.join(locations.keys,'license_public_key.pem'))}\n`,{mode:0o600,flag:'wx'});return config;
}
function open(data){const file=runtime.paths({VENIUX_DATA_DIR:data}).database;const db=new Database(file,{timeout:5000});db.pragma('foreign_keys=ON');db.pragma('journal_mode=WAL');return db;}
function configuredEngine(data){const file=path.join(data,'install.env');return fs.existsSync(file)?require('node:util').parseEnv(fs.readFileSync(file,'utf8')).DB_ENGINE:null;}
async function initialize(data,account,options={}){
 data=path.resolve(data);const release=lock(data);let db,started=false;
 try{
  if(!account||typeof account.password!=='string'||Buffer.byteLength(account.password)>72||account.password.length<12||!/[a-z]/.test(account.password)||!/[A-Z]/.test(account.password)||!/[0-9]/.test(account.password))throw Error('Yönetici şifresi en az 12 karakter ve büyük/küçük harf ile rakam içermeli (en fazla 72 bayt).');
  const email=String(account.email||'').trim().toLowerCase(),phone=require('./ownerPhone').normalizePhone(account.phone);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!phone||!String(account.companyName||'').trim())throw Error('Firma adı, geçerli yönetici e-postası ve telefon gerekli.');
  configure(data);if(configuredEngine(data)==='mysql')throw Error('MySQL ilk verisini ayrı hedefe aktarın ve mysql_migrate --record-deployment ile doğrulayın.');db=open(data);
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get()&&db.prepare('SELECT COUNT(*) n FROM users').get().n)throw Error('Bu veritabanında kullanıcılar var. İlk yönetici kurulumu tekrar yapılamaz; güncelleme komutunu kullanın.');
  started=true;writeState(data,{status:'installing'});const migrator=new Migrator(db,options);await migrator.migrate();
  const passwordHash=await require('bcrypt').hash(account.password,12);
  const owner=db.transaction(()=>{
   const tenant=db.prepare('INSERT INTO tenants(name,tenant_code,company_name,email,owner_phone) VALUES(?,?,?,?,?) RETURNING id').get(account.companyName,'T-'+crypto.randomUUID(),account.companyName,email,phone);
   const user=db.prepare("INSERT INTO users(tenant_id,email,password_hash,role,full_name,phone,status) VALUES(?,?,?,'admin',?,?,'active') RETURNING id").get(tenant.id,email,passwordHash,account.fullName||account.companyName,phone);
   db.prepare('INSERT INTO platform_admins(user_id) VALUES(?)').run(user.id);
   db.prepare("UPDATE user_access_scopes SET mode='company',updated_by=? WHERE user_id=?").run(user.id,user.id);
   db.prepare('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)').run(tenant.id,email,'installation.first_admin','user',user.id,JSON.stringify({user_id:user.id,mode:'company',method:'local-installation'}));
   return {user_id:user.id,tenant_id:tenant.id};
  })();
  writeState(data,{status:'ready',app_version:require('../../package.json').version,catalog_sha256:migrator.status().catalog_sha256,completed_at:new Date().toISOString()});return {status:'ready',...owner};
 }catch(error){if(started)writeState(data,{status:'failed',operation:'install'});throw error;}finally{db?.close();release();}
}
async function update(data,options={}){
 data=path.resolve(data);const release=lock(data);let db,safety,started=false;
 try{
  if(!fs.existsSync(path.join(data,'install.env')))throw Error('Kalıcı kurulum ayarları yok. Önce kurulum veya eski veriyi taşıma adımını tamamlayın.');
  if(configuredEngine(data)==='mysql')throw Error('MySQL güncellemesini ayrı güvenlik kopyasında mysql_migrate --apply --upgrade-safety-copy ile hazırlayın; hedefi doğrulayıp --record-deployment çalıştırın. Canlı şemada DDL uygulanmadı.');
  db=open(data);const migrator=new Migrator(db,options);const before=migrator.status();
  safety=await snapshot.create(db,runtime.paths({VENIUX_DATA_DIR:data}),{reason:'pre-update',schema_before:before.version,app_version:fs.existsSync(stateFile(data))?(JSON.parse(fs.readFileSync(stateFile(data),'utf8')).app_version||'unknown-legacy'):'unknown-legacy',target_app_version:require('../../package.json').version});
  started=true;writeState(data,{status:'updating',safety_backup:safety});await migrator.migrate();
  if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw Error('Migration sonrası veri bütünlüğü geçersiz. Uygulama açılmayacak.');
  const pendingAssignments=db.prepare("SELECT COUNT(*) n FROM users u LEFT JOIN user_access_scopes s ON s.user_id=u.id WHERE u.status='active' AND COALESCE(s.mode,'restricted')='restricted' AND NOT EXISTS(SELECT 1 FROM user_warehouse_access a WHERE a.user_id=u.id)").get().n;
  writeState(data,{status:'ready',app_version:require('../../package.json').version,catalog_sha256:migrator.status().catalog_sha256,safety_backup:safety,completed_at:new Date().toISOString()});
  return {status:'ready',safety_backup:safety,pending_assignments:pendingAssignments,migrations:migrator.status().applied};
 }catch(error){if(started)writeState(data,{status:'failed',operation:'update',safety_backup:safety||null});throw error;}finally{db?.close();release();}
}
function check(data,options={}){
 data=path.resolve(data);if(fs.existsSync(path.join(data,'maintenance.lock'))&&!(options.allowOwnedMaintenance&&JSON.parse(fs.readFileSync(path.join(data,'maintenance.lock'),'utf8')).pid===process.pid))throw Error('Bakım kilidi var. Güncelleme/kurtarma işlemini tamamlayın.');
 const state=fs.existsSync(stateFile(data))?JSON.parse(fs.readFileSync(stateFile(data),'utf8')):null;
 if(!state||!['ready','restored'].includes(state.status))throw Error('Kurulum/güncelleme tamamlanmadı. Uygulama güvenlik nedeniyle başlamadı.');
 if(configuredEngine(data)==='mysql'){
  const {manifest}=require('../database/mysqlMigrator');
  if(state.engine!=='mysql'||state.mysql_schema_spec!==JSON.stringify(manifest))throw Error('MySQL dağıtım kaydı eksik veya eski. Ayrı hedefte migration ve --record-deployment doğrulaması gerekli.');
  return {status:'current',version:manifest.version,applied:1,expected:1};
 }
 const db=open(data);try{const migrations=new Migrator(db,options).status();if(migrations.status!=='current')throw Error('Kod ve veritabanı uyumsuz. Güncelleme komutunu çalıştırın.');return migrations;}finally{db.close();}
}
async function restore(data,directory,confirmation,options={}){
 if(confirmation!=='VERİLERİ GERİ YÜKLE')throw Error('Geri yükleme mevcut verileri değiştirecek. Açık VERİLERİ GERİ YÜKLE onayı gerekli.');
 data=path.resolve(data);directory=path.resolve(directory);const release=lock(data);let raw;
 try{
  if(configuredEngine(data)==='mysql')throw Error('MySQL geri yükleme ayrı boş kurtarma veritabanına mevcut Yedekleme ekranından yapılır. SQLite kurtarma komutu MySQL verisine uygulanmaz.');
  snapshot.validate(directory);const candidate=new Database(path.join(directory,'database.sqlite'),{readonly:true});try{new Migrator(candidate,options).status();}finally{candidate.close();}
  raw=open(data);const safety=await snapshot.create(raw,runtime.paths({VENIUX_DATA_DIR:data}),{reason:'pre-recovery'});raw.pragma('wal_checkpoint(TRUNCATE)');raw.close();raw=null;
  const stage=path.join(data,'restore-'+crypto.randomUUID());fs.mkdirSync(stage);
  const old=path.join(stage,'before');fs.mkdirSync(old);const locations=runtime.paths({VENIUX_DATA_DIR:data});
  const previous=JSON.parse(fs.readFileSync(stateFile(data),'utf8'));const journal={status:'recovering',stage,safety_backup:safety,previous};writeState(data,journal);
  const moved=[];let writesStarted=false;
  try{
   for(const name of ['stok_takip.db','stok_takip.db-wal','stok_takip.db-shm','storage','keys','install.env'])if(fs.existsSync(path.join(data,name))){fs.renameSync(path.join(data,name),path.join(old,name));moved.push(name);}
   writesStarted=true;writeState(data,{...journal,phase:'installing'});
   fs.copyFileSync(path.join(directory,'database.sqlite'),locations.database);snapshot.copy(path.join(directory,'storage'),locations.storage);snapshot.copy(path.join(directory,'keys'),locations.keys);
   if(fs.existsSync(path.join(directory,'install.env'))){const env=require('node:util').parseEnv(fs.readFileSync(path.join(directory,'install.env'),'utf8'));env.VENIUX_DATA_DIR=data.replaceAll('\\','/');env.LICENSE_PRIVATE_KEY_PATH=path.join(data,'keys/license_private_key.pem').replaceAll('\\','/');env.LICENSE_PUBLIC_KEY_PATH=path.join(data,'keys/license_public_key.pem').replaceAll('\\','/');fs.writeFileSync(path.join(data,'install.env'),Object.entries(env).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600});}
   if(!fs.existsSync(path.join(data,'install.env'))&&fs.existsSync(path.join(old,'install.env')))fs.copyFileSync(path.join(old,'install.env'),path.join(data,'install.env'));
   writeState(data,{status:'restored',safety_backup:safety,source:directory,completed_at:new Date().toISOString()});
   // Retain the previous files for explicit recovery; never discard the safety copy.
   return {status:'restored',safety_backup:safety,previous_files:old,migrations_require_update:true};
  }catch(error){if(writesStarted)for(const name of ['stok_takip.db','storage','keys','install.env']){const target=path.join(data,name);if(fs.existsSync(target))removeInside(data,target);}for(const name of moved)fs.renameSync(path.join(old,name),path.join(data,name));writeState(data,{...previous,recovery_failed:true,safety_backup:safety});throw error;}
 }finally{raw?.close();release();}
}
function removeInside(data,target){const root=path.resolve(data),full=path.resolve(target);if(!full.startsWith(root+path.sep)||full===root)throw Error('Geçersiz kurtarma dosya yolu.');fs.rmSync(full,{recursive:true,force:true});}
function repair(data,confirmation){
 if(confirmation!=='VERİLERİ GERİ YÜKLE')throw Error('Açık geri yükleme onayı gerekli.');data=path.resolve(data);const release=lock(data);
 try{const journal=JSON.parse(fs.readFileSync(stateFile(data),'utf8'));if(journal.status!=='recovering')throw Error('Yarım kalmış geri yükleme yok.');const stage=path.resolve(journal.stage),old=path.join(stage,'before');if(!stage.startsWith(data+path.sep)||path.dirname(stage)!==data||!path.basename(stage).startsWith('restore-'))throw Error('Kurtarma günlüğü geçersiz.');
 if(journal.phase==='installing')for(const name of ['stok_takip.db','storage','keys','install.env'])if(!fs.existsSync(path.join(old,name))&&fs.existsSync(path.join(data,name)))removeInside(data,path.join(data,name));
 for(const name of fs.readdirSync(old)){if(!['stok_takip.db','stok_takip.db-wal','stok_takip.db-shm','storage','keys','install.env'].includes(name))throw Error('Kurtarma kaydı geçersiz.');const target=path.join(data,name);if(fs.existsSync(target))removeInside(data,target);fs.renameSync(path.join(old,name),target);}writeState(data,journal.previous);return {status:'recovered'};
 }finally{release();}
}
async function adopt(data,legacyBackend){
 data=path.resolve(data);legacyBackend=path.resolve(legacyBackend);const release=lock(data);let source,started=false;
 try{
  if(fs.existsSync(path.join(data,'stok_takip.db'))||fs.existsSync(path.join(data,'install.env')))throw Error('Hedef kurulum boş olmalı; mevcut verinin üzerine taşıma yapılmaz.');
  const legacyPid=path.join(legacyBackend,'../.local/api.pid');if(fs.existsSync(legacyPid)&&alive(Number(fs.readFileSync(legacyPid,'utf8').trim())))throw Error('Eski API açık. Önce geliştirme sunucusunu durdurun.');
  if(!fs.existsSync(path.join(legacyBackend,'stok_takip.db')))throw Error('Eski SQLite veritabanı bulunamadı.');
  const envFile=path.join(legacyBackend,'.env');const env=fs.existsSync(envFile)?require('node:util').parseEnv(fs.readFileSync(envFile,'utf8')):{};
  const customPaths=['MEDICINE_STORAGE_DIR','UPDATE_STORAGE_DIR'];for(const key of customPaths)if(env[key]&&path.resolve(env[key])!==path.join(legacyBackend,'storage')&&path.resolve(env[key])!==path.join(legacyBackend,'storage','updates'))throw Error(key+' özel dosya konumu kullanıyor. Önce dosyaları eski storage klasörüne taşıyıp yapılandırmayı düzenleyin. Otomatik taşıma durduruldu.');
  source=new Database(path.join(legacyBackend,'stok_takip.db'),{readonly:true});new Migrator(source).status();
  started=true;const safety=await snapshot.create(source,{data:legacyBackend,storage:path.join(legacyBackend,'storage'),keys:path.join(legacyBackend,'config/keys'),recovery:path.join(data,'recovery')},{reason:'legacy-adoption'});
  await source.backup(path.join(data,'stok_takip.db'));source.close();source=null;
  configure(data);snapshot.copy(path.join(safety,'storage'),path.join(data,'storage'));
  const pairing=path.join(legacyBackend,'../scanner-bridge/pairing.json');if(fs.existsSync(pairing)){const target=path.join(data,'storage/scanner-bridge/pairing.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(pairing,target);}
  const oldPrivate=env.LICENSE_PRIVATE_KEY_PATH||path.join(legacyBackend,'config/keys/license_private_key.pem'),oldPublic=env.LICENSE_PUBLIC_KEY_PATH||path.join(legacyBackend,'config/keys/license_public_key.pem');
  if(!fs.existsSync(oldPrivate)||!fs.existsSync(oldPublic))throw Error('Eski lisans imza anahtarları bulunamadı. Mevcut lisansları korumak için taşıma durduruldu.');
  fs.copyFileSync(oldPrivate,path.join(data,'keys/license_private_key.pem'));fs.copyFileSync(oldPublic,path.join(data,'keys/license_public_key.pem'));
  const existing=require('node:util').parseEnv(fs.readFileSync(path.join(data,'install.env'),'utf8'));
  const excluded=new Set(['NODE_ENV','DB_ENGINE','HOST','PORT','VENIUX_DATA_DIR','TEST_SQLITE_PATH','LICENSE_PRIVATE_KEY_PATH','LICENSE_PUBLIC_KEY_PATH','MEDICINE_STORAGE_DIR','UPDATE_STORAGE_DIR','JWT_SECRET']);
  for(const [key,value] of Object.entries(env))if(!excluded.has(key)&&/^[A-Z][A-Z0-9_]*$/.test(key))existing[key]=value;
  if(env.JWT_SECRET&&Buffer.byteLength(env.JWT_SECRET)>=32&&!/your-secret|change-this|example|placeholder/i.test(env.JWT_SECRET))existing.JWT_SECRET=env.JWT_SECRET;
  fs.writeFileSync(path.join(data,'install.env'),Object.entries(existing).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600});
  writeState(data,{status:'adopted',safety_backup:safety});return {status:'adopted',safety_backup:safety,next:'Update-Windows.ps1 çalıştırın; yeni kullanıcı oluşturulmadı.'};
 }catch(error){if(started)writeState(data,{status:'failed',operation:'adopt'});throw error;}finally{source?.close();release();}
}
module.exports={lock,adopt,repair,initialize,update,check,restore,configure,assertStopped,alive,writeState};
