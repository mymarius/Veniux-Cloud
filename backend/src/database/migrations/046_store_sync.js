// Mağaza–bulut eşitleme (Aşama 1, tek yön): mağazadan buluta satış yükleme.
// Yalnız yeni tablolar eklenir. Bulut, mağaza satışlarını kendi satışlarından AYRI tutar (çifte sayım olmaz, bulut stoğu değişmez).
//  - store_sync_devices: buluttaki işletme için üretilen, iptal edilebilir cihaz anahtarları (yalnız SHA-256 özeti saklanır).
//  - store_sync_sales / store_sync_shifts: mağazadan gelen satış ve vardiya (açılış, kapanış, nakit giriş/çıkış=gider) kopyaları; değişince güncellenir.
//  - store_sync_config / store_sync_sent: mağaza (masaüstü) tarafında bulut adresi, anahtar ve gönderilen satışların izi.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_sync_devices (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME,
      revoked_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_store_sync_devices_tenant ON store_sync_devices(tenant_id);
    CREATE TABLE IF NOT EXISTS store_sync_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      remote_sale_id INTEGER NOT NULL,
      receipt_no TEXT NOT NULL,
      business_date TEXT NOT NULL,
      sold_at TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_method TEXT,
      total_amount REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      net_amount REAL NOT NULL,
      snapshot_json TEXT NOT NULL,
      snapshot_hash TEXT NOT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,device_id,remote_sale_id)
    );
    CREATE INDEX IF NOT EXISTS idx_store_sync_sales_day ON store_sync_sales(tenant_id,business_date);
    CREATE TABLE IF NOT EXISTS store_sync_config (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      cloud_url TEXT NOT NULL,
      device_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at DATETIME,
      last_error TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS store_sync_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      remote_shift_id INTEGER NOT NULL,
      register_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_cash_cents INTEGER NOT NULL DEFAULT 0,
      cash_in_cents INTEGER NOT NULL DEFAULT 0,
      cash_out_cents INTEGER NOT NULL DEFAULT 0,
      closing_json TEXT,
      row_hash TEXT NOT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,device_id,remote_shift_id)
    );
    CREATE TABLE IF NOT EXISTS store_sync_sent (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      snapshot_hash TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(tenant_id,kind,ref_id)
    );
  `);
};
