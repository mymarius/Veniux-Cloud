ALTER TABLE tenants ADD COLUMN owner_phone TEXT;
CREATE TABLE IF NOT EXISTS assistant_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL,
 status TEXT NOT NULL, summary TEXT, sms_status TEXT DEFAULT 'not_requested',
 sms_job_id TEXT, started_at TEXT NOT NULL, finished_at TEXT,
 FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_assistant_runs_tenant ON assistant_runs(tenant_id,id);
