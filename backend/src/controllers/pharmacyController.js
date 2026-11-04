const pool = require('../config/database');
const { parseKarekod, generateKarekodString } = require('../services/karekodService');
const { scanLocalFolders, ingestMedicineItems, parseMedulaXml, parsePharmaCsv, getScanDirectories } = require('../services/medulaScannerService');
const { detectFarmakomInstallation, syncFarmakomStocks } = require('../services/farmakomService');

// Get Pharmacy Dashboard Stats & Metrics
const getPharmacyDashboardStats = async (req, res) => {
  try {
    const [medsRes, batchesRes, syncLogsRes, depotsRes] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total_medicines,
          COALESCE(SUM(sr.quantity), 0) as total_boxes,
          COALESCE(SUM(sr.quantity * COALESCE(p.depocu_fiyati, p.purchase_price)), 0) as total_depot_value,
          COALESCE(SUM(sr.quantity * COALESCE(p.kamu_fiyati, p.sale_price)), 0) as total_kamu_value,
          COUNT(CASE WHEN p.prescription_type = 'kirmizi' THEN 1 END) as kirmizi_count,
          COUNT(CASE WHEN p.prescription_type = 'yesil' THEN 1 END) as yesil_count,
          COUNT(CASE WHEN p.prescription_type = 'mor' THEN 1 END) as mor_count
        FROM products p
        LEFT JOIN stock_records sr ON p.id = sr.product_id
        WHERE p.tenant_id=$1 AND (p.is_medicine = 1 OR p.category LIKE '%İlaç%')
      `,[req.user.tenantId]),
      pool.query(`
        SELECT 
          COUNT(CASE WHEN expiry_date < date('now') THEN 1 END) as expired_count,
          COUNT(CASE WHEN expiry_date >= date('now') AND expiry_date <= date('now', '+30 days') THEN 1 END) as critical_expiry_count,
          COUNT(CASE WHEN expiry_date > date('now', '+30 days') AND expiry_date <= date('now', '+90 days') THEN 1 END) as warning_expiry_count,
          COUNT(CASE WHEN expiry_date > date('now', '+90 days') AND expiry_date <= date('now', '+180 days') THEN 1 END) as caution_expiry_count
        FROM medicine_batches
        WHERE tenant_id=$1 AND status = 'in_stock'
      `,[req.user.tenantId]),
      pool.query('SELECT * FROM medula_sync_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 5',[req.user.tenantId]),
      pool.query('SELECT * FROM pharmacy_depots WHERE tenant_id=$1 ORDER BY name ASC',[req.user.tenantId])
    ]);

    const stats = medsRes.rows[0];
    const expiry = batchesRes.rows[0];

    res.json({
      summary: {
        total_medicines: stats.total_medicines || 0,
        total_boxes: stats.total_boxes || 0,
        total_depot_value: stats.total_depot_value || 0,
        total_kamu_value: stats.total_kamu_value || 0,
        kirmizi_count: stats.kirmizi_count || 0,
        yesil_count: stats.yesil_count || 0,
        mor_count: stats.mor_count || 0
      },
      expiry_radar: {
        expired_count: expiry.expired_count || 0,
        critical_expiry_count: expiry.critical_expiry_count || 0,
        warning_expiry_count: expiry.warning_expiry_count || 0,
        caution_expiry_count: expiry.caution_expiry_count || 0
      },
      recent_syncs: syncLogsRes.rows,
      depots: depotsRes.rows
    });
  } catch (error) {
    console.error('Pharmacy dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get List of Medicines
const getPharmacyMedicines = async (req, res) => {
  try {
    const { search, prescription_type } = req.query;

    let query = `
      SELECT 
        p.*,
        s.name as supplier_name,
        COALESCE((SELECT SUM(quantity) FROM stock_records WHERE product_id = p.id), 0) as total_quantity,
        COALESCE((SELECT COUNT(*) FROM medicine_batches WHERE product_id = p.id AND status = 'in_stock'), 0) as tracked_boxes_count,
        (SELECT MIN(expiry_date) FROM medicine_batches WHERE product_id = p.id AND status = 'in_stock') as earliest_expiry
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.tenant_id = $1 AND (p.is_medicine = 1 OR p.category LIKE '%İlaç%' OR p.category = 'Medicine')
    `;
    const params = [req.user.tenantId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name LIKE $${params.length} OR p.sku LIKE $${params.length} OR p.gtin LIKE $${params.length} OR p.barcode LIKE $${params.length} OR p.active_substance LIKE $${params.length})`;
    }

    if (prescription_type) {
      params.push(prescription_type);
      query += ` AND p.prescription_type = $${params.length}`;
    }

    query += ' ORDER BY p.name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get pharmacy medicines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Decode and Process GS1 2D Karekod (Barcode gun scan)
const decodeAndProcessKarekod = async (req, res) => {
 const client=await pool.connect();
  try {
    const { karekod, action = 'check', warehouse_id } = req.body;
    if (!karekod) {
      return res.status(400).json({ error: 'Karekod metni zorunludur.' });
    }

    const decoded = parseKarekod(karekod);
    const standardBc = decoded.standardBarcode;
    await client.query('BEGIN');

    // Find medicine by GTIN or barcode
    const medRes = await client.query(`
      SELECT * FROM products 
      WHERE tenant_id=$4 AND (gtin = $1 OR barcode = $2 OR barcode = $3)
      LIMIT 1
    `, [decoded.gtin, decoded.gtin, standardBc,req.user.tenantId]);

    const medicine = medRes.rows.length > 0 ? medRes.rows[0] : null;

    // Check if this specific box is already registered
    const batchCheck = await client.query(`
      SELECT * FROM medicine_batches 
      WHERE gtin = $1 AND serial_number = $2 AND tenant_id=$3
    `, [decoded.gtin, decoded.serialNumber,req.user.tenantId]);

    const existingBatch = batchCheck.rows.length > 0 ? batchCheck.rows[0] : null;

    // If action is inbound (Stok Girişi)
    if (action === 'inbound' && medicine) {
      let targetWarehouse = warehouse_id;
      if (!targetWarehouse) {
        const whRes = await client.query("SELECT id FROM warehouses WHERE tenant_id = $1 AND (name LIKE '%Eczane%' OR type = 'retail' OR type = 'main' OR type = 'MAIN') LIMIT 1", [req.user.tenantId]);
        if(!whRes.rows.length)throw new Error('Depo bulunamadı.');
        targetWarehouse=whRes.rows[0].id;
      }

      // Register or update batch
      if (!existingBatch) {
        await client.query(`
          INSERT INTO medicine_batches (tenant_id, product_id, gtin, serial_number, lot_number, expiry_date, status, warehouse_id)
          VALUES ($7, $1, $2, $3, $4, $5, 'in_stock', $6)
        `, [medicine.id, decoded.gtin, decoded.serialNumber, decoded.lotNumber, decoded.expiryDate, targetWarehouse, req.user.tenantId]);

        // Increment stock
        const stockRes = await client.query('SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3', [medicine.id, targetWarehouse, req.user.tenantId]);
        if (stockRes.rows.length > 0) {
          await client.query('UPDATE stock_records SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [stockRes.rows[0].id]);
        } else {
          await client.query('INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($3, $1, $2, 1)', [medicine.id, targetWarehouse, req.user.tenantId]);
        }

        // Movement record
        await client.query(`
          INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note)
          VALUES ($4, $1, $2, 1, 'inbound', 'karekod_scan', $3)
        `, [medicine.id, targetWarehouse, `Karekod Girişi: SN: ${decoded.serialNumber}`, req.user.tenantId]);
      }
    } else if (action === 'dispense' && medicine && existingBatch) {
      // Reçeteli Satış / Çıkış
      if(existingBatch.status!=='in_stock')throw new Error('Bu kutu daha önce çıkılmış veya kullanıma kapalı.');
      await client.query("UPDATE medicine_batches SET status = 'sold' WHERE id = $1 AND tenant_id=$2 AND status='in_stock'", [existingBatch.id,req.user.tenantId]);

      const stockRes = await client.query('SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3', [medicine.id, existingBatch.warehouse_id, req.user.tenantId]);
      if(!stockRes.rows.length||stockRes.rows[0].quantity<1)throw new Error('Yetersiz stok.');
      if (stockRes.rows.length > 0 && stockRes.rows[0].quantity > 0) {
        const updRes = await client.query('UPDATE stock_records SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND quantity >= 1', [stockRes.rows[0].id]);
        if (updRes.rowCount === 0) {
          throw new Error('Yetersiz stok veya eşzamanlı işlem.');
        }
      }

      await client.query(`
        INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note)
        VALUES ($4, $1, $2, -1, 'outbound', 'karekod_dispense', $3)
      `, [medicine.id, existingBatch.warehouse_id, `Karekod Reçeteli Çıkış: SN: ${decoded.serialNumber}`, req.user.tenantId]);
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      decoded,
      medicine,
      batch: existingBatch,
      status: existingBatch ? existingBatch.status : 'not_registered'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Decode karekod error:', error);
    res.status(400).json({ error: 'Karekod işlemi tamamlanamadı: '+error.message });
  }finally{client.release();}
};

// Scan Local Computer Folders for Medula & Depot Files
const scanLocalMedulaFolders = async (req, res) => {
  try {
    const result = await scanLocalFolders(req.user.tenantId);
    res.json({
      message: 'Bilgisayar Medula ve Ecza Deposu klasörleri başarıyla tarandı.',
      ...result
    });
  } catch (error) {
    console.error('Scan local folders error:', error);
    res.status(500).json({ error: 'Klasör tarama sırasında hata oluştu.' });
  }
};

// Import Custom Medula XML / CSV File (Direct Upload / Paste)
const importMedulaFile = async (req, res) => {
  try {
    const { content, fileName = 'Manuel_Yuklenen_Dosya.xml', fileType = 'xml' } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Dosya içeriği boş olamaz.' });
    }

    let items = [];
    if (fileType === 'xml' || content.includes('<Ilac>') || content.includes('<?xml')) {
      items = parseMedulaXml(content);
    } else {
      items = parsePharmaCsv(content);
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'Dosyada geçerli ilaç veya Medula verisi bulunamadı.' });
    }

    const result = await ingestMedicineItems(items, fileName, 'Manuel_Upload', fileType === 'xml' ? 'medula_xml' : 'depot_csv',req.user.tenantId);

    res.json({
      message: `${result.importedCount} ilaç başarıyla stoğa aktarıldı.`,
      ...result
    });
  } catch (error) {
    console.error('Import Medula file error:', error);
    res.status(500).json({ error: 'Dosya içe aktarılamadı.' });
  }
};

