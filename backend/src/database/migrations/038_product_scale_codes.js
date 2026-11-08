// Terazi kodu (PLU): terazinin bastığı etiketteki ürün kodu. Firma içinde tektir; ürün tablosuna sütun eklemek yerine
// ayrı tablo kullanılır, çünkü kurulu masaüstü veritabanları yeni tabloyu güvenle ekleyebilir.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_scale_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      plu TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,plu),
      UNIQUE(tenant_id,product_id)
    );
  `);
};
