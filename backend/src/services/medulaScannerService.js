const fs = require('fs');
const path = require('path');
const os = require('os');
const pool = require('../config/database');
const { parseKarekod } = require('./karekodService');

/**
 * Medula & Pharmacy Local File Auto-Scanner Service
 * Automatically discovers, parses, and synchronizes Medula XMLs, Depot Invoices, and ITS Datamatrix files.
 */

// Target scanning folders on user machine
const getScanDirectories = () => {
  const homeDir = os.homedir();
  const dirs = [
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Documents'),
    'C:\\TEBEOS\\Export',
    'C:\\TEBEOS\\Raporlar',
    'C:\\Byte\\Rapor',
    'C:\\Farmakom\\Stok',
    'C:\\Medula'
  ];

  return dirs.filter(d => {
    try {
      return fs.existsSync(d) && fs.statSync(d).isDirectory();
    } catch (e) {
      return false;
    }
  });
};

/**
 * Parse Medula XML Content
 */
const parseMedulaXml = (xmlContent) => {
  const items = [];
  
  // Extract all <Ilac> blocks
  const ilacRegex = /<Ilac>([\s\S]*?)<\/Ilac>/gi;
  let match;

  while ((match = ilacRegex.exec(xmlContent)) !== null) {
    const block = match[1];
    const barkodMatch = block.match(/<Barkod>(.*?)<\/Barkod>/i);
    const ilacAdiMatch = block.match(/<IlacAdi>(.*?)<\/IlacAdi>/i);
    const adetMatch = block.match(/<(?:KutuAdet|Adet)>(.*?)<\/(?:KutuAdet|Adet)>/i);
    const depocuMatch = block.match(/<DepocuFiyati>(.*?)<\/DepocuFiyati>/i);
    const kamuMatch = block.match(/<KamuFiyati>(.*?)<\/KamuFiyati>/i);
    const turMatch = block.match(/<ReceteTuru>(.*?)<\/ReceteTuru>/i);

    // Extract individual Karekods inside <Karekodlar>
    const karekodlar = [];
    const karekodRegex = /<Karekod>(.*?)<\/Karekod>/gi;
    let kMatch;
    while ((kMatch = karekodRegex.exec(block)) !== null) {
      karekodlar.push(kMatch[1].trim());
    }

    if (barkodMatch && ilacAdiMatch) {
      items.push({
        barkod: barkodMatch[1].trim(),
        name: ilacAdiMatch[1].trim(),
        quantity: adetMatch ? parseInt(adetMatch[1], 10) : (karekodlar.length || 1),
        depocu_fiyati: depocuMatch ? parseFloat(depocuMatch[1]) : 0,
        kamu_fiyati: kamuMatch ? parseFloat(kamuMatch[1]) : 0,
        prescription_type: turMatch ? turMatch[1].trim().toLowerCase() : 'normal',
        karekodlar
      });
    }
  }

  return items;
};

/**
 * Parse CSV or Excel format
 */
const parsePharmaCsv = (csvContent) => {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const bcIdx = headers.findIndex(h => h.includes('barkod') || h.includes('gtin'));
  const nameIdx = headers.findIndex(h => h.includes('ilac') || h.includes('ad') || h.includes('urun'));
  const qtyIdx = headers.findIndex(h => h.includes('adet') || h.includes('miktar') || h.includes('kutu'));
  const buyIdx = headers.findIndex(h => h.includes('depocu') || h.includes('alis') || h.includes('fiyat'));
  const kamuIdx = headers.findIndex(h => h.includes('kamu') || h.includes('satis'));
  const expIdx = headers.findIndex(h => h.includes('miad') || h.includes('skt') || h.includes('expiry'));
  const lotIdx = headers.findIndex(h => h.includes('parti') || h.includes('lot'));

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
    if (parts.length >= 2) {
      items.push({
        barkod: parts[bcIdx !== -1 ? bcIdx : 0],
        name: parts[nameIdx !== -1 ? nameIdx : 1],
        quantity: qtyIdx !== -1 ? parseInt(parts[qtyIdx], 10) || 1 : 1,
        depocu_fiyati: buyIdx !== -1 ? parseFloat(parts[buyIdx]) || 0 : 0,
        kamu_fiyati: kamuIdx !== -1 ? parseFloat(parts[kamuIdx]) || 0 : 0,
        expiryDate: expIdx !== -1 ? parts[expIdx] : null,
        lotNumber: lotIdx !== -1 ? parts[lotIdx] : null,
        prescription_type: 'normal',
        karekodlar: []
      });
    }
  }

  return items;
};

