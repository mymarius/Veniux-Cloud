// Generates an additive MySQL schema version from an in-memory SQLite schema.
const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'../../backend/src/database/mysql'),first=path.join(dir,'001-parity.json'),before=fs.readFileSync(first);
(async()=>{try{await require('../../backend/scripts/build_mysql_manifest').build();const next=JSON.parse(fs.readFileSync(first,'utf8'));next.version='002-retail-pro';fs.writeFileSync(path.join(dir,'002-retail-pro.json'),JSON.stringify(next,null,2)+'\n');console.log('Prepared 002-retail-pro; existing 001 remains unchanged.');}finally{fs.writeFileSync(first,before);}})().catch(()=>{console.error('Manifest generation failed safely.');process.exitCode=1;});
