// Online mağaza (ayrı paket: online_store): yalnız yeni tablolar eklenir, mevcut tablolara dokunulmaz.
//  - online_stores: işletme başına mağaza ayarı (adres kısaltması, ödeme/teslimat seçenekleri, yayın durumu).
//  - online_product_settings: ürünün mağazada yayında olup olmadığı, açıklaması, sırası.
//  - online_product_media: ürün görselleri (dosya diskte, burada yalnız üst bilgi).
//  - online_orders / online_order_items / online_order_events: müşteri siparişi, sipariş anındaki kalemler, durum geçmişi.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS online_stores (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT,
      about TEXT,
      logo_media_id INTEGER,
      contact_email TEXT,
      public_phone TEXT,
      cod_enabled INTEGER NOT NULL DEFAULT 1,
      transfer_enabled INTEGER NOT NULL DEFAULT 0,
      pickup_enabled INTEGER NOT NULL DEFAULT 1,
      transfer_note TEXT,
      delivery_fee REAL NOT NULL DEFAULT 0,
      free_delivery_over REAL,
      min_order REAL NOT NULL DEFAULT 0,
      warehouse_id INTEGER,
      published INTEGER NOT NULL DEFAULT 0,
      accepting_orders INTEGER NOT NULL DEFAULT 0,
      terms_text TEXT,
      order_counter INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS online_product_settings (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      max_per_order INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(tenant_id,product_id)
    );
    CREATE TABLE IF NOT EXISTS online_product_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      file_key TEXT NOT NULL UNIQUE,
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      alt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_online_product_media_product ON online_product_media(tenant_id,product_id,position);
    CREATE TABLE IF NOT EXISTS online_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      public_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'new',
      delivery_method TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      note TEXT,
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      warehouse_id INTEGER NOT NULL,
      consent_at DATETIME NOT NULL,
      idempotency_key TEXT NOT NULL,
      cancel_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,number),
      UNIQUE(tenant_id,idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(tenant_id,status,created_at);
    CREATE TABLE IF NOT EXISTS online_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT,
      name TEXT NOT NULL,
      unit TEXT,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      line_total REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON online_order_items(tenant_id,order_id);
    CREATE TABLE IF NOT EXISTS online_order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      user_id INTEGER,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_online_order_events_order ON online_order_events(tenant_id,order_id);
  `);
};
