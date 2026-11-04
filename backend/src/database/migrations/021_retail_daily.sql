CREATE TABLE IF NOT EXISTS retail_sales (
 sale_id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
 business_date TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(sale_id) REFERENCES pos_sales(id), FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS retail_reversals (
 id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, sale_id INTEGER NOT NULL, kind TEXT NOT NULL,
 business_date TEXT NOT NULL, amount_cents INTEGER NOT NULL, data_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(sale_id) REFERENCES pos_sales(id)
);
CREATE TABLE IF NOT EXISTS retail_cashier_permissions (
 tenant_id INTEGER NOT NULL, user_id INTEGER NOT NULL, permissions_json TEXT NOT NULL, PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE IF NOT EXISTS retail_day_closings (
 id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL, business_date TEXT NOT NULL,
 user_id INTEGER NOT NULL, data_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant_id,warehouse_id,business_date)
);
CREATE INDEX IF NOT EXISTS idx_retail_sales_day ON retail_sales(tenant_id,warehouse_id,business_date);
CREATE INDEX IF NOT EXISTS idx_retail_reversals_day ON retail_reversals(tenant_id,business_date);
