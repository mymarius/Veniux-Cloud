ALTER TABLE purchase_orders ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN approved_by INTEGER REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN approved_at DATETIME;
ALTER TABLE purchase_orders ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN cancel_reason TEXT;
ALTER TABLE purchase_orders ADD COLUMN cancelled_at DATETIME;
ALTER TABLE purchase_orders ADD COLUMN updated_at DATETIME;
ALTER TABLE purchase_order_items ADD COLUMN cancelled_quantity REAL NOT NULL DEFAULT 0;
UPDATE purchase_orders SET status='draft' WHERE status='pending';
UPDATE purchase_orders SET status='completed' WHERE status='received';
ALTER TABLE wms_inbound_receipts ADD COLUMN purchase_order_id INTEGER REFERENCES purchase_orders(id);
ALTER TABLE wms_inbound_items ADD COLUMN purchase_order_item_id INTEGER REFERENCES purchase_order_items(id);
ALTER TABLE wms_inbound_items ADD COLUMN unit_purchase_price REAL;
ALTER TABLE wms_inbound_items ADD COLUMN lot_id INTEGER REFERENCES inventory_lots(id);
ALTER TABLE wms_inbound_items ADD COLUMN returned_qty REAL NOT NULL DEFAULT 0;
UPDATE wms_inbound_items SET lot_id=(SELECT l.id FROM inventory_lots l WHERE l.tenant_id=wms_inbound_items.tenant_id AND l.product_id=wms_inbound_items.product_id AND l.lot_number=wms_inbound_items.lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX idx_inbound_purchase ON wms_inbound_receipts(tenant_id,purchase_order_id);
CREATE TABLE supplier_return_documents (
 id TEXT PRIMARY KEY,tenant_id INTEGER NOT NULL,supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
 purchase_order_id INTEGER REFERENCES purchase_orders(id),reason TEXT NOT NULL,
 created_by INTEGER NOT NULL REFERENCES users(id),created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE supplier_return_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,tenant_id INTEGER NOT NULL,
 return_id TEXT NOT NULL REFERENCES supplier_return_documents(id),
 receipt_item_id INTEGER NOT NULL REFERENCES wms_inbound_items(id),
 quantity REAL NOT NULL CHECK(quantity>0),transaction_id INTEGER NOT NULL REFERENCES inventory_transactions(id),
 released_holds_json TEXT
);
CREATE INDEX idx_supplier_return_scope ON supplier_return_documents(tenant_id,supplier_id);
