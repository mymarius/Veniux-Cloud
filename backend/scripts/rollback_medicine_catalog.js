// İlaç Veritabanı migration'ını geri alır (008_medicine_catalog.js).
// DİKKAT: medicines, medicine_sync_logs ve medicine_catalog_settings tablolarını
// ve içindeki tüm verileri siler. Yalnızca --confirm ile çalışır; uygulama
// açılışında veya testlerde otomatik çalıştırılmaz.
if (!process.argv.includes('--confirm')) {
  console.error('Bu işlem ilaç kataloğu tablolarını kalıcı olarak siler. Onaylamak için: node scripts/rollback_medicine_catalog.js --confirm');
  process.exit(1);
}
const path = require('path');
const Database = require('better-sqlite3');
const { down } = require('../src/database/migrations/008_medicine_catalog');

const db = new Database(path.join(__dirname, '..', process.env.NODE_ENV === 'test' ? 'stok_takip_test.db' : 'stok_takip.db'));
db.transaction(() => {
  down(db);
  db.prepare('DELETE FROM schema_migrations WHERE version IN (?, ?)').run('008_medicine_catalog.js', '009_medicine_license.js');
})();
db.close();
console.log('İlaç Veritabanı tabloları kaldırıldı. Uygulama yeniden başlatılırsa migration tekrar uygulanır.');
