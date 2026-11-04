-- 003_module_split.sql

CREATE TABLE IF NOT EXISTS tenant_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    allow_negative_stock BOOLEAN DEFAULT 0,
    min_stock_alert BOOLEAN DEFAULT 1,
    auto_reservation BOOLEAN DEFAULT 1,
    count_approval_required BOOLEAN DEFAULT 1,
    fefo_active BOOLEAN DEFAULT 1,
    expiry_warning_days INTEGER DEFAULT 90,
    lot_required BOOLEAN DEFAULT 1,
    serial_required BOOLEAN DEFAULT 0,
    quarantine_active BOOLEAN DEFAULT 1,
    cold_chain_active BOOLEAN DEFAULT 1,
    block_expired_receiving BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS quarantine_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    lot_number TEXT,
    serial_number TEXT,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'IN_REVIEW',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Note: ALTER TABLE in SQLite fails if column already exists.
-- But since it's a new migration, it should run once.
ALTER TABLE products ADD COLUMN module_type TEXT DEFAULT 'NORMAL';
ALTER TABLE warehouses ADD COLUMN warehouse_type TEXT DEFAULT 'NORMAL';
