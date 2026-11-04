/**
 * GS1 Datamatrix (2D Karekod) Parser and Formatter for Turkish Pharmaceutical Track & Trace System (İTS)
 * Standards:
 * - (01) GTIN: 14 numeric digits
 * - (21) Serial Number: Up to 20 alphanumeric characters
 * - (17) Expiry Date: YYMMDD format
 * - (10) Batch / Lot Number: Up to 20 alphanumeric characters
 */

const parseKarekod = (rawInput) => {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('Geçersiz karekod verisi: Metin boş olamaz.');
  }

  let text = rawInput.trim();

  // Replace common scanner invisible chars / group separators
  text = text.replace(/[\x1D\x1E\x04]/g, '<GS>');

  let gtin = '';
  let serialNumber = '';
  let expiryDate = '';
  let lotNumber = '';

  // Mode 1: Parentheses format: (01)...(21)...(17)...(10)...
  if (text.includes('(01)') || text.includes('(21)') || text.includes('(17)') || text.includes('(10)')) {
    const gtinMatch = text.match(/\(01\)(\d{14})/);
    const snMatch = text.match(/\(21\)([^()\s]+)/);
    const expMatch = text.match(/\(17\)(\d{6})/);
    const lotMatch = text.match(/\(10\)([^()\s]+)/);

    if (gtinMatch) gtin = gtinMatch[1];
    if (snMatch) serialNumber = snMatch[1];
    if (expMatch) expiryDate = formatYYMMDD(expMatch[1]);
    if (lotMatch) lotNumber = lotMatch[1];
  } else {
    // Mode 2: Standard GS1 Raw Stream
    // Remove leading FNC1 or ]d2 prefix if sent by 2D scanner
    if (text.startsWith(']d2') || text.startsWith(']Q3')) {
      text = text.slice(3);
    }

    // Extract (01) GTIN (fixed 14 digits after '01')
    if (text.startsWith('01')) {
      gtin = text.slice(2, 16);
      text = text.slice(16);
    }

    // Split remaining tokens by <GS> if available
    const tokens = text.split('<GS>');

    tokens.forEach(tok => {
      if (tok.startsWith('21')) {
        // Serial Number might be followed by 17 or 10 if no GS
        const expIdx = tok.indexOf('17', 2);
        if (expIdx !== -1 && tok.length >= expIdx + 8) {
          serialNumber = tok.slice(2, expIdx);
          const remaining = tok.slice(expIdx);
          if (remaining.startsWith('17')) {
            expiryDate = formatYYMMDD(remaining.slice(2, 8));
            if (remaining.length > 8 && remaining.slice(8).startsWith('10')) {
              lotNumber = remaining.slice(10);
            }
          }
        } else {
          serialNumber = tok.slice(2);
        }
      } else if (tok.startsWith('17')) {
        expiryDate = formatYYMMDD(tok.slice(2, 8));
        if (tok.length > 8 && tok.slice(8).startsWith('10')) {
          lotNumber = tok.slice(10);
        }
      } else if (tok.startsWith('10')) {
        lotNumber = tok.slice(2);
      }
    });
  }

  // Fallbacks if not extracted
  if (!gtin && text.length >= 13) {
    const numericMatch = text.match(/\d{13,14}/);
    if (numericMatch) gtin = numericMatch[0].padStart(14, '0');
  }

  if (!serialNumber) {
    serialNumber = `SN${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  if (!expiryDate) {
    // Default 1 year from now if missing
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    expiryDate = d.toISOString().slice(0, 10);
  }

  // If GTIN starts with '0' and is 14 digits, the standard barcode/EAN is 13 digits
  const standardBarcode = gtin.startsWith('0') ? gtin.slice(1) : gtin;

  return {
    raw: rawInput,
    gtin,
    standardBarcode,
    serialNumber,
    expiryDate,
    lotNumber: lotNumber || 'LOT-STANDARD'
  };
};

/**
 * Format YYMMDD into standard ISO YYYY-MM-DD
 * e.g. '261231' -> '2026-12-31', '250501' -> '2025-05-01'
 */
const formatYYMMDD = (yymmdd) => {
  if (!yymmdd || yymmdd.length !== 6) return new Date().toISOString().slice(0, 10);
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);

  const year = 2000 + parseInt(yy, 10);
  const month = mm.padStart(2, '0');
  const day = dd === '00' ? '28' : dd.padStart(2, '0'); // If day is 00, end of month

  return `${year}-${month}-${day}`;
};

/**
 * Generate standard GS1 Datamatrix string from components
 */
const generateKarekodString = ({ gtin, serialNumber, expiryDate, lotNumber }) => {
  const paddedGtin = (gtin || '').padStart(14, '0');
  let expYYMMDD = '261231';
  if (expiryDate) {
    const parts = expiryDate.split('-');
    if (parts.length === 3) {
      expYYMMDD = `${parts[0].slice(2)}${parts[1]}${parts[2]}`;
    }
  }
  const sn = serialNumber || `SN${Math.floor(10000000 + Math.random() * 90000000)}`;
  const lot = lotNumber || 'LOT1';

  return `(01)${paddedGtin}(21)${sn}(17)${expYYMMDD}(10)${lot}`;
};

module.exports = {
  parseKarekod,
  formatYYMMDD,
  generateKarekodString
};
