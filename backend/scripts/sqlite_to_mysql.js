const path=require('path'),mysql=require('mysql2/promise');
const {snapshotSQLite,restoreEmptyTarget}=require('../src/database/dataTransfer');
const {getMySQLConfig}=require('../src/config/mysqlAdapter');
async function run(){
  const args=process.argv.slice(2),source=args[args.indexOf('--source')+1];
  if(!args.includes('--source')||!source||!path.isAbsolute(source)||!args.includes('--confirm-empty-target'))throw Error('Mutlak --source yolu ve --confirm-empty-target gerekli.');
  const payload=snapshotSQLite(source),c=await mysql.createConnection(getMySQLConfig());
  try{
    if(args.includes('--clean-interrupted-target')){
      const [mig]=await c.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='veniux_mysql_migrations'").catch(()=>[[]]);
      if(mig.length){
        const [rows]=await c.query("SELECT state FROM veniux_mysql_migrations");
        if(rows.some(r=>r.state==='failed')){
          await c.query('SET FOREIGN_KEY_CHECKS=0');
          const [tables]=await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
          for(const t of tables)await c.query('DROP TABLE `'+t.TABLE_NAME+'`');
          await c.query('SET FOREIGN_KEY_CHECKS=1');
        }
      }
    }
    await restoreEmptyTarget(c,payload);
    console.log('SQLite aktarımı tamamlandı; kimlikler ve ilişkiler doğrulandı. Kaynak değiştirilmedi.');
  }finally{await c.end();}
}
if(require.main===module)run().catch(()=>{console.error('Aktarım tamamlanmadı. Kaynak korundu, başarısız hedef operasyonlara kapalıdır.');process.exitCode=1;});
module.exports={run};
