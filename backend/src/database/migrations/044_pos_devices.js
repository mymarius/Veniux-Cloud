// Online kasa 2. aşama: kasa cihazları, kasa-gün fiş sayaçları ve satışa eklenen bilgi (mevcut tablolara sütun eklenmez).
// Yalnız yeni tablolar eklenir; kurulu masaüstü veritabanları güvenle yükseltilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pos_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      device_uid TEXT NOT NULL,
      register_id INTEGER,
      platform TEXT NOT NULL,
      label TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      emergency_prefix TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,device_uid)
    );
    CREATE TABLE IF NOT EXISTS pos_receipt_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      register_id INTEGER NOT NULL,
      business_date TEXT NOT NULL,
      last_no INTEGER NOT NULL,
      UNIQUE(tenant_id,register_id,business_date)
    );
    CREATE TABLE IF NOT EXISTS pos_sale_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sale_id INTEGER NOT NULL,
      client_uuid TEXT,
      device_id INTEGER,
      local_receipt_no TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'online',
      okc_status TEXT NOT NULL DEFAULT 'not_required',
      okc_receipt_no TEXT,
      okc_z_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,sale_id),
      UNIQUE(tenant_id,local_receipt_no)
    );
  `);
};
