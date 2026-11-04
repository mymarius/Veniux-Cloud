const pool = require('../config/database');
const inventoryTransactionService = require('./inventoryTransactionService');
const wmsEventService = require('./wmsEventService');

class InventoryReservationService {
  /**
   * Create an inventory reservation with FEFO/FIFO automated bin allocation
   */
  async createReservation(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        tenant_id,
        warehouse_id,
        product_id,
        order_id = null,
        order_line_id = null,
        requested_qty,
        strategy = 'FEFO' // 'FEFO' (First Expiry First Out) or 'FIFO'
      } = data;

      if (!warehouse_id || !product_id || !requested_qty || requested_qty <= 0) {
        throw new Error('Geçerli bir depo, ürün ve rezervasyon miktarı gereklidir.');
      }

      // 1. Fetch available stock in bins ordered by FEFO / FIFO strategy
      let orderByClause = "COALESCE(lot.expiry_date, '9999-12-31') ASC, pbr.quantity DESC";
      if (strategy === 'FIFO') {
        orderByClause = 'pbr.updated_at ASC, pbr.quantity DESC';
      }

      const availableBinsRes = await client.query(`
        SELECT pbr.*, lot.expiry_date, lot.lot_number, loc.location_code, loc.zone_name
        FROM product_bin_records pbr
        JOIN warehouse_locations loc ON pbr.location_id = loc.id
        LEFT JOIN inventory_lots lot ON pbr.lot_id = lot.id
        WHERE pbr.product_id = $1 
          AND loc.warehouse_id = $2
          AND (pbr.quantity - pbr.reserved_qty) > 0
          AND loc.is_locked = 0
          AND (lot.status IS NULL OR lot.status = 'available')
        ORDER BY ${orderByClause}
      `, [product_id, warehouse_id]);

      let remainingToReserve = requested_qty;
      const reservationsCreated = [];

      for (const bin of availableBinsRes.rows) {
        if (remainingToReserve <= 0) break;

        const binAvailable = (parseFloat(bin.quantity) || 0) - (parseFloat(bin.reserved_qty) || 0);
        const qtyToTake = Math.min(binAvailable, remainingToReserve);

        if (qtyToTake > 0) {
          // Create reservation record
          const insertRes = await client.query(`
            INSERT INTO inventory_reservations (
              tenant_id, warehouse_id, location_id, product_id, lot_id, order_id, 
              order_line_id, reserved_qty, allocated_qty, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'reserved')
            RETURNING *
          `, [tenant_id, warehouse_id, bin.location_id, product_id, bin.lot_id, order_id, order_line_id, qtyToTake]);

          // Update bin reserved_qty
          await client.query(`
            UPDATE product_bin_records 
            SET reserved_qty = reserved_qty + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [qtyToTake, bin.id]);

          reservationsCreated.push(insertRes.rows[0]);
          remainingToReserve -= qtyToTake;
        }
      }

      if (remainingToReserve > 0) {
        throw new Error(`Yetersiz serbest stok! İstenen: ${requested_qty}, Rezerve edilebilen: ${requested_qty - remainingToReserve}`);
      }

      await client.query('COMMIT');

      wmsEventService.emit('inventory.reserved', {
        order_id,
        product_id,
        requested_qty,
        reservations: reservationsCreated
      });

      return {
        success: true,
        reserved_total: requested_qty,
        reservations: reservationsCreated
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Release reservation and restore available stock
   */
  async releaseReservation(reservationId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resRes = await client.query('SELECT * FROM inventory_reservations WHERE id = $1', [reservationId]);
      if (resRes.rows.length === 0) throw new Error('Rezervasyon bulunamadı');
      const reservation = resRes.rows[0];

      if (reservation.status === 'completed' || reservation.status === 'cancelled') {
        throw new Error('Bu rezervasyon zaten kapatılmış.');
      }

      const unpickedQty = Math.max(0, reservation.reserved_qty - reservation.picked_qty);

      // Restore reserved quantity in bin
      if (unpickedQty > 0 && reservation.location_id) {
        await client.query(`
          UPDATE product_bin_records 
          SET reserved_qty = MAX(0, reserved_qty - $1), updated_at = CURRENT_TIMESTAMP
          WHERE location_id = $2 AND product_id = $3
        `, [unpickedQty, reservation.location_id, reservation.product_id]);
      }

      // Mark cancelled
      const updatedRes = await client.query(`
        UPDATE inventory_reservations 
        SET status = 'cancelled', released_qty = $1
        WHERE id = $2
        RETURNING *
      `, [unpickedQty, reservationId]);

      await client.query('COMMIT');

      wmsEventService.emit('inventory.released', { reservation_id: reservationId, released_qty: unpickedQty });
      return updatedRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List active reservations
   */
  async getActiveReservations(warehouseId = null,tenantId) {
    let query = `
      SELECT r.*, p.name as product_name, p.sku, p.barcode,
             loc.location_code, loc.zone_name,
             lot.lot_number, lot.expiry_date
      FROM inventory_reservations r
      JOIN products p ON r.product_id = p.id
      LEFT JOIN warehouse_locations loc ON r.location_id = loc.id
      LEFT JOIN inventory_lots lot ON r.lot_id = lot.id
      WHERE r.tenant_id = $1 AND r.status IN ('reserved', 'allocated')
    `;
    const params = [tenantId];
    if (warehouseId) {
      params.push(warehouseId);
      query += ` AND r.warehouse_id = $2`;
    }
    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }
}

module.exports = new InventoryReservationService();
