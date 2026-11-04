const {TABLES:all,INDEXES:allIndexes}=require('./mysqlSchema');
const names=new Set(require('../database/mysqlMigrator').manifest.tables.filter(t=>/^medicine/.test(t.name)).map(t=>t.name));
module.exports={TABLES:all.filter(sql=>[...names].some(n=>sql.startsWith('CREATE TABLE IF NOT EXISTS `'+n+'`'))),INDEXES:allIndexes.filter(ix=>names.has(ix.table))};
