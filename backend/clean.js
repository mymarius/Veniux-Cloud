const fs = require('fs');
let t = fs.readFileSync('src/config/database.js', 'utf8');

const endOfInit = t.lastIndexOf('module.exports = {');
const restOfFile = t.substring(endOfInit);

const cleanHeader = `const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
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

`;

fs.writeFileSync('src/config/database.js', cleanHeader + restOfFile);
console.log('Cleaned database.js');
