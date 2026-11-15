// Online mağaza ek özellikleri (yalnız yeni tablolar): indirim kodları, kargo kuralları, sipariş ekleri (il, indirim, kargo bilgisi).
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS online_discount_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      kind TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      min_order REAL NOT NULL DEFAULT 0,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      starts_at DATETIME,
      ends_at DATETIME,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,code)
    );
    CREATE TABLE IF NOT EXISTS online_shipping_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cities TEXT NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      free_over REAL,
      position INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_online_shipping_rules_tenant ON online_shipping_rules(tenant_id,position);
    CREATE TABLE IF NOT EXISTS online_order_extras (
      order_id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      city TEXT,
      discount_code_id INTEGER,
      discount_code TEXT,
      discount_amount REAL NOT NULL DEFAULT 0,
      shipping_rule TEXT,
      carrier TEXT,
      tracking_no TEXT,
      shipped_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_online_order_extras_tenant ON online_order_extras(tenant_id,order_id);
  `);
};
