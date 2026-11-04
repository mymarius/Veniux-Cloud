const fs=require('fs'),path=require('path');
const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../.local/mysql-test/config.json')));
if(config.host!=='127.0.0.1'||config.port!==33316||!/^veniux_test_[a-z_]+$/.test(config.database))throw Error('Unsafe MySQL test target');
Object.assign(process.env,{NODE_ENV:'test',VENIUX_MYSQL_TEST:'1',DB_ENGINE:'mysql',DB_HOST:config.host,DB_PORT:String(config.port),DB_USER:config.user,DB_PASSWORD:config.password,DB_NAME:config.database,VENIUX_DATA_DIR:path.resolve(__dirname,'../../../.local/mysql-test/app-data')});
