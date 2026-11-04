const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../stok_takip.db');
const db = new Database(dbPath);

console.log('[Live Data Seed] Canlı kurumsal ve eczane verileri yükleniyor...');

db.pragma('foreign_keys = ON');

const seedLive = db.transaction(() => {
  // 1. Reset dynamic tables cleanly
  db.exec(`
    DELETE FROM stock_movements;
    DELETE FROM stock_records;
    DELETE FROM medicine_batches;
    DELETE FROM medula_sync_logs;
    DELETE FROM alerts;
    DELETE FROM purchase_order_items;
    DELETE FROM purchase_orders;
    DELETE FROM stock_count_items;
    DELETE FROM stock_counts;
    DELETE FROM products;
    DELETE FROM suppliers;
    DELETE FROM warehouses;
    DELETE FROM pharmacy_depots;
  `);

  // 2. Insert Warehouses
  const insertWarehouse = db.prepare(`
    INSERT INTO warehouses (id, name, type, location, capacity, source_config)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertWarehouse.run(1, 'Ana Merkez Depo (Gebze Lojistik)', 'main', 'Kocaeli / Gebze Organize Sanayi A-Blok', 25000, '{"sync":true}');
  insertWarehouse.run(2, 'Eczane Ön Banko & Raflar', 'retail', 'Giriş Katı, Banko Arkası ve Çekmeceler', 5000, '{"pos":true}');
  insertWarehouse.run(3, 'Soğuk Zincir +2°C / +8°C İlaç Dolabı', 'internal', 'Laboratuvar İçi Dijital Sıcaklık Kontrollü', 1500, '{"temp_control":true}');
  insertWarehouse.run(4, 'E-Ticaret Hızlı Dağıtım Deposu', 'ecommerce', 'İstanbul / Ataşehir Lojistik Şube', 10000, '{"marketplace":true}');

  // 3. Insert Suppliers & Pharmacy Depots
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, name, contact_name, email, phone, address, tax_no, lead_time_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSupplier.run(1, 'Selçuk Ecza Deposu A.Ş.', 'Mehmet Yılmaz (Bölge Müdürü)', 'siparis@selcukecza.com.tr', '+90 216 554 0000', 'Altunizade Mah. Kuşbakışı Cad. No:37 Üsküdar/İstanbul', '7610012345', 1);
  insertSupplier.run(2, 'Alliance Healthcare Turkey', 'Ayşe Kaya (Müşteri Temsilcisi)', 'tedarik@alliance-healthcare.com.tr', '+90 212 338 1000', 'Büyükdere Cad. No:193 Levent/İstanbul', '0540023456', 1);
  insertSupplier.run(3, 'Hedef Ecza Deposu', 'Burak Demir (Sevkiyat Sorumlusu)', 'info@hedefecza.com', '+90 216 458 8000', 'Dudullu OSB 2. Cadde No:8 Ümraniye/İstanbul', '4610034567', 2);
  insertSupplier.run(4, 'Abdi İbrahim İlaç Sanayi', 'Zeynep Öztürk (Satış Yöneticisi)', 'tedarik@abdiibrahim.com.tr', '+90 212 354 1800', 'Reşitpaşa Mah. Eski Büyükdere Cad. No:4 Sarıyer/İstanbul', '0010045678', 2);
  insertSupplier.run(5, 'Bayer Türk Kimya San. Ltd.', 'Caner Aksu', 'siparis@bayer.com.tr', '+90 216 528 3600', 'Fatih Sultan Mehmet Mah. Balkan Cad. Ümraniye/İstanbul', '1520056789', 3);

  // Pharmacy Depots
  const insertDepot = db.prepare(`
    INSERT INTO pharmacy_depots (name, branch, phone, email, account_no, current_balance)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertDepot.run('Selçuk Ecza Deposu', 'Kadıköy Şube', '0216 345 67 89', 'kadikoy@selcukecza.com.tr', 'CAR-SEL-3401', 42850.50);
  insertDepot.run('Alliance Healthcare', 'Ümraniye Şube', '0216 456 78 90', 'umraniye@alliance.com.tr', 'CAR-ALL-3402', 28400.00);
  insertDepot.run('Hedef Ecza Deposu', 'Kartal Şube', '0216 567 89 01', 'kartal@hedefecza.com', 'CAR-HED-3403', 14200.75);

  // 4. Insert Products & Real Medicines
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, sku, name, category, barcode, unit, purchase_price, sale_price,
      min_stock_level, max_stock_level, supplier_id, is_medicine,
      gtin, atc_code, sgk_code, active_substance, prescription_type,
      kamu_fiyati, depocu_fiyati, perakende_fiyat, kdv_orani
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Medicines
  insertProduct.run(1, 'MED-PAROL-500', 'Parol 500 mg 20 Tablet', 'İlaç & Sağlık', '8699525010019', 'kutu', 42.50, 58.75, 40, 400, 1, 1, '8699525010019', 'N02BE01', 'SGK001', 'Parasetamol', 'normal', 58.75, 42.50, 58.75, 10);
  insertProduct.run(2, 'MED-AUGM-1000', 'Augmentin-BID 1000 mg 14 Film Tablet', 'İlaç & Sağlık', '8699525090124', 'kutu', 115.00, 154.20, 25, 250, 1, 1, '8699525090124', 'J01CR02', 'SGK002', 'Amoksisilin + Klavulanik Asit', 'normal', 154.20, 115.00, 154.20, 10);
  insertProduct.run(3, 'MED-CORAS-100', 'Coraspin 100 mg 30 Enterik Tablet', 'İlaç & Sağlık', '8699546011156', 'kutu', 38.00, 52.30, 50, 500, 5, 1, '8699546011156', 'B01AC06', 'SGK003', 'Asetilsalisilik Asit', 'normal', 52.30, 38.00, 52.30, 10);
  insertProduct.run(4, 'MED-XANAX-05', 'Xanax 0.5 mg 30 Tablet', 'İlaç & Sağlık', '8699525090028', 'kutu', 95.00, 134.50, 15, 120, 2, 1, '8699525090028', 'N05BA12', 'SGK004', 'Alprazolam', 'yesil', 134.50, 95.00, 134.50, 10);
  insertProduct.run(5, 'MED-CONC-36', 'Concerta 36 mg 30 Salımlı Tablet', 'İlaç & Sağlık', '8699593010188', 'kutu', 480.00, 620.00, 10, 60, 2, 1, '8699593010188', 'N06BA04', 'SGK005', 'Metilfenidat Hidroklorür', 'kirmizi', 620.00, 480.00, 620.00, 10);
  insertProduct.run(6, 'MED-LANTUS-100', 'Lantus Solostar 100 IU/ml İnsülin 5 Kalem', 'İlaç & Sağlık', '8699809950154', 'kutu', 520.00, 695.00, 12, 100, 3, 1, '8699809950154', 'A10AE04', 'SGK006', 'İnsülin Glarjin', 'mor', 695.00, 520.00, 695.00, 10);
  insertProduct.run(7, 'MED-VENT-100', 'Ventolin 100 mcg İnhaler 200 Doz', 'İlaç & Sağlık', '8699525520037', 'kutu', 78.50, 104.80, 20, 180, 1, 1, '8699525520037', 'R03AC02', 'SGK007', 'Salbutamol', 'normal', 104.80, 78.50, 104.80, 10);
  insertProduct.run(8, 'MED-MAJ-100', 'Majezik 100 mg 15 Film Tablet', 'İlaç & Sağlık', '8699508090045', 'kutu', 62.00, 84.50, 30, 220, 4, 1, '8699508090045', 'M01AE09', 'SGK008', 'Flurbiprofen', 'normal', 84.50, 62.00, 84.50, 10);

  // Dermocosmetics & OTC
  insertProduct.run(9, 'DERM-BEP-50G', 'Bepanthol Deri Bakım Kremi 50g', 'Dermokozmetik & Bakım', '8699546350019', 'adet', 110.00, 165.00, 30, 300, 5, 0, null, null, null, null, 'normal', 0, 110.00, 165.00, 20);
  insertProduct.run(10, 'VIT-SUP-30E', 'Supradyn All Day 30 Efervesan Tablet', 'Vitamin & Takviye', '8699546020059', 'kutu', 185.00, 260.00, 20, 180, 5, 0, null, null, null, null, 'normal', 0, 185.00, 260.00, 10);
  insertProduct.run(11, 'MED-BRAUN-IRT7', 'Braun ThermoScan 7 Kulaktan Ateş Ölçer', 'Medikal Cihazlar', '4022167652096', 'adet', 1450.00, 2150.00, 5, 40, 3, 0, null, null, null, null, 'normal', 0, 1450.00, 2150.00, 20);
  insertProduct.run(12, 'MED-OMR-M2B', 'Omron M2 Basic Dijital Koldan Tansiyon Aleti', 'Medikal Cihazlar', '4015672109865', 'adet', 850.00, 1250.00, 8, 50, 3, 0, null, null, null, null, 'normal', 0, 850.00, 1250.00, 20);
  insertProduct.run(13, 'SARF-GB-100', 'Steril Hidrofil Gazlı Bez 7.5x7.5 cm 100 Adet', 'Tıbbi Sarf Malzeme', '8699123456789', 'paket', 45.00, 75.00, 50, 600, 1, 0, null, null, null, null, 'normal', 0, 45.00, 75.00, 10);

  // 5. Stock Records across Warehouses
  const insertStock = db.prepare(`
    INSERT INTO stock_records (product_id, warehouse_id, quantity)
    VALUES (?, ?, ?)
  `);

  // Main Warehouse (Gebze)
  insertStock.run(1, 1, 180); // Parol
  insertStock.run(2, 1, 95);  // Augmentin
  insertStock.run(3, 1, 240); // Coraspin
  insertStock.run(4, 1, 45);  // Xanax
  insertStock.run(5, 1, 20);  // Concerta
  insertStock.run(7, 1, 80);  // Ventolin
  insertStock.run(8, 1, 110); // Majezik
  insertStock.run(9, 1, 140); // Bepanthol
  insertStock.run(10, 1, 85); // Supradyn
  insertStock.run(11, 1, 18); // Braun
  insertStock.run(12, 1, 26); // Omron
  insertStock.run(13, 1, 320); // Gazlı Bez

  // Front Pharmacy Shelf (Ön Banko)
  insertStock.run(1, 2, 45);  // Parol
  insertStock.run(2, 2, 18);  // Augmentin
  insertStock.run(3, 2, 60);  // Coraspin
  insertStock.run(4, 2, 12);  // Xanax
  insertStock.run(5, 2, 6);   // Concerta (Low)
  insertStock.run(7, 2, 15);  // Ventolin
  insertStock.run(8, 2, 25);  // Majezik
  insertStock.run(9, 2, 35);  // Bepanthol
  insertStock.run(10, 2, 20); // Supradyn
  insertStock.run(11, 2, 4);  // Braun (Low)
  insertStock.run(12, 2, 6);  // Omron

  // Cold Chain Fridge (Soğuk Zincir)
  insertStock.run(6, 3, 38);  // Lantus İnsülin

  // E-Commerce Warehouse (Ataşehir)
  insertStock.run(9, 4, 80);  // Bepanthol
  insertStock.run(10, 4, 60); // Supradyn
  insertStock.run(11, 4, 12); // Braun
  insertStock.run(12, 4, 15); // Omron

  // 6. Insert GS1 2D Karekod Batches for Medicines
  const insertBatch = db.prepare(`
    INSERT INTO medicine_batches (product_id, gtin, serial_number, lot_number, expiry_date, status, warehouse_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Parol Batches (Safe & Near)
  insertBatch.run(1, '8699525010019', 'SN-PRL-908124', 'LOT-P2025A', '2027-06-30', 'in_stock', 2);
  insertBatch.run(1, '8699525010019', 'SN-PRL-908125', 'LOT-P2025A', '2027-06-30', 'in_stock', 2);
  insertBatch.run(1, '8699525010019', 'SN-PRL-847219', 'LOT-P2024X', '2026-10-15', 'in_stock', 2); // 45 days warning

  // Augmentin Batches
  insertBatch.run(2, '8699525090124', 'SN-AUG-448101', 'LOT-AG2025', '2027-01-31', 'in_stock', 2);
  insertBatch.run(2, '8699525090124', 'SN-AUG-448102', 'LOT-AG2024K', '2026-09-08', 'in_stock', 2); // 8 days critical

  // Lantus Batches in Cold Chain
  insertBatch.run(6, '8699809950154', 'SN-LNT-771901', 'LOT-LT2026', '2027-04-30', 'in_stock', 3);
  insertBatch.run(6, '8699809950154', 'SN-LNT-771902', 'LOT-LT2025', '2026-09-12', 'in_stock', 3); // 12 days critical
  insertBatch.run(6, '8699809950154', 'SN-LNT-661000', 'LOT-LT2024', '2026-08-15', 'in_stock', 3); // Expired

  // 7. Insert Stock Movements (Recent Ledger Records)
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type, source, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertMovement.run(1, 1, 100, 'inbound', 'purchase_order', 'Satın Alma İrsaliyesi: PO-2026-001 (Selçuk Ecza)', '2026-08-31 02:15:00');
  insertMovement.run(2, 1, 50, 'inbound', 'purchase_order', 'Satın Alma İrsaliyesi: PO-2026-001 (Selçuk Ecza)', '2026-08-31 02:20:00');
  insertMovement.run(6, 3, 20, 'inbound', 'purchase_order', 'Soğuk Zincir Teslimatı: Hedef Ecza İrsaliye #84102', '2026-08-31 03:00:00');
  insertMovement.run(1, 2, -2, 'outbound', 'pos', 'Reçeteli Satış / SGK Provizyon #94108', '2026-08-31 03:45:00');
  insertMovement.run(4, 2, -1, 'outbound', 'pos', 'Yeşil Reçeteli Satış (Dr. Onaylı)', '2026-08-31 04:10:00');
  insertMovement.run(9, 2, -3, 'outbound', 'pos', 'Perakende Müşteri Satışı', '2026-08-31 04:25:00');
  insertMovement.run(1, 1, -30, 'transfer', 'internal', 'Merkez Depo -> Ön Banko İkmal Transferi', '2026-08-31 04:30:00');
  insertMovement.run(1, 2, 30, 'transfer', 'internal', 'Merkez Depo -> Ön Banko İkmal Transferi', '2026-08-31 04:30:00');

  // 8. Insert Purchase Orders
  const insertPO = db.prepare(`
    INSERT INTO purchase_orders (id, order_no, supplier_id, target_warehouse_id, status, total_amount, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPO.run(1, 'PO-2026-001', 1, 1, 'received', 18450.00, 'Haftalık rutin Selçuk Ecza ikmali (Kabul Edildi)', '2026-08-30 10:00:00');
  insertPO.run(2, 'PO-2026-002', 2, 2, 'pending', 9620.00, 'Alliance Healthcare Acil Ön Banko Siparişi (Yolda)', '2026-08-31 01:30:00');

  const insertPOItem = db.prepare(`
    INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_price, received_quantity)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertPOItem.run(1, 1, 200, 42.50, 200);
  insertPOItem.run(1, 2, 80, 115.00, 80);
  insertPOItem.run(2, 4, 30, 95.00, 0);
  insertPOItem.run(2, 5, 10, 480.00, 0);

  // 9. Insert Stock Count Sessions
  const insertCount = db.prepare(`
    INSERT INTO stock_counts (id, count_no, warehouse_id, status, notes, counted_by, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCount.run(1, 'SYM-2026-001', 1, 'completed', '2026 Q3 Gebze Merkez Depo Genel Sayımı', 'admin@example.com', '2026-08-25 09:00:00', '2026-08-25 18:00:00');
  insertCount.run(2, 'SYM-2026-002', 2, 'in_progress', 'Eczane Ön Banko Haftalık Sayım Masası', 'manager@example.com', '2026-08-31 04:00:00', null);

  const insertCountItem = db.prepare(`
    INSERT INTO stock_count_items (count_id, product_id, system_quantity, counted_quantity, difference, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertCountItem.run(1, 1, 180, 180, 0, 'Tam mutabakat');
  insertCountItem.run(1, 2, 95, 95, 0, 'Tam mutabakat');
  insertCountItem.run(2, 1, 45, 45, 0, 'Sayıldı');
  insertCountItem.run(2, 2, 18, 17, -1, '1 kutu eksik bulundu');
  insertCountItem.run(2, 3, 60, 62, 2, '2 kutu fazla bulundu');

  // 10. Insert Alerts
  const insertAlert = db.prepare(`
    INSERT INTO alerts (product_id, warehouse_id, alert_type, severity, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAlert.run(5, 2, 'low_stock', 'critical', 'Concerta 36 mg stok seviyesi kritik eşik (10 kutu) altına düştü. Mevcut: 6 kutu.', 'unread', '2026-08-31 03:00:00');
  insertAlert.run(6, 3, 'expiry_critical', 'critical', 'Lantus İnsülin LOT-LT2025 partisinin miadına 12 gün kaldı. İade listesine ekleyin.', 'unread', '2026-08-31 03:30:00');
  insertAlert.run(11, 2, 'low_stock', 'warning', 'Braun Ateş Ölçer ön bankoda 4 adede düştü. Merkez depodan transfer önerilir.', 'unread', '2026-08-31 04:00:00');
});

seedLive();
console.log('✅ [Live Data Seed] Canlı veriler başarıyla yüklendi!');
