// İşletmenin kendi marka adı ve logosu (programda, kasada ve fişte kullanılır). Yalnız yeni tablo.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant_branding (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      brand_name TEXT,
      logo_mime TEXT,
      logo_data TEXT,
      logo_width INTEGER,
      logo_height INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
