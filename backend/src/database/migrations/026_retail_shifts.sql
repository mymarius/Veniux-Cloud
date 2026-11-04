CREATE TABLE retail_registers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id INTEGER NOT NULL REFERENCES tenants(id),
 warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
 name TEXT NOT NULL,
 UNIQUE(tenant_id,warehouse_id,name), UNIQUE(tenant_id,id)
);
CREATE TABLE retail_shifts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id INTEGER NOT NULL,
 register_id INTEGER NOT NULL,
 warehouse_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id),
 opened_by_email TEXT NOT NULL,
 opening_cash_cents INTEGER NOT NULL CHECK(opening_cash_cents>=0),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closed_at TEXT,
 closed_by INTEGER REFERENCES users(id),
 closing_json TEXT,
 FOREIGN KEY(tenant_id,register_id) REFERENCES retail_registers(tenant_id,id),
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX idx_retail_one_open_shift ON retail_shifts(tenant_id,register_id) WHERE status='open';
CREATE TABLE retail_cash_movements (
 id TEXT PRIMARY KEY,
 tenant_id INTEGER NOT NULL,
 shift_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id),
 user_email TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('in','out')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,shift_id) REFERENCES retail_shifts(tenant_id,id)
);
ALTER TABLE retail_sales ADD COLUMN register_id INTEGER REFERENCES retail_registers(id);
ALTER TABLE retail_sales ADD COLUMN shift_id INTEGER REFERENCES retail_shifts(id);
ALTER TABLE retail_reversals ADD COLUMN register_id INTEGER REFERENCES retail_registers(id);
ALTER TABLE retail_reversals ADD COLUMN shift_id INTEGER REFERENCES retail_shifts(id);
CREATE INDEX idx_retail_sale_shift ON retail_sales(tenant_id,shift_id);
CREATE INDEX idx_retail_reversal_shift ON retail_reversals(tenant_id,shift_id);
CREATE INDEX idx_retail_cash_shift ON retail_cash_movements(tenant_id,shift_id);
CREATE TRIGGER retail_closed_shift_immutable BEFORE UPDATE ON retail_shifts
WHEN OLD.status='closed'
BEGIN SELECT RAISE(ABORT,'Closed shift cannot be changed'); END;
CREATE TRIGGER retail_shift_identity_immutable BEFORE UPDATE ON retail_shifts
WHEN NEW.tenant_id!=OLD.tenant_id OR NEW.register_id!=OLD.register_id OR NEW.warehouse_id!=OLD.warehouse_id OR NEW.user_id!=OLD.user_id OR NEW.opening_cash_cents!=OLD.opening_cash_cents OR NEW.opened_by_email!=OLD.opened_by_email OR NEW.opened_at!=OLD.opened_at
BEGIN SELECT RAISE(ABORT,'Shift opening cannot be changed'); END;
CREATE TRIGGER retail_cash_movement_immutable BEFORE UPDATE ON retail_cash_movements
BEGIN SELECT RAISE(ABORT,'Cash movement cannot be changed'); END;
CREATE TRIGGER retail_cash_requires_open_shift BEFORE INSERT ON retail_cash_movements
WHEN NOT EXISTS(SELECT 1 FROM retail_shifts WHERE id=NEW.shift_id AND tenant_id=NEW.tenant_id AND status='open')
BEGIN SELECT RAISE(ABORT,'Cash movement requires open shift'); END;
CREATE TRIGGER retail_sale_shift_binding BEFORE INSERT ON retail_sales
WHEN NEW.shift_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM retail_shifts WHERE id=NEW.shift_id AND tenant_id=NEW.tenant_id AND warehouse_id=NEW.warehouse_id AND register_id=NEW.register_id AND status='open')
BEGIN SELECT RAISE(ABORT,'Sale shift binding invalid'); END;
CREATE TRIGGER retail_sale_finance_immutable BEFORE UPDATE ON retail_sales
WHEN OLD.shift_id IS NOT NULL AND (NEW.shift_id IS NOT OLD.shift_id OR NEW.register_id IS NOT OLD.register_id OR NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id OR NEW.warehouse_id!=OLD.warehouse_id OR NEW.business_date!=OLD.business_date OR json_extract(NEW.snapshot_json,'$.payments') IS NOT json_extract(OLD.snapshot_json,'$.payments') OR json_extract(NEW.snapshot_json,'$.gross_cents') IS NOT json_extract(OLD.snapshot_json,'$.gross_cents') OR json_extract(NEW.snapshot_json,'$.net_cents') IS NOT json_extract(OLD.snapshot_json,'$.net_cents') OR json_extract(NEW.snapshot_json,'$.discount_cents') IS NOT json_extract(OLD.snapshot_json,'$.discount_cents'))
BEGIN SELECT RAISE(ABORT,'Recorded sale finance cannot be changed'); END;
CREATE TRIGGER retail_reversal_shift_binding BEFORE INSERT ON retail_reversals
WHEN NEW.shift_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM retail_shifts WHERE id=NEW.shift_id AND tenant_id=NEW.tenant_id AND register_id=NEW.register_id AND status='open')
BEGIN SELECT RAISE(ABORT,'Reversal shift binding invalid'); END;
CREATE TRIGGER retail_reversal_immutable BEFORE UPDATE ON retail_reversals
WHEN OLD.shift_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Recorded reversal cannot be changed'); END;
