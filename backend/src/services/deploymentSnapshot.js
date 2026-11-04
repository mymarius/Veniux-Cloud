// Private local recovery snapshots, separate from downloadable sanitized backups.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Database=require('better-sqlite3');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(root,relative=''){
 if(!fs.existsSync(root))return [];
 const result=[];for(const item of fs.readdirSync(root,{withFileTypes:true})){
  const name=path.join(relative,item.name),full=path.join(root,item.name);
  if(item.isSymbolicLink())throw Error('Güvenlik yedeğinde sembolik bağlantı desteklenmiyor.');
  if(item.isDirectory())result.push(...files(full,name));else if(item.isFile())result.push(name);
 }return result;
}
function copy(source,target){if(!fs.existsSync(source))return;fs.mkdirSync(target,{recursive:true});for(const name of files(source)){const to=path.join(target,name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(source,name),to);}}
async function create(db,locations,extra={}){
 const directory=path.join(locations.recovery,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());fs.mkdirSync(directory,{recursive:true,mode:0o700});
 try{
  const target=path.join(directory,'database.sqlite');await db.backup(target);
  const check=new Database(target,{readonly:true});try{if(check.pragma('integrity_check',{simple:true})!=='ok'||check.pragma('foreign_key_check').length)throw Error('Güncelleme öncesi veritabanı bütünlüğü doğrulanamadı.');}finally{check.close();}
  copy(locations.storage,path.join(directory,'storage'));copy(locations.keys,path.join(directory,'keys'));
  for(const name of ['install.env','.env']){const source=path.join(locations.data,name);if(fs.existsSync(source))fs.copyFileSync(source,path.join(directory,name));}
  const manifest={format:1,created_at:new Date().toISOString(),app_version:require('../../package.json').version,schema_versions:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()?db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r=>r.version):[],...extra,files:files(directory).map(name=>({name,sha256:hash(path.join(directory,name))}))};
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});return directory;
 }catch(error){fs.writeFileSync(path.join(directory,'FAILED.txt'),'Yedek tamamlanmadı. Sağlam yedek olarak kullanmayın.',{mode:0o600});throw error;}
}
function validate(directory){
 if(fs.existsSync(path.join(directory,'FAILED.txt')))throw Error('Başarısız güvenlik yedeği kullanılamaz.');
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 if(manifest.format!==1||!Array.isArray(manifest.files))throw Error('Güvenlik yedeği biçimi geçersiz.');
 const actual=files(directory).filter(n=>n!=='manifest.json').sort(),listed=manifest.files.map(e=>e.name).sort();if(!listed.includes('database.sqlite')||JSON.stringify(actual)!==JSON.stringify(listed))throw Error('Yedek dosya listesi eksik veya değişmiş.');
 for(const entry of manifest.files){const full=path.resolve(directory,entry.name);if(!full.startsWith(path.resolve(directory)+path.sep)||fs.lstatSync(full).isSymbolicLink()||hash(full)!==entry.sha256)throw Error('Güvenlik yedeği dosya bütünlüğü geçersiz.');}
 const check=new Database(path.join(directory,'database.sqlite'),{readonly:true});try{if(check.pragma('integrity_check',{simple:true})!=='ok'||check.pragma('foreign_key_check').length)throw Error('Yedek veritabanı ilişkileri geçersiz.');const versions=check.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get()?check.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r=>r.version):[];if(JSON.stringify(versions)!==JSON.stringify(manifest.schema_versions))throw Error('Yedek şema bilgisi uyuşmuyor.');}finally{check.close();}
 return manifest;
}
module.exports={create,validate,copy,files,hash};
