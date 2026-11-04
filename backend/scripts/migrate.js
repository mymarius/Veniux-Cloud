if(process.env.DB_ENGINE==='mysql'){require('./mysql_migrate').run().catch(()=>{console.error('MySQL migration tamamlanmadı; hedef kapalı tutuldu.');process.exitCode=1;});}else if(process.env.NODE_ENV==='production'){console.error('Üretimde Update-Windows.ps1 kullanın; yedeksiz migration çalıştırılmaz.');process.exitCode=1;}else{
// SQLite migrations are also applied automatically at application startup.
if (process.env.DB_ENGINE && process.env.DB_ENGINE !== 'sqlite') {
  console.error('Bu komut yalnızca DB_ENGINE=sqlite için desteklenir. MySQL migration doğrulaması gereklidir.');
  process.exitCode = 1;
} else {
  process.env.DB_ENGINE = 'sqlite';
  const database = require('../src/config/database');
  database.ready.then(() => {
    database.getDb().close();
    console.log('SQLite migration işlemleri tamamlandı.');
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

}
