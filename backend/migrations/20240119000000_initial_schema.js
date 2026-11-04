exports.up = function(pgm) {
  // Users table
  pgm.createTable('users', {
    id: { type: 'serial', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(50)', notNull: true, default: 'viewer' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // Suppliers table
  pgm.createTable('suppliers', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    contact_info: { type: 'jsonb' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // Warehouses table
  pgm.createTable('warehouses', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    type: { type: 'varchar(50)', notNull: true },
    source_config: { type: 'jsonb' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // Products table
  pgm.createTable('products', {
    id: { type: 'serial', primaryKey: true },
    sku: { type: 'varchar(100)', notNull: true, unique: true },
    name: { type: 'varchar(255)', notNull: true },
    category: { type: 'varchar(100)' },
    unit: { type: 'varchar(50)', notNull: true, default: 'adet' },
    min_stock_level: { type: 'integer', notNull: true, default: 0 },
    supplier_id: { 
      type: 'integer', 
      references: 'suppliers(id)',
      onDelete: 'SET NULL'
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // Stock records table
  pgm.createTable('stock_records', {
    id: { type: 'serial', primaryKey: true },
    product_id: { 
      type: 'integer', 
      notNull: true,
      references: 'products(id)',
      onDelete: 'CASCADE'
    },
    warehouse_id: { 
      type: 'integer', 
      notNull: true,
      references: 'warehouses(id)',
      onDelete: 'CASCADE'
    },
    quantity: { type: 'integer', notNull: true, default: 0 },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // Unique constraint on product_id and warehouse_id
  pgm.addConstraint('stock_records', 'unique_product_warehouse', {
    unique: ['product_id', 'warehouse_id']
  });

  // Stock movements table
  pgm.createTable('stock_movements', {
    id: { type: 'serial', primaryKey: true },
    product_id: { 
      type: 'integer', 
      notNull: true,
      references: 'products(id)',
      onDelete: 'CASCADE'
    },
    warehouse_id: { 
      type: 'integer', 
      notNull: true,
      references: 'warehouses(id)',
      onDelete: 'CASCADE'
    },
    change_amount: { type: 'integer', notNull: true },
    movement_type: { type: 'varchar(50)', notNull: true },
    source: { type: 'varchar(100)' },
    note: { type: 'text' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // Alerts table
  pgm.createTable('alerts', {
    id: { type: 'serial', primaryKey: true },
    product_id: { 
      type: 'integer',
      references: 'products(id)',
      onDelete: 'SET NULL'
    },
    warehouse_id: { 
      type: 'integer',
      references: 'warehouses(id)',
      onDelete: 'SET NULL'
    },
    alert_type: { type: 'varchar(50)', notNull: true },
    severity: { type: 'varchar(20)', notNull: true },
    message: { type: 'text', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'unread' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // AI summary logs table
  pgm.createTable('ai_summary_logs', {
    id: { type: 'serial', primaryKey: true },
    summary_text: { type: 'text', notNull: true },
    related_product_ids: { type: 'integer[]' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now') }
  });

  // Indexes
  pgm.createIndex('stock_movements', ['product_id', 'created_at'], {
    name: 'idx_stock_movements_product'
  });
  pgm.createIndex('alerts', ['status'], {
    name: 'idx_alerts_status'
  });
  pgm.createIndex('stock_records', ['product_id'], {
    name: 'idx_stock_records_product'
  });
};

exports.down = function(pgm) {
  pgm.dropIndex('stock_records', 'idx_stock_records_product');
  pgm.dropIndex('alerts', 'idx_alerts_status');
  pgm.dropIndex('stock_movements', 'idx_stock_movements_product');
  
  pgm.dropTable('ai_summary_logs');
  pgm.dropTable('alerts');
  pgm.dropTable('stock_movements');
  pgm.dropConstraint('stock_records', 'unique_product_warehouse');
  pgm.dropTable('stock_records');
  pgm.dropTable('products');
  pgm.dropTable('warehouses');
  pgm.dropTable('suppliers');
  pgm.dropTable('users');
};
