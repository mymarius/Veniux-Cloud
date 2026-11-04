
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      tenant_code TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      tax_number TEXT,
      tax_office TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_no TEXT,
      lead_time_days INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT,
      capacity INTEGER DEFAULT 10000,
      source_config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      barcode TEXT,
      unit TEXT NOT NULL DEFAULT 'adet',
      purchase_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      min_stock_level INTEGER NOT NULL DEFAULT 0,
      max_stock_level INTEGER DEFAULT 1000,
      supplier_id INTEGER,
      is_medicine INTEGER DEFAULT 0,
      gtin TEXT,
      atc_code TEXT,
      sgk_code TEXT,
      active_substance TEXT,
      prescription_type TEXT DEFAULT 'normal',
      kamu_fiyati REAL DEFAULT 0,
      depocu_fiyati REAL DEFAULT 0,
      perakende_fiyat REAL DEFAULT 0,
      kdv_orani INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, warehouse_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      target_warehouse_id INTEGER,
      change_amount INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      source TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER,
      warehouse_id INTEGER,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ai_summary_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_text TEXT NOT NULL,
      related_product_ids TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      user_email TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Pharmacy Specific Tables: Medicine Batches & GS1 Karekod Records
    CREATE TABLE IF NOT EXISTS medicine_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      gtin TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      lot_number TEXT,
      expiry_date TEXT NOT NULL,
      status TEXT DEFAULT 'in_stock',
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(gtin, serial_number),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    );

    -- Pharmacy Depots Table (Selçuk Ecza, Alliance, Hedef Ecza vb.)
    CREATE TABLE IF NOT EXISTS pharmacy_depots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      branch TEXT,
      phone TEXT,
      email TEXT,
      account_no TEXT,
      current_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Medula & Pharmacy Auto-Scan Logs
    CREATE TABLE IF NOT EXISTS medula_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      source_type TEXT DEFAULT 'medula_xml',
      items_detected INTEGER DEFAULT 0,
      items_imported INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchase Orders (Satın Alma Siparişleri & İrsaliye Eşleştirme)
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL,
      target_warehouse_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (target_warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      received_quantity INTEGER DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Stock Counts & Reconciliation (Fiziksel Sayım & Mutabakat)
    CREATE TABLE IF NOT EXISTS stock_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      count_no TEXT UNIQUE NOT NULL,
      warehouse_id INTEGER NOT NULL,
      status TEXT DEFAULT 'in_progress',
      notes TEXT,
      counted_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_count_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      count_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      system_quantity INTEGER NOT NULL,
      counted_quantity INTEGER NOT NULL,
      difference INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (count_id) REFERENCES stock_counts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Renkli Reçete Defteri (Kırmızı, Yeşil, Mor, Turuncu)
    CREATE TABLE IF NOT EXISTS colored_prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      prescription_no TEXT NOT NULL,
      prescription_type TEXT NOT NULL,
      patient_tc TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      doctor_name TEXT,
      doctor_diploma_no TEXT,
      protocol_no TEXT,
      medicine_id INTEGER NOT NULL,
      gtin TEXT,
      serial_number TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'dispensed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Hasta Veresiye & Cari Hesapları
    CREATE TABLE IF NOT EXISTS patient_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      tc_no TEXT UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      current_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patient_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      sale_id INTEGER,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      due_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE CASCADE
    );

    -- Majistral İlaç & Laboratuvar Formülleri (TEB Tarifesi)
    CREATE TABLE IF NOT EXISTS majistral_formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      formula_name TEXT NOT NULL,
      preparation_type TEXT DEFAULT 'merhem',
      ingredients_json TEXT NOT NULL,
      packaging_cost REAL DEFAULT 0,
      labor_cost REAL DEFAULT 0,
      total_price REAL NOT NULL,
      pharmacist_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Eczane POS & Banko Hızlı Satış
    CREATE TABLE IF NOT EXISTS pos_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      receipt_no TEXT UNIQUE NOT NULL,
      patient_id INTEGER,
      total_amount REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      sgk_coverage_amount REAL DEFAULT 0,
      patient_copay_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS pos_sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      gtin TEXT,
      serial_number TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES pos_sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_stock_records_product ON stock_records(product_id);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_medicine_batches_expiry ON medicine_batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_medicine_batches_gtin ON medicine_batches(gtin);
    CREATE INDEX IF NOT EXISTS idx_colored_presc_date ON colored_prescriptions(created_at);
    CREATE INDEX IF NOT EXISTS idx_pos_sales_receipt ON pos_sales(receipt_no);

    -- ======== ECZANE MEGA ALTYAPI YENİ TABLOLAR ========

    -- İlaç Etkileşim Kontrol Sistemi
    CREATE TABLE IF NOT EXISTS drug_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      atc_code_1 TEXT NOT NULL,
      drug_name_1 TEXT NOT NULL,
      atc_code_2 TEXT NOT NULL,
      drug_name_2 TEXT NOT NULL,
      interaction_level TEXT NOT NULL,
      description TEXT NOT NULL,
      clinical_effect TEXT,
      recommendation TEXT,
      source TEXT DEFAULT 'TEB_DB',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SGK Medula Provizyon Sistemi
    CREATE TABLE IF NOT EXISTS medula_provisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      provision_no TEXT UNIQUE NOT NULL,
      prescription_no TEXT NOT NULL,
      patient_tc TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      doctor_name TEXT,
      diagnosis_code TEXT,
      hospital_name TEXT,
      provision_type TEXT DEFAULT 'normal',
      total_sgk_amount REAL DEFAULT 0,
      total_patient_copay REAL DEFAULT 0,
      total_equivalent_diff REAL DEFAULT 0,
      status TEXT DEFAULT 'approved',
      rejection_reason TEXT,
      items_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Eczane Personel Kadrosu
    CREATE TABLE IF NOT EXISTS pharmacy_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      title TEXT NOT NULL,
      tc_no TEXT,
      phone TEXT,
      diploma_no TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Nöbet Çizelgesi
    CREATE TABLE IF NOT EXISTS duty_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      duty_date DATE NOT NULL,
      shift_type TEXT DEFAULT 'nobetci',
      staff_id INTEGER,
      start_time TEXT DEFAULT '08:00',
      end_time TEXT DEFAULT '08:00',
      night_surcharge_rate REAL DEFAULT 0.40,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES pharmacy_staff(id) ON DELETE SET NULL
    );

    -- İlaç İade Yönetimi
    CREATE TABLE IF NOT EXISTS medicine_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      return_no TEXT UNIQUE NOT NULL,
      depot_id INTEGER,
      return_reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_items INTEGER DEFAULT 0,
      total_value REAL DEFAULT 0,
      credit_note_no TEXT,
      credit_amount REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (depot_id) REFERENCES pharmacy_depots(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS medicine_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      return_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      batch_id INTEGER,
      gtin TEXT,
      serial_number TEXT,
      quantity INTEGER NOT NULL,
      unit_value REAL NOT NULL,
      reason_detail TEXT,
      FOREIGN KEY (return_id) REFERENCES medicine_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Soğuk Zincir & Sıcaklık Takip
    CREATE TABLE IF NOT EXISTS cold_chain_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT DEFAULT 'fridge',
      location TEXT,
      min_temp REAL DEFAULT 2.0,
      max_temp REAL DEFAULT 8.0,
      is_active INTEGER DEFAULT 1,
      warehouse_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS cold_chain_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      device_id INTEGER NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL,
      is_alarm INTEGER DEFAULT 0,
      alarm_type TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES cold_chain_devices(id) ON DELETE CASCADE
    );

    -- Hasta İlaç Hatırlatma
    CREATE TABLE IF NOT EXISTS patient_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      reminder_type TEXT DEFAULT 'refill',
      frequency_days INTEGER DEFAULT 30,
      last_dispensed_at DATETIME,
      next_reminder_at DATETIME,
      notification_method TEXT DEFAULT 'system',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patient_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Ecza Deposu Cari Hesap
    CREATE TABLE IF NOT EXISTS depot_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      depot_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_no TEXT,
      description TEXT,
      balance_after REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (depot_id) REFERENCES pharmacy_depots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS depot_reconciliations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      depot_id INTEGER NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      our_balance REAL NOT NULL,
      depot_balance REAL,
      difference REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (depot_id) REFERENCES pharmacy_depots(id) ON DELETE CASCADE
    );

    -- E-Fatura / E-İrsaliye
    CREATE TABLE IF NOT EXISTS pharmacy_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      invoice_no TEXT UNIQUE NOT NULL,
      invoice_type TEXT DEFAULT 'sales',
      invoice_format TEXT DEFAULT 'e_fatura',
      customer_name TEXT,
      customer_tc_vkn TEXT,
      customer_address TEXT,
      subtotal REAL NOT NULL,
      kdv_total REAL NOT NULL,
      grand_total REAL NOT NULL,
      kdv_breakdown_json TEXT,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'issued',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pharmacy_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      kdv_rate INTEGER DEFAULT 10,
      kdv_amount REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES pharmacy_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    -- Yeni İndeksler
    CREATE INDEX IF NOT EXISTS idx_drug_interactions_atc1 ON drug_interactions(atc_code_1);
    CREATE INDEX IF NOT EXISTS idx_drug_interactions_atc2 ON drug_interactions(atc_code_2);
    CREATE INDEX IF NOT EXISTS idx_medula_provisions_tc ON medula_provisions(patient_tc);
    CREATE INDEX IF NOT EXISTS idx_duty_schedule_date ON duty_schedule(duty_date);
    CREATE INDEX IF NOT EXISTS idx_medicine_returns_status ON medicine_returns(status);
    CREATE INDEX IF NOT EXISTS idx_cold_chain_logs_device ON cold_chain_logs(device_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_patient_reminders_next ON patient_reminders(next_reminder_at);
    CREATE INDEX IF NOT EXISTS idx_depot_transactions_depot ON depot_transactions(depot_id);
    -- ======== ENTERPRISE WMS (DEPO YÖNETİM SİSTEMİ) TABLOLARI ========

    -- 1. Merkezi Stok Defteri (Inventory Ledger)
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      location_id INTEGER,
      product_id INTEGER NOT NULL,
      lot_id INTEGER,
      serial_number TEXT,
      handling_unit_id INTEGER,
      transaction_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      before_quantity REAL,
      after_quantity REAL,
      reference_type TEXT,
      reference_id TEXT,
      user_id INTEGER,
      device_id TEXT,
      idempotency_key TEXT UNIQUE,
      reason_code TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- 2. Rezervasyon & Tahsis (Inventory Reservations & Allocations)
    CREATE TABLE IF NOT EXISTS inventory_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      location_id INTEGER,
      product_id INTEGER NOT NULL,
      lot_id INTEGER,
      order_id INTEGER,
      order_line_id INTEGER,
      reserved_qty REAL NOT NULL,
      allocated_qty REAL DEFAULT 0,
      picked_qty REAL DEFAULT 0,
      released_qty REAL DEFAULT 0,
      status TEXT DEFAULT 'reserved',
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- 3. Lot / Parti & SKT Takibi
    CREATE TABLE IF NOT EXISTS inventory_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      lot_number TEXT NOT NULL,
      supplier_id INTEGER,
      production_date DATE,
      expiry_date DATE,
      supplier_lot_number TEXT,
      status TEXT DEFAULT 'available',
      qa_status TEXT DEFAULT 'approved',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, lot_number),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- 4. Seri Numaraları
    CREATE TABLE IF NOT EXISTS inventory_serial_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      serial_number TEXT NOT NULL UNIQUE,
      lot_id INTEGER,
      location_id INTEGER,
      handling_unit_id INTEGER,
      status TEXT DEFAULT 'available',
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      shipped_at DATETIME,
      warranty_end_date DATE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id)
    );

    -- 5. Birim ve Ambalaj Hiyerarşisi (UOM)
    CREATE TABLE IF NOT EXISTS product_uoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      uom_code TEXT NOT NULL,
      conversion_factor REAL NOT NULL,
      is_base_uom INTEGER DEFAULT 0,
      barcode TEXT,
      length_cm REAL,
      width_cm REAL,
      height_cm REAL,
      gross_weight_kg REAL,
      UNIQUE(product_id, uom_code),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- 6. Depo Alanları ve Lokasyonları (Zones, Aisles, Racks, Bins)
    CREATE TABLE IF NOT EXISTS warehouse_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      location_code TEXT UNIQUE NOT NULL,
      zone_name TEXT DEFAULT 'General',
      aisle_code TEXT NOT NULL,
      rack_number INTEGER NOT NULL,
      shelf_tier INTEGER NOT NULL,
      bin_position INTEGER NOT NULL,
      location_type TEXT DEFAULT 'storage',
      max_weight_kg REAL DEFAULT 500,
      max_volume_m3 REAL DEFAULT 1.5,
      allowed_storage_class TEXT DEFAULT 'ALL',
      is_locked INTEGER DEFAULT 0,
      lock_reason TEXT,
      x_coord REAL DEFAULT 0,
      y_coord REAL DEFAULT 0,
      z_coord REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    );

    -- 7. Lokasyon Bazlı Anlık Stok Projeksiyonu
    CREATE TABLE IF NOT EXISTS product_bin_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      lot_id INTEGER,
      quantity REAL NOT NULL DEFAULT 0,
      reserved_qty REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(location_id, product_id, lot_id),
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- 8. Depo Navigasyon Düğümleri (Nodes)
    CREATE TABLE IF NOT EXISTS warehouse_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      node_type TEXT NOT NULL,
      location_id INTEGER,
      x REAL NOT NULL,
      y REAL NOT NULL,
      is_blocked INTEGER DEFAULT 0,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id) ON DELETE SET NULL
    );

    -- 9. Depo Navigasyon Bağlantıları (Edges)
    CREATE TABLE IF NOT EXISTS warehouse_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      from_node_id INTEGER NOT NULL,
      to_node_id INTEGER NOT NULL,
      distance_m REAL NOT NULL,
      travel_seconds REAL,
      is_one_way INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
      FOREIGN KEY (from_node_id) REFERENCES warehouse_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (to_node_id) REFERENCES warehouse_nodes(id) ON DELETE CASCADE
    );

    -- 10. Taşıma Birimleri (Handling Units / Palet / Koli / Tote / SSCC)
    CREATE TABLE IF NOT EXISTS handling_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      hu_code TEXT UNIQUE NOT NULL,
      sscc_code TEXT UNIQUE,
      hu_type TEXT NOT NULL,
      warehouse_id INTEGER NOT NULL,
      current_location_id INTEGER,
      parent_hu_id INTEGER,
      weight_kg REAL DEFAULT 0,
      max_weight_kg REAL DEFAULT 1000,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (current_location_id) REFERENCES warehouse_locations(id),
      FOREIGN KEY (parent_hu_id) REFERENCES handling_units(id) ON DELETE SET NULL
    );

    -- 11. Rampa, Kapı ve Randevu Yönetimi (Docks & Appointments)
    CREATE TABLE IF NOT EXISTS wms_dock_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      dock_code TEXT NOT NULL,
      direction TEXT NOT NULL,
      appointment_time DATETIME NOT NULL,
      carrier_company TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      plate_number TEXT,
      status TEXT DEFAULT 'SCHEDULED',
      started_at DATETIME,
      completed_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    -- 12. Mal Kabul & İrsaliye Belgesi
    CREATE TABLE IF NOT EXISTS wms_inbound_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      receipt_no TEXT UNIQUE NOT NULL,
      warehouse_id INTEGER NOT NULL,
      supplier_id INTEGER,
      waybill_no TEXT,
      appointment_id INTEGER,
      status TEXT DEFAULT 'pending',
      total_expected_qty REAL DEFAULT 0,
      total_received_qty REAL DEFAULT 0,
      total_rejected_qty REAL DEFAULT 0,
      received_by INTEGER,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (appointment_id) REFERENCES wms_dock_appointments(id)
    );

    CREATE TABLE IF NOT EXISTS wms_inbound_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      receipt_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      lot_number TEXT,
      expiry_date DATE,
      expected_qty REAL NOT NULL,
      received_qty REAL DEFAULT 0,
      rejected_qty REAL DEFAULT 0,
      target_location_id INTEGER,
      actual_location_id INTEGER,
      status TEXT DEFAULT 'pending',
      qc_notes TEXT,
      FOREIGN KEY (receipt_id) REFERENCES wms_inbound_receipts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- 13. Dalga Toplama (Wave & Tasks)
    CREATE TABLE IF NOT EXISTS wms_pick_waves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      wave_no TEXT UNIQUE NOT NULL,
      warehouse_id INTEGER NOT NULL,
      picking_type TEXT DEFAULT 'WAVE',
      status TEXT DEFAULT 'pending',
      total_lines INTEGER DEFAULT 0,
      picked_lines INTEGER DEFAULT 0,
      assigned_user_id INTEGER,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS wms_pick_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      wave_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      lot_id INTEGER,
      target_handling_unit_id INTEGER,
      requested_qty REAL NOT NULL,
      picked_qty REAL DEFAULT 0,
      sequence_number INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      exception_reason TEXT,
      picked_by INTEGER,
      picked_at DATETIME,
      FOREIGN KEY (wave_id) REFERENCES wms_pick_waves(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- 14. El Terminalleri & Cihaz Filosu (Handheld Fleet)
    CREATE TABLE IF NOT EXISTS warehouse_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      device_uid TEXT UNIQUE NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT DEFAULT 'PDA',
      manufacturer TEXT,
      warehouse_id INTEGER NOT NULL,
      assigned_user_id INTEGER,
      battery_level INTEGER DEFAULT 100,
      last_ip_address TEXT,
      last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    -- 15. Standart Barkod Tarama Olayları (Scan Events Log)
    CREATE TABLE IF NOT EXISTS wms_scan_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      user_id INTEGER,
      raw_barcode TEXT NOT NULL,
      resolved_type TEXT,
      resolved_id INTEGER,
      operation TEXT NOT NULL,
      is_success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. WMS Kural Motoru Tablosu (Dynamic Rules)
    CREATE TABLE IF NOT EXISTS wms_business_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      warehouse_id INTEGER,
      rule_type TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      priority INTEGER DEFAULT 10,
      condition_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- WMS İndeksleri
    CREATE INDEX IF NOT EXISTS idx_inv_tx_wh_prod ON inventory_transactions(warehouse_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_inv_tx_created ON inventory_transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_inv_res_wh_prod ON inventory_reservations(warehouse_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_wh_loc_code ON warehouse_locations(location_code);
    CREATE INDEX IF NOT EXISTS idx_prod_bin_loc ON product_bin_records(location_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_pick_tasks_wave ON wms_pick_tasks(wave_id, status);
    CREATE INDEX IF NOT EXISTS idx_hu_code ON handling_units(hu_code);
    CREATE INDEX IF NOT EXISTS idx_dock_app_time ON wms_dock_appointments(appointment_time);

    -- ======== ENTERPRISE LICENSING & MULTI-TENANT ARCHITECTURE ========

    -- 1. Şirket / Müşteri Kiracıları (Tenants)
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_code TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      tax_number TEXT,
      tax_office TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Yıllık Kurumsal Lisanslar (Annual Licenses)
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL DEFAULT 'ENTERPRISE_ANNUAL',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      max_users INTEGER DEFAULT 50,
      max_warehouses INTEGER DEFAULT 5,
      max_devices INTEGER DEFAULT 25,
      max_pdas INTEGER DEFAULT 25,
      enabled_features_json TEXT,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      activated_at DATETIME,
      expires_at DATETIME NOT NULL,
      grace_period_days INTEGER DEFAULT 14,
      last_validation_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    -- 3. Cihaz / PC Aktivasyon Bağlantıları (Device Hardware Bindings)
    CREATE TABLE IF NOT EXISTS license_activations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      device_fingerprint TEXT NOT NULL,
      device_name TEXT,
      os_info TEXT,
      app_version TEXT DEFAULT '2.4.0',
      is_active INTEGER DEFAULT 1,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deactivated_at DATETIME,
      UNIQUE(license_id, device_fingerprint),
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    -- 4. Yıllık Abonelik Faturaları (Annual Billing & Invoices)
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL,
      license_id INTEGER,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      billing_period TEXT DEFAULT 'ANNUAL',
      payment_method TEXT DEFAULT 'CREDIT_CARD',
      status TEXT DEFAULT 'PAID',
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
    );

    -- 5. Lisans Denetim Kayıtları (License Audit Logs)
    CREATE TABLE IF NOT EXISTS license_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER,
      event_type TEXT NOT NULL,
      ip_address TEXT,
      device_fingerprint TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_lic_key ON licenses(license_key);
    CREATE INDEX IF NOT EXISTS idx_lic_tenant ON licenses(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_lic_act_dev ON license_activations(device_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
  