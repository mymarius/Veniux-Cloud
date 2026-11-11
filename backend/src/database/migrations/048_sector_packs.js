// Sektör paketleri (Hırdavat, Züccaciye, Pide/Restoran): her paket ayrı satın alınır; veri yalnız yeni tablolardır.
//  - sector_packs: sözleşmesiz (eski) lisanslarda platform yöneticisinin tanımladığı paket hakları.
//  - product_attributes: ürün özellikleri (ölçü, kırılgan, menü...).
//  - product_sets / product_set_items: züccaciye takımları (hedef set sayısı ve parçalar).
//  - location_tags: raf konumu etiketleri (üst raf, kırılgan bölge, vitrin...).
//  - restaurant_tables / restaurant_orders / restaurant_order_items / product_recipes: pide ve restoran siparişi, mutfak ve reçete.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sector_packs (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      pack TEXT NOT NULL,
      granted_by INTEGER,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(tenant_id,pack)
    );
    CREATE TABLE IF NOT EXISTS product_attributes (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      attr_key TEXT NOT NULL,
      attr_value TEXT NOT NULL,
      PRIMARY KEY(tenant_id,product_id,attr_key)
    );
    CREATE INDEX IF NOT EXISTS idx_product_attributes_kv ON product_attributes(tenant_id,attr_key,attr_value);
    CREATE TABLE IF NOT EXISTS product_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_sets INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_product_sets_tenant ON product_sets(tenant_id);
    CREATE TABLE IF NOT EXISTS product_set_items (
      set_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      PRIMARY KEY(set_id,product_id)
    );
    CREATE TABLE IF NOT EXISTS location_tags (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY(tenant_id,location_id,tag)
    );
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(tenant_id,name)
    );
    CREATE TABLE IF NOT EXISTS restaurant_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      table_id INTEGER,
      order_type TEXT NOT NULL DEFAULT 'masa',
      status TEXT NOT NULL DEFAULT 'open',
      warehouse_id INTEGER NOT NULL,
      waiter_user_id INTEGER,
      note TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      shift_id INTEGER,
      register_id INTEGER,
      cash_cents INTEGER NOT NULL DEFAULT 0,
      card_cents INTEGER NOT NULL DEFAULT 0,
      business_day TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_restaurant_orders_day ON restaurant_orders(tenant_id,business_day,status);
    CREATE TABLE IF NOT EXISTS restaurant_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      shortfall TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ready_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_restaurant_items_order ON restaurant_order_items(tenant_id,order_id);
    CREATE INDEX IF NOT EXISTS idx_restaurant_items_status ON restaurant_order_items(tenant_id,status);
    CREATE TABLE IF NOT EXISTS product_recipes (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      PRIMARY KEY(tenant_id,product_id,ingredient_id)
    );
  `);
};
