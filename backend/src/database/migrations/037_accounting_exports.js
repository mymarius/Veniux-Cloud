// Muhasebe aktarım paketleri. active_key, bir kaydın aynı anda iki geçerli pakette bulunmasını engeller.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounting_exports (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      export_type TEXT NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      status TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      imported_at DATETIME,
      cancelled_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS accounting_export_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      export_id TEXT NOT NULL REFERENCES accounting_exports(id) ON DELETE CASCADE,
      export_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      active_key TEXT,
      UNIQUE(tenant_id,export_type,active_key)
    );
    CREATE TABLE IF NOT EXISTS accounting_account_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      map_key TEXT NOT NULL,
      account_code TEXT NOT NULL,
      UNIQUE(tenant_id,map_key)
    );
  `);
};
