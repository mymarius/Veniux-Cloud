const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const Papa = require('papaparse');
const pool = require('../../../config/database');
const { cleanBarcode, cleanText, parsePrice, normalizeSearch } = require('../normalize');
const { mapHeaders } = require('../providers/TitckListProvider');

// Yöneticinin yüklediği barkodlu fiyat / reçete listesiyle katalogdaki fiyat ve reçete türünü tamamlar
// (ör. TİTCK Kurumsal Portal'daki İlaç Fiyat Listesi veya ecza deposunun listesi).
// Not: TİTCK'nin herkese açık "Referans Bazlı" listesinde barkod ve TL fiyat bulunmaz; kullanılamaz.
// Eşleştirme yalnızca barkodla yapılır; manuel / elle düzenlenmiş kayıtlara dokunulmaz.
// Hata olursa senkronizasyonun geri kalanı etkilenmez; sonuç rapora yazılır.

// Fiyat listesinde genel "fiyat" yerine perakende fiyatı tercih edilir.
const RETAIL = ['perakende satis fiyati', 'kdv dahil perakende satis fiyati', 'perakende satis fiyati kdv dahil', 'psf', 'ps fiyati', 'perakende fiyat', 'perakende fiyati'];

function findHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const cells = rows[r] || [];
    const map = mapHeaders(cells);
    const normalized = cells.map(c => normalizeSearch(c));
    const retail = normalized.findIndex(h => h && RETAIL.some(a => h === a || h.startsWith(a + ' ')));
    if (retail >= 0) map.price = retail;
    if (map.barcode !== undefined && (map.price !== undefined || map.prescriptionType !== undefined)) return { row: r, map, headers: cells.filter(Boolean).map(String) };
  }
  return null;
}

function readWorkbook(file) {
  if (/\.(csv|txt)$/i.test(file)) {
    const rows = Papa.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''), { skipEmptyLines: true, delimiter: '' }).data;
    return { SheetNames: ['CSV'], Sheets: { CSV: XLSX.utils.aoa_to_sheet(rows, { dense: true }) } };
  }
  return XLSX.readFile(file, { dense: true });
}

async function enrich({ file, chunkSize = 500 }) {
  if (!file || !fs.existsSync(file)) throw new Error('Fiyat listesi dosyası bulunamadı. Dosyayı yeniden yükleyin.');
  const url = path.basename(file);
  const workbook = readWorkbook(file);
  let matched = 0, rows = 0, withPrice = 0, withPrescription = 0, seenHeaders = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const head = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range: { s: { r: range.s.r, c: range.s.c }, e: { r: Math.min(range.e.r, range.s.r + 25), c: range.e.c } } });
    const header = findHeader(head);
    if (!header) { seenHeaders = seenHeaders.length ? seenHeaders : (head.find(r => (r || []).filter(Boolean).length >= 2) || []).filter(Boolean).map(v => String(v).trim()).slice(0, 20); continue; }
    for (let start = range.s.r + header.row + 1; start <= range.e.r; start += chunkSize) {
      const batch = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range: { s: { r: start, c: range.s.c }, e: { r: Math.min(range.e.r, start + chunkSize - 1), c: range.e.c } } });
      const updates = [];
      for (const cells of batch) {
        const barcode = cleanBarcode(cells[header.map.barcode]);
        if (!barcode) continue;
        rows++;
        const price = header.map.price !== undefined ? parsePrice(cells[header.map.price]) : null;
        const prescription = header.map.prescriptionType !== undefined ? cleanText(cells[header.map.prescriptionType], 80) : null;
        if (price !== null) withPrice++;
        if (prescription) withPrescription++;
        if (price !== null || prescription) updates.push([price, prescription, barcode]);
      }
      if (!updates.length) continue;
      await pool.transaction(async client => {
        for (const [price, prescription, barcode] of updates) {
          const result = await client.query(
            "UPDATE medicines SET price = COALESCE($1, price), prescription_type = COALESCE($2, prescription_type), updated_at = CURRENT_TIMESTAMP WHERE barcode = $3 AND source <> 'manual' AND manual_override = 0",
            [price, prescription, barcode]
          );
          matched += result.rowCount;
        }
      });
      await new Promise(resolve => setImmediate(resolve));
    }
    return { source: url, rows, matched, withPrice, withPrescription, columns: header.headers.slice(0, 20) };
  }
  throw new Error(`Fiyat listesinde barkod ve fiyat / reçete sütunları tanınamadı. Bulunan sütunlar: ${seenHeaders.join(', ') || '—'}`);
}

module.exports = { enrich };
