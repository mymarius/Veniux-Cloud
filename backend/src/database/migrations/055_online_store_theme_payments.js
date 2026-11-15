// Online mağaza: vitrin teması ve kartla ödeme (sanal POS) ayarları ile ödeme kayıtları. Yalnız yeni tablolar.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS online_store_theme (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      color TEXT NOT NULL DEFAULT '#b23f04',
      layout TEXT NOT NULL DEFAULT 'grid',
      font TEXT NOT NULL DEFAULT 'modern',
      hero TEXT NOT NULL DEFAULT 'plain',
      banner TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS online_payment_settings (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'iyzico',
      sandbox INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 0,
      secrets TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS online_payments (
      order_id INTEGER PRIMARY KEY REFERENCES online_orders(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      token TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount REAL NOT NULL,
      provider_ref TEXT,
      refund_state TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS online_payments_token ON online_payments(token);
    CREATE INDEX IF NOT EXISTS online_payments_pending ON online_payments(status, created_at);
  `);
};