/**
 * Ingest extracted items into SQLite Database
 */
const ingestMedicineItems = async (items, fileName, filePath, sourceType,tenantId) => {
 if(!tenantId)throw new Error('İşletme bilgisi zorunludur.');
 if(!Array.isArray(items)||items.length>1000)throw new Error('Bir dosyada en fazla 1000 ilaç aktarılabilir.');
 const client=await pool.connect();try{await client.query('BEGIN');
  let importedCount = 0;

  // Get or select default Pharmacy Retail Warehouse
  const whRes = await client.query("SELECT id FROM warehouses WHERE tenant_id=$1 ORDER BY CASE WHEN type='retail' THEN 0 ELSE 1 END,id LIMIT 1",[tenantId]);
  if(!whRes.rows.length)throw new Error('Önce işletmeye depo ekleyin.');
  const warehouseId=whRes.rows[0].id;

  for (const item of items) {
    const gtin = item.barkod.padStart(14, '0');
    const sku = `MED-T${tenantId}-${item.barkod}`;
    if(!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0)throw new Error('Geçersiz ilaç miktarı.');

    // 1. Upsert Product
    let productRes = await client.query('SELECT id, is_medicine FROM products WHERE (barcode = $1 OR gtin = $2) AND tenant_id=$3', [item.barkod, gtin,tenantId]);
    let productId;

    if (productRes.rows.length > 0) {
      productId = productRes.rows[0].id;
      await client.query(`
        UPDATE products SET 
          is_medicine = 1,
          kamu_fiyati = CASE WHEN $1 > 0 THEN $1 ELSE kamu_fiyati END,
          depocu_fiyati = CASE WHEN $2 > 0 THEN $2 ELSE depocu_fiyati END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [item.kamu_fiyati, item.depocu_fiyati, productId]);
    } else {
      const insertRes = await client.query(`
        INSERT INTO products (
          tenant_id,sku, name, category, barcode, unit, purchase_price, sale_price,
          min_stock_level, max_stock_level, is_medicine, gtin,
          prescription_type, kamu_fiyati, depocu_fiyati, perakende_fiyat, kdv_orani
        ) VALUES ($9,$1, $2, 'İlaç & Sağlık', $3, 'kutu', $4, $5, 20, 200, 1, $6, $7, $8, $4, $5, 10) RETURNING id
      `, [
        sku,
        item.name,
        item.barkod,
        item.depocu_fiyati || 40,
        item.kamu_fiyati || (item.depocu_fiyati ? item.depocu_fiyati * 1.4 : 60),
        gtin,
        item.prescription_type || 'normal',
        item.kamu_fiyati || 60,tenantId
      ]);
      productId = insertRes.rows[0].id;
    }

    // 2. Increment Stock Record in Pharmacy Warehouse
    const stockCheck = await client.query('SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2', [productId, warehouseId]);
    if (stockCheck.rows.length > 0) {
      await client.query('UPDATE stock_records SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [item.quantity, stockCheck.rows[0].id]);
    } else {
      await client.query('INSERT INTO stock_records (tenant_id,product_id, warehouse_id, quantity) VALUES ($4,$1, $2, $3)', [productId, warehouseId, item.quantity,tenantId]);
    }

    // 3. Register Stock Movement
    await client.query(`
      INSERT INTO stock_movements (tenant_id,product_id, warehouse_id, change_amount, movement_type, source, note)
      VALUES ($5,$1, $2, $3, 'inbound', 'medula_auto_scan', $4)
    `, [productId, warehouseId, item.quantity, `Medula Otomatik Senkronizasyon: ${fileName}`,tenantId]);

    // 4. Register individual Karekods if present
    if (item.karekodlar && item.karekodlar.length > 0) {
      for (const k of item.karekodlar) {
        try {
          const parsed = parseKarekod(k);
          await client.query(`
            INSERT OR IGNORE INTO medicine_batches (tenant_id,product_id, gtin, serial_number, lot_number, expiry_date, status, warehouse_id)
            VALUES ($7,$1, $2, $3, $4, $5, 'in_stock', $6)
          `, [productId, gtin, parsed.serialNumber, parsed.lotNumber, parsed.expiryDate, warehouseId,tenantId]);
        } catch (kErr) {
          // Ignore duplicate batch
        }
      }
    } else {
      // Auto-generate generic batch for the stock
      const expDate = item.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const lot = item.lotNumber || `LOT-MED-${new Date().getFullYear()}`;
      for (let q = 1; q <= Math.min(item.quantity, 5); q++) {
        const sn = `SN${item.barkod.slice(-4)}${Math.floor(100000 + Math.random() * 900000)}`;
        try {
          await client.query(`
            INSERT OR IGNORE INTO medicine_batches (tenant_id,product_id, gtin, serial_number, lot_number, expiry_date, status, warehouse_id)
            VALUES ($7,$1, $2, $3, $4, $5, 'in_stock', $6)
          `, [productId, gtin, sn, lot, expDate, warehouseId,tenantId]);
        } catch (e) {}
      }
    }

    importedCount++;
  }

  // 5. Log the Sync
  await client.query(`
    INSERT INTO medula_sync_logs (tenant_id,file_name, file_path, source_type, items_detected, items_imported, status, details)
    VALUES ($7,$1, $2, $3, $4, $5, 'success', $6)
  `, [
    fileName,
    filePath,
    sourceType,
    items.length,
    importedCount,
    `${importedCount} farklı ilaç ve kutu stoğu başarıyla güncellendi.`,tenantId
  ]);

  await client.query('COMMIT');return { itemsCount: items.length, importedCount };
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
};

/**
 * Scan all discovered folders for Medula & Depot files
 */
const scanLocalFolders = async (tenantId) => {
  const scanDirs = getScanDirectories();
  const processedFiles = [];
  let totalMedicinesDetected = 0;
  let totalImported = 0;

  for (const dir of scanDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;

        const lowerName = f.toLowerCase();
        const isMedula = lowerName.includes('medula') || lowerName.includes('recete') || lowerName.includes('ecza') || lowerName.includes('fatura') || lowerName.includes('its');

        if (isMedula && (lowerName.endsWith('.xml') || lowerName.endsWith('.csv') || lowerName.endsWith('.txt'))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            let items = [];
            let sourceType = 'medula_xml';

            if (lowerName.endsWith('.xml')) {
              items = parseMedulaXml(content);
              sourceType = 'medula_xml';
            } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
              items = parsePharmaCsv(content);
              sourceType = 'depot_csv';
            }

            if (items.length > 0) {
              const res = await ingestMedicineItems(items, f, fullPath, sourceType,tenantId);
              totalMedicinesDetected += res.itemsCount;
              totalImported += res.importedCount;
              processedFiles.push({
                fileName: f,
                filePath: fullPath,
                itemsCount: res.itemsCount,
                importedCount: res.importedCount
              });
            }
          } catch (fileErr) {
            console.error(`Error processing file ${fullPath}:`, fileErr.message);
          }
        }
      }
    } catch (dirErr) {
      console.error(`Error scanning directory ${dir}:`, dirErr.message);
    }
  }

  return {
    scannedDirectories: scanDirs,
    processedFiles,
    totalMedicinesDetected,
    totalImported
  };
};

module.exports = {
  scanLocalFolders,
  parseMedulaXml,
  parsePharmaCsv,
  ingestMedicineItems,
  getScanDirectories
};
