process.env.DB_ENGINE='sqlite';
const db=require('../src/config/database');
require('../src/services/medicines/manufacturerImages').sync({dryRun:process.argv.includes('--dry-run')})
 .then(result=>{console.log(JSON.stringify(result,null,2));db.getDb().close();})
 .catch(error=>{console.error(error.message);db.getDb().close();process.exitCode=1;});
