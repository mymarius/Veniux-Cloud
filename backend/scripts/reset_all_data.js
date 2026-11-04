const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, '../stok_takip.db');
const db = new Database(dbPath);

console.log('[System Reset] Stok ve sistem verileri sıfırlanıyor...');

db.exec(`
  -- Clear all transactions, movements, batches, logs and alerts
  DELETE FROM stock_movements;
  DELETE FROM stock_records;
  DELETE FROM medicine_batches;
  DELETE FROM medula_sync_logs;
  DELETE FROM alerts;
  DELETE FROM audit_logs;
  DELETE FROM purchase_order_items;
  DELETE FROM purchase_orders;
  DELETE FROM stock_count_items;
  DELETE FROM stock_counts;
  DELETE FROM products;
  DELETE FROM suppliers;
  DELETE FROM warehouses;
  DELETE FROM pharmacy_depots;
`);

// Re-seed clean base structure (Admin user, default warehouses, pharmacy depots)
const adminHash = bcrypt.hashSync('admin123', 10);
const managerHash = bcrypt.hashSync('manager123', 10);

const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)');
insertUser.run(1, 'admin@example.com', adminHash, 'admin');
insertUser.run(2, 'manager@example.com', managerHash, 'manager');

// Default Warehouses
const insertWh = db.prepare('INSERT INTO warehouses (name, type, location, capacity) VALUES (?, ?, ?, ?)');
insertWh.run('Ana Merkez Depo', 'main', 'Kat 1 - A Blok', 50000);
insertWh.run('Eczane Ön Banko & Raflar', 'retail', 'Eczane Satış Alanı', 15000);
insertWh.run('Soğuk Zincir Dolabı (+2/+8°C)', 'internal', 'Medikal Buzdolabı', 2000);
insertWh.run('Kırmızı & Yeşil Reçete Kasası', 'internal', 'Kilitli Kasa', 1000);

// Default Suppliers / Pharma Depots
const insertDepot = db.prepare('INSERT INTO pharmacy_depots (name, branch, phone, email, account_no, current_balance) VALUES (?, ?, ?, ?, ?, ?)');
insertDepot.run('Selçuk Ecza Deposu', 'Anadolu Şubesi', '+90 216 554 0101', 'anadolu@selcukecza.com.tr', 'SEL-1001', 0);
insertDepot.run('Alliance Healthcare', 'Gebze Merkezi', '+90 216 455 0202', 'gebze@alliance.com.tr', 'ALL-2002', 0);
insertDepot.run('Hedef Ecza Deposu', 'Avrupa Şubesi', '+90 212 388 0303', 'avrupa@hedefecza.com.tr', 'HDF-3003', 0);

const insertSup = db.prepare('INSERT INTO suppliers (name, contact_name, email, phone, address, lead_time_days) VALUES (?, ?, ?, ?, ?, ?)');
insertSup.run('Selçuk Ecza Deposu A.Ş.', 'Murat Demir', 'siparis@selcukecza.com.tr', '+90 216 554 0101', 'İstanbul', 1);
insertSup.run('Alliance Healthcare', 'Elif Kaya', 'eczane@alliance.com.tr', '+90 216 455 0202', 'İstanbul', 1);
insertSup.run('Tekno Dağıtım', 'Ahmet Yılmaz', 'siparis@tekno.com', '+90 212 555 0101', 'İstanbul', 2);

console.log('✅ [System Reset] Tüm stoklar, hareketler ve veriler başarıyla sıfırlandı! Temiz sıfır envanter hazırlandı.');
db.close();
