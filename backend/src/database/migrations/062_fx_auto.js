// Otomatik döviz kuru (TCMB): işletme başına açık/kapalı ayarı ve kurun kaynağı (otomatik/elle). Yalnız yeni tablolar.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rate_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      auto_enabled INTEGER NOT NULL DEFAULT 0,
      last_fetch_at DATETIME,
      last_status TEXT,
      last_error TEXT,
      rates_date TEXT,
      UNIQUE(tenant_id)
    );
    CREATE TABLE IF NOT EXISTS exchange_rate_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      buying_try DECIMAL(24,6),
      rates_date TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, currency)
    );
  `);
};
