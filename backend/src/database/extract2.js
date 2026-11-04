const fs = require('fs');
let t = fs.readFileSync('src/config/database.js', 'utf8');

const match = t.match(/db\.exec\(\`([\s\S]*?)\`\);/);
if (match) {
  let schema = match[1];
  fs.writeFileSync('src/database/migrations/001_initial.sql', schema);
  console.log('Successfully wrote 001_initial.sql');
} else {
  console.log('Failed to find db.exec');
}
