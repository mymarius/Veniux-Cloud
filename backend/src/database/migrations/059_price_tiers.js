// Fiyat türleri: ürün başına 2. (toptan) ve 3. (özel) satış fiyatı. Fiyat 1 ürünün normal satış fiyatıdır. Yalnız yeni tablo.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_price_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      tier INTEGER NOT NULL,
      price DECIMAL(24,6) NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, product_id, tier)
    );
  `);
};
