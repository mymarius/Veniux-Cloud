const fs = require('fs');
const cleanHeader = `const Database = require('better-sqlite3');
const path = require('path');
const fs_ = require('fs');
const bcrypt = require('bcrypt');
const { initMySQL, executeMySQLQuery, isMySQLConnected, getMySQLPool } = require('./mysqlAdapter');

const isTest = process.env.NODE_ENV === 'test';
const dbName = isTest ? 'stok_takip_test.db' : 'stok_takip.db';
const dbFilePath = path.join(__dirname, '../../', dbName);

if (isTest && dbFilePath.includes('stok_takip.db') && !dbFilePath.includes('test')) {
  throw new Error('Test run on production DB detected! Aborting.');
}

const db = new Database(dbFilePath, { timeout: 5000 });

try {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (e) {
  // Pragma catch
}

const Migrator = require('../database/migrator');
const migrator = new Migrator(db);
migrator.migrate().catch(err => console.error('Migration error:', err));

// Attempt MySQL connection on startup
initMySQL().catch(err => console.error('MySQL init error:', err));

module.exports = {
  query: async (text, params) => {
    // MySQL Fallback logic
    if (isMySQLConnected) {
      // ...
      let mysqlQuery = text;
      const mysqlParams = [];
      if (params) {
        let paramIndex = 1;
        mysqlQuery = text.replace(/\\$[0-9]+/g, () => {
          mysqlParams.push(params[paramIndex - 1]);
          paramIndex++;
          return '?';
        });
      }
      const [rows] = await executeMySQLQuery(mysqlQuery, mysqlParams);
      return { rows: Array.isArray(rows) ? rows : [rows], rowCount: rows.length || 0 };
    }

    // SQLite Logic
    const sqliteQuery = text.replace(/\\$[0-9]+/g, '?');
    const stmt = db.prepare(sqliteQuery);
    
    if (text.trim().toUpperCase().startsWith('SELECT')) {
      const rows = stmt.all(params || []);
      return { rows, rowCount: rows.length };
    } else {
      let info;
      try {
          info = stmt.run(params || []);
      } catch (err) {
          throw err;
      }
      return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  },
  connect: async () => ({
    query: async (text, params) => module.exports.query(text, params),
    release: () => {}
  }),
  getDb: () => db
};
`;

fs.writeFileSync('src/config/database.js', cleanHeader);
console.log('Successfully rebuilt database.js');
