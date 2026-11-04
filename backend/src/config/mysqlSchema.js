// Compatibility exports for existing inspection commands. Startup never executes DDL.
const {manifest,quote:q}=require('../database/mysqlMigrator');
const columns=names=>names.map(q).join(',');
const TABLES=manifest.tables.map(t=>'CREATE TABLE IF NOT EXISTS '+q(t.name)+'('+[...t.columns.map(c=>c.definition),...(t.primary.length?['PRIMARY KEY('+columns(t.primary)+')']:[]),...t.unique.map(ix=>'UNIQUE KEY '+q(ix.name)+'('+columns(ix.columns)+')'),...t.checks.map((check,i)=>'CONSTRAINT '+q('ck_'+t.name+'_'+i)+' CHECK('+check+')'),...t.foreign.map(fk=>'CONSTRAINT '+q(fk.name)+' FOREIGN KEY('+columns(fk.columns)+') REFERENCES '+q(fk.table)+'('+columns(fk.references)+') ON DELETE '+fk.onDelete+' ON UPDATE '+fk.onUpdate)].join(',')+') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin');
const INDEXES=manifest.tables.flatMap(t=>t.indexes.map(ix=>({name:ix.name,table:t.name,cols:columns(ix.columns)})));
module.exports={TABLES,INDEXES};
