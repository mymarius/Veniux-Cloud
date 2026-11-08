// Trendyol cari hesap ekstresi kayıtları (satış, iade, indirim): komisyon ve satıcı hakedişi.
// Yalnız yeni tablo eklenir; kurulu masaüstü veritabanları güvenle yükseltilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      order_number TEXT,
      barcode TEXT,
      transaction_at DATETIME NOT NULL,
      amount_cents INTEGER NOT NULL,
      commission_cents INTEGER NOT NULL,
      revenue_cents INTEGER NOT NULL,
      payment_at DATETIME,
      UNIQUE(tenant_id,provider,entry_id)
    );
  `);
};
