const fs = require('fs');
const path = require('path');
const dbPath = process.env.TEST_SQLITE_PATH ? path.resolve(process.env.TEST_SQLITE_PATH) : path.join(__dirname, '../stok_takip_test.db');

beforeAll(() => {
  if(process.env.VENIUX_MYSQL_TEST==='1'&&process.env.DB_ENGINE==='mysql')return;
  // We don't delete the test DB here, migrator handles schema.
  // But we can clear tables to ensure a clean state per test suite.
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  try {
    db.exec('PRAGMA foreign_keys = OFF;');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migrations','migration_checksums')").all();
    db.exec('BEGIN TRANSACTION');
    for (const table of tables) {
      db.exec(`DELETE FROM ${table.name}`);
    }
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (err) {
    if(db.inTransaction) db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }
});
