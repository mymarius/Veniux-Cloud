const fs = require('fs');
const path = require('path');
const os = require('os');
const pool = require('../config/database');
const { parseKarekod } = require('./karekodService');
const { ingestMedicineItems } = require('./medulaScannerService');

/**
 * Farmakom Eczane Otomasyon Sistemi Otomatik Teşhis & Stok Entegrasyon Servisi
 * Farmakom programının bilgisayarda kurulu olup olmadığını tespit eder,
 * stok ve reçete dosyalarını tarayıp Veniux envanterine aktarır.
 */

// Known Farmakom system paths on Windows
const getPossibleFarmakomPaths = () => {
  const homeDir = os.homedir();
  const paths = [
    'C:\\Farmakom',
    'C:\\FarmakomData',
    'C:\\Farmakom_Yedek',
    'C:\\Program Files (x86)\\Farmakom',
    'C:\\Program Files\\Farmakom',
    'D:\\Farmakom',
    'D:\\FarmakomData',
    'E:\\Farmakom',
    path.join(homeDir, 'Desktop', 'Farmakom'),
    path.join(homeDir, 'Downloads', 'Farmakom'),
    path.join(homeDir, 'Documents', 'Farmakom')
  ];

  return paths;
};

/**
 * Detect whether Farmakom is installed on the system
 */
const detectFarmakomInstallation = async (customPath = null) => {
  const candidatePaths = customPath ? [customPath, ...getPossibleFarmakomPaths()] : getPossibleFarmakomPaths();
  const checkedPaths = [];
  const foundDirectories = [];
  const databaseFiles = [];
  const stockFiles = [];

  for (const dir of candidatePaths) {
    checkedPaths.push(dir);
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        foundDirectories.push(dir);

        // Scan files inside Farmakom folder and subfolders (DATA, STOK, EXCEL, EXPORT, FATURA)
        const subdirsToScan = [
          dir,
          path.join(dir, 'DATA'),
          path.join(dir, 'Data'),
          path.join(dir, 'STOK'),
          path.join(dir, 'Stok'),
          path.join(dir, 'EXCEL'),
          path.join(dir, 'Excel'),
          path.join(dir, 'EXPORT'),
          path.join(dir, 'Export'),
          path.join(dir, 'FATURA'),
          path.join(dir, 'Fatura'),
          path.join(dir, 'TRANSFER')
        ];

        for (const sub of subdirsToScan) {
          if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) {
            try {
              const entries = fs.readdirSync(sub);
              for (const file of entries) {
                const fullPath = path.join(sub, file);
                try {
                  const stat = fs.statSync(fullPath);
                  if (stat.isFile()) {
                    const ext = path.extname(file).toLowerCase();
                    const name = file.toLowerCase();

                    // Check for Farmakom Firebird / Interbase DB files
                    if (ext === '.fdb' || ext === '.gdb' || ext === '.db' || ext === '.mdb') {
                      databaseFiles.push({
                        fileName: file,
                        filePath: fullPath,
                        sizeBytes: stat.size,
                        modifiedAt: stat.mtime
                      });
                    }

                    // Check for Farmakom Stock & Medula Report files
                    if (['.csv', '.xml', '.txt', '.xlsx', '.xls', '.dat', '.json'].includes(ext)) {
                      if (
                        name.includes('stok') ||
                        name.includes('ilac') ||
                        name.includes('karekod') ||
                        name.includes('fatura') ||
                        name.includes('medula') ||
                        name.includes('recete') ||
                        name.includes('farmakom') ||
                        name.includes('its') ||
                        sub.toLowerCase().includes('stok') ||
                        sub.toLowerCase().includes('excel') ||
                        sub.toLowerCase().includes('export')
                      ) {
                        stockFiles.push({
                          fileName: file,
                          filePath: fullPath,
                          sizeBytes: stat.size,
                          modifiedAt: stat.mtime
                        });
                      }
                    }
                  }
                } catch (fileErr) {}
              }
            } catch (readErr) {}
          }
        }
      }
    } catch (e) {}
  }

  // Get last Farmakom sync log from database
  let lastSync = null;
  try {
    const syncRes = await pool.query(`
      SELECT * FROM medula_sync_logs 
      WHERE source_type LIKE '%farmakom%' 
      ORDER BY created_at DESC LIMIT 1
    `);
    if (syncRes.rows.length > 0) {
      lastSync = syncRes.rows[0];
    }
  } catch (e) {}

  const isInstalled = foundDirectories.length > 0;

  return {
    is_installed: isInstalled,
    status: isInstalled ? 'installed' : 'not_found',
    detected_paths: foundDirectories,
    primary_path: foundDirectories[0] || null,
    checked_paths_count: checkedPaths.length,
    database_files: databaseFiles,
    stock_files_found: stockFiles,
    total_stock_files: stockFiles.length,
    last_sync: lastSync,
    checked_paths: candidatePaths
  };
};

