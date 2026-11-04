/**
 * Veniux — MySQL demo veri seti.
 *
 * Önce TÜM tabloları boşaltır (mock/kalıntı veri kalmaz), sonra sistemin
 * her modülünü besleyen tutarlı bir demo veri seti yükler: depo ve raf
 * yapısı, ürün kataloğu, stok defteri, WMS operasyonu, eczane/İTS tarafı,
 * personel kadrosu ve lisans kayıtları.
 *
 *   node scripts/seed_mysql.js
 */

const { initMySQL, getMySQLPool } = require('../src/config/mysqlAdapter');
const bcrypt = require('bcrypt');

const TODAY = new Date('2026-09-10T09:00:00');
const day = (offset) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  return d;
};
const iso = (d) => d.toISOString().slice(0, 10);
const dt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const pick = (arr, i) => arr[i % arr.length];
const rnd = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
const between = (seed, min, max) => min + Math.floor(rnd(seed) * (max - min + 1));

async function run() {
  const ok = await initMySQL();
  if (!ok) throw new Error('MySQL bağlantısı kurulamadı. XAMPP MySQL çalışıyor mu?');
  const pool = getMySQLPool();
  const q = (sql, params) => pool.query(sql, params);

  /* ─────────── 1. TEMİZLİK ─────────── */
  const [tables] = await q(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE table_schema = DATABASE()'
  );
  await q('SET FOREIGN_KEY_CHECKS = 0');
  for (const { t } of tables) await q(`TRUNCATE TABLE \`${t}\``);
  await q('SET FOREIGN_KEY_CHECKS = 1');
  console.log(`🧹 ${tables.length} tablo boşaltıldı.`);

  /* ─────────── 2. KULLANICILAR ─────────── */
  const users = [
    ['admin@example.com', 'admin123', 'admin'],
    ['manager@example.com', 'manager123', 'manager'],
    ['viewer@example.com', 'viewer123', 'viewer'],
    ['depo@veniux.com', 'depo123', 'manager'],
    ['eczaci@veniux.com', 'eczaci123', 'manager']
  ];
  for (const [email, pass, role] of users) {
    await q('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [
      email, bcrypt.hashSync(pass, 10), role
    ]);
  }

  /* ─────────── 3. TEDARİKÇİ & ECZA DEPOSU ─────────── */
  const suppliers = [
    ['Selçuk Ecza Deposu A.Ş.', 'Kemal Özkan', 'siparis@selcukecza.com.tr', '+90 216 555 10 20', 'Ataşehir / İstanbul', '7620045518', 1],
    ['Alliance Healthcare Türkiye', 'Zeynep Aksoy', 'satis@alliance-healthcare.com.tr', '+90 232 444 80 90', 'Bornova / İzmir', '0680123456', 2],
    ['As Ecza Deposu', 'Mehmet Eren', 'merkez@asecza.com.tr', '+90 312 380 40 50', 'Yenimahalle / Ankara', '0910887766', 2],
    ['Medikal Sarf Tedarik Ltd.', 'Burcu Şen', 'info@medikalsarf.com.tr', '+90 216 470 11 22', 'Ümraniye / İstanbul', '6110223344', 4],
    ['Soğuk Zincir Lojistik A.Ş.', 'Onur Tekin', 'operasyon@sogukzincir.com.tr', '+90 262 751 60 70', 'Gebze / Kocaeli', '7770998877', 3]
  ];
  for (const s of suppliers) {
    await q(
      'INSERT INTO suppliers (name, contact_name, email, phone, address, tax_no, lead_time_days) VALUES (?,?,?,?,?,?,?)',
      s
    );
  }

  const depots = [
    ['Selçuk Ecza Deposu', 'Ataşehir Şube', '+90 216 555 10 20', 'atasehir@selcukecza.com.tr', 'SLC-4471', 184250.75],
    ['Alliance Healthcare', 'İzmir Bölge', '+90 232 444 80 90', 'izmir@alliance.com.tr', 'ALH-2210', 96430.00],
    ['As Ecza Deposu', 'Ankara Merkez', '+90 312 380 40 50', 'ankara@asecza.com.tr', 'ASE-7788', -12480.40],
    ['Hedef Ecza Deposu', 'Kocaeli Şube', '+90 262 322 55 66', 'kocaeli@hedefecza.com.tr', 'HDF-1093', 42115.20]
  ];
  for (const d of depots) {
    await q(
      'INSERT INTO pharmacy_depots (name, branch, phone, email, account_no, current_balance) VALUES (?,?,?,?,?,?)',
      d
    );
  }

  /* ─────────── 4. DEPOLAR ─────────── */
  const warehouses = [
    ['Ana Merkez Depo', 'main', 'Gebze OSB · A Blok · Kocaeli', 25000, '{"sync":true,"code":"IST-01"}'],
    ['Gebze Lojistik Merkezi', 'distribution', 'Gebze OSB · B Blok · Kocaeli', 40000, '{"sync":true,"code":"KOC-02"}'],
    ['Eczane Ön Banko & Raflar', 'retail', 'Giriş Katı · Banko Arkası', 5000, '{"pos":true,"code":"PH-01"}'],
    ['Soğuk Zincir Dolabı (+2/+8°C)', 'cold', 'Laboratuvar · Dijital Sıcaklık Kontrollü', 1500, '{"temp_control":true,"code":"CLD-01"}']
  ];
  for (const w of warehouses) {
    await q('INSERT INTO warehouses (name, type, location, capacity, source_config) VALUES (?,?,?,?,?)', w);
  }

  /* ─────────── 5. RAF VE GÖZ HARİTASI ─────────── */
  const ZONES = [
    { wh: 1, zone: 'Hızlı Devir', aisles: ['A', 'B'], racks: 6, tiers: 3, bins: 2, type: 'storage', cls: 'ALL' },
    { wh: 1, zone: 'Palet Stok', aisles: ['C'], racks: 5, tiers: 2, bins: 2, type: 'bulk', cls: 'PALLET' },
    { wh: 2, zone: 'Sevkiyat Hazırlık', aisles: ['D', 'E'], racks: 4, tiers: 2, bins: 2, type: 'storage', cls: 'ALL' },
    { wh: 3, zone: 'Banko Çekmece', aisles: ['P'], racks: 3, tiers: 3, bins: 2, type: 'pick_face', cls: 'SMALL' },
    { wh: 4, zone: 'Soğuk Oda', aisles: ['K'], racks: 2, tiers: 2, bins: 2, type: 'cold', cls: 'COLD' }
  ];

  const locations = [];
  let locSeed = 1;
  for (const z of ZONES) {
    for (const aisle of z.aisles) {
      for (let rack = 1; rack <= z.racks; rack++) {
        for (let tier = 1; tier <= z.tiers; tier++) {
          for (let bin = 1; bin <= z.bins; bin++) {
            const code = `${aisle}-${String(rack).padStart(2, '0')}-${String(tier).padStart(2, '0')}-${String(bin).padStart(2, '0')}`;
            locations.push({
              wh: z.wh, code, zone: z.zone, aisle, rack, tier, bin,
              type: z.type, cls: z.cls,
              locked: rnd(locSeed++) > 0.94 ? 1 : 0,
              x: rack * 2.5, y: aisle.charCodeAt(0) - 64, z: tier * 1.4
            });
          }
        }
      }
    }
  }
  // Sahne (staging) lokasyonları
  locations.push({ wh: 1, code: 'STG-IN-01', zone: 'Mal Kabul Sahnesi', aisle: 'STG', rack: 1, tier: 1, bin: 1, type: 'staging', cls: 'ALL', locked: 0, x: 0, y: 0, z: 0 });
  locations.push({ wh: 1, code: 'STG-OUT-01', zone: 'Sevkiyat Sahnesi', aisle: 'STG', rack: 2, tier: 1, bin: 1, type: 'staging', cls: 'ALL', locked: 0, x: 0, y: 1, z: 0 });
  locations.push({ wh: 2, code: 'STG-OUT-02', zone: 'Sevkiyat Sahnesi', aisle: 'STG', rack: 3, tier: 1, bin: 1, type: 'staging', cls: 'ALL', locked: 0, x: 0, y: 2, z: 0 });

  for (const l of locations) {
    await q(
      `INSERT INTO warehouse_locations
        (warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position,
         location_type, max_weight_kg, max_volume_m3, allowed_storage_class, is_locked, lock_reason, x_coord, y_coord, z_coord)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [l.wh, l.code, l.zone, l.aisle, l.rack, l.tier, l.bin, l.type,
        l.type === 'bulk' ? 1200 : 500, l.type === 'bulk' ? 4.5 : 1.5, l.cls,
        l.locked, l.locked ? 'Sayım kilidi' : null, l.x, l.y, l.z]
    );
  }
  console.log(`📦 ${locations.length} raf gözü oluşturuldu.`);

  /* ─────────── 6. ÜRÜN KATALOĞU ─────────── */
  const meds = [
    ['VNX-10428', 'Parol 500 mg 20 Tablet', 'Ağrı Kesici', '8699508010428', 'N02BE01', 'Parasetamol', 'normal', 18.75, 24.90, 1],
    ['VNX-20117', 'Augmentin BID 1000 mg 14 Film Tablet', 'Antibiyotik', '8699546090117', 'J01CR02', 'Amoksisilin + Klavulanik Asit', 'kirmizi', 96.40, 128.60, 1],
    ['VNX-30902', 'Lantus SoloStar 100 IU/ml Kalem', 'Diyabet', '8699874090902', 'A10AE04', 'İnsülin Glarjin', 'normal', 412.30, 528.00, 1],
    ['VNX-11876', 'Dolorex Jel 50 g', 'Kas İskelet', '8699512011876', 'M02AA15', 'Diklofenak', 'normal', 42.10, 58.90, 1],
    ['VNX-22043', 'Devit-3 Damla 15 ml', 'Vitamin', '8699540022043', 'A11CC05', 'Kolekalsiferol', 'normal', 31.20, 44.50, 1],
    ['VNX-33150', 'Coraspin 100 mg 30 Tablet', 'Kardiyoloji', '8699502033150', 'B01AC06', 'Asetilsalisilik Asit', 'normal', 14.60, 21.30, 1],
    ['VNX-44201', 'Nexium 40 mg 28 Tablet', 'Mide', '8699786044201', 'A02BC05', 'Esomeprazol', 'normal', 88.90, 118.40, 1],
    ['VNX-55318', 'Ventolin İnhaler 100 mcg', 'Solunum', '8699522055318', 'R03AC02', 'Salbutamol', 'yesil', 76.20, 99.80, 1],
    ['VNX-66742', 'Rifocin 250 mg Ampul', 'Antibiyotik', '8699591066742', 'J04AB02', 'Rifamisin', 'kirmizi', 54.30, 72.10, 1],
    ['VNX-77905', 'Xanax 0.5 mg 30 Tablet', 'Nöroloji', '8699517077905', 'N05BA12', 'Alprazolam', 'yesil', 39.80, 55.20, 1],
    ['VNX-88431', 'Enoxaparin 4000 IU Enjektör', 'Kardiyoloji', '8699536088431', 'B01AB05', 'Enoksaparin Sodyum', 'normal', 168.50, 214.90, 1],
    ['VNX-99027', 'Prospan Şurup 100 ml', 'Solunum', '8699578099027', 'R05CP', 'Sarmaşık Yaprağı Ekstresi', 'normal', 48.70, 66.30, 1]
  ];
  const consumables = [
    ['VNX-45510', 'Cerrahi Maske 3 Katlı 50li Kutu', 'Medikal Sarf', '8690000455102', 8.40, 14.90],
    ['VNX-45620', 'Nitril Muayene Eldiveni M 100lü', 'Medikal Sarf', '8690000456203', 96.20, 139.00],
    ['VNX-45735', 'Alkol Bazlı El Dezenfektanı 500 ml', 'Medikal Sarf', '8690000457354', 42.10, 62.50],
    ['VNX-45840', 'Steril Enjektör 5 ml 100lü', 'Medikal Sarf', '8690000458405', 118.60, 165.40],
    ['VNX-45955', 'Dijital Ateş Ölçer', 'Medikal Cihaz', '8690000459556', 148.00, 219.90],
    ['VNX-46060', 'Tansiyon Aleti Dijital Koldan', 'Medikal Cihaz', '8690000460606', 612.40, 849.00],
    ['VNX-46175', 'Yara Bandı 100lü Kutu', 'Medikal Sarf', '8690000461757', 22.30, 36.80],
    ['VNX-46280', 'Termal Etiket Rulosu 100x150', 'Depo Sarf', '8690000462808', 74.90, 108.50]
  ];

  let pid = 0;
  for (const [sku, name, cat, barcode, atc, sub, presc, buy, sell] of meds) {
    pid++;
    await q(
      `INSERT INTO products (sku, name, category, barcode, unit, purchase_price, sale_price,
        min_stock_level, max_stock_level, supplier_id, is_medicine, gtin, atc_code, sgk_code,
        active_substance, prescription_type, kamu_fiyati, depocu_fiyati, perakende_fiyat, kdv_orani)
       VALUES (?,?,?,?,'kutu',?,?,?,?,?,1,?,?,?,?,?,?,?,?,10)`,
      [sku, name, cat, barcode, buy, sell, between(pid, 15, 60), between(pid + 50, 300, 800),
        between(pid + 7, 1, 3), barcode, atc, `SGK-${barcode.slice(-6)}`, sub, presc,
        +(sell * 0.72).toFixed(2), buy, sell]
    );
  }
  for (const [sku, name, cat, barcode, buy, sell] of consumables) {
    pid++;
    await q(
      `INSERT INTO products (sku, name, category, barcode, unit, purchase_price, sale_price,
        min_stock_level, max_stock_level, supplier_id, is_medicine, kdv_orani)
       VALUES (?,?,?,?,'adet',?,?,?,?,?,0,20)`,
      [sku, name, cat, barcode, buy, sell, between(pid, 20, 80), between(pid + 30, 400, 900), 4]
    );
  }
  const productCount = pid;
  console.log(`💊 ${productCount} ürün eklendi.`);

  /* ─────────── 7. PARTİ (LOT) & STOK ─────────── */
  const lots = [];
  for (let p = 1; p <= 12; p++) {
    for (let k = 0; k < 2; k++) {
      const lotNo = `LOT-${2026}${String(p).padStart(3, '0')}${k}`;
      const expDays = between(p * 10 + k, 25, 540);
      const [res] = await q(
        `INSERT INTO inventory_lots (product_id, lot_number, supplier_id, production_date, expiry_date,
          supplier_lot_number, status, qa_status) VALUES (?,?,?,?,?,?,'available','approved')`,
        [p, lotNo, between(p, 1, 3), iso(day(-between(p + k, 120, 400))), iso(day(expDays)), `S-${lotNo}`]
      );
      lots.push({ id: res.insertId, product: p, expiry: iso(day(expDays)) });
    }
  }

  const storageLocs = [];
  const [locRows] = await q(
    "SELECT id, warehouse_id, location_code FROM warehouse_locations WHERE location_type IN ('storage','bulk','pick_face','cold') ORDER BY id"
  );
  locRows.forEach((r) => storageLocs.push(r));

  let stockSeed = 1;
  for (let p = 1; p <= productCount; p++) {
    for (const wh of [1, 2, 3]) {
      if (wh === 3 && p > 16) continue;
      const qty = between(stockSeed++, 0, 260);
      await q('INSERT INTO stock_records (product_id, warehouse_id, quantity) VALUES (?,?,?)', [p, wh, qty]);
    }
  }
  // Soğuk zincir ürünleri
  for (const p of [3, 11]) {
    await q('INSERT INTO stock_records (product_id, warehouse_id, quantity) VALUES (?,?,?)', [p, 4, between(p, 20, 90)]);
  }

  // Göz bazlı stok projeksiyonu — haritanın dolu görünmesini sağlar
  let binSeed = 1;
  const occupied = storageLocs.filter((_, i) => rnd(i + 3) > 0.28);
  for (const loc of occupied) {
    const product = between(binSeed, 1, productCount);
    const lot = lots.find((l) => l.product === product);
    await q(
      'INSERT INTO product_bin_records (location_id, product_id, lot_id, quantity, reserved_qty) VALUES (?,?,?,?,?)',
      [loc.id, product, lot ? lot.id : null, between(binSeed + 5, 4, 140), between(binSeed + 9, 0, 12)]
    );
    binSeed++;
  }
  console.log(`🗃️  ${occupied.length}/${storageLocs.length} göz dolu.`);

  /* ─────────── 8. STOK HAREKETLERİ & DEFTER ─────────── */
  const MOVE_TYPES = ['inbound', 'outbound', 'transfer', 'adjustment'];
  const SOURCES = ['manual', 'pda', 'pos', 'medula_import', 'excel'];
  let txSeed = 1;
  for (let i = 0; i < 160; i++) {
    const product = between(txSeed++, 1, productCount);
    const wh = between(txSeed++, 1, 3);
    const type = pick(MOVE_TYPES, i);
    const magnitude = between(txSeed++, 1, 90);
    const amount = type === 'outbound' ? -magnitude : magnitude;
    const when = dt(day(-between(i, 0, 29)));

    await q(
      'INSERT INTO stock_movements (product_id, warehouse_id, target_warehouse_id, change_amount, movement_type, source, note, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [product, wh, type === 'transfer' ? (wh === 1 ? 2 : 1) : null, amount, type, pick(SOURCES, i), null, when]
    );

    const loc = pick(storageLocs, i);
    const before = between(txSeed++, 0, 200);
    await q(
      `INSERT INTO inventory_transactions
        (warehouse_id, location_id, product_id, lot_id, transaction_type, quantity, before_quantity, after_quantity,
         reference_type, reference_id, user_id, idempotency_key, reason_code, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [wh, loc.id, product, (lots.find((l) => l.product === product) || {}).id || null,
        type.toUpperCase(), amount, before, before + amount,
        'MOVEMENT', `MV-${1000 + i}`, between(i, 1, 5), `SEED-TX-${i}`, type === 'adjustment' ? 'COUNT_ADJ' : null, when]
    );
  }
  console.log('📒 160 stok hareketi ve defter kaydı eklendi.');

  /* ─────────── 9. WMS OPERASYONU ─────────── */
  const docks = [
    [1, 'RAMPA-01', 'INBOUND', dt(day(0)), 'Selçuk Lojistik', 'Hasan Tunç', '+90 532 118 44 55', '34 VNX 001', 'IN_PROGRESS'],
    [1, 'RAMPA-02', 'OUTBOUND', dt(day(0)), 'Aras Kargo', 'Serkan Ay', '+90 533 220 77 88', '41 KOC 220', 'SCHEDULED'],
    [2, 'RAMPA-03', 'INBOUND', dt(day(1)), 'Alliance Dağıtım', 'Murat Kılıç', '+90 542 660 11 22', '35 IZM 115', 'SCHEDULED'],
    [2, 'RAMPA-04', 'OUTBOUND', dt(day(-1)), 'Sürat Kargo', 'Emre Doğan', '+90 555 909 33 44', '06 ANK 907', 'COMPLETED']
  ];
  for (const d of docks) {
    await q(
      'INSERT INTO wms_dock_appointments (warehouse_id, dock_code, direction, appointment_time, carrier_company, driver_name, driver_phone, plate_number, status) VALUES (?,?,?,?,?,?,?,?,?)',
      d
    );
  }

  // Durum sözlüğü backend ile birebir aynı olmalı:
  // belge → pending | receiving | stored, kalem → pending | completed
  const receipts = [
    ['MK-2026-0418', 1, 1, 'IRS-778451', 1, 'receiving'],
    ['MK-2026-0419', 1, 2, 'IRS-778462', null, 'pending'],
    ['MK-2026-0420', 2, 3, 'IRS-901233', 3, 'pending'],
    ['MK-2026-0417', 2, 1, 'IRS-778440', null, 'stored']
  ];
  let recSeed = 1;
  for (const [no, wh, sup, waybill, appt, status] of receipts) {
    const [r] = await q(
      `INSERT INTO wms_inbound_receipts (receipt_no, warehouse_id, supplier_id, waybill_no, appointment_id, status,
        total_expected_qty, total_received_qty, total_rejected_qty, received_by, received_at, completed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [no, wh, sup, waybill, appt, status, 0, 0, 0, 1, dt(day(-between(recSeed, 0, 4))),
        status === 'stored' ? dt(day(-1)) : null]
    );
    let expected = 0;
    let received = 0;
    for (let k = 0; k < 4; k++) {
      const product = between(recSeed * 10 + k, 1, productCount);
      const exp = between(recSeed * 3 + k, 20, 180);
      // 'receiving' belgede ilk yarı yerleşmiş, kalanı bekliyor olsun
      const done = status === 'stored' || (status === 'receiving' && k < 2);
      const rec = done ? exp : 0;
      expected += exp;
      received += rec;
      // Hedef raf, belgenin deposuna ait olmalı; aksi hâlde yerleştirme
      // servisi "Hedef lokasyon bu depoya ait değil" diyerek reddeder.
      const whLocs = storageLocs.filter((l) => l.warehouse_id === wh);
      const target = pick(whLocs.length ? whLocs : storageLocs, recSeed + k);
      await q(
        `INSERT INTO wms_inbound_items (receipt_id, product_id, lot_number, expiry_date, expected_qty, received_qty,
          rejected_qty, target_location_id, actual_location_id, status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.insertId, product, `LOT-MK${recSeed}${k}`, iso(day(between(k, 90, 420))), exp, rec, 0,
          target.id, done ? target.id : null, done ? 'completed' : 'pending']
      );
    }
    await q('UPDATE wms_inbound_receipts SET total_expected_qty = ?, total_received_qty = ? WHERE id = ?',
      [expected, received, r.insertId]);
    recSeed++;
  }

  const waves = [
    ['TOP-2419', 1, 'WAVE', 'PROCESSING', 24, 18],
    ['TOP-2418', 1, 'WAVE', 'PROCESSING', 12, 5],
    ['TOP-2416', 1, 'BATCH', 'PACKING', 24, 23],
    ['TOP-2421', 2, 'WAVE', 'pending', 16, 0],
    ['TOP-2415', 2, 'ZONE', 'COMPLETED', 30, 30]
  ];
  let waveSeed = 1;
  for (const [no, wh, type, status, total, picked] of waves) {
    const [w] = await q(
      `INSERT INTO wms_pick_waves (wave_no, warehouse_id, picking_type, status, total_lines, picked_lines,
        assigned_user_id, started_at, completed_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [no, wh, type, status, total, picked, between(waveSeed, 1, 5),
        status === 'pending' ? null : dt(day(-1)),
        status === 'COMPLETED' ? dt(day(-1)) : null, dt(day(-between(waveSeed, 1, 3)))]
    );
    for (let k = 0; k < Math.min(total, 8); k++) {
      const loc = pick(storageLocs, waveSeed * 7 + k);
      const product = between(waveSeed * 11 + k, 1, productCount);
      const req = between(waveSeed + k, 2, 40);
      const done = k < Math.round((picked / total) * Math.min(total, 8));
      await q(
        `INSERT INTO wms_pick_tasks (wave_id, location_id, product_id, requested_qty, picked_qty, sequence_number,
          status, picked_by, picked_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        [w.insertId, loc.id, product, req, done ? req : 0, k + 1,
          done ? 'picked' : 'pending', done ? between(k, 1, 5) : null, done ? dt(day(-1)) : null]
      );
    }
    waveSeed++;
  }

  const hus = [
    ['HU-PLT-00181', '885012345600001811', 'PALLET', 1, 'open'],
    ['HU-PLT-00182', '885012345600001828', 'PALLET', 1, 'closed'],
    ['HU-KOLI-04410', '885012345600044105', 'CARTON', 1, 'open'],
    ['HU-KOLI-04411', '885012345600044112', 'CARTON', 2, 'shipped'],
    ['HU-TOTE-00920', null, 'TOTE', 2, 'open'],
    ['HU-TOTE-00921', null, 'TOTE', 2, 'open']
  ];
  let huSeed = 1;
  for (const [code, sscc, type, wh, status] of hus) {
    await q(
      'INSERT INTO handling_units (hu_code, sscc_code, hu_type, warehouse_id, current_location_id, weight_kg, max_weight_kg, status) VALUES (?,?,?,?,?,?,?,?)',
      [code, sscc, type, wh, pick(storageLocs, huSeed).id, between(huSeed, 12, 480), type === 'PALLET' ? 1000 : 25, status]
    );
    huSeed++;
  }

  const devices = [
    ['PDA-IST-01', 'Zebra TC22 · Mal Kabul', 'PDA', 'Zebra', 1, 1, 87, '192.168.1.41', 'active'],
    ['PDA-IST-02', 'Zebra TC22 · Toplama', 'PDA', 'Zebra', 1, 4, 62, '192.168.1.42', 'active'],
    ['PDA-KOC-01', 'Honeywell CT30 · Sevkiyat', 'PDA', 'Honeywell', 2, 4, 24, '192.168.2.18', 'active'],
    ['FRK-KOC-01', 'Forklift Terminali', 'FORKLIFT', 'Zebra', 2, null, 95, '192.168.2.31', 'active'],
    ['PDA-PH-01', 'Eczane Banko Okuyucu', 'SCANNER', 'Datalogic', 3, 5, 100, '192.168.3.12', 'idle']
  ];
  for (const d of devices) {
    await q(
      'INSERT INTO warehouse_devices (device_uid, device_name, device_type, manufacturer, warehouse_id, assigned_user_id, battery_level, last_ip_address, status) VALUES (?,?,?,?,?,?,?,?,?)',
      d
    );
  }
  console.log('🏭 WMS operasyon verileri eklendi (rampa, mal kabul, dalga, taşıma birimi, cihaz).');

  /* ─────────── 10. SATIN ALMA & SAYIM ─────────── */
  const orders = [
    ['SAT-2026-0091', 1, 1, 'pending'],
    ['SAT-2026-0092', 2, 1, 'partial'],
    ['SAT-2026-0093', 3, 2, 'received'],
    ['SAT-2026-0094', 4, 1, 'pending']
  ];
  let poSeed = 1;
  for (const [no, sup, wh, status] of orders) {
    const [o] = await q(
      'INSERT INTO purchase_orders (order_no, supplier_id, target_warehouse_id, status, total_amount, notes, created_at) VALUES (?,?,?,?,?,?,?)',
      [no, sup, wh, status, 0, null, dt(day(-between(poSeed, 2, 20)))]
    );
    let total = 0;
    for (let k = 0; k < 4; k++) {
      const product = between(poSeed * 13 + k, 1, productCount);
      const qty = between(poSeed + k, 20, 200);
      const price = 20 + between(poSeed * k + 3, 5, 380);
      total += qty * price;
      await q(
        'INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_price, received_quantity) VALUES (?,?,?,?,?)',
        [o.insertId, product, qty, price, status === 'received' ? qty : status === 'partial' ? Math.floor(qty / 2) : 0]
      );
    }
    await q('UPDATE purchase_orders SET total_amount = ? WHERE id = ?', [total, o.insertId]);
    poSeed++;
  }

  const counts = [
    ['SYM-2026-001', 1, 'completed', 'admin@example.com', dt(day(-16)), dt(day(-16))],
    ['SYM-2026-002', 3, 'in_progress', 'eczaci@veniux.com', dt(day(-1)), null]
  ];
  let cSeed = 1;
  for (const [no, wh, status, by, created, completed] of counts) {
    const [c] = await q(
      'INSERT INTO stock_counts (count_no, warehouse_id, status, notes, counted_by, created_at, completed_at) VALUES (?,?,?,?,?,?,?)',
      [no, wh, status, null, by, created, completed]
    );
    for (let k = 0; k < 6; k++) {
      const product = between(cSeed * 17 + k, 1, productCount);
      const sys = between(cSeed + k, 10, 200);
      const counted = sys + between(cSeed * k + 2, -4, 4);
      await q(
        'INSERT INTO stock_count_items (count_id, product_id, system_quantity, counted_quantity, difference) VALUES (?,?,?,?,?)',
        [c.insertId, product, sys, counted, counted - sys]
      );
    }
    cSeed++;
  }

  /* ─────────── 11. UYARILAR & DENETİM ─────────── */
  const alerts = [
    [1, 1, 'low_stock', 'high', 'Parol 500 mg minimum stok seviyesinin altına indi (12 kutu).', 'unread'],
    [3, 4, 'cold_chain', 'critical', 'Soğuk zincir dolabı 9,4 °C ölçüldü — eşik +8 °C aşıldı.', 'unread'],
    [5, 1, 'expiry', 'medium', 'Devit-3 Damla partisi 28 gün içinde miadını dolduruyor.', 'unread'],
    [2, 2, 'low_stock', 'medium', 'Augmentin BID stok seviyesi kritik eşiğe yaklaştı.', 'unread'],
    [null, 1, 'system', 'low', 'Gebze deposunda 3 raf gözü sayım nedeniyle kilitli.', 'read'],
    [7, 3, 'expiry', 'high', 'Nexium 40 mg partisi 12 gün içinde miadını dolduruyor.', 'unread']
  ];
  for (const a of alerts) {
    await q('INSERT INTO alerts (product_id, warehouse_id, alert_type, severity, message, status) VALUES (?,?,?,?,?,?)', a);
  }

  const audits = [
    ['admin@example.com', 'CREATE', 'product', 1, 'Yeni ürün kataloğa eklendi'],
    ['manager@example.com', 'UPDATE', 'stock_record', 12, 'Stok düzeltmesi: +40'],
    ['depo@veniux.com', 'CREATE', 'wms_pick_wave', 1, 'Toplama dalgası oluşturuldu'],
    ['eczaci@veniux.com', 'CREATE', 'colored_prescription', 2, 'Yeşil reçete kaydı'],
    ['admin@example.com', 'DELETE', 'purchase_order', 7, 'İptal edilen sipariş silindi']
  ];
  let aSeed = 1;
  for (const [email, action, entity, entityId, details] of audits) {
    await q('INSERT INTO audit_logs (user_email, action, entity_type, entity_id, details, created_at) VALUES (?,?,?,?,?,?)',
      [email, action, entity, entityId, details, dt(day(-aSeed++))]);
  }

  /* ─────────── 12. ECZANE & İTS ─────────── */
  let batchSeed = 1;
  for (const lot of lots) {
    for (let k = 0; k < 3; k++) {
      await q(
        'INSERT INTO medicine_batches (product_id, gtin, serial_number, lot_number, expiry_date, status, warehouse_id) VALUES (?,?,?,?,?,?,?)',
        [lot.product, `86995080${String(10000 + lot.product).slice(-5)}`, `SN${String(batchSeed).padStart(9, '0')}`,
          `LOT-${lot.id}`, lot.expiry, 'in_stock', lot.product === 3 || lot.product === 11 ? 4 : 3]
      );
      batchSeed++;
    }
  }

  const patients = [
    ['12345678901', 'Ayşe Kandemir', '+90 532 118 22 44', 'Kadıköy / İstanbul', 340.50],
    ['23456789012', 'Mehmet Aslan', '+90 533 220 11 09', 'Ataşehir / İstanbul', 0],
    ['34567890123', 'Fatma Yücel', '+90 542 771 33 18', 'Ümraniye / İstanbul', 128.75],
    ['45678901234', 'Hüseyin Bakır', '+90 555 660 45 21', 'Maltepe / İstanbul', 0],
    ['56789012345', 'Elif Şahin', '+90 541 903 77 66', 'Kartal / İstanbul', 92.40],
    ['67890123456', 'Ramazan Öz', '+90 536 445 90 12', 'Pendik / İstanbul', 0]
  ];
  for (const p of patients) {
    await q('INSERT INTO patient_accounts (tc_no, full_name, phone, address, current_balance) VALUES (?,?,?,?,?)', p);
  }

  let saleSeed = 1;
  for (let i = 0; i < 14; i++) {
    const total = between(saleSeed++, 60, 1400);
    const discount = between(saleSeed++, 0, 40);
    const net = total - discount;
    const sgk = Math.round(net * 0.7);
    const [s] = await q(
      `INSERT INTO pos_sales (receipt_no, patient_id, total_amount, discount_amount, net_amount, payment_method,
        sgk_coverage_amount, patient_copay_amount, status, created_at)
       VALUES (?,?,?,?,?,?,?,?, 'completed', ?)`,
      [`FIS-2026-${String(4100 + i)}`, between(i, 1, 6), total, discount, net,
        pick(['cash', 'card', 'sgk', 'veresiye'], i), sgk, net - sgk, dt(day(-between(i, 0, 12)))]
    );
    for (let k = 0; k < 2; k++) {
      const product = between(saleSeed * 5 + k, 1, productCount);
      const qty = between(saleSeed + k, 1, 4);
      const price = between(saleSeed * k + 11, 15, 420);
      await q(
        'INSERT INTO pos_sale_items (sale_id, product_id, quantity, unit_price, total_price) VALUES (?,?,?,?,?)',
        [s.insertId, product, qty, price, qty * price]
      );
    }
  }

  const prescriptions = [
    ['RCT-2026-1180', 'kirmizi', '12345678901', 'Ayşe Kandemir', 'Dr. Serkan Tunç', '112233', 'PRT-90011', 2, 1],
    ['RCT-2026-1181', 'yesil', '23456789012', 'Mehmet Aslan', 'Dr. Nihal Uçar', '445566', 'PRT-90012', 10, 1],
    ['RCT-2026-1182', 'mor', '34567890123', 'Fatma Yücel', 'Dr. Kaan Demirtaş', '778899', 'PRT-90013', 8, 2],
    ['RCT-2026-1183', 'turuncu', '45678901234', 'Hüseyin Bakır', 'Dr. Serkan Tunç', '112233', 'PRT-90014', 9, 1],
    ['RCT-2026-1184', 'kirmizi', '56789012345', 'Elif Şahin', 'Dr. Ebru Kaplan', '221100', 'PRT-90015', 2, 2]
  ];
  for (const [no, type, tc, name, doctor, diploma, protocol, med, qty] of prescriptions) {
    await q(
      `INSERT INTO colored_prescriptions (prescription_no, prescription_type, patient_tc, patient_name, doctor_name,
        doctor_diploma_no, protocol_no, medicine_id, gtin, serial_number, quantity, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'dispensed')`,
      [no, type, tc, name, doctor, diploma, protocol, med, `86995080${String(10000 + med).slice(-5)}`, `SN${String(med).padStart(9, '0')}`, qty]
    );
  }

  const coldDevices = [
    ['Buzdolabı-01 · Aşı', 'fridge', 'Laboratuvar Sol Duvar', 2, 8, 4],
    ['Buzdolabı-02 · İnsülin', 'fridge', 'Laboratuvar Sağ Duvar', 2, 8, 4],
    ['Derin Dondurucu-01', 'freezer', 'Arka Depo', -25, -15, 4]
  ];
  let cdSeed = 1;
  for (const [name, type, loc, min, max, wh] of coldDevices) {
    const [d] = await q(
      'INSERT INTO cold_chain_devices (device_name, device_type, location, min_temp, max_temp, is_active, warehouse_id) VALUES (?,?,?,?,?,1,?)',
      [name, type, loc, min, max, wh]
    );
    for (let h = 0; h < 24; h++) {
      const base = type === 'freezer' ? -20 : 5;
      const drift = (rnd(cdSeed * 100 + h) - 0.5) * (cdSeed === 2 && h > 20 ? 9 : 2.4);
      const temp = +(base + drift).toFixed(2);
      const alarm = temp > max || temp < min ? 1 : 0;
      const at = new Date(TODAY);
      at.setHours(at.getHours() - (23 - h));
      await q(
        'INSERT INTO cold_chain_logs (device_id, temperature, humidity, is_alarm, alarm_type, recorded_at) VALUES (?,?,?,?,?,?)',
        [d.insertId, temp, between(cdSeed + h, 38, 62), alarm, alarm ? (temp > max ? 'HIGH_TEMP' : 'LOW_TEMP') : null, dt(at)]
      );
    }
    cdSeed++;
  }

  const interactions = [
    ['B01AC06', 'Coraspin', 'B01AB05', 'Enoxaparin', 'major', 'Birlikte kullanımda kanama riski belirgin artar.', 'Hemoraji riski', 'INR ve trombosit takibi yapılmalı.'],
    ['J01CR02', 'Augmentin', 'B01AA03', 'Warfarin', 'moderate', 'Antibiyotik INR değerini yükseltebilir.', 'INR artışı', 'Tedavi süresince INR haftalık ölçülmeli.'],
    ['A02BC05', 'Nexium', 'N05BA12', 'Xanax', 'minor', 'Benzodiazepin metabolizması yavaşlayabilir.', 'Sedasyon artışı', 'Doz azaltımı düşünülebilir.'],
    ['N02BE01', 'Parasetamol', 'B01AA03', 'Warfarin', 'moderate', 'Yüksek dozda antikoagülan etkiyi artırır.', 'Kanama riski', 'Günlük 2 g üzerinde kullanımdan kaçınılmalı.'],
    ['R03AC02', 'Ventolin', 'C07AB02', 'Metoprolol', 'major', 'Beta bloker bronkodilatör etkiyi baskılar.', 'Bronkospazm', 'Kardiyoselektif alternatif tercih edilmeli.']
  ];
  for (const i of interactions) {
    await q(
      'INSERT INTO drug_interactions (atc_code_1, drug_name_1, atc_code_2, drug_name_2, interaction_level, description, clinical_effect, recommendation) VALUES (?,?,?,?,?,?,?,?)',
      i
    );
  }

  const provisions = [
    ['PRV-2026-88101', 'RCT-2026-1180', '12345678901', 'Ayşe Kandemir', 'Dr. Serkan Tunç', 'J06.9', 'Memorial Ataşehir', 'normal', 412.30, 88.20, 0, 'approved'],
    ['PRV-2026-88102', 'RCT-2026-1181', '23456789012', 'Mehmet Aslan', 'Dr. Nihal Uçar', 'E11.9', 'Acıbadem Kadıköy', 'rapor', 1240.00, 0, 44.10, 'approved'],
    ['PRV-2026-88103', 'RCT-2026-1182', '34567890123', 'Fatma Yücel', 'Dr. Kaan Demirtaş', 'M54.5', 'Devlet Hastanesi', 'normal', 96.40, 24.10, 0, 'approved'],
    ['PRV-2026-88104', 'RCT-2026-1183', '45678901234', 'Hüseyin Bakır', 'Dr. Serkan Tunç', 'I10', 'Memorial Ataşehir', 'normal', 0, 0, 0, 'rejected']
  ];
  for (const p of provisions) {
    await q(
      `INSERT INTO medula_provisions (provision_no, prescription_no, patient_tc, patient_name, doctor_name,
        diagnosis_code, hospital_name, provision_type, total_sgk_amount, total_patient_copay, total_equivalent_diff,
        status, rejection_reason)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [...p, p[11] === 'rejected' ? 'Rapor süresi dolmuş' : null]
    );
  }

  /* ─────────── 13. PERSONEL & NÖBET ─────────── */
  const staff = [
    ['Murat Yıldırım', 'Depo Operasyon Şefi', '12345678901', '+90 532 415 22 08', null, 1],
    ['Selin Demir', 'Mesul Müdür Eczacı', '23456789012', '+90 533 220 71 44', '44182', 1],
    ['Ahmet Yılmaz', 'Kurumsal Satış Yöneticisi', '34567890123', '+90 544 908 16 30', null, 1],
    ['Elif Kaya', 'Kurumsal Satış Temsilcisi', '45678901234', '+90 555 771 02 19', null, 1],
    ['Can Demir', 'Bölge Satış Temsilcisi', '56789012345', '+90 541 663 45 77', null, 1],
    ['Hakan Şahin', 'Depo Görevlisi · Toplama', '67890123456', '+90 537 118 60 25', null, 1],
    ['Ayça Korkmaz', 'Sevkiyat Planlama Uzmanı', '78901234567', '+90 546 302 88 91', null, 1],
    ['Burak Aydın', 'Sistem ve Entegrasyon Uzmanı', '89012345678', '+90 538 447 15 63', null, 1],
    ['Gamze Arslan', 'Ön Muhasebe Sorumlusu', '90123456789', '+90 542 819 33 07', null, 1],
    ['Emre Çetin', 'Depo Görevlisi · Mal Kabul', '01234567890', '+90 536 240 77 12', null, 0]
  ];
  for (const s of staff) {
    await q('INSERT INTO pharmacy_staff (full_name, title, tc_no, phone, diploma_no, is_active) VALUES (?,?,?,?,?,?)', s);
  }

  const SHIFTS = ['gunduz', 'aksam', 'gece', 'nobetci'];
  for (let d = -3; d <= 10; d++) {
    for (let staffId = 1; staffId <= 9; staffId++) {
      if (rnd(d * 20 + staffId) > 0.72) continue;
      const shift = pick(SHIFTS, staffId + d);
      await q(
        'INSERT INTO duty_schedule (duty_date, shift_type, staff_id, start_time, end_time, night_surcharge_rate, notes) VALUES (?,?,?,?,?,?,?)',
        [iso(day(d)), shift, staffId,
          shift === 'gece' ? '00:00' : shift === 'aksam' ? '16:00' : '08:00',
          shift === 'gece' ? '08:00' : shift === 'aksam' ? '24:00' : '16:00',
          shift === 'gece' ? 0.4 : 0, null]
      );
    }
  }
  console.log('👷 Personel kadrosu ve nöbet çizelgesi eklendi.');

  /* ─────────── 14. LİSANS ─────────── */
  const [tenant] = await q(
    'INSERT INTO tenants (tenant_code, company_name, email, phone, tax_number, tax_office, address, is_active) VALUES (?,?,?,?,?,?,?,1)',
    ['VNX-DEMO-001', 'Veniux Demo Lojistik A.Ş.', 'info@veniux.com', '+90 262 751 60 70', '7770998877', 'Gebze', 'Gebze OSB, Kocaeli']
  );
  const [lic] = await q(
    `INSERT INTO licenses (license_key, tenant_id, plan_id, status, max_users, max_warehouses, max_devices, max_pdas,
      enabled_features_json, activated_at, expires_at, grace_period_days, last_validation_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['VNX-ENT-2026-DEMO-0001', tenant.insertId, 'ENTERPRISE_ANNUAL', 'ACTIVE', 50, 5, 25, 25,
      '["wms","pharmacy","crm","hr","ai"]', dt(day(-151)), dt(day(214)), 14, dt(day(0))]
  );
  await q(
    'INSERT INTO license_activations (license_id, tenant_id, device_fingerprint, device_name, os_info, app_version, is_active) VALUES (?,?,?,?,?,?,1)',
    [lic.insertId, tenant.insertId, 'DEMO-FP-0001', 'GEBZE-SRV-01', 'Windows Server 2022', '2.4.0']
  );
  await q(
    'INSERT INTO invoices (invoice_no, tenant_id, license_id, amount, currency, billing_period, payment_method, status) VALUES (?,?,?,?,?,?,?,?)',
    ['FTR-2026-0001', tenant.insertId, lic.insertId, 12000, 'USD', 'ANNUAL', 'BANK_TRANSFER', 'PAID']
  );

  /* ─────────── 15. CRM ─────────── */
  const crmCompanies = [
    ['Selçuk Ecza Deposu A.Ş.', 'selcukecza.com.tr', 'İlaç Dağıtım & Lojistik', '6.500+', '₺42,5 Milyar', 'İstanbul, TR', 'Stratejik Ecza Deposu', 'champion', 'Ahmet Yılmaz', '["SAP ERP","İTS Entegrasyonu","Oracle DB","EDI"]', 'Türkiye genelinde 115 şubesiyle 25.000 eczaneye kesintisiz ilaç tedariği ve lojistik hizmeti sağlayan ana ecza deposu.', 'https://selcukecza.com.tr', 'https://linkedin.com/company/selcuk-ecza', '+90 216 555 10 20', '7620045518'],
    ['Alliance Healthcare Türkiye', 'alliance-healthcare.com.tr', 'Uluslararası İlaç Dağıtımı', '2.800+', '₺18,2 Milyar', 'İzmir, TR', 'Kurumsal Ecza Deposu', 'champion', 'Elif Kaya', '["Microsoft Dynamics 365","İTS Webhook","PostgreSQL"]', 'Sağlık sektöründe eczaneler ve hastaneler için lojistik ve tedarik zinciri çözümleri sunmaktadır.', 'https://alliance-healthcare.com.tr', 'https://linkedin.com/company/alliance-healthcare-turkey', '+90 232 444 80 90', '0680123456'],
    ['As Ecza Deposu', 'asecza.com.tr', 'Bölgesel İlaç Dağıtımı', '1.200+', '₺8,4 Milyar', 'Ankara, TR', 'Bölgesel Depo', 'healthy', 'Can Demir', '["Veniux API","Farmakom DB","Firebird"]', 'İç Anadolu ve Ege bölgesinde hızlı ve güvenilir ilaç ve medikal sarf malzeme dağıtımı.', 'https://asecza.com.tr', 'https://linkedin.com/company/as-ecza', '+90 312 380 40 50', '0910887766'],
    ['Memorial Sağlık Grubu', 'memorial.com.tr', 'Özel Hastane Zinciri', '7.500+', '₺12,1 Milyar', 'İstanbul, TR', 'Stratejik Hastane Grubu', 'healthy', 'Ahmet Yılmaz', '["HBYS","Veniux ERP","HL7","PACS"]', 'JCI akreditasyonuna sahip 11 hastanesiyle Türkiye’nin lider özel sağlık kurumlarından biri.', 'https://memorial.com.tr', 'https://linkedin.com/company/memorial-health-group', '+90 212 314 66 66', '6220334455'],
    ['Gündüz Medikal & Ortopedi Ltd.', 'gunduzmedikal.com.tr', 'Medikal Cihaz & Ortopedi', '180+', '₺420 Milyon', 'İzmir, TR', 'Yeni Hesap', 'at_risk', 'Can Demir', '["Excel","Logo Tiger"]', 'Ortopedik destek ürünleri ve medikal sarf malzeme distribütörü.', 'https://gunduzmedikal.com.tr', null, '+90 232 220 11 22', '3980112233']
  ];
  for (const c of crmCompanies) {
    await q(
      `INSERT INTO crm_companies (name, domain, industry, employees, annual_revenue, location, tier, health_status,
        account_owner, tech_stack, description, website, linkedin, phone, tax_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      c
    );
  }

  const crmContacts = [
    ['Kemal Özkan', 'Tedarik Zinciri ve Satın Alma Direktörü', 1, 'kemal.ozkan@selcukecza.com.tr', '+90 216 555 10 20', 'İstanbul, Türkiye', 'Yetkili Satın Alıcı', 'Ahmet Yılmaz', 95, '["C-Level","Karar Verici","Yıllık Sözleşme"]', '1 saat önce'],
    ['Zeynep Aksoy', 'Bilgi Teknolojileri ve İTS Entegrasyon Müdürü', 2, 'zeynep.aksoy@alliance-healthcare.com.tr', '+90 232 444 80 90', 'İzmir, Türkiye', 'Teknik Koordinatör', 'Elif Kaya', 92, '["Teknik","Entegrasyon"]', '3 saat önce'],
    ['Mehmet Eren', 'Eczane Satış & Dağıtım Müdürü', 3, 'mehmet.eren@asecza.com.tr', '+90 312 380 40 50', 'Ankara, Türkiye', 'Sözleşme Aşamasında', 'Can Demir', 88, '["Saha","Bölgesel"]', 'Dün'],
    ['Dr. Nihal Uçar', 'Merkez Eczane Sorumlusu', 4, 'nihal.ucar@memorial.com.tr', '+90 212 314 66 66', 'İstanbul, Türkiye', 'Aktif Fırsat', 'Ahmet Yılmaz', 90, '["Hastane","Klinik"]', '2 gün önce'],
    ['Merve Gündüz', 'Genel Müdür', 5, 'merve@gunduzmedikal.com.tr', '+90 232 220 11 22', 'İzmir, Türkiye', 'İlk Görüşme', 'Can Demir', 64, '["KOBİ"]', '5 gün önce'],
    ['Hakan Söylemez', 'Lojistik Operasyon Müdürü', 1, 'hakan.soylemez@selcukecza.com.tr', '+90 216 555 10 24', 'İstanbul, Türkiye', 'Teknik Koordinatör', 'Ahmet Yılmaz', 78, '["Operasyon","WMS"]', '4 saat önce']
  ];
  for (const c of crmContacts) {
    await q(
      `INSERT INTO crm_contacts (full_name, job_title, company_id, email, phone, location, contact_status, owner,
        lead_score, tags, last_contacted) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      c
    );
  }

  const crmLeads = [
    ['Ecz. Halil İbrahim', 'Şifa Eczanesi (Kadıköy)', 'Mesul Müdür Eczacı', 'halil@sifaeczanesi.com', '+90 216 345 67 89', 'Doğrudan Web Başvurusu', 'qualified', 94, 65000, 'Ahmet Yılmaz', 'Farmakom ve Medula reçete aktarım desteği talep ediyor.'],
    ['Dr. Serkan Tunç', 'Avrasya Poliklinikleri Grubu', 'Medikal Direktör', 'stunc@avrasyasaglik.com', '+90 212 680 90 00', 'Tavsiye & Referans', 'new', 86, 240000, 'Elif Kaya', '3 şubenin ortak medikal stok ve reçete sisteminin merkezileştirilmesi.'],
    ['Merve Gündüz', 'Gündüz Medikal & Ortopedi Ltd.', 'Genel Müdür', 'merve@gunduzmedikal.com.tr', '+90 232 220 11 22', 'Sektörel Fuar', 'contacted', 75, 120000, 'Can Demir', 'UTS entegrasyonu ve parti numarası takibi istiyor.'],
    ['Ecz. Burcu Tekin', 'Hayat Eczanesi (Bornova)', 'Eczacı', 'burcu@hayateczanesi.com', '+90 232 441 22 33', 'Doğrudan Web Başvurusu', 'new', 71, 48000, 'Elif Kaya', 'Tek şube, POS ve soğuk zincir modülü ile ilgileniyor.'],
    ['Okan Bayraktar', 'Bayraktar Medikal Lojistik', 'Operasyon Direktörü', 'okan@bayraktarlojistik.com', '+90 262 751 88 99', 'Soğuk Arama', 'unqualified', 42, 0, 'Can Demir', 'Bütçe bu yıl için uygun değil, gelecek çeyrek tekrar aranacak.']
  ];
  for (const l of crmLeads) {
    await q(
      `INSERT INTO crm_leads (name, company, job_title, email, phone, source, status, score, estimated_value, owner, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      l
    );
  }

  const crmDeals = [
    ['Selçuk Ecza Otomatik İTS İrsaliye Entegrasyon Lisansı', 1, 950000, 'negotiation', 85, 'Ahmet Yılmaz', iso(day(5)), 'urgent', '["İTS Entegrasyonu","Yıllık Kurumsal"]'],
    ['Alliance Healthcare Çoklu Depo Stok Senkronizasyonu', 2, 890000, 'proposal', 65, 'Elif Kaya', iso(day(20)), 'high', '["Depo Senkronizasyonu","Kurumsal"]'],
    ['Memorial Sağlık Grubu Merkez Depo & HBYS Entegrasyonu', 4, 1200000, 'won', 100, 'Ahmet Yılmaz', iso(day(-16)), 'urgent', '["Hastane Entegrasyonu","Tamamlandı"]'],
    ['As Ecza Bölgesel WMS Yaygınlaştırma', 3, 420000, 'qualification', 35, 'Can Demir', iso(day(45)), 'medium', '["WMS","Bölgesel"]'],
    ['Gündüz Medikal UTS Takip Modülü', 5, 120000, 'proposal', 45, 'Can Demir', iso(day(30)), 'low', '["UTS","KOBİ"]'],
    ['Selçuk Ecza Soğuk Zincir İzleme Genişletme', 1, 310000, 'qualification', 30, 'Ahmet Yılmaz', iso(day(60)), 'medium', '["Soğuk Zincir"]']
  ];
  for (const d of crmDeals) {
    await q(
      `INSERT INTO crm_deals (title, company_id, value, stage, probability, sales_rep, expected_close_date, priority, tags)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      d
    );
  }

  const crmTasks = [
    ['Selçuk Ecza Bilgi İşlem ile İTS Webhook Testi Yapılacak', 'urgent', 'Ahmet Yılmaz', iso(day(-10)), 1, 1, 'in_progress', '["Teknik Test","İTS"]'],
    ['Şifa Eczanesi Farmakom Veritabanı Aktarım Desteği', 'high', 'Elif Kaya', iso(day(-9)), null, null, 'todo', '["Farmakom","Destek"]'],
    ['Alliance teklif revizyonu gönderilecek', 'high', 'Elif Kaya', iso(day(2)), 2, 2, 'todo', '["Teklif"]'],
    ['Memorial devreye alma toplantısı planla', 'medium', 'Ahmet Yılmaz', iso(day(4)), 4, 3, 'todo', '["Devreye Alma"]'],
    ['As Ecza saha ziyareti raporu', 'low', 'Can Demir', iso(day(-2)), 3, 4, 'completed', '["Saha"]'],
    ['Gündüz Medikal UTS demo hazırlığı', 'medium', 'Can Demir', iso(day(7)), 5, 5, 'todo', '["Demo","UTS"]']
  ];
  for (const t of crmTasks) {
    await q(
      `INSERT INTO crm_tasks (title, priority, assignee, due_date, related_company_id, related_deal_id, status, tags)
       VALUES (?,?,?,?,?,?,?,?)`,
      t
    );
  }

  const crmActivities = [
    ['deal_won', 'Sözleşme İmzalandı: Memorial Sağlık Grubu (₺1.200.000)', '11 hastanenin merkez eczane ve depo entegrasyonu için 2 yıllık kurumsal sözleşme onaylandı.', 'Ahmet Yılmaz', 'Memorial Sağlık Grubu', 'success', dt(day(-1))],
    ['meeting', 'Görüşme Tamamlandı: Selçuk Ecza IT Ekibi ile Güvenlik Toplantısı', 'İTS otomatik bildirimleri ve SSL şifreleme protokolü mutabakatı sağlandı.', 'Ahmet Yılmaz', 'Selçuk Ecza Deposu A.Ş.', 'info', dt(day(0))],
    ['stage_change', 'Fırsat Aşaması Güncellendi: Alliance Healthcare → Teklif', 'Çoklu depo senkronizasyonu için fiyat teklifi paylaşıldı.', 'Elif Kaya', 'Alliance Healthcare Türkiye', 'purple', dt(day(-2))],
    ['call', 'Arama: Gündüz Medikal genel müdürü ile ilk temas', 'UTS entegrasyonu ihtiyacı doğrulandı, demo talep edildi.', 'Can Demir', 'Gündüz Medikal & Ortopedi Ltd.', 'info', dt(day(-4))],
    ['automation', 'Otomasyon Çalıştı: Kritik stok sipariş taslağı', '14 kalem için otomatik sipariş taslağı oluşturuldu.', 'Sistem', 'Ana Merkez Depo', 'purple', dt(day(0))],
    ['email', 'E-posta: As Ecza bölgesel yaygınlaştırma bilgilendirmesi', 'Pilot şube listesi ve kurulum takvimi iletildi.', 'Can Demir', 'As Ecza Deposu', 'info', dt(day(-6))],
    ['note', 'Not: Memorial devreye alma ekibi belirlendi', 'Teknik ekip ve eczane sorumluları atandı.', 'Ahmet Yılmaz', 'Memorial Sağlık Grubu', 'info', dt(day(-3))]
  ];
  for (const a of crmActivities) {
    await q(
      `INSERT INTO crm_activities (activity_type, title, description, user_name, related_object, badge_color, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      a
    );
  }

  const crmAutomations = [
    ['Kritik Seviye Altındaki İlaçlar İçin Otomatik Depo Sipariş Taslağı', 'Stok Miktarı <= Minimum Eşik Değeri', 3, 1, 184, '1 saat önce',
      '[{"id":"s1","type":"trigger","label":"Tetikleyici: Ürün stoğu tanımlı kritik eşiğin altına indiğinde"},{"id":"s2","type":"action","label":"İşlem: En uygun fiyatlı anlaşmalı ecza deposu için sipariş taslağı aç"},{"id":"s3","type":"action","label":"İşlem: Sorumlu eczacıya ve satın alma yöneticisine bildirim gönder"}]'],
    ['Yaklaşan Miad (SKT <= 90 Gün) Otomatik İade & Takas Bildirimi', 'Son Kullanma Tarihine Kalan Gün <= 90', 2, 1, 62, 'Bugün 09:00',
      '[{"id":"s1","type":"trigger","label":"Tetikleyici: İlaç partisinin son kullanımına 90 gün veya daha az kaldığında"},{"id":"s2","type":"action","label":"İşlem: Miad Radarı paneline ekle ve tedarikçi ecza deposuna takas uyarısı oluştur"}]'],
    ['Kazanılan Fırsat Sonrası Devreye Alma Görevi Aç', 'Fırsat Aşaması = Kazanıldı', 2, 0, 9, '3 gün önce',
      '[{"id":"s1","type":"trigger","label":"Tetikleyici: Bir fırsat Kazanıldı aşamasına geçtiğinde"},{"id":"s2","type":"action","label":"İşlem: Hesap sorumlusuna devreye alma görevi ata"}]']
  ];
  for (const a of crmAutomations) {
    await q(
      `INSERT INTO crm_automations (name, trigger_text, actions_count, enabled, runs_count, last_run, steps_json)
       VALUES (?,?,?,?,?,?,?)`,
      a
    );
  }

  const crmNotifications = [
    ['deals', 'Memorial Sağlık Sözleşmesi Onaylandı (₺1,2M)', 'Merkez depo ve HBYS entegrasyon sözleşmesi başarıyla kapatıldı.', 0, '/crm?sekme=firsatlar'],
    ['tasks', 'Bugün Teslim: Selçuk Ecza İTS Webhook Testi', 'Ahmet Yılmaz tarafından atanan görev bugün tamamlanmalı.', 0, '/crm?sekme=gorevler'],
    ['leads', 'Yeni Aday: Ecz. Burcu Tekin', 'Web başvurusu üzerinden yeni aday müşteri düştü.', 0, '/crm?sekme=adaylar'],
    ['deals', 'Alliance teklifi 20 gün içinde kapanıyor', 'Beklenen kapanış tarihine yaklaşıldı.', 1, '/crm?sekme=firsatlar']
  ];
  for (const n of crmNotifications) {
    await q('INSERT INTO crm_notifications (category, title, message, is_read, link) VALUES (?,?,?,?,?)', n);
  }
  console.log('🤝 CRM verileri eklendi (şirket, kişi, aday, fırsat, görev, aktivite, otomasyon, bildirim).');

  /* ─────────── 16. İNSAN KAYNAKLARI ─────────── */
  const departments = [
    ['Depo Operasyonları', '#F97316', 'MLZ-100'],
    ['Eczane & İTS', '#0EA5E9', 'ECZ-200'],
    ['Satış & CRM', '#8B5CF6', 'SAT-300'],
    ['Lojistik & Sevkiyat', '#10B981', 'LOJ-400'],
    ['Muhasebe & Finans', '#F59E0B', 'FIN-500'],
    ['Bilgi Teknolojileri', '#6366F1', 'BT-600']
  ];
  for (const d of departments) {
    await q('INSERT INTO hr_departments (name, color, cost_center) VALUES (?,?,?)', d);
  }

  const shifts = [
    ['gunduz', 'Gündüz', '08:00', '16:00', '#F97316', 0],
    ['aksam', 'Akşam', '16:00', '24:00', '#8B5CF6', 0.2],
    ['gece', 'Gece', '00:00', '08:00', '#334155', 0.4],
    ['izinli', 'İzinli', '—', '—', '#94A3B8', 0]
  ];
  for (const s of shifts) {
    await q('INSERT INTO hr_shifts (code, name, start_time, end_time, color, night_rate) VALUES (?,?,?,?,?,?)', s);
  }

  const leaveTypes = [
    ['yillik', 'Yıllık İzin', 1, 26],
    ['mazeret', 'Mazeret İzni', 1, 5],
    ['rapor', 'İstirahat Raporu', 1, null],
    ['ucretsiz', 'Ücretsiz İzin', 0, null],
    ['dogum', 'Doğum / Babalık İzni', 1, 112]
  ];
  for (const t of leaveTypes) {
    await q('INSERT INTO hr_leave_types (code, name, is_paid, max_days) VALUES (?,?,?,?)', t);
  }

  const employees = [
    ['VNX-0114', 'Murat Yıldırım', 'Depo Operasyon Şefi', 1, null, 'aktif', 'Belirsiz Süreli', '2021-03-15', null, '1988-06-02', 'erkek', 'evli', '123******78', '2021-0114-77', '+90 532 415 22 08', 'murat.yildirim@veniux.com', 'İstanbul', 'Ataşehir / İstanbul', 'Ana Merkez Depo · IST-01', 'Lisans · Lojistik Yönetimi', 'Ayşe Yıldırım · +90 532 415 22 09', '0 Rh+', 'gunduz', 45, 'TR12 0006 2000 1234 5678 9012 34', 78500],
    ['VNX-0121', 'Selin Demir', 'Mesul Müdür Eczacı', 2, null, 'aktif', 'Belirsiz Süreli', '2020-09-01', null, '1991-01-19', 'kadin', 'bekar', '456******12', '2020-0121-04', '+90 533 220 71 44', 'selin.demir@veniux.com', 'İstanbul', 'Kadıköy / İstanbul', 'Eczane Ön Banko · PH-01', 'Lisans · Eczacılık Fakültesi', 'Kaan Demir · +90 533 220 71 45', 'A Rh+', 'gunduz', 45, 'TR33 0006 2000 2345 6789 0123 45', 96000],
    ['VNX-0133', 'Ahmet Yılmaz', 'Kurumsal Satış Yöneticisi', 3, null, 'aktif', 'Belirsiz Süreli', '2022-01-10', null, '1990-11-27', 'erkek', 'evli', '789******34', '2022-0133-19', '+90 544 908 16 30', 'ahmet.yilmaz@veniux.com', 'İstanbul', 'Beşiktaş / İstanbul', 'Genel Müdürlük', 'Yüksek Lisans · İşletme', 'Deniz Yılmaz · +90 544 908 16 31', 'B Rh+', 'gunduz', 45, 'TR55 0006 2000 3456 7890 1234 56', 88000],
    ['VNX-0148', 'Elif Kaya', 'Kurumsal Satış Temsilcisi', 3, 3, 'aktif', 'Belirsiz Süreli', '2023-04-03', null, '1995-05-08', 'kadin', 'bekar', '234******56', '2023-0148-62', '+90 555 771 02 19', 'elif.kaya@veniux.com', 'İzmir', 'Bornova / İzmir', 'Ege Bölge Ofisi', 'Lisans · Uluslararası Ticaret', 'Meral Kaya · +90 555 771 02 20', '0 Rh−', 'gunduz', 45, 'TR77 0006 2000 4567 8901 2345 67', 62000],
    ['VNX-0155', 'Can Demir', 'Bölge Satış Temsilcisi', 3, 3, 'izinli', 'Belirsiz Süreli', '2023-08-21', null, '1993-09-14', 'erkek', 'evli', '567******90', '2023-0155-31', '+90 541 663 45 77', 'can.demir@veniux.com', 'Ankara', 'Çankaya / Ankara', 'İç Anadolu Bölge Ofisi', 'Lisans · Pazarlama', 'Berk Demir · +90 541 663 45 78', 'A Rh−', 'gunduz', 45, 'TR99 0006 2000 5678 9012 3456 78', 58000],
    ['VNX-0162', 'Hakan Şahin', 'Depo Görevlisi · Toplama', 1, 1, 'aktif', 'Belirli Süreli', '2024-02-12', null, '1998-03-30', 'erkek', 'bekar', '890******23', '2024-0162-08', '+90 537 118 60 25', 'hakan.sahin@veniux.com', 'Kocaeli', 'Gebze / Kocaeli', 'Gebze Lojistik Merkezi · KOC-02', 'Lise · Meslek Lisesi', 'Nazlı Şahin · +90 537 118 60 26', 'AB Rh+', 'aksam', 45, 'TR21 0006 2000 6789 0123 4567 89', 42000],
    ['VNX-0170', 'Ayça Korkmaz', 'Sevkiyat Planlama Uzmanı', 4, 1, 'aktif', 'Belirsiz Süreli', '2022-11-07', null, '1994-12-11', 'kadin', 'evli', '345******67', '2022-0170-45', '+90 546 302 88 91', 'ayca.korkmaz@veniux.com', 'Kocaeli', 'Gebze / Kocaeli', 'Gebze Lojistik Merkezi · KOC-02', 'Lisans · Ulaştırma ve Lojistik', 'Onur Korkmaz · +90 546 302 88 92', '0 Rh+', 'gunduz', 45, 'TR43 0006 2000 7890 1234 5678 90', 61000],
    ['VNX-0184', 'Burak Aydın', 'Sistem ve Entegrasyon Uzmanı', 6, null, 'aktif', 'Belirsiz Süreli', '2021-06-28', null, '1992-07-23', 'erkek', 'bekar', '678******01', '2021-0184-90', '+90 538 447 15 63', 'burak.aydin@veniux.com', 'İstanbul', 'Maltepe / İstanbul', 'Genel Müdürlük', 'Lisans · Bilgisayar Mühendisliği', 'Sevgi Aydın · +90 538 447 15 64', 'B Rh−', 'gunduz', 45, 'TR65 0006 2000 8901 2345 6789 01', 92000],
    ['VNX-0192', 'Gamze Arslan', 'Ön Muhasebe Sorumlusu', 5, null, 'aktif', 'Belirsiz Süreli', '2023-01-16', null, '1996-02-05', 'kadin', 'bekar', '901******45', '2023-0192-27', '+90 542 819 33 07', 'gamze.arslan@veniux.com', 'İstanbul', 'Ümraniye / İstanbul', 'Genel Müdürlük', 'Ön Lisans · Muhasebe', 'Tuna Arslan · +90 542 819 33 08', 'A Rh+', 'gunduz', 45, 'TR87 0006 2000 9012 3456 7890 12', 51000],
    ['VNX-0203', 'Emre Çetin', 'Depo Görevlisi · Mal Kabul', 1, 1, 'ayrildi', 'Belirli Süreli', '2024-05-06', '2026-07-31', '1999-10-17', 'erkek', 'bekar', '112******89', '2024-0203-53', '+90 536 240 77 12', 'emre.cetin@veniux.com', 'Kocaeli', 'Darıca / Kocaeli', 'Gebze Lojistik Merkezi · KOC-02', 'Lise', 'Hale Çetin · +90 536 240 77 13', '0 Rh+', 'gunduz', 45, 'TR09 0006 2000 0123 4567 8901 23', 40000]
  ];
  for (const e of employees) {
    await q(
      `INSERT INTO hr_employees (employee_no, full_name, title, department_id, manager_id, status, employment_type,
        hire_date, exit_date, birth_date, gender, marital_status, tc_no, sgk_no, phone, email, city, address,
        work_site, education, emergency_contact, blood_type, default_shift, weekly_hours, iban, salary_gross)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      e
    );
  }
  await q("UPDATE hr_employees SET exit_reason = 'Sözleşme süresi doldu' WHERE status = 'ayrildi'");

  const activeIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Vardiya çizelgesi — geçen hafta + bu hafta + gelecek hafta
  for (let d = -7; d <= 7; d++) {
    const date = day(d);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    for (const emp of activeIds) {
      const onLeave = emp === 5 && d >= -2 && d <= 2;
      let code;
      if (onLeave) code = 'izinli';
      else if (weekend) code = rnd(d * 30 + emp) > 0.7 ? 'gunduz' : 'izinli';
      else code = emp === 6 ? 'aksam' : (emp === 8 && d % 5 === 0 ? 'gece' : 'gunduz');
      await q('INSERT INTO hr_schedule (employee_id, work_date, shift_code) VALUES (?,?,?)', [emp, iso(date), code]);
    }
  }

  // Devam kayıtları — son 10 iş günü
  for (let d = -9; d <= 0; d++) {
    const date = day(d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    for (const emp of activeIds) {
      const seedN = d * 40 + emp;
      const onLeave = emp === 5 && d >= -2;
      if (onLeave) {
        await q('INSERT INTO hr_attendance (employee_id, work_date, status) VALUES (?,?,?)', [emp, iso(date), 'izinli']);
        continue;
      }
      const absent = rnd(seedN) > 0.94;
      if (absent) {
        await q('INSERT INTO hr_attendance (employee_id, work_date, status) VALUES (?,?,?)', [emp, iso(date), 'gelmedi']);
        continue;
      }
      const late = rnd(seedN + 5) > 0.78 ? between(seedN, 3, 55) : 0;
      const inH = 8 * 60 + late;
      const overtime = rnd(seedN + 9) > 0.8 ? between(seedN + 2, 15, 120) : 0;
      const outH = 16 * 60 + overtime;
      const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      await q(
        'INSERT INTO hr_attendance (employee_id, work_date, check_in, check_out, late_minutes, overtime_minutes, status) VALUES (?,?,?,?,?,?,?)',
        [emp, iso(date), hhmm(inH), d === 0 ? null : hhmm(outH), late, d === 0 ? 0 : overtime, d === 0 ? 'icerde' : 'cikti']
      );
    }
  }

  const balances = [[1, 20, 6, 0], [2, 20, 11, 2], [3, 20, 4, 0], [4, 14, 9, 0], [5, 14, 5, 5], [6, 14, 2, 3], [7, 20, 13, 0], [8, 20, 7, 0], [9, 14, 3, 1]];
  for (const [emp, ent, used, pend] of balances) {
    await q('INSERT INTO hr_leave_balances (employee_id, year, entitled_days, used_days, pending_days) VALUES (?,?,?,?,?)',
      [emp, 2026, ent, used, pend]);
  }

  const leaveReqs = [
    [5, 'yillik', iso(day(-2)), iso(day(2)), 5, 'onaylandi', iso(day(-17)), 'Ahmet Yılmaz', 'Aile ziyareti'],
    [6, 'yillik', iso(day(11)), iso(day(13)), 3, 'bekliyor', iso(day(-1)), null, 'Kişisel'],
    [2, 'mazeret', iso(day(-1)), iso(day(-1)), 1, 'onaylandi', iso(day(-2)), 'Ahmet Yılmaz', 'Eczacı odası toplantısı'],
    [9, 'rapor', iso(day(0)), iso(day(1)), 2, 'bekliyor', iso(day(0)), null, 'İstirahat raporu · 2 gün'],
    [2, 'yillik', iso(day(25)), iso(day(26)), 2, 'bekliyor', iso(day(-3)), null, 'Kısa tatil'],
    [7, 'ucretsiz', iso(day(-24)), iso(day(-22)), 3, 'reddedildi', iso(day(-31)), 'Murat Yıldırım', 'Sevkiyat yoğunluğu nedeniyle uygun görülmedi'],
    [4, 'yillik', iso(day(-40)), iso(day(-33)), 8, 'onaylandi', iso(day(-55)), 'Ahmet Yılmaz', 'Yıllık izin kullanımı']
  ];
  for (const r of leaveReqs) {
    await q(
      `INSERT INTO hr_leave_requests (employee_id, leave_code, start_date, end_date, days, status, requested_at, approver, reason)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      r
    );
  }

  const goals = [
    [1, '2026 Q3', 'Mal kabul çevrim süresi', 45, 38, 'dk', 'lower'],
    [1, '2026 Q3', 'Sayım doğruluk oranı', 99.5, 99.94, '%', 'higher'],
    [2, '2026 Q3', 'Provizyon ret oranı', 3, 1.8, '%', 'lower'],
    [2, '2026 Q3', 'Reçete işlem hacmi', 1200, 1284, 'adet', 'higher'],
    [3, '2026 Q3', 'Kapanan sözleşme değeri', 1500000, 2150000, '₺', 'higher'],
    [4, '2026 Q3', 'Kapanan sözleşme değeri', 900000, 890000, '₺', 'higher'],
    [5, '2026 Q3', 'Kapanan sözleşme değeri', 600000, 420000, '₺', 'higher'],
    [6, '2026 Q3', 'Saatlik toplama satırı', 60, 71, 'satır', 'higher'],
    [7, '2026 Q3', 'Zamanında sevkiyat', 96, 97.4, '%', 'higher'],
    [8, '2026 Q3', 'Entegrasyon kesintisi', 120, 64, 'dk', 'lower'],
    [9, '2026 Q3', 'Mutabakat kapanış süresi', 5, 6.2, 'gün', 'lower']
  ];
  for (const g of goals) {
    await q('INSERT INTO hr_goals (employee_id, period, label, target_value, actual_value, unit, direction) VALUES (?,?,?,?,?,?,?)', g);
  }

  const reviews = [
    [1, '2026 Q2', 4.6, 'Genel Müdürlük', 'Gebze devreye alma sürecini planın önünde tamamladı.'],
    [2, '2026 Q2', 4.8, 'Genel Müdürlük', 'Renkli reçete denetiminde sıfır bulgu.'],
    [3, '2026 Q2', 4.4, 'Genel Müdürlük', 'Memorial anlaşması hedefin üzerinde kapandı.'],
    [4, '2026 Q2', 4.1, 'Ahmet Yılmaz', 'Ege bölgesinde portföy büyümesi istikrarlı.'],
    [6, '2026 Q2', 3.9, 'Murat Yıldırım', 'Toplama hızı iyi; akşam vardiyası devam düzeni takip edilmeli.'],
    [7, '2026 Q2', 4.3, 'Murat Yıldırım', 'Rampa randevu planlaması sorunsuz ilerliyor.'],
    [8, '2026 Q2', 4.5, 'Genel Müdürlük', 'İTS webhook kesintilerini kalıcı olarak çözdü.'],
    [9, '2026 Q2', 3.6, 'Genel Müdürlük', 'Mutabakat kapanışlarında gecikme; süreç desteği planlandı.']
  ];
  for (const r of reviews) {
    await q('INSERT INTO hr_reviews (employee_id, period, score, reviewer, note) VALUES (?,?,?,?,?)', r);
  }

  const documents = [
    [1, 'sozlesme', 'Belirsiz Süreli İş Sözleşmesi', 'sozlesme-0114.pdf', '2021-03-15', null, 'gecerli'],
    [1, 'saglik', 'İşe Giriş Sağlık Raporu', 'saglik-0114.pdf', '2021-03-10', '2027-03-10', 'gecerli'],
    [2, 'diploma', 'Eczacılık Fakültesi Diploması', 'diploma-0121.pdf', '2014-06-20', null, 'gecerli'],
    [2, 'ruhsat', 'Mesul Müdürlük Belgesi', 'ruhsat-0121.pdf', '2020-09-01', '2027-09-01', 'gecerli'],
    [3, 'sozlesme', 'Belirsiz Süreli İş Sözleşmesi', 'sozlesme-0133.pdf', '2022-01-10', null, 'gecerli'],
    [6, 'sozlesme', 'Belirli Süreli İş Sözleşmesi', 'sozlesme-0162.pdf', '2024-02-12', '2026-11-30', 'suresi_doluyor'],
    [6, 'ehliyet', 'Forklift Operatör Belgesi', 'forklift-0162.pdf', '2024-03-01', '2027-03-01', 'gecerli'],
    [7, 'sozlesme', 'Belirsiz Süreli İş Sözleşmesi', 'sozlesme-0170.pdf', '2022-11-07', null, 'gecerli'],
    [8, 'gizlilik', 'Gizlilik ve KVKK Taahhütnamesi', 'kvkk-0184.pdf', '2021-06-28', null, 'gecerli'],
    [9, 'sozlesme', 'Belirsiz Süreli İş Sözleşmesi', 'sozlesme-0192.pdf', '2023-01-16', null, 'gecerli']
  ];
  for (const d of documents) {
    await q('INSERT INTO hr_documents (employee_id, doc_type, title, file_name, issued_at, expires_at, status) VALUES (?,?,?,?,?,?,?)', d);
  }

  const trainings = [
    [1, 'İş Sağlığı ve Güvenliği Temel Eğitimi', 'OSGB Kocaeli', '2025-02-14', '2028-02-14', 'ISG-2025-1140', 'tamamlandi'],
    [1, 'Depo Yönetimi ve 5S', 'Lojistik Derneği', '2024-10-08', null, 'LOJ-2024-770', 'tamamlandi'],
    [2, 'İTS ve Karekod Uygulamaları', 'TEB Akademi', '2025-05-20', '2027-05-20', 'TEB-2025-441', 'tamamlandi'],
    [2, 'Soğuk Zincir Yönetimi', 'Sağlık Bakanlığı', '2026-03-11', '2029-03-11', 'SB-2026-118', 'tamamlandi'],
    [6, 'Forklift Kullanım Eğitimi', 'MEB Onaylı Kurs', '2024-03-01', '2027-03-01', 'MEB-2024-2210', 'tamamlandi'],
    [6, 'İş Sağlığı ve Güvenliği Temel Eğitimi', 'OSGB Kocaeli', '2024-02-20', '2027-02-20', 'ISG-2024-908', 'tamamlandi'],
    [7, 'Tehlikeli Madde Güvenlik Danışmanlığı (TMGD) Farkındalık', 'UND Akademi', '2025-09-30', '2028-09-30', 'UND-2025-330', 'tamamlandi'],
    [8, 'Bilgi Güvenliği ve KVKK', 'Veniux İç Eğitim', '2026-01-15', '2027-01-15', 'VNX-2026-012', 'tamamlandi'],
    [8, 'MySQL Performans Optimizasyonu', 'Online Akademi', null, null, null, 'devam_ediyor']
  ];
  for (const t of trainings) {
    await q('INSERT INTO hr_trainings (employee_id, title, provider, completed_at, expires_at, certificate_no, status) VALUES (?,?,?,?,?,?,?)', t);
  }

  // Bordro — son üç dönem
  for (const period of ['2026-07', '2026-08', '2026-09']) {
    for (const emp of activeIds) {
      const [row] = await q('SELECT salary_gross FROM hr_employees WHERE id = ?', [emp]);
      const gross = Number(row[0].salary_gross) || 40000;
      const overtime = between(emp * 7 + period.charCodeAt(6), 0, 4200);
      const bonus = period === '2026-08' && emp <= 3 ? 8000 : 0;
      const base = gross + overtime + bonus;
      const sgkEmp = +(base * 0.14).toFixed(2);
      const sgkEr = +(base * 0.2075).toFixed(2);
      const tax = +((base - sgkEmp) * 0.15).toFixed(2);
      const stamp = +(base * 0.00759).toFixed(2);
      const net = +(base - sgkEmp - tax - stamp).toFixed(2);
      await q(
        `INSERT INTO hr_payroll (employee_id, period, gross, sgk_employee, sgk_employer, income_tax, stamp_tax, overtime_pay, bonus, net)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [emp, period, gross, sgkEmp, sgkEr, tax, stamp, overtime, bonus, net]
      );
    }
  }

  const events = [
    [1, 'ise_giris', 'İşe giriş', 'Depo Görevlisi olarak işe başladı.', '2021-03-15', 'İK'],
    [1, 'terfi', 'Terfi: Depo Operasyon Şefi', 'Ekip yönetimi sorumluluğu verildi.', '2023-07-01', 'Genel Müdürlük'],
    [1, 'zam', 'Ücret güncellemesi', 'Yıllık performans zammı uygulandı.', '2026-01-01', 'İK'],
    [2, 'ise_giris', 'İşe giriş', 'Mesul Müdür Eczacı olarak işe başladı.', '2020-09-01', 'İK'],
    [2, 'belge', 'Mesul müdürlük belgesi yenilendi', 'Belge 2027 yılına kadar geçerli.', '2026-03-11', 'İK'],
    [3, 'ise_giris', 'İşe giriş', 'Kurumsal Satış Yöneticisi olarak işe başladı.', '2022-01-10', 'İK'],
    [3, 'prim', 'Satış primi', 'Memorial sözleşmesi primi ödendi.', '2026-08-31', 'Finans'],
    [5, 'izin', 'Yıllık izin', '5 günlük yıllık izin onaylandı.', iso(day(-17)), 'Ahmet Yılmaz'],
    [6, 'uyari', 'Devam uyarısı', 'Akşam vardiyasında tekrarlayan geç kalma nedeniyle sözlü uyarı.', iso(day(-12)), 'Murat Yıldırım'],
    [6, 'ise_giris', 'İşe giriş', 'Belirli süreli sözleşme ile işe başladı.', '2024-02-12', 'İK'],
    [8, 'ise_giris', 'İşe giriş', 'Sistem ve Entegrasyon Uzmanı olarak işe başladı.', '2021-06-28', 'İK'],
    [9, 'ise_giris', 'İşe giriş', 'Ön Muhasebe Sorumlusu olarak işe başladı.', '2023-01-16', 'İK'],
    [10, 'ise_giris', 'İşe giriş', 'Belirli süreli sözleşme ile işe başladı.', '2024-05-06', 'İK'],
    [10, 'ayrilis', 'İşten ayrılış', 'Sözleşme süresi doldu, yenilenmedi.', '2026-07-31', 'İK']
  ];
  for (const e of events) {
    await q('INSERT INTO hr_events (employee_id, event_type, title, description, event_date, created_by) VALUES (?,?,?,?,?,?)', e);
  }
  console.log('🧑‍💼 İK verileri eklendi (kadro, vardiya, devam, izin, hedef, belge, eğitim, bordro, özlük olayları).');

  /* ─────────── ÖZET ─────────── */
  const [all] = await q(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE table_schema = DATABASE() ORDER BY TABLE_NAME'
  );
  const filled = [];
  for (const { t } of all) {
    const [r] = await q(`SELECT COUNT(*) AS c FROM \`${t}\``);
    if (r[0].c) filled.push(`${t}=${r[0].c}`);
  }
  console.log(`\n✅ Demo veri yüklendi. Dolu tablo: ${filled.length}/${all.length}`);
  console.log(filled.join('  '));
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Seed hatası:', e.message);
    console.error(e.stack.split('\n').slice(0, 4).join('\n'));
    process.exit(1);
  });
