// Pazaryeri bağlantıları. API anahtarları yalnızca şifreli saklanır; her paket firma başına bir kez işlenir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      credentials_enc TEXT NOT NULL,
      environment TEXT NOT NULL,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      enabled INTEGER NOT NULL DEFAULT 1,
      orders_since DATETIME NOT NULL,
      last_batch_id TEXT,
      last_sync_at DATETIME,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,provider)
    );
    CREATE TABLE IF NOT EXISTS marketplace_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      package_id TEXT NOT NULL,
      order_number TEXT,
      status TEXT NOT NULL,
      stock_state TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,provider,package_id)
    );
    CREATE TABLE IF NOT EXISTS marketplace_stock_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,provider,product_id)
    );
  `);
};
