// İlaç Veritabanı modülü: tüm işletmelerin ortak kullandığı referans ilaç kataloğu.
// Mevcut tablolara dokunmaz; yalnızca yeni tablolar ve indeksler ekler.
// Geri alma: `node scripts/rollback_medicine_catalog.js --confirm` (otomatik çalışmaz).

const up = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      gtin TEXT,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      search_text TEXT NOT NULL,
      active_ingredient TEXT,
      normalized_ingredient TEXT,
      dosage TEXT,
      pharmaceutical_form TEXT,
      package_size TEXT,
      manufacturer TEXT,
      company TEXT,
      normalized_company TEXT,
      prescription_type TEXT,
      atc_code TEXT,
      market_status TEXT NOT NULL DEFAULT 'active',
      price REAL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      image_url TEXT,
      image_local_path TEXT,
      image_source TEXT,
      image_verified INTEGER NOT NULL DEFAULT 0,
      kub_url TEXT,
      kt_url TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_url TEXT,
      manual_override INTEGER NOT NULL DEFAULT 0,
      data_hash TEXT,
      last_seen_sync_id INTEGER,
      last_synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_medicines_gtin ON medicines(gtin);
    CREATE INDEX IF NOT EXISTS idx_medicines_normalized_name ON medicines(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_medicines_ingredient ON medicines(normalized_ingredient);
    CREATE INDEX IF NOT EXISTS idx_medicines_company ON medicines(normalized_company);
    CREATE INDEX IF NOT EXISTS idx_medicines_atc ON medicines(atc_code);
    CREATE INDEX IF NOT EXISTS idx_medicines_status ON medicines(market_status);
    CREATE INDEX IF NOT EXISTS idx_medicines_source ON medicines(source, last_seen_sync_id);

    CREATE TABLE IF NOT EXISTS medicine_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      total INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0,
      unchanged INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      deactivated INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      error_message TEXT,
      details TEXT,
      triggered_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_medicine_sync_logs_status ON medicine_sync_logs(status, started_at);

    CREATE TABLE IF NOT EXISTS medicine_catalog_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

// Yalnızca açıkça çağrıldığında kullanılır; tüm katalog verisini siler.
const down = db => {
  db.exec(`
    DROP TABLE IF EXISTS medicine_catalog_settings;
    DROP TABLE IF EXISTS medicine_sync_logs;
    DROP TABLE IF EXISTS medicines;
  `);
};

module.exports = up;
module.exports.up = up;
module.exports.down = down;
