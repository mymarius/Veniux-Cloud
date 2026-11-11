// Web Push (telefon kapalıyken bildirim): sunucunun VAPID anahtarı, cihaz abonelikleri ve "en son ne bildirildi" durumu.
// Yalnız yeni tablolar eklenir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_vapid (
      id INTEGER PRIMARY KEY,
      public_key TEXT NOT NULL,
      private_sealed TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      role TEXT,
      endpoint_hash TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      failures INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_ok_at DATETIME,
      UNIQUE(tenant_id,endpoint_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant ON push_subscriptions(tenant_id,role);
    CREATE TABLE IF NOT EXISTS push_state (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(tenant_id,topic)
    );
  `);
};
