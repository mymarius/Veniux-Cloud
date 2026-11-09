// Denetim kaydı bütünlüğü: her kayıt sırayla HMAC zincirine bağlanır (audit_seals); saklama süresi dolup
// silinen kayıtlar bir kontrol noktası bırakır (audit_checkpoints). Yeni cihazdan giriş için cihaz izi (login_devices).
// Yalnız yeni tablolar eklenir; kurulu masaüstü veritabanları güvenle yükseltilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_seals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      audit_id INTEGER NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      sealed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(audit_id)
    );
    CREATE TABLE IF NOT EXISTS audit_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      through_audit_id INTEGER NOT NULL,
      last_hash TEXT NOT NULL,
      purged_count INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS login_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      device_hash TEXT NOT NULL,
      label TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id,device_hash)
    );
  `);
};
