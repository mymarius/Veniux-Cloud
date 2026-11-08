// Pazaryeri ek ayarları: aşırı satışa karşı güvenlik payı, fiyat gönderimi, gönderilen fiyatlar ve işlenen iadeler.
// Mevcut tablolara sütun eklenmez; kurulu masaüstü veritabanları yalnız yeni tabloyu güvenle ekleyebilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      stock_buffer INTEGER NOT NULL DEFAULT 0,
      price_sync INTEGER NOT NULL DEFAULT 0,
      UNIQUE(tenant_id,provider)
    );
    CREATE TABLE IF NOT EXISTS marketplace_price_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price_cents INTEGER NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,provider,product_id)
    );
    CREATE TABLE IF NOT EXISTS marketplace_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      claim_item_id TEXT NOT NULL,
      order_number TEXT,
      barcode TEXT,
      status TEXT NOT NULL,
      stock_state TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,provider,claim_item_id)
    );
  `);
};
