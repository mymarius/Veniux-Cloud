ALTER TABLE products ADD COLUMN purchase_price_tax_basis TEXT;
ALTER TABLE wms_inbound_items ADD COLUMN purchase_price_tax_basis TEXT;
ALTER TABLE wms_inbound_items ADD COLUMN purchase_vat_rate REAL;
