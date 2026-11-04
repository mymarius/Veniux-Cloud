module.exports=db=>{
 if(!db.prepare('PRAGMA table_info(ai_summary_logs)').all().some(c=>c.name==='tenant_id'))db.exec('ALTER TABLE ai_summary_logs ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
};
