// Şema 035: (1) satın alma siparişinde para birimi, (2) barkod sağlayıcı ayarı ve kalıcı kullanım sayacı,
// (3) ortak katalog (işletmelerin aynı barkod için verdiği adlar; yalnız en az 2 farklı işletme aynı barkodu girince yayımlanır; fiyat hiç saklanmaz),
// (4) işletmenin ortak kataloğa katkı tercihi. Yalnız ekleme: tablo/sütun eklenir, veri silinmez ve değiştirilmez.
module.exports = db => {
  const has = (table, name) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === name);
  if (!has('purchase_orders', 'currency')) db.exec("ALTER TABLE purchase_orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'TRY'");
  if (!has('tenants', 'catalog_sharing')) db.exec('ALTER TABLE tenants ADD COLUMN catalog_sharing INTEGER NOT NULL DEFAULT 1');
  db.exec(`
    CREATE TABLE IF NOT EXISTS barcode_provider_settings (
      provider_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL DEFAULT 100,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS barcode_provider_usage (
      day TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      tenant_id INTEGER NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      found INTEGER NOT NULL DEFAULT 0,
      missing INTEGER NOT NULL DEFAULT 0,
      errors INTEGER NOT NULL DEFAULT 0,
      limited INTEGER NOT NULL DEFAULT 0,
      cache_hits INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, provider_id, tenant_id)
    );
    CREATE TABLE IF NOT EXISTS shared_catalog_products (
      barcode TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      unit TEXT,
      category TEXT,
      tenants_count INTEGER NOT NULL DEFAULT 2,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS shared_catalog_votes (
      barcode TEXT NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      brand TEXT,
      unit TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (barcode, tenant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shared_catalog_votes_barcode ON shared_catalog_votes(barcode);
  `);
};