// Get Expiry (Miad) Radar List
const getExpiryRadar = async (req, res) => {
  try {
    const { status_filter } = req.query; // 'expired', 'critical', 'warning', 'caution'

    const result = await pool.query(`
      SELECT 
        mb.*,
        p.name as medicine_name,
        p.sku,
        p.barcode,
        p.prescription_type,
        COALESCE(p.kamu_fiyati, p.sale_price) as kamu_fiyati,
        COALESCE(p.depocu_fiyati, p.purchase_price) as depocu_fiyati,
        w.name as warehouse_name,
        s.name as supplier_name,
        CAST((julianday(mb.expiry_date) - julianday('now')) AS INTEGER) as days_remaining
      FROM medicine_batches mb
      JOIN products p ON mb.product_id = p.id
      JOIN warehouses w ON mb.warehouse_id = w.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE mb.tenant_id=$1 AND mb.status = 'in_stock'
      ORDER BY mb.expiry_date ASC
    `,[req.user.tenantId]);

    const items = result.rows.map(item => {
      let urgency = 'safe';
      const days = item.days_remaining;

      if (days <= 0) {
        urgency = 'expired';
      } else if (days <= 30) {
        urgency = 'critical';
      } else if (days <= 90) {
        urgency = 'warning';
      } else if (days <= 180) {
        urgency = 'caution';
      }

      return {
        ...item,
        urgency
      };
    });

    const filtered = status_filter ? items.filter(i => i.urgency === status_filter) : items;

    // Total financial risk for items expiring within 90 days
    const totalRisk = items
      .filter(i => i.days_remaining <= 90)
      .reduce((acc, i) => acc + (i.depocu_fiyati || 0), 0);

    res.json({
      total_risk_valuation: totalRisk,
      items: filtered
    });
  } catch (error) {
    console.error('Get expiry radar error:', error);
    res.status(500).json({ error: 'Miad radarı yüklenemedi.' });
  }
};

