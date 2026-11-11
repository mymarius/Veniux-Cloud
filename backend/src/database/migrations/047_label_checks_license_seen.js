// Mobil etiket kontrolü ve bulut lisans izi. Yalnız yeni tablolar eklenir (mevcut tablolara dokunulmaz).
//  - store_label_checks: personelin raf etiketi kontrolleri (etiket fiyatı / sistem fiyatı); sayaçlar ve hatalı etiket listesi bundan türetilir.
//  - cloud_license_seen: bulutta bir lisansın en son ne zaman (saniye) geçerli doğrulandığı. Mağaza yüklemesi, lisansı uzun süredir
//    doğrulanamayan hesaplarda durdurulur (lisans sunucusuna yüklemede ayrıca sorulmaz).
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_label_checks (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL,
      check_day TEXT NOT NULL,
      barcode TEXT NOT NULL,
      product_id INTEGER,
      product_name TEXT,
      shelf_price REAL NOT NULL,
      system_price REAL NOT NULL,
      ok INTEGER NOT NULL,
      user_id INTEGER,
      checked_at TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_store_label_checks_day ON store_label_checks(tenant_id,warehouse_id,check_day);
    CREATE TABLE IF NOT EXISTS cloud_license_seen (
      authority_license_id INTEGER PRIMARY KEY,
      last_valid_epoch INTEGER NOT NULL
    );
  `);
};
