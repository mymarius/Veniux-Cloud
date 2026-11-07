// e-Belge altyapısı. Hesap bilgileri şifreli saklanır; active_key aynı satışa ikinci geçerli belgeyi engeller.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS edocument_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      credentials_enc TEXT NOT NULL,
      last_test_at DATETIME,
      last_test_ok INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id)
    );
    CREATE TABLE IF NOT EXISTS edocuments (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sale_id TEXT NOT NULL,
      active_key TEXT,
      document_type TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      provider_detail TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,active_key)
    );
    CREATE TABLE IF NOT EXISTS edocument_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES edocuments(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      detail TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
