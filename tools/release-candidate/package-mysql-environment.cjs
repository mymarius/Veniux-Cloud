const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../.local/product-packages'),file=path.resolve(process.env.VENIUX_RC2_MYSQL_CONFIG||'');
if(path.dirname(file)!==root||path.basename(file)!=='mysql-config.json')throw Error('Unsafe RC2 test config');
const c=JSON.parse(fs.readFileSync(file));
if(c.host!=='127.0.0.1'||c.database!=='veniux_test_rc2'||c.port<1024||c.user!=='rc2_test')throw Error('Unsafe RC2 MySQL target');
Object.assign(process.env,{NODE_ENV:'test',VENIUX_MYSQL_TEST:'1',DB_ENGINE:'mysql',DB_HOST:c.host,DB_PORT:String(c.port),DB_USER:c.user,DB_PASSWORD:c.password,DB_NAME:c.database,VENIUX_DATA_DIR:path.join(root,'mysql-app'),VENIUX_DISABLE_BACKGROUND_JOBS:'1'});