/**
 * Parse Farmakom XML format
 */
const parseFarmakomXml = (xmlContent) => {
  const items = [];
  const ilacRegex = /<(?:Ilac|Stok|Urun|Record)>([\s\S]*?)<\/(?:Ilac|Stok|Urun|Record)>/gi;
  let match;

  while ((match = ilacRegex.exec(xmlContent)) !== null) {
    const block = match[1];
    const barkodMatch = block.match(/<(?:Barkod|Gtin|Barcode|StokKodu)>(.*?)<\/(?:Barkod|Gtin|Barcode|StokKodu)>/i);
    const ilacAdiMatch = block.match(/<(?:IlacAdi|UrunAdi|StokAdi|Name)>(.*?)<\/(?:IlacAdi|UrunAdi|StokAdi|Name)>/i);
    const adetMatch = block.match(/<(?:KutuAdet|MevcutMiktar|StokMiktari|Adet|Quantity)>(.*?)<\/(?:KutuAdet|MevcutMiktar|StokMiktari|Adet|Quantity)>/i);
    const depocuMatch = block.match(/<(?:DepocuFiyati|AlisFiyati|Maliyet|PurchasePrice)>(.*?)<\/(?:DepocuFiyati|AlisFiyati|Maliyet|PurchasePrice)>/i);
    const kamuMatch = block.match(/<(?:KamuFiyati|SatisFiyati|PerakendeFiyat|SalePrice)>(.*?)<\/(?:KamuFiyati|SatisFiyati|PerakendeFiyat|SalePrice)>/i);
    const turMatch = block.match(/<(?:ReceteTuru|Tur|Type)>(.*?)<\/(?:ReceteTuru|Tur|Type)>/i);
    const miadMatch = block.match(/<(?:Miad|SKT|ExpiryDate)>(.*?)<\/(?:Miad|SKT|ExpiryDate)>/i);
    const lotMatch = block.match(/<(?:PartiNo|LotNo|Lot)>(.*?)<\/(?:PartiNo|LotNo|Lot)>/i);

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
        quantity: adetMatch ? parseInt(adetMatch[1], 10) || 1 : (karekodlar.length || 1),
        depocu_fiyati: depocuMatch ? parseFloat(depocuMatch[1]) || 0 : 0,
        kamu_fiyati: kamuMatch ? parseFloat(kamuMatch[1]) || 0 : 0,
        prescription_type: turMatch ? turMatch[1].trim().toLowerCase() : 'normal',
        expiryDate: miadMatch ? miadMatch[1].trim() : null,
        lotNumber: lotMatch ? lotMatch[1].trim() : null,
        karekodlar
      });
    }
  }

  return items;
};

/**
 * Parse Farmakom CSV / TXT Delimited Stock Report
 */