// Get Pharmacy Depots
const getPharmacyDepots = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pharmacy_depots WHERE tenant_id = $1 ORDER BY name ASC', [req.user.tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get pharmacy depots error:', error);
    res.status(500).json({ error: 'Depolar listelenemedi.' });
  }
};

// Get Farmakom Diagnosis & Installation Status
const getFarmakomStatus = async (req, res) => {
  try {
    const { custom_path } = req.query;
    const diagnosis = await detectFarmakomInstallation(custom_path);
    res.json(diagnosis);
  } catch (error) {
    console.error('Farmakom status error:', error);
    res.status(500).json({ error: 'Farmakom durumu sorgulanamadı.' });
  }
};

// Sync Farmakom Stock into Veniux
const syncFarmakomStock = async (req, res) => {
  try {
    const { custom_path } = req.body || {};
    const result = await syncFarmakomStocks(custom_path,req.user.tenantId);
    res.json(result);
  } catch (error) {
    console.error('Farmakom sync error:', error);
    res.status(500).json({ error: 'Farmakom stokları senkronize edilemedi.' });
  }
};

module.exports = {
  getPharmacyDashboardStats,
  getPharmacyMedicines,
  decodeAndProcessKarekod,
  scanLocalMedulaFolders,
  importMedulaFile,
  getExpiryRadar,
  getPharmacyDepots,
  getFarmakomStatus,
  syncFarmakomStock
};
