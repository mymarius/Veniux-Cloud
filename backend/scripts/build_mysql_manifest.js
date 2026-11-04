// Build from a fresh, in-memory migration database; never open customer data.
const fs=require('fs'),path=require('path'),Database=require('better-sqlite3');
const Migrator=require('../src/database/migrator');
const quote=s=>'`'+s.replaceAll('`','``')+'`';
function checks(sql){const out=[];for(const m of sql.matchAll(/\bCHECK\s*\(/gi)){let i=m.index+m[0].length,depth=1,start=i,quoted=false;for(;i<sql.length&&depth;i++){if(sql[i]==="'")quoted=!quoted;if(!quoted){if(sql[i]==='(')depth++;if(sql[i]===')')depth--;}}out.push(sql.slice(start,i-1));}return out;}
async function build(){
 const raw=new Database(':memory:');await new Migrator(raw).migrate();
 const tables=raw.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migrations','migration_checksums') ORDER BY name").all();
 const result=[];
 for(const {name,sql} of tables){
  const columns=raw.prepare('PRAGMA table_info('+quote(name)+')').all(),indexes=raw.prepare('PRAGMA index_list('+quote(name)+')').all();
  const keys=new Set(columns.filter(c=>c.pk).map(c=>c.name));
  for(const ix of indexes)for(const c of raw.prepare('PRAGMA index_info('+quote(ix.name)+')').all())keys.add(c.name);
  const fks=raw.prepare('PRAGMA foreign_key_list('+quote(name)+')').all();
  for(const fk of fks)keys.add(fk.from);
  const defs=columns.map(c=>{
   const integer=/^(INTEGER|INT|BOOLEAN)$/i.test(c.type),real=/REAL|FLOAT|DOUBLE|DECIMAL|NUMERIC/i.test(c.type);
   let type=(integer&&/quantity|(?:^|_)qty$|change_amount/.test(c.name)||real)?'DECIMAL(24,6)':integer?'BIGINT':/^(DATETIME|TIMESTAMP)$/i.test(c.type)?c.type+'(6)':/^DATE$/i.test(c.type)?'DATE':keys.has(c.name)?'VARCHAR(191)':'LONGTEXT';
   const auto=c.pk&&columns.filter(v=>v.pk).length===1&&integer&&/AUTOINCREMENT/i.test(sql);
   let definition=quote(c.name)+' '+type+(c.notnull||c.pk?' NOT NULL':'')+(auto?' AUTO_INCREMENT':'');
   if(c.dflt_value!==null){const value=/^(DATETIME|TIMESTAMP)\(6\)$/i.test(type)?c.dflt_value.replace(/CURRENT_TIMESTAMP\b(?!\()/gi,'CURRENT_TIMESTAMP(6)'):c.dflt_value;definition+=' DEFAULT '+(type==='LONGTEXT'?'('+value+')':value);}
   return {name:c.name,type,definition};
  });
  const primary=columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
  const unique=[],regular=[];
  for(const ix of indexes){if(ix.origin==='pk')continue;const cols=raw.prepare('PRAGMA index_info('+quote(ix.name)+')').all().map(c=>c.name);if(cols.some(c=>!c))throw Error('Expression index requires explicit mapping: '+ix.name);
   if(ix.partial){if(ix.name!=='idx_retail_one_open_shift')throw Error('Partial index requires explicit mapping: '+ix.name);defs.push({name:'open_register_id',type:'BIGINT',definition:"`open_register_id` BIGINT GENERATED ALWAYS AS (CASE WHEN status='open' THEN register_id ELSE NULL END) STORED"});unique.push({name:ix.name,columns:['tenant_id','open_register_id']});}
   else (ix.unique?unique:regular).push({name:ix.name.startsWith('sqlite_autoindex_')?'uq_'+name+'_'+unique.length:ix.name,columns:cols});
  }
  const foreign=[];for(const id of new Set(fks.map(f=>f.id))){const group=fks.filter(f=>f.id===id).sort((a,b)=>a.seq-b.seq);foreign.push({name:'fk_'+name+'_'+id,table:group[0].table,columns:group.map(f=>f.from),references:group.map(f=>f.to||'id'),onDelete:group[0].on_delete,onUpdate:group[0].on_update});}
  result.push({name,columns:defs,primary,unique,indexes:regular,foreign,checks:checks(sql)});
 }
 const triggers=raw.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
 const catalog=new Migrator(raw).catalog().map(c=>c.version);raw.close();
 fs.mkdirSync(path.join(__dirname,'../src/database/mysql'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'../src/database/mysql/001-parity.json'),JSON.stringify({version:'001-parity',sqliteMigrations:catalog,tables:result,triggers},null,2)+'\n');
 console.log('MySQL manifest: '+result.length+' tables, '+triggers.length+' triggers.');
}
if(require.main===module)build().catch(()=>{console.error('Manifest could not be built.');process.exitCode=1;});
module.exports={build,checks};
