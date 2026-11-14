// Ürün birimi (koli, paket...) için özel satış fiyatı: "200 adetlik koli 360 ₺" (adet fiyatı x çarpandan farklı).
// Yalnız yeni tablo eklenir; birim tanımı mevcut product_uoms tablosundadır.
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
  `);
};
