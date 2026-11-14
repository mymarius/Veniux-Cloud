// Sektör paketleri derinleştirme: yalnız yeni tablolar eklenir (mevcut tablolar değişmez).
//  - product_unit_prices: ürün birimine (koli, paket, kg) özel satış fiyatı.
//  - product_set_codes: züccaciye takımının kasada okutulan barkodu ve takım fiyatı.
//  - gift_registries / gift_registry_items: çeyiz ve düğün listesi (istenen ve alınan adet).
//  - restaurant_refunds: kapanmış adisyonda iade (tutar, ödeme yolu, sebep, kalemler).
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_unit_prices (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      uom_code TEXT NOT NULL,
      sale_price REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(tenant_id,product_id,uom_code)
    );
    CREATE TABLE IF NOT EXISTS product_set_codes (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      set_id INTEGER NOT NULL,
      barcode TEXT NOT NULL,
      sale_price REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(tenant_id,set_id),
      UNIQUE(tenant_id,barcode)
    );
    CREATE TABLE IF NOT EXISTS gift_registries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      owner_name TEXT,
      phone TEXT,
      event_date TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gift_registries_tenant ON gift_registries(tenant_id,status);
    CREATE TABLE IF NOT EXISTS gift_registry_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      registry_id INTEGER NOT NULL,
      product_id INTEGER,
      set_id INTEGER,
      wanted REAL NOT NULL,
      bought REAL NOT NULL DEFAULT 0,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_gift_registry_items_registry ON gift_registry_items(tenant_id,registry_id);
    CREATE TABLE IF NOT EXISTS restaurant_refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL,
      reason TEXT NOT NULL,
      items_json TEXT,
      shift_id INTEGER,
      user_id INTEGER,
      business_day TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_restaurant_refunds_order ON restaurant_refunds(tenant_id,order_id);
  `);
};
