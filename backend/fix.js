const fs = require('fs');
let c = fs.readFileSync('src/services/aiAnalysisService.js', 'utf8');
c = c.replace(/\\`/g, '`');
fs.writeFileSync('src/services/aiAnalysisService.js', c);
console.log('Fixed');
