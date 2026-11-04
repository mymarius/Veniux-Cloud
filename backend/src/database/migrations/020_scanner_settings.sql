CREATE TABLE IF NOT EXISTS scanner_settings (
 tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 config_json TEXT NOT NULL
);
