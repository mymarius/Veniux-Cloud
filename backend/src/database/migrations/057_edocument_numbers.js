// e-Belge resmî numara serisi: işletme + seri + yıl içinde ardışık, tekrar edemez (UNIQUE). Yalnız yeni tablo.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS edocument_numbers (
      document_id TEXT PRIMARY KEY REFERENCES edocuments(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      series TEXT NOT NULL,
      year INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      number TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,series,year,seq)
    );
  `);
};
