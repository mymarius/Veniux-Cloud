/** Seed yazarken sütun adlarını birebir görmek için şema dökümü. */
const { initMySQL, getMySQLPool } = require('../src/config/mysqlAdapter');

const WANTED = process.argv.slice(2);

(async () => {
  await initMySQL();
  const pool = getMySQLPool();
  const [rows] = await pool.query(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_TYPE AS ty, IS_NULLABLE AS n, COLUMN_DEFAULT AS d
     FROM information_schema.COLUMNS WHERE table_schema = DATABASE()
     ${WANTED.length ? `AND TABLE_NAME IN (${WANTED.map(() => '?').join(',')})` : ''}
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    WANTED
  );
  const byTable = {};
  for (const r of rows) {
    (byTable[r.t] ||= []).push(`${r.c}:${r.ty}${r.n === 'NO' ? '!' : ''}`);
  }
  for (const [t, cols] of Object.entries(byTable)) {
    console.log(`\n${t}\n  ${cols.join('  ')}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
