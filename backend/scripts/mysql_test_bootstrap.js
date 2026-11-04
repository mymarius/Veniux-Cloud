// Only for the private, loopback test server at 33316. No production env read.
const mysql=require('mysql2/promise'),crypto=require('crypto'),fs=require('fs'),path=require('path');
async function run(){
 const c=await mysql.createConnection({host:'127.0.0.1',port:33316,user:'root',password:''});
 const [server]=await c.query('SELECT @@datadir AS data');
 const expected=path.resolve(__dirname,'../../.local/mysql-test/data');
 if(path.resolve(server[0].data).toLowerCase()!==expected.toLowerCase()){await c.end();throw Error('Test sunucusunun veri yolu eşleşmiyor.');}
 const password=crypto.randomBytes(24).toString('base64url');
 try{
  await c.query("CREATE USER IF NOT EXISTS 'veniux_test'@'127.0.0.1' IDENTIFIED BY ?",[password]);
  await c.query("ALTER USER 'veniux_test'@'127.0.0.1' IDENTIFIED BY ?",[password]);
  await c.query('CREATE DATABASE IF NOT EXISTS veniux_test_parity CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
  await c.query("GRANT ALL ON veniux_test_parity.* TO 'veniux_test'@'127.0.0.1'");
  await c.query('CREATE DATABASE IF NOT EXISTS veniux_test_import CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
  await c.query("GRANT ALL ON veniux_test_import.* TO 'veniux_test'@'127.0.0.1'");
  for(const name of ['veniux_test_rc2_fault','veniux_test_rc2_restore']){
   await c.query('CREATE DATABASE IF NOT EXISTS '+name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
   await c.query('GRANT ALL ON '+name+".* TO 'veniux_test'@'127.0.0.1'");
  }
  // Hesap ayrımı testleri bu sabit, yalnız teste özel hesapları kullanır (tests/mysql/cutoverAndIntegrity.test.js).
  for(const [user,secret,rights] of [['veniux_migrator_test','VnxMigratorTest2026!','SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP,TRIGGER'],['veniux_runtime_test','VnxRuntimeTest2026!','SELECT,INSERT,UPDATE,DELETE']]){
   await c.query("CREATE USER IF NOT EXISTS ?@'127.0.0.1' IDENTIFIED BY ?",[user,secret]);
   for(const name of ['veniux_test_parity','veniux_test_import'])await c.query('GRANT '+rights+' ON '+name+".* TO ?@'127.0.0.1'",[user]);
  }
  const target=path.resolve(__dirname,'../../.local/mysql-test/config.json');
  fs.writeFileSync(target,JSON.stringify({host:'127.0.0.1',port:33316,user:'veniux_test',password,database:'veniux_test_parity',dateStrings:true,decimalNumbers:false}),{mode:0o600});
  // Disable the temporary bootstrap account after creating the test account.
  await c.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[crypto.randomBytes(32).toString('base64url')]);
 }finally{await c.end();}
 console.log('Ayrı MySQL test hesabı hazır. Sırlar yalnız yerel test ayarındadır.');
}
run().catch(()=>{console.error('Test MySQL başlangıcı başarısız.');process.exitCode=1;});
