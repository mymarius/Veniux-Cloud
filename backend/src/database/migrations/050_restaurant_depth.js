// Pide/restoran derinleştirme: yalnız yeni tablolar eklenir (mevcut tablolar değişmez).
//  - restaurant_menu_options: ürünün tanımlı seçenekleri (ad, ek fiyat, isteğe bağlı stoktan düşen malzeme).
//  - restaurant_item_options: sipariş kalemine seçilen fiyatlı seçenekler (kaşarlı +20 ₺, acılı...).
//  - restaurant_order_adjustments: ikram (kalem), indirim (yüzde/tutar) ve servis ücreti.
//  - restaurant_deliveries: paket/motor siparişinin müşteri, adres, kurye ve teslim durumu.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurant_menu_options (
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      ingredient_id INTEGER,
      ingredient_qty REAL,
      PRIMARY KEY(tenant_id,product_id,position)
    );
    CREATE TABLE IF NOT EXISTS restaurant_item_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      ingredient_id INTEGER,
      ingredient_qty REAL
    );
    CREATE INDEX IF NOT EXISTS idx_restaurant_item_options_item ON restaurant_item_options(tenant_id,item_id);
    CREATE INDEX IF NOT EXISTS idx_restaurant_item_options_order ON restaurant_item_options(tenant_id,order_id);
    CREATE TABLE IF NOT EXISTS restaurant_order_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL,
      item_id INTEGER,
      kind TEXT NOT NULL,
      percent REAL,
      amount REAL,
      reason TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_restaurant_adjustments_order ON restaurant_order_adjustments(tenant_id,order_id);
    CREATE TABLE IF NOT EXISTS restaurant_deliveries (
      order_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_name TEXT,
      phone TEXT,
      address TEXT,
      note TEXT,
      courier TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(tenant_id,order_id)
    );
  `);
};
