const fs=require('fs'),path=require('path');
const catalog=fs.readdirSync(path.join(__dirname,'mysql')).filter(name=>/^\d+.*\.json$/.test(name)).sort().map(name=>JSON.parse(fs.readFileSync(path.join(__dirname,'mysql',name),'utf8')));
const manifest=catalog.at(-1);
const q=name=>'`'+name.replaceAll('`','``')+'`';
const cols=names=>names.map(q).join(',');
const error=message=>Object.assign(Error(message),{code:'MYSQL_MIGRATION_REQUIRED'});
function triggerDDL({name,sql}){
 const match=sql.match(/CREATE TRIGGER\s+\w+\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+(\w+)\s*([\s\S]*?)BEGIN\s*([\s\S]*?)\s*END\s*;?$/i);
 if(!match)throw error('MySQL trigger karşılığı eksik: '+name);
 let [,timing,event,table,when,body]=match;
 when=when.trim().replace(/^WHEN\s+/i,'');
 // SQLite IS NOT provides NULL-safe comparison. Preserve it explicitly.
 when=when.replace(/(json_extract\([^)]*\)|(?:NEW|OLD)\.\w+)\s+IS NOT\s+(json_extract\([^)]*\)|(?:NEW|OLD)\.\w+)/gi,'NOT ($1 <=> $2)');
 body=body.replace(/SELECT\s+RAISE\(ABORT,'([^']*)'\)\s*;/gi,"SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='$1';");
 return `CREATE TRIGGER ${q(name)} ${timing} ${event} ON ${q(table)} FOR EACH ROW BEGIN ${when?'IF '+when+' THEN ':''}${body}${when?' END IF;':''} END`;
}
class MySQLMigrator{
 constructor(connection){this.connection=connection;}
 async status(){
  const c=this.connection;
  const [tables]=await c.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='veniux_mysql_migrations'");
  if(!tables.length)return {status:'pending',pending:catalog.map(v=>v.version),applied:0,expected:catalog.length};
  const [rows]=await c.query('SELECT version,state,schema_spec FROM veniux_mysql_migrations');
  if(rows.some(r=>!catalog.some(v=>v.version===r.version)))throw error('MySQL şeması kod sürümünden daha yeni.');
  if(rows.some(r=>r.state!=='complete'))throw error('Önceki MySQL migration tamamlanmadı. Güvenlik yedeğinden ayrı veritabanına kurtarın.');
  if(rows.some(r=>r.schema_spec!==JSON.stringify(catalog.find(v=>v.version===r.version))))throw error('MySQL migration tanımı değişmiş; ayrı hedefe yeniden migration gerekli.');
  const pending=catalog.filter(v=>!rows.some(r=>r.version===v.version)).map(v=>v.version);
  if(rows.some(r=>catalog.findIndex(v=>v.version===r.version)>catalog.findIndex(v=>v.version===pending[0]))&&pending.length)throw error('MySQL migration sırası geçersiz.');
  if(!pending.length)await verifyStructure(c);
  return {status:pending.length?'pending':'current',version:rows.map(r=>r.version).sort().at(-1),applied:rows.length,expected:catalog.length,pending};
 }
 // Kurulu masaüstü veritabanı için: yalnız yeni tablo ekleyen adımlar uygulanır, mevcut tablo ve tetikleyicilere dokunulmaz.
 // Bekleyen adım mevcut bir tabloyu değiştiriyorsa hiçbir şey yapılmadan durur.
 async upgradeAdditive(){
  const c=this.connection;const [lock]=await c.query("SELECT GET_LOCK(CONCAT(DATABASE(),':veniux-migrate'),0) AS acquired");if(lock[0].acquired!==1)throw error('Başka bir migration sürüyor.');
  try{
   const state=await this.status();if(state.status==='current')return state;
   if(!state.applied)throw error('Boş veritabanı ek yükseltmeyle kurulamaz.');
   const steps=catalog.filter(v=>state.pending.includes(v.version));
   for(const step of steps){const before=catalog[catalog.indexOf(step)-1];
    if(!before||JSON.stringify(step.triggers)!==JSON.stringify(before.triggers)||before.tables.some(t=>JSON.stringify(step.tables.find(n=>n.name===t.name))!==JSON.stringify(t)))throw error('SCHEMA_UPGRADE_UNSUPPORTED');}
   const [present]=await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
   for(const step of steps){const before=catalog[catalog.indexOf(step)-1];
    const added=step.tables.filter(t=>!before.tables.some(b=>b.name===t.name));
    if(added.some(t=>present.some(p=>p.TABLE_NAME===t.name)))throw error('SCHEMA_UPGRADE_CONFLICT');
    for(const t of added){
     const definitions=t.columns.map(v=>v.definition);if(t.primary.length)definitions.push('PRIMARY KEY('+cols(t.primary)+')');
     for(const ix of t.unique)definitions.push('UNIQUE KEY '+q(ix.name)+'('+cols(ix.columns)+')');
     for(const ix of t.indexes)definitions.push('KEY '+q(ix.name)+'('+cols(ix.columns)+')');
     for(const [i,check] of t.checks.entries())definitions.push('CONSTRAINT '+q('ck_'+t.name+'_'+i)+' CHECK('+check+')');
     for(const fk of t.foreign)definitions.push('CONSTRAINT '+q(fk.name)+' FOREIGN KEY('+cols(fk.columns)+') REFERENCES '+q(fk.table)+'('+cols(fk.references)+') ON DELETE '+fk.onDelete+' ON UPDATE '+fk.onUpdate);
     await c.query('CREATE TABLE '+q(t.name)+'('+definitions.join(',')+') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin');
    }
    await c.query("INSERT INTO veniux_mysql_migrations(version,state,applied_at,schema_spec) VALUES(?,'complete',CURRENT_TIMESTAMP,?)",[step.version,JSON.stringify(step)]);
   }
   return this.status();
  }finally{await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':veniux-migrate'))").catch(()=>{});}
 }
 async migrate(options={}){
  const c=this.connection;const [lock]=await c.query("SELECT GET_LOCK(CONCAT(DATABASE(),':veniux-migrate'),0) AS acquired");if(lock[0].acquired!==1)throw error('Başka bir migration sürüyor.');
  try{
   const state=await this.status();if(state.status==='current')return state;
   const [existingTables]=await c.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME<>'veniux_mysql_migrations'");
   if(existingTables.length&&!options.upgradeCopy)throw error('Migration yalnız boş hedefte veya açıkça doğrulanmış güvenlik kopyasında uygulanır.');
   await c.query("CREATE TABLE IF NOT EXISTS veniux_mysql_migrations(version VARCHAR(80) PRIMARY KEY,state ENUM('running','complete','failed') NOT NULL,applied_at DATETIME,schema_spec LONGTEXT NOT NULL)");
   for(const manifest of catalog.filter(v=>state.pending.includes(v.version))){
   await c.query("INSERT INTO veniux_mysql_migrations(version,state,schema_spec) VALUES(?,'running',?)",[manifest.version,JSON.stringify(manifest)]);
   // MySQL DDL commits implicitly. The durable running/failed latch is never
   // cleared automatically. Apply to an empty/copy target, then switch config.
   await c.query('SET FOREIGN_KEY_CHECKS=0');
   const [oldRelations]=await c.query('SELECT TABLE_NAME,CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()');
   for(const fk of oldRelations)await c.query('ALTER TABLE '+q(fk.TABLE_NAME)+' DROP FOREIGN KEY '+q(fk.CONSTRAINT_NAME));
   for(const t of manifest.tables){
    const definitions=t.columns.map(v=>v.definition);if(t.primary.length)definitions.push('PRIMARY KEY('+cols(t.primary)+')');
    for(const ix of t.unique)definitions.push('UNIQUE KEY '+q(ix.name)+'('+cols(ix.columns)+')');
    for(const [i,check] of t.checks.entries())definitions.push('CONSTRAINT '+q('ck_'+t.name+'_'+i)+' CHECK('+check+')');
    await c.query('CREATE TABLE IF NOT EXISTS '+q(t.name)+'('+definitions.join(',')+') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin');
    const [existing]=await c.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[t.name]);
    for(const column of t.columns)if(!existing.some(v=>v.COLUMN_NAME===column.name))await c.query('ALTER TABLE '+q(t.name)+' ADD COLUMN '+column.definition);
    for(const column of t.columns.filter(v=>!v.definition.includes('GENERATED ALWAYS'))){await c.query('ALTER TABLE '+q(t.name)+' MODIFY COLUMN '+column.definition);}
    for(const [i,check] of t.checks.entries()){const name='ck_'+t.name+'_'+i;const [found]=await c.query('SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=?',[t.name,name]);if(!found.length)await c.query('ALTER TABLE '+q(t.name)+' ADD CONSTRAINT '+q(name)+' CHECK('+check+')');}
    for(const ix of [...t.unique,...t.indexes]){const [found]=await c.query('SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?',[t.name,ix.name]);if(!found.length)await c.query('CREATE '+(t.unique.includes(ix)?'UNIQUE ':'')+'INDEX '+q(ix.name)+' ON '+q(t.name)+'('+cols(ix.columns)+')');}
   }
   for(const t of manifest.tables)for(const fk of t.foreign){
    const [found]=await c.query('SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME=?',[fk.name]);
    if(!found.length)await c.query('ALTER TABLE '+q(t.name)+' ADD CONSTRAINT '+q(fk.name)+' FOREIGN KEY('+cols(fk.columns)+') REFERENCES '+q(fk.table)+'('+cols(fk.references)+') ON DELETE '+fk.onDelete+' ON UPDATE '+fk.onUpdate);
   }
   await c.query('SET FOREIGN_KEY_CHECKS=1');
   await c.query('CREATE TABLE IF NOT EXISTS veniux_write_mutex(id INT PRIMARY KEY, is_active TINYINT NOT NULL DEFAULT 1, fence_version INT NOT NULL DEFAULT 1) ENGINE=InnoDB');
   const [vmCols] = await c.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='veniux_write_mutex'");
   if (!vmCols.some(col => col.COLUMN_NAME === 'is_active')) {
     await c.query('ALTER TABLE veniux_write_mutex ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1, ADD COLUMN fence_version INT NOT NULL DEFAULT 1');
   }
   await c.query('INSERT IGNORE INTO veniux_write_mutex(id, is_active, fence_version) VALUES(1, 1, 1)');
   if(options.load&&manifest.version===catalog.at(-1).version){
    // Earlier catalog triggers can validate rows whose parents are not loaded yet,
    // or synthesize access scopes that also exist in the snapshot. This branch is
    // only reached by explicit empty-target recovery. Recreate and verify below;
    // failures keep the migration latch closed and never activate this target.
    for(const trigger of catalog.flatMap(v=>v.triggers))await c.query('DROP TRIGGER IF EXISTS '+q(trigger.name));
    await c.query('SET FOREIGN_KEY_CHECKS=0');try{await options.load(c);}finally{await c.query('SET FOREIGN_KEY_CHECKS=1');}
   }
   await verifyRelations(c,manifest);
   for(const trigger of manifest.triggers){await c.query('DROP TRIGGER IF EXISTS '+q(trigger.name));await c.query(triggerDDL(trigger));}
   await c.query("INSERT INTO user_access_scopes(user_id,tenant_id,mode) SELECT id,tenant_id,CASE WHEN role='admin' THEN 'company' ELSE 'restricted' END FROM users WHERE id NOT IN (SELECT user_id FROM user_access_scopes)");
   await c.query("UPDATE veniux_mysql_migrations SET state='complete',applied_at=CURRENT_TIMESTAMP WHERE version=?",[manifest.version]);
   }return this.status();
  }catch(e){await c.query("UPDATE veniux_mysql_migrations SET state='failed' WHERE state='running'").catch(()=>{});throw e;}
  finally{await c.query('SET FOREIGN_KEY_CHECKS=1').catch(()=>{});await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':veniux-migrate'))").catch(()=>{});}
 }
}
async function verifyRelations(c,manifest=module.exports.manifest){
 for(const table of manifest.tables)for(const fk of table.foreign){const join=fk.columns.map((col,i)=>'p.'+q(fk.references[i])+'=r.'+q(col)).join(' AND '),present=fk.columns.map(col=>'r.'+q(col)+' IS NOT NULL').join(' AND ');const [rows]=await c.query('SELECT 1 FROM '+q(table.name)+' r WHERE '+present+' AND NOT EXISTS(SELECT 1 FROM '+q(fk.table)+' p WHERE '+join+') LIMIT 1');if(rows.length)throw error('İlişki doğrulaması başarısız: '+table.name);}
 for(const table of manifest.tables.filter(t=>t.columns.some(c=>c.name==='tenant_id')))for(const fk of table.foreign){
  const parent=manifest.tables.find(t=>t.name===fk.table);if(!parent?.columns.some(c=>c.name==='tenant_id'))continue;
  const join=fk.columns.map((col,i)=>'p.'+q(fk.references[i])+'=r.'+q(col)).join(' AND ');const [rows]=await c.query('SELECT 1 FROM '+q(table.name)+' r JOIN '+q(fk.table)+' p ON '+join+' WHERE r.tenant_id<>p.tenant_id LIMIT 1');if(rows.length)throw error('Firma ilişkisi uyumsuz: '+table.name);
 }
 for(const sql of ["SELECT 1 FROM user_warehouse_access a JOIN users u ON u.id=a.user_id JOIN warehouses w ON w.id=a.warehouse_id WHERE a.tenant_id<>u.tenant_id OR a.tenant_id<>w.tenant_id LIMIT 1","SELECT 1 FROM user_access_scopes a JOIN users u ON u.id=a.user_id WHERE a.tenant_id<>u.tenant_id LIMIT 1","SELECT 1 FROM retail_cash_movements m JOIN retail_shifts s ON s.id=m.shift_id WHERE m.tenant_id<>s.tenant_id LIMIT 1"]){const [rows]=await c.query(sql);if(rows.length)throw error('Firma ilişki doğrulaması başarısız.');}
}
function normalizeColumnType(type){return type.toLowerCase().replace(/\b(tinyint|smallint|mediumint|int|integer|bigint)\(\d+\)/g,'$1');}
async function verifyStructure(c){
 const [columns]=await c.query('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()'),[tables]=await c.query('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()'),[triggers]=await c.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()'),[constraints]=await c.query('SELECT TABLE_NAME,CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()'),[indexes]=await c.query('SELECT TABLE_NAME,INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()');
 for(const table of manifest.tables){
  if(!tables.some(t=>t.TABLE_NAME===table.name&&t.ENGINE==='InnoDB'))throw error('MySQL tablo motoru doğrulanamadı: '+table.name);
  for(const column of table.columns){const actual=columns.find(v=>v.TABLE_NAME===table.name&&v.COLUMN_NAME===column.name);if(!actual||normalizeColumnType(actual.COLUMN_TYPE)!==normalizeColumnType(column.type)||column.definition.includes('GENERATED ALWAYS')&&!actual.EXTRA.includes('GENERATED'))throw error('MySQL sütunu şemayla eşleşmiyor: '+table.name+'.'+column.name);}
  for(const name of [...table.foreign.map(f=>f.name),...table.checks.map((_,i)=>'ck_'+table.name+'_'+i)])if(!constraints.some(v=>v.TABLE_NAME===table.name&&v.CONSTRAINT_NAME===name))throw error('MySQL ilişki/kural eksik: '+name);
  for(const ix of [...table.unique,...table.indexes])if(!indexes.some(v=>v.TABLE_NAME===table.name&&v.INDEX_NAME===ix.name))throw error('MySQL indeks eksik: '+ix.name);
 }
 const [grants]=await c.query('SHOW GRANTS').catch(()=>[[]]);
 const canSeeTriggers=grants.some(g=>Object.values(g).some(v=>/\b(TRIGGER|ALL PRIVILEGES)\b/i.test(v)));
 if(canSeeTriggers)for(const trigger of manifest.triggers)if(!triggers.some(v=>v.TRIGGER_NAME===trigger.name))throw error('MySQL trigger eksik: '+trigger.name);
}
module.exports={MySQLMigrator,manifest,triggerDDL,verifyRelations,verifyStructure,quote:q};
