// Uyarıların e-posta, SMS ve WhatsApp ile iletim kaydı: aynı uyarı aynı kanaldan bir kez gider.
// Yalnız yeni tablo eklenir; kurulu masaüstü veritabanları güvenle yükseltilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      alert_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,alert_id,channel)
    );
  `);
};
