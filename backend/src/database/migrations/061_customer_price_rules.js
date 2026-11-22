// Müşteri fiyat kuralı: cari hesaba bağlı fiyat türü (1 perakende, 2 toptan, 3 özel) ve yüzde iskonto. Yalnız yeni tablo.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_price_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES retail_credit_accounts(id) ON DELETE CASCADE,
      price_tier INTEGER NOT NULL DEFAULT 1,
      discount_percent DECIMAL(24,6) NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, account_id)
    );
  `);
};
