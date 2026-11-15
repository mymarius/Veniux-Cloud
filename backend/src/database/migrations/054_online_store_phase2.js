// Online mağaza Faz 2 (yalnız yeni tablolar): kiloyla satış ayarı, mağaza müşterileri (CRM), özel alan adı, merkezi paket doğrulama kaydı.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS online_product_measure (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      step REAL NOT NULL,
      min_qty REAL NOT NULL,
      PRIMARY KEY (tenant_id, product_id)
    );
    CREATE TABLE IF NOT EXISTS online_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      city TEXT,
      address TEXT,
      order_count INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      first_order_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_order_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      anonymized INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, phone)
    );
    CREATE INDEX IF NOT EXISTS online_customers_last ON online_customers(tenant_id, last_order_at);
    CREATE TABLE IF NOT EXISTS online_order_customers (
      order_id INTEGER PRIMARY KEY REFERENCES online_orders(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES online_customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS online_order_customers_customer ON online_order_customers(tenant_id, customer_id);
    CREATE TABLE IF NOT EXISTS online_domains (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      domain TEXT NOT NULL UNIQUE,
      verify_token TEXT NOT NULL,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cloud_pack_seen (
      authority_license_id INTEGER NOT NULL,
      pack TEXT NOT NULL,
      last_seen_epoch INTEGER NOT NULL,
      PRIMARY KEY (authority_license_id, pack)
    );
  `);
};