const parseFarmakomCsv = (csvContent) => {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) return [];

  // Determine delimiter (comma, semicolon, or tab)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes(';')) delimiter = ';';
  else if (firstLine.includes('\t')) delimiter = '\t';

  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const bcIdx = headers.findIndex(h => h.includes('barkod') || h.includes('gtin') || h.includes('kodu'));
  const nameIdx = headers.findIndex(h => h.includes('ilac') || h.includes('ad') || h.includes('urun') || h.includes('stok'));
  const qtyIdx = headers.findIndex(h => h.includes('adet') || h.includes('miktar') || h.includes('kutu') || h.includes('mevcut'));
  const buyIdx = headers.findIndex(h => h.includes('depocu') || h.includes('alis') || h.includes('maliyet'));
  const saleIdx = headers.findIndex(h => h.includes('kamu') || h.includes('satis') || h.includes('perakende'));
  const expIdx = headers.findIndex(h => h.includes('miad') || h.includes('skt') || h.includes('tarih'));
  const lotIdx = headers.findIndex(h => h.includes('lot') || h.includes('parti') || h.includes('seri'));
  const typeIdx = headers.findIndex(h => h.includes('recete') || h.includes('tur'));

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map(p => p.trim().replace(/"/g, ''));
    if (parts.length >= 2) {
      const barkod = parts[bcIdx !== -1 ? bcIdx : 0];
      const name = parts[nameIdx !== -1 ? nameIdx : 1];
      if (barkod && name) {
        items.push({
          barkod,
          name,
          quantity: qtyIdx !== -1 ? parseInt(parts[qtyIdx], 10) || 1 : 1,
          depocu_fiyati: buyIdx !== -1 ? parseFloat(parts[buyIdx].replace(',', '.')) || 0 : 0,
          kamu_fiyati: saleIdx !== -1 ? parseFloat(parts[saleIdx].replace(',', '.')) || 0 : 0,
          expiryDate: expIdx !== -1 ? parts[expIdx] : null,
          lotNumber: lotIdx !== -1 ? parts[lotIdx] : null,
          prescription_type: typeIdx !== -1 ? parts[typeIdx].toLowerCase() : 'normal',
          karekodlar: []
        });
      }
    }
  }

  return items;
};

/**
 * Scan and Ingest Farmakom Stock into Database
 */
const syncFarmakomStocks = async (targetDirectory = null,tenantId) => {
  const diagnosis = await detectFarmakomInstallation(targetDirectory);
  
  if (!diagnosis.is_installed && !targetDirectory) {
    return {
      success: false,
      message: 'Farmakom programı sistemde bulunamadı. Lütfen Farmakom dizinini manuel belirtin veya örnek demo dosyalarını yükleyin.',
      diagnosis
    };
  }

  const filesToProcess = diagnosis.stock_files_found;
  const processedFiles = [];
  let totalDetected = 0;
  let totalImported = 0;

  for (const fileObj of filesToProcess) {
    const fullPath = fileObj.filePath;
    const f = fileObj.fileName;
    const lowerName = f.toLowerCase();

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      let items = [];
      let sourceType = 'farmakom_stock';

      if (lowerName.endsWith('.xml')) {
        items = parseFarmakomXml(content);
        sourceType = 'farmakom_xml';
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt') || lowerName.endsWith('.dat')) {
        items = parseFarmakomCsv(content);
        sourceType = 'farmakom_csv';
      }

      if (items.length > 0) {
        const res = await ingestMedicineItems(items, `[Farmakom] ${f}`, fullPath, sourceType,tenantId);
        totalDetected += res.itemsCount;
        totalImported += res.importedCount;
        processedFiles.push({
          fileName: f,
          filePath: fullPath,
          itemsCount: res.itemsCount,
          importedCount: res.importedCount
        });
      }
    } catch (err) {
      console.error(`Farmakom file processing error on ${fullPath}:`, err.message);
    }
  }

  return {
    success: true,
    message: totalImported > 0 
      ? `Farmakom stokları başarıyla incelendi ve ${totalImported} ilaç stoğu Veniux'a senkronize edildi!`
      : 'Farmakom dizinleri tarandı, ancak işlenebilir stok raporu bulunamadı.',
    totalDetected,
    totalImported,
    processedFiles,
    diagnosis
  };
};

module.exports = {
  detectFarmakomInstallation,
  syncFarmakomStocks,
  parseFarmakomXml,
  parseFarmakomCsv
};
