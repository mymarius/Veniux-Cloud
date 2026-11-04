const pool = require('../config/database');
const wmsEventService = require('./wmsEventService');

class InventoryTransactionService {
  /**
   * Execute an atomic inventory transaction (Double-Entry Ledger + State Projection)
   */
  async recordTransaction(data, externalClient = null) {
    const client = externalClient || await pool.connect();
    const isInternalTx = !externalClient;

    try {
      if (isInternalTx) await client.query('BEGIN');

      const {
        tenant_id,
        warehouse_id,
        location_id,
        product_id,
        lot_id = null,
        serial_number = null,
        handling_unit_id = null,
        transaction_type, // 'RECEIVE','PUTAWAY','TRANSFER_OUT','TRANSFER_IN','RESERVE','RELEASE','ALLOCATE','PICK','PACK','SHIP','COUNT_ADJUSTMENT','DAMAGE','QUARANTINE','RETURN','SCRAP'
        quantity: rawQuantity, // Positive for increase/inflow, negative for decrease/outflow
        reference_type = null,
        reference_id = null,
        user_id = null,
        device_id = null,
        idempotency_key = null,
        reason_code = null,
        notes = null
      } = data;

      const quantity=Number(rawQuantity);
      if (!tenant_id || !warehouse_id || !product_id || rawQuantity === undefined || !['number','string'].includes(typeof rawQuantity) || !Number.isFinite(quantity) || !transaction_type) {
        throw new Error('tenant_id, warehouse_id, product_id, quantity and transaction_type are required');
      }

      for(const [table,id] of [['warehouses',warehouse_id],['products',product_id],['warehouse_locations',location_id],['inventory_lots',lot_id],['handling_units',handling_unit_id]]) {
        if(id==null)continue;
        const owned=(await client.query(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`,[id,tenant_id])).rows[0];
        if(!owned)throw new Error('Kayıt bulunamadı.');
        if(owned.warehouse_id&&Number(owned.warehouse_id)!==Number(warehouse_id))throw new Error('Kayıt seçilen depoya ait değil.');
        if(owned.product_id&&Number(owned.product_id)!==Number(product_id))throw new Error('Parti seçilen ürüne ait değil.');
        if(table==='inventory_lots'&&quantity<0&&['PICK','SHIP'].includes(transaction_type)){
          const days=require('./stockHealthService').daysUntil(owned.expiry_date);
          if(days!==null&&(!Number.isFinite(days)||days<0)||owned.status!=='available'||owned.qa_status!=='approved')throw new Error('Tarihi geçmiş veya bloke lot satılamaz.');
        }
        if(table==='warehouse_locations'&&owned.is_locked&&['PICK','TRANSFER_IN','TRANSFER_OUT','PUTAWAY','RECEIVE'].includes(transaction_type))throw new Error('Lokasyon kilitlidir.');
      }

      // Check idempotency if key provided
      if (idempotency_key) {
        const existingTx = await client.query(
          'SELECT * FROM inventory_transactions WHERE idempotency_key = $1 AND tenant_id = $2',
          [idempotency_key, tenant_id]
        );
        if (existingTx.rows.length > 0) {
          if (isInternalTx) await client.query('COMMIT');
          return existingTx.rows[0];
        }
      }

      if(quantity<0){
        const lots=await require('./stockHealthService').lotAvailability(tenant_id,product_id,warehouse_id,client);
        if(lot_id&&Number(lots.find(l=>Number(l.id)===Number(lot_id))?.quantity||0)<Math.abs(quantity))throw new Error('Lot stoğu yetersiz.');
        if(!lot_id&&lots.length&&!location_id){const total=Number((await client.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3',[tenant_id,product_id,warehouse_id])).rows[0].q);if(total-lots.reduce((n,l)=>n+l.quantity,0)<Math.abs(quantity))throw new Error('Lotlu stok çıkışında lot seçimi zorunludur.');}
          if(!location_id){const held=Number((await client.query('SELECT COALESCE(SUM(quantity),0) AS q FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 AND location_id IS NULL AND (lot_id=$4 OR (lot_id IS NULL AND $4 IS NULL))',[tenant_id,product_id,warehouse_id,lot_id])).rows[0].q);const physical=lot_id?Number(lots.find(l=>l.id===Number(lot_id))?.quantity||0):Number((await client.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3',[tenant_id,product_id,warehouse_id])).rows[0].q)-lots.reduce((n,l)=>n+l.quantity,0);if(physical-Math.abs(quantity)<held)throw new Error('Hasarlı veya karantina miktarı azaltılamaz.');}
      }

      // 1. Determine before quantity in the target location/bin
      let beforeQty = 0;
      let existingBinRow = null;

      if (location_id) {
        const binRes = await client.query(`
          SELECT * FROM product_bin_records 
          WHERE location_id = $1 AND product_id = $2 
          AND (lot_id = $3 OR (lot_id IS NULL AND $3 IS NULL)) AND tenant_id=$4
        `, [location_id, product_id, lot_id,tenant_id]);

        if (binRes.rows.length > 0) {
          if(binRes.rows.length>1)throw new Error('Ürün/lot/raf için mükerrer stok kaydı var.');
          existingBinRow = binRes.rows[0];
          beforeQty = parseFloat(existingBinRow.quantity) || 0;
        }
      }

      if(!location_id)beforeQty=Number((await client.query('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3',[tenant_id,warehouse_id,product_id])).rows[0].q);

      const afterQty = Math.max(0, beforeQty + quantity);

      // Validate against negative stock on decrease operations
      if (quantity < 0 && Math.abs(quantity) > beforeQty && location_id) {
        throw new Error(`Yetersiz stok! Raftaki mevcut miktar: ${beforeQty}, talep edilen: ${Math.abs(quantity)}`);
      }
      if(quantity<0&&location_id){const held=Number((await client.query('SELECT COALESCE(SUM(quantity),0) AS q FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 AND location_id=$4 AND (lot_id=$5 OR (lot_id IS NULL AND $5 IS NULL))',[tenant_id,product_id,warehouse_id,location_id,lot_id])).rows[0].q);if(beforeQty+quantity<Number(existingBinRow?.reserved_qty||0)+held-0.000001)throw new Error('Rezerve, hasarlı veya karantina miktarı azaltılamaz.');}

      // 2. Insert into Ledger (Immutable Source of Truth)
      const insertLedgerSql = `
        INSERT INTO inventory_transactions (
          tenant_id, warehouse_id, location_id, product_id, lot_id, serial_number, 
          handling_unit_id, transaction_type, quantity, before_quantity, after_quantity, 
          reference_type, reference_id, user_id, device_id, idempotency_key, reason_code, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;
      const ledgerValues = [
        tenant_id, warehouse_id, location_id || null, product_id, lot_id, serial_number,
        handling_unit_id, transaction_type, quantity, beforeQty, afterQty,
        reference_type, reference_id ? String(reference_id) : null, user_id, device_id,
        idempotency_key, reason_code, notes
      ];
      const ledgerRes = await client.query(insertLedgerSql, ledgerValues);
      const txRecord = ledgerRes.rows[0];

      // 3. Update State Projection: product_bin_records
      if (location_id) {
        if (existingBinRow) {
          await client.query(`
            UPDATE product_bin_records 
            SET quantity = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [afterQty, existingBinRow.id]);
        } else {
          await client.query(`
            INSERT INTO product_bin_records (tenant_id, location_id, product_id, lot_id, quantity, reserved_qty)
            VALUES ($1, $2, $3, $4, $5, 0)
          `, [tenant_id, location_id, product_id, lot_id, afterQty]);
        }
      }

      // 4. Update Warehouse-level stock_records projection
      const stockRecRes = await client.query(`
        SELECT * FROM stock_records 
        WHERE warehouse_id = $1 AND product_id = $2 AND tenant_id=$3
      `, [warehouse_id, product_id,tenant_id]);

      if(quantity<0&&Math.abs(quantity)>Number(stockRecRes.rows[0]?.quantity||0))throw new Error('Yetersiz depo stoğu.');

      if (stockRecRes.rows.length > 0) {
        const currentWhQty = parseFloat(stockRecRes.rows[0].quantity) || 0;
        const newWhQty = Math.max(0, currentWhQty + quantity);
        await client.query(`
          UPDATE stock_records 
          SET quantity = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newWhQty, stockRecRes.rows[0].id]);
      } else {
        await client.query(`
          INSERT INTO stock_records (tenant_id, warehouse_id, product_id, quantity, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [tenant_id, warehouse_id, product_id, Math.max(0, quantity)]);
      }

      await require('./stockAlertSync').syncWarehouseStockAlert(client,tenant_id,product_id,warehouse_id);
      if (isInternalTx) await client.query('COMMIT');

      // Emit domain event asynchronously
      wmsEventService.emit(`inventory.${transaction_type.toLowerCase()}`, {
        transaction_id: txRecord.id,
        warehouse_id,
        location_id,
        product_id,
        quantity,
        after_quantity: afterQty
      });

      return txRecord;
    } catch (err) {
      if (isInternalTx) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (isInternalTx) client.release();
    }
  }

  /**
   * Get Stock Ledger History with filters
   */
  async getLedgerHistory(filters = {}) {
    let query = `
      SELECT tx.*, p.name as product_name, p.sku, p.barcode, 
             loc.location_code, loc.zone_name,
             w.name as warehouse_name,
             lot.lot_number, lot.expiry_date,
             u.email as user_email
      FROM inventory_transactions tx
      JOIN products p ON tx.product_id = p.id
      JOIN warehouses w ON tx.warehouse_id = w.id
      LEFT JOIN warehouse_locations loc ON tx.location_id = loc.id
      LEFT JOIN inventory_lots lot ON tx.lot_id = lot.id
      LEFT JOIN users u ON tx.user_id = u.id
      WHERE tx.tenant_id = $1
    `;
    const params = [filters.tenant_id];

    if (filters.warehouse_id) {
      params.push(filters.warehouse_id);
      query += ` AND tx.warehouse_id = $${params.length}`;
    }
    if (filters.product_id) {
      params.push(filters.product_id);
      query += ` AND tx.product_id = $${params.length}`;
    }
    if (filters.location_id) {
      params.push(filters.location_id);
      query += ` AND tx.location_id = $${params.length}`;
    }
    if (filters.transaction_type) {
      params.push(filters.transaction_type);
      query += ` AND tx.transaction_type = $${params.length}`;
    }
    if (filters.reference_type) {
      params.push(filters.reference_type);
      query += ` AND tx.reference_type = $${params.length}`;
    }

    query += ' ORDER BY tx.created_at DESC LIMIT 200';

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get comprehensive stock breakdown for a product (On Hand, Reserved, Allocated, Available)
   */
  async getProductStockBreakdown(productId, warehouseId = null) {
    let whCondition = '';
    const params = [productId];

    if (warehouseId) {
      params.push(warehouseId);
      whCondition = 'AND pbr.location_id IN (SELECT id FROM warehouse_locations WHERE warehouse_id = $2)';
    }

    // Bin level breakdown
    const binQuery = `
      SELECT pbr.*, loc.location_code, loc.zone_name, loc.aisle_code, loc.rack_number, 
             loc.shelf_tier, loc.bin_position, loc.location_type,
             lot.lot_number, lot.expiry_date, lot.status as lot_status
      FROM product_bin_records pbr
      JOIN warehouse_locations loc ON pbr.location_id = loc.id
      LEFT JOIN inventory_lots lot ON pbr.lot_id = lot.id
      WHERE pbr.product_id = $1 ${whCondition}
      ORDER BY loc.location_code ASC
    `;
    const binsRes = await pool.query(binQuery, params);

    // Reservations
    const resParams = [productId];
    let resWhCondition = '';
    if (warehouseId) {
      resParams.push(warehouseId);
      resWhCondition = 'AND warehouse_id = $2';
    }
    const resQuery = `
      SELECT * FROM inventory_reservations 
      WHERE product_id = $1 AND status IN ('reserved', 'allocated') ${resWhCondition}
    `;
    const resRes = await pool.query(resQuery, resParams);

    const onHand = binsRes.rows.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
    const reserved = resRes.rows.reduce((sum, r) => sum + (parseFloat(r.reserved_qty) || 0), 0);
    const allocated = resRes.rows.reduce((sum, r) => sum + (parseFloat(r.allocated_qty) || 0), 0);
    const available = Math.max(0, onHand - reserved);

    return {
      product_id: productId,
      on_hand: onHand,
      reserved,
      allocated,
      available,
      locations: binsRes.rows,
      active_reservations: resRes.rows
    };
  }
}

module.exports = new InventoryTransactionService();
