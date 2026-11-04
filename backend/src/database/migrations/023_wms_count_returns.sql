CREATE TABLE IF NOT EXISTS wms_count_reviews (
 id TEXT PRIMARY KEY,tenant_id INTEGER NOT NULL,operator_id INTEGER NOT NULL,
 warehouse_id INTEGER NOT NULL,location_id INTEGER NOT NULL,product_id INTEGER NOT NULL,lot_id INTEGER,
 system_qty REAL NOT NULL,counted_qty REAL NOT NULL,snapshot_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',approved_by INTEGER,reason TEXT,result_json TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,approved_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_wms_count_reviews_tenant ON wms_count_reviews(tenant_id,status);
CREATE TABLE IF NOT EXISTS inventory_return_holds (
 id TEXT PRIMARY KEY,tenant_id INTEGER NOT NULL,product_id INTEGER NOT NULL,warehouse_id INTEGER NOT NULL,
 location_id INTEGER,lot_id INTEGER,quantity REAL NOT NULL CHECK(quantity>0),disposition TEXT NOT NULL,
 user_id INTEGER NOT NULL,sale_id INTEGER,line_id INTEGER,created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_return_holds_scope ON inventory_return_holds(tenant_id,product_id,warehouse_id,lot_id);
