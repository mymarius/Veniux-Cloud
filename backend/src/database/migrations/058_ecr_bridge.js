// ÖKC (yazarkasa) köprüsü: cihaz tanımı ve satış başına mali fiş işi. Yalnız yeni tablolar.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecr_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      register_id INTEGER,
      brand TEXT NOT NULL,
      connection TEXT NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ecr_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      device_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'sale',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      fiscal_receipt_no TEXT,
      z_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      done_at DATETIME,
      UNIQUE(tenant_id, sale_id, kind)
    );
  `);
};
