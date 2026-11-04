// Mevcut MySQL veritabanında stok/defter farkını gösterir; --apply ile açılış kayıtlarını yazar. Önce yedek alın.
const mysql = require('mysql2/promise');
const { getMySQLConfig } = require('../src/config/mysqlAdapter');
const { DRIFT_SQL, BACKFILL_SQL } = require('../src/database/migrations/034_ledger_opening_balance');

async function run() {
  const connection = await mysql.createConnection(getMySQLConfig());
  try {
    const [before] = await connection.query(DRIFT_SQL);
    console.log(JSON.stringify({ drifted: before.length }));
    if (!process.argv.includes('--apply') || !before.length) return;
    await connection.query(BACKFILL_SQL);
    const [after] = await connection.query(DRIFT_SQL);
    console.log(JSON.stringify({ written: before.length, drifted: after.length }));
    if (after.length) process.exitCode = 1;
  } finally { await connection.end(); }
}
if (require.main === module) run().catch(error => { console.error('Defter açılış kaydı başarısız:', error.message); process.exitCode = 1; });
