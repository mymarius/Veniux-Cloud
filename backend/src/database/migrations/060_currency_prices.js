// Dövizli fiyat: işletmenin girdiği kurlar ve ürün başına döviz cinsinden fiyat. Satışta fiyat güncel kurla TL'ye çevrilir. Yalnız yeni tablolar.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      rate_try DECIMAL(24,6) NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, currency)
    );
    CREATE TABLE IF NOT EXISTS product_currency_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      price DECIMAL(24,6) NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, product_id)
    );
  `);
};
