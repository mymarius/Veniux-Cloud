CREATE TABLE IF NOT EXISTS pharmacy_depot_balances (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id INTEGER NOT NULL REFERENCES tenants(id),
 lot_id INTEGER NOT NULL REFERENCES inventory_lots(id),
 warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
 UNIQUE(tenant_id, lot_id, warehouse_id)
);
CREATE TABLE IF NOT EXISTS workspace_collections (
 tenant_id INTEGER NOT NULL REFERENCES tenants(id),
 scope TEXT NOT NULL,
 name TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 payload TEXT NOT NULL DEFAULT '[]',
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(tenant_id, scope, name)
);
CREATE TABLE IF NOT EXISTS depot_operation_keys (
 tenant_id INTEGER NOT NULL REFERENCES tenants(id),
 operation_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 result_json TEXT NOT NULL,
 PRIMARY KEY(tenant_id, operation_key)
);
