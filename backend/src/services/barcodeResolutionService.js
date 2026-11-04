const pool = require('../config/database');

class BarcodeResolutionService {
  /**
   * Unified Barcode & QR Code resolver for all PDA & Handheld scanning operations
   */
  async resolveBarcode(rawCode, warehouseId = null,tenantId) {
    if (!tenantId || !rawCode || typeof rawCode !== 'string') {
      return { matched: false, message: 'Geçersiz barkod' };
    }

    const cleanedCode = rawCode.trim();

    // 1. Check if it's a Warehouse Location (e.g., A-01-02-03, DOCK-01, STAGE-IN-01, QUAR-01)
    const locRes = await pool.query(
      'SELECT * FROM warehouse_locations WHERE UPPER(location_code) = UPPER($1) AND tenant_id=$2 ' + 
      (warehouseId ? 'AND warehouse_id = $3' : ''),
      warehouseId ? [cleanedCode,tenantId, warehouseId] : [cleanedCode,tenantId]
    );
    if (locRes.rows.length > 0) {
      const loc = locRes.rows[0];
      const stocks = await pool.query(
        'SELECT pbr.*, p.name, p.sku FROM product_bin_records pbr JOIN products p ON pbr.product_id = p.id WHERE pbr.location_id = $1 AND pbr.tenant_id = $2 AND pbr.quantity > 0',
        [loc.id, tenantId]
      );
      return {
        matched: true,
        type: 'LOCATION',
        id: loc.id,
        code: loc.location_code,
        data: {
          ...loc,
          stored_products: stocks.rows
        }
      };
    }

    // 2. Check if it's a Handling Unit / Pallet / Tote / SSCC
    const huRes = await pool.query(
      'SELECT * FROM handling_units WHERE (UPPER(hu_code) = UPPER($1) OR sscc_code = $1) AND tenant_id=$2',
      [cleanedCode,tenantId]
    );
    if (huRes.rows.length > 0) {
      const hu = huRes.rows[0];
      return {
        matched: true,
        type: 'HANDLING_UNIT',
        id: hu.id,
        code: hu.hu_code,
        data: hu
      };
    }

    // 3. Check if it's a Product (by barcode, GTIN, SKU or UOM barcode)
    const prodRes = await pool.query(`
      SELECT p.*, u.uom_code, u.conversion_factor
      FROM products p
      LEFT JOIN product_uoms u ON u.product_id = p.id AND (u.barcode = $1)
      WHERE (p.barcode = $1 OR p.gtin = $1 OR UPPER(p.sku) = UPPER($1) OR u.barcode = $1) AND p.tenant_id=$2
      LIMIT 1
    `, [cleanedCode,tenantId]);

    if (prodRes.rows.length > 0) {
      const prod = prodRes.rows[0];
      // Get current location stocks for this product
      const stockRes = await pool.query(`
        SELECT pbr.*, loc.location_code, loc.zone_name, lot.lot_number, lot.expiry_date
        FROM product_bin_records pbr
        JOIN warehouse_locations loc ON pbr.location_id = loc.id
        LEFT JOIN inventory_lots lot ON pbr.lot_id = lot.id
        WHERE pbr.product_id = $1 AND pbr.tenant_id = $2 AND pbr.quantity > 0
      `, [prod.id, tenantId]);

      return {
        matched: true,
        type: 'PRODUCT',
        id: prod.id,
        code: prod.barcode || prod.sku,
        data: {
          ...prod,
          stock_locations: stockRes.rows
        }
      };
    }

    // 4. Check if it's a Pick Wave
    if (cleanedCode.toUpperCase().startsWith('WAV-')) {
      const waveRes = await pool.query('SELECT * FROM wms_pick_waves WHERE UPPER(wave_no) = UPPER($1) AND tenant_id=$2', [cleanedCode,tenantId]);
      if (waveRes.rows.length > 0) {
        return {
          matched: true,
          type: 'WAVE',
          id: waveRes.rows[0].id,
          code: waveRes.rows[0].wave_no,
          data: waveRes.rows[0]
        };
      }
    }

    // 5. Check if it's an Inbound Receipt
    if (cleanedCode.toUpperCase().startsWith('INB-')) {
      const inbRes = await pool.query('SELECT * FROM wms_inbound_receipts WHERE UPPER(receipt_no) = UPPER($1) AND tenant_id=$2', [cleanedCode,tenantId]);
      if (inbRes.rows.length > 0) {
        return {
          matched: true,
          type: 'INBOUND_RECEIPT',
          id: inbRes.rows[0].id,
          code: inbRes.rows[0].receipt_no,
          data: inbRes.rows[0]
        };
      }
    }

    // 6. Check if it's a Serial Number
    const serialRes = await pool.query(
      'SELECT s.*, p.name as product_name, p.sku FROM inventory_serial_numbers s JOIN products p ON s.product_id = p.id WHERE s.serial_number = $1 AND s.tenant_id=$2',
      [cleanedCode,tenantId]
    );
    if (serialRes.rows.length > 0) {
      return {
        matched: true,
        type: 'SERIAL_NUMBER',
        id: serialRes.rows[0].id,
        code: serialRes.rows[0].serial_number,
        data: serialRes.rows[0]
      };
    }

    // 7. Check if it's a Lot Number
    const lotRes = await pool.query(
      'SELECT l.*, p.name as product_name, p.sku FROM inventory_lots l JOIN products p ON l.product_id = p.id WHERE UPPER(l.lot_number) = UPPER($1) AND l.tenant_id=$2',
      [cleanedCode,tenantId]
    );
    if (lotRes.rows.length > 0) {
      return {
        matched: true,
        type: 'LOT_NUMBER',
        id: lotRes.rows[0].id,
        code: lotRes.rows[0].lot_number,
        data: lotRes.rows[0]
      };
    }

    return {
      matched: false,
      raw_code: cleanedCode,
      message: 'Barkod sistemde herhangi bir ürün, raf, palet veya işlemle eşleştirilemedi.'
    };
  }

  /**
   * Log standard scan event
   */
  async logScanEvent(tenantId, data) {
    const { device_id, user_id, raw_barcode, resolved_type, resolved_id, operation, is_success, error_message } = data;
    try {
      await pool.query(`
        INSERT INTO wms_scan_events (
          tenant_id, device_id, user_id, raw_barcode, resolved_type, resolved_id, operation, is_success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [tenantId, device_id || 'UNKNOWN_DEVICE', user_id || null, raw_barcode, resolved_type || null, resolved_id || null, operation || 'SCAN', is_success ? 1 : 0, error_message || null]);
    } catch (e) {
      console.error('Log scan event error:', e.message);
    }
  }
}

module.exports = new BarcodeResolutionService();
