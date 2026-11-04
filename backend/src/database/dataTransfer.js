const {manifest,quote:q,MySQLMigrator}=require('./mysqlMigrator');
const Database=require('better-sqlite3'),Migrator=require('./migrator');
const writableColumns=t=>t.columns.filter(c=>!c.definition.includes('GENERATED ALWAYS'));
function decimalText(value){const match=String(value).match(/^(-?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);if(!match)throw Error('Geçersiz ondalık değer.');const [,sign,integer,fraction='',exponent='0']=match,position=integer.length+Number(exponent),digits=integer+fraction;if(Math.abs(Number(exponent))>100)throw Error('Ondalık sınırı aşıldı.');let out=position<=0?'0.'+'0'.repeat(-position)+digits:position>=digits.length?digits+'0'.repeat(position-digits.length):digits.slice(0,position)+'.'+digits.slice(position);out=out.replace(/^0+(?=\d)/,'');return sign+out;}
function validatePayload(payload){
 if(payload?.format!=='veniux-mysql-data-1'||payload.schema!==JSON.stringify(manifest)||!Array.isArray(payload.tables)||payload.tables.length!==manifest.tables.length)throw Error('Yedek şeması bu kod sürümüyle uyumlu değil.');
 const names=new Set();for(const t of payload.tables){const expected=manifest.tables.find(v=>v.name===t.name);if(!expected||names.has(t.name)||JSON.stringify(t.columns)!==JSON.stringify(writableColumns(expected).map(c=>c.name))||!Array.isArray(t.rows)||t.rows.some(row=>!Array.isArray(row)||row.length!==t.columns.length||row.some(v=>v!==null&&!['string','number'].includes(typeof v))))throw Error('Yedek veri yapısı geçersiz.');names.add(t.name);}
 return payload;
}
async function snapshotMySQL(c){
 const [actual]=await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
 if(actual.some(t=>!manifest.tables.some(v=>v.name===t.TABLE_NAME)&&!['veniux_mysql_migrations','veniux_write_mutex','schema_migrations','migration_checksums'].includes(t.TABLE_NAME)))throw Error('Tanınmayan MySQL tabloları var; eksik yedek üretilemez.');
 const tables=[];for(const table of manifest.tables){const columns=writableColumns(table).map(v=>v.name);const [rows]=await c.query('SELECT '+columns.map(q).join(',')+' FROM '+q(table.name));tables.push({name:table.name,columns,rows:rows.map(r=>columns.map(col=>r[col]))});}
 return {format:'veniux-mysql-data-1',schema:JSON.stringify(manifest),created_at:new Date().toISOString(),tables};
}
function snapshotSQLite(source){
 const raw=new Database(source,{readonly:true,fileMustExist:true});raw.defaultSafeIntegers(true);
 try{raw.pragma('query_only=ON');raw.pragma('trusted_schema=OFF');raw.exec('BEGIN');
  const status=new Migrator(raw).status();if(status.status!=='current')throw Error('Kaynak SQLite migrationları güncel olmalı; aktarım kaynak veriyi değiştirmez.');
  if(raw.pragma('integrity_check',{simple:true})!=='ok'||raw.pragma('foreign_key_check').length)throw Error('Kaynak SQLite bütünlüğü başarısız.');
  const tables=manifest.tables.map(t=>{const definitions=writableColumns(t),columns=definitions.map(c=>c.name);const expressions=definitions.map(c=>c.type.startsWith('DECIMAL')?'CAST('+q(c.name)+' AS TEXT) AS '+q(c.name):q(c.name));const rows=raw.prepare('SELECT '+expressions.join(',')+' FROM '+q(t.name)).all();return {name:t.name,columns,rows:rows.map(r=>columns.map(col=>typeof r[col]==='bigint'?r[col].toString():r[col]))};});
  raw.exec('COMMIT');return {format:'veniux-mysql-data-1',schema:JSON.stringify(manifest),created_at:new Date().toISOString(),tables};
 }finally{raw.close();}
}
async function restoreEmptyTarget(c,payload,options={}){
 validatePayload(payload);const [existing]=await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');if(existing.length)throw Error('Geri yükleme yalnız ayrı, boş hedef veritabanına uygulanır.');
 return new MySQLMigrator(c).migrate({load:async connection=>{
  await connection.beginTransaction();try{
   for(const t of payload.tables){const definition=manifest.tables.find(v=>v.name===t.name),placeholders=t.columns.map(()=>'?').join(',');for(const row of t.rows){
    const values=row.map((value,i)=>{
     const column=definition.columns.find(v=>v.name===t.columns[i]);if(value===null)return value;
     if(column.type.startsWith('DECIMAL')){
      const raw=decimalText(value);if(raw.replace(/^-/,'').split('.')[0].replace(/^0+/,'').length>18||/\.\d{6}[0-9]*[1-9][0-9]*$/.test(raw))throw Error('Tutar veya miktar hassasiyeti korunamıyor; aktarım reddedildi.');return raw;
     }
     if(/^(DATETIME|TIMESTAMP)(?:\(6\))?$/i.test(column.type)&&typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*Z$/.test(value))return value.replace('T',' ').replace(/Z$/,'');
     return value;
    });
    await connection.query('INSERT INTO '+q(t.name)+'('+t.columns.map(q).join(',')+') VALUES('+placeholders+')',values);
   }}
   await options.beforeCommit?.(connection);await connection.commit();
  }catch(e){await connection.rollback();throw e;}
 }});
}
module.exports={snapshotMySQL,snapshotSQLite,restoreEmptyTarget,validatePayload,decimalText};
