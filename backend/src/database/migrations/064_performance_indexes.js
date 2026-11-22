// Uzun kullanım/büyük veri: sık okunan tablolarda eksik indeksler (yalnız CREATE INDEX IF NOT EXISTS; veri ve tablo değişmez).
// Ölçüm ve gerekçe: docs/UZUN-KULLANIM-PERFORMANS-2026-11-23.md
module.exports = db => {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_retail_sales_tenant_date ON retail_sales(tenant_id, business_date);
    CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON pos_sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_pos_sale_items_product ON pos_sale_items(tenant_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_pos_sales_tenant_created ON pos_sales(tenant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created ON stock_movements(tenant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_products_tenant_gtin ON products(tenant_id, gtin);
    CREATE INDEX IF NOT EXISTS idx_product_uoms_barcode ON product_uoms(tenant_id, barcode);
    CREATE INDEX IF NOT EXISTS idx_stock_records_tenant_updated ON stock_records(tenant_id, updated_at, id);
    CREATE INDEX IF NOT EXISTS idx_products_tenant_created ON products(tenant_id, created_at);
  `);
};
