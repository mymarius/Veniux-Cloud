const fs = require('fs');
let t = fs.readFileSync('src/config/database.js', 'utf8');
const start = t.indexOf('CREATE TABLE IF NOT EXISTS tenants');
const end = t.lastIndexOf(');', t.indexOf('// Insert seed data if not exists'));
let schema = t.substring(start, end + 2);
schema = schema.replace(/\\`/g, '');
fs.writeFileSync('src/database/migrations/001_initial.sql', schema);
