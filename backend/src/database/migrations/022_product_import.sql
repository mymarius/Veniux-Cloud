CREATE TABLE IF NOT EXISTS product_import_batches (
 id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
 filename TEXT NOT NULL, parsed_json TEXT NOT NULL, preview_json TEXT, result_json TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_import_tenant ON product_import_batches(tenant_id,user_id);
