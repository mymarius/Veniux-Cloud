-- Additive only: existing sales and stock are never rewritten.
CREATE TABLE retail_product_media (
 tenant_id INTEGER NOT NULL, product_id INTEGER NOT NULL, image_path TEXT, brand TEXT,
 PRIMARY KEY(tenant_id,product_id)
);
CREATE TABLE retail_credit_accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, name TEXT NOT NULL,
 tax_number TEXT, address TEXT, limit_cents INTEGER NOT NULL DEFAULT 0 CHECK(limit_cents>=0),
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE retail_credit_entries (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, tenant_id INTEGER NOT NULL, account_id INTEGER NOT NULL,
 sale_id INTEGER, shift_id INTEGER, kind TEXT NOT NULL, amount_cents INTEGER NOT NULL,
 due_date TEXT, reason TEXT NOT NULL, user_id INTEGER NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(account_id) REFERENCES retail_credit_accounts(id)
);
CREATE INDEX idx_credit_account_entries ON retail_credit_entries(tenant_id,account_id,created_at,id);
CREATE INDEX idx_credit_sale ON retail_credit_entries(tenant_id,sale_id);
CREATE INDEX idx_retail_catalog_page ON products(tenant_id,module_type,id);
CREATE INDEX idx_retail_catalog_barcode ON products(tenant_id,barcode);
CREATE INDEX idx_retail_catalog_name ON products(tenant_id,name,id);
CREATE TABLE retail_external_operations (
 id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
 profile TEXT NOT NULL, action TEXT NOT NULL, amount_cents INTEGER NOT NULL,
 status TEXT NOT NULL, source_operation_id TEXT, business_date TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_retail_external_day ON retail_external_operations(tenant_id,business_date,id);
