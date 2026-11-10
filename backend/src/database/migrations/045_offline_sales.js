// Çevrimdışı kasa satışları: sunucuya sonradan gelen satışın geçici fiş izi ve stok uyuşmazlığı kayıtları.
// Yalnız yeni tablolar eklenir (mevcut tablolara sütun eklenmez); kurulu masaüstü veritabanları güvenle yükseltilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pos_offline_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sale_id INTEGER NOT NULL,
      emergency_receipt_no TEXT NOT NULL,
      offline_at TEXT NOT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      conflict_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(tenant_id,sale_id),
      UNIQUE(tenant_id,emergency_receipt_no)
    );
    CREATE TABLE IF NOT EXISTS pos_offline_conflicts (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sale_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'stock_shortfall',
      shortfall_quantity REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_pos_offline_conflicts_open ON pos_offline_conflicts(tenant_id,status,created_at);
  `);
};
