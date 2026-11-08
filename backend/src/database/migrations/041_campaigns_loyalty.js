// Kasa kampanyaları (X al Y öde, yüzde indirim; tarih aralığı) ve basit puan sadakati.
// Yalnız yeni tablolar eklenir; kurulu masaüstü veritabanları güvenle yükseltilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS retail_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      buy_qty INTEGER,
      pay_qty INTEGER,
      percent INTEGER,
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS retail_loyalty_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      card_no TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,card_no)
    );
    CREATE TABLE IF NOT EXISTS retail_loyalty_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      card_id INTEGER NOT NULL REFERENCES retail_loyalty_cards(id) ON DELETE CASCADE,
      sale_id INTEGER,
      kind TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
