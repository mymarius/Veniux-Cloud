const mysql=require('mysql2/promise'),fs=require('fs'),path=require('path');
const {getMySQLConfig}=require('../src/config/mysqlAdapter');
const {MySQLMigrator}=require('../src/database/mysqlMigrator');
async function run(){const config=getMySQLConfig(),c=await mysql.createConnection(config);try{const m=new MySQLMigrator(c);if(process.argv.includes('--apply')){if(!process.argv.includes('--confirm-target'))throw Error('Hedef veritabanını doğrulamak için --confirm-target gerekli.');await m.migrate({upgradeCopy:process.argv.includes('--upgrade-safety-copy')});}const state=await m.status();
 if(process.argv.includes('--record-deployment')){
  if(state.status!=='current'||!process.argv.includes('--confirm-target')||!process.env.VENIUX_DATA_DIR||!path.isAbsolute(process.env.VENIUX_DATA_DIR))throw Error('Güncel MySQL hedefi, kalıcı veri klasörü ve --confirm-target gerekli.');
  const data=process.env.VENIUX_DATA_DIR,env=require('node:util').parseEnv(fs.readFileSync(path.join(data,'install.env'),'utf8'));
  if(env.DB_ENGINE!=='mysql'||env.DB_NAME!==config.database||env.DB_HOST!==config.host||Number(env.DB_PORT||3306)!==config.port)throw Error('Kurulum ayarları doğrulanan MySQL hedefiyle eşleşmiyor.');
  require('../src/config/runtimeConfig').validate({...env,NODE_ENV:'production'});
  const release=require('../src/services/deploymentService').lock(data);
  try{const target=path.join(data,'deployment.json');fs.writeFileSync(target+'.tmp',JSON.stringify({status:'ready',engine:'mysql',app_version:require('../package.json').version,mysql_schema_spec:JSON.stringify(require('../src/database/mysqlMigrator').manifest),completed_at:new Date().toISOString()}),{mode:0o600});fs.renameSync(target+'.tmp',target);}finally{release();}
 }
 console.log(JSON.stringify(state));}finally{await c.end();}}
if(require.main===module)run().catch(e=>{console.error(e.code==='MYSQL_MIGRATION_REQUIRED'?e.message:'MySQL migration başarısız. Hedef kapalı tutuldu; ayrı kopyadaki hata kayıtlarını inceleyin.');process.exitCode=1;});
module.exports={run};
