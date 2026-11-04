const pool = require('../config/database');
const warehouseNavigationService = require('./warehouseNavigationService');
const inventoryTransactionService = require('./inventoryTransactionService');
const wmsEventService = require('./wmsEventService');

class WMSPickingService {
  /**
   * Create a Pick Wave with automatic shortest pick-path route optimization
   */
  async createWave(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        tenant_id,
        warehouse_id,
        picking_type = 'WAVE', // 'SINGLE','BATCH','WAVE','CLUSTER','ZONE'
        items = [], // [{ product_id, requested_qty }]
        assigned_user_id = null
      } = data;

      if (!warehouse_id || !items || items.length === 0) {
        throw new Error('Geçerli bir depo ve en az 1 toplama kalemi gereklidir.');
      }

      const year = new Date().getFullYear();
      const waveNo = `WAV-${year}-${require('crypto').randomUUID()}`;

      // 1. For each item, find best source bin (FEFO order with available stock)
      const rawTasks = [];
      for (const item of items) {
        let neededQty = parseFloat(item.requested_qty) || 1;

        const binsRes = await client.query(`
          SELECT pbr.*, lot.expiry_date
          FROM product_bin_records pbr
          JOIN warehouse_locations loc ON pbr.location_id = loc.id
          LEFT JOIN inventory_lots lot ON pbr.lot_id = lot.id
          WHERE pbr.product_id = $1 
            AND loc.warehouse_id = $2 
            AND pbr.tenant_id = $3
            AND pbr.quantity > 0
            AND loc.is_locked = 0
          ORDER BY COALESCE(lot.expiry_date, '9999-12-31') ASC, pbr.quantity DESC
        `, [item.product_id, warehouse_id, tenant_id]);

        for (const bin of binsRes.rows) {
          if (neededQty <= 0) break;
          const availableInBin = parseFloat(bin.quantity) || 0;
          const takeQty = Math.min(availableInBin, neededQty);

          rawTasks.push({
            location_id: bin.location_id,
            product_id: item.product_id,
            lot_id: bin.lot_id,
            requested_qty: takeQty
          });

          neededQty -= takeQty;
        }

        if (neededQty > 0) {
          throw new Error(`Yetersiz stok! Ürün ID: ${item.product_id} için ${neededQty} adet eksik.`);
        }
      }

      // 2. Run Spatial Route Optimization (Shortest Path TSP)
      const routeResult = await warehouseNavigationService.optimizePickPath(rawTasks, warehouse_id, tenant_id, { x: 0, y: 0 }, client);
      const optimizedTasks = routeResult.optimized_tasks || rawTasks;

      // 3. Create Wave
      const waveRes = await client.query(`
        INSERT INTO wms_pick_waves (
          tenant_id, wave_no, warehouse_id, picking_type, status, total_lines, picked_lines, assigned_user_id
        ) VALUES ($1, $2, $3, $4, 'pending', $5, 0, $6)
        RETURNING *
      `, [tenant_id, waveNo, warehouse_id, picking_type, optimizedTasks.length, assigned_user_id]);

      const wave = waveRes.rows[0];

      // 4. Insert Tasks in optimized sequence order
      for (const task of optimizedTasks) {
        await client.query(`
          INSERT INTO wms_pick_tasks (
            tenant_id, wave_id, location_id, product_id, lot_id, requested_qty, picked_qty, sequence_number, status
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'pending')
        `, [tenant_id, wave.id, task.location_id, task.product_id, task.lot_id || null, task.requested_qty, task.sequence_number || 1]);
      }

      await client.query('COMMIT');

      wmsEventService.emit('wave.created', {
        wave_id: wave.id,
        wave_no: waveNo,
        total_lines: optimizedTasks.length,
        estimated_time_minutes: routeResult.estimated_time_minutes
      });

      return await this.getWaveById(wave.id,tenant_id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Confirm picked item at location
   */
  async confirmPickItem(data) {
    const {
      tenant_id,
      task_id,
      picked_qty,
      target_handling_unit_id = null,
      user_id = null,
      device_id = null,
      notes = null
    } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const taskRes = await client.query(`
        SELECT t.*, w.warehouse_id, w.wave_no
        FROM wms_pick_tasks t
        JOIN wms_pick_waves w ON t.wave_id = w.id
        WHERE t.id = $1 AND t.tenant_id = $2
      `, [task_id, tenant_id]);

      if (taskRes.rows.length === 0) throw new Error('Toplama görevi bulunamadı');
      const task = taskRes.rows[0];

      if (task.status === 'picked') throw new Error('Bu kalem zaten toplanmış.');

      const actualPicked = parseFloat(picked_qty || task.requested_qty) || 1;

      // 1. Record atomic inventory transaction (PICK / OUTFLOW)
      await inventoryTransactionService.recordTransaction({ tenant_id, 
        warehouse_id: task.warehouse_id,
        location_id: task.location_id,
        product_id: task.product_id,
        lot_id: task.lot_id,
        handling_unit_id: target_handling_unit_id,
        transaction_type: 'PICK',
        quantity: -Math.abs(actualPicked),
        reference_type: 'PICK_WAVE',
        reference_id: task.wave_no,
        user_id,
        device_id,
        notes: `Dalga toplama (Görev #${task.sequence_number})`
      }, client);

      // 2. Update task
      await client.query(`
        UPDATE wms_pick_tasks
        SET picked_qty = $1, target_handling_unit_id = $2, status = 'picked', picked_by = $3, picked_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND tenant_id = $5
      `, [actualPicked, target_handling_unit_id, user_id, task_id, tenant_id]);

      // 3. Update wave progress
      await client.query(`
        UPDATE wms_pick_waves
        SET picked_lines = picked_lines + 1,
            status = CASE 
              WHEN (SELECT COUNT(*) FROM wms_pick_tasks WHERE wave_id = $1 AND tenant_id = $2 AND status != 'picked') = 0 THEN 'completed'
              ELSE 'in_progress'
            END,
            completed_at = CASE
              WHEN (SELECT COUNT(*) FROM wms_pick_tasks WHERE wave_id = $1 AND tenant_id = $2 AND status != 'picked') = 0 THEN CURRENT_TIMESTAMP
              ELSE NULL
            END
        WHERE id = $1 AND tenant_id = $2
      `, [task.wave_id, tenant_id]);

      await client.query('COMMIT');
      wmsEventService.emit('inventory.picked', { wave_id: task.wave_id, task_id, picked_qty: actualPicked });
      return { success: true, task_id, picked_qty: actualPicked };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get Wave by ID with tasks in route order
   */
  async getWaveById(waveId,tenantId) {
    const waveRes = await pool.query(`
      SELECT w.*, wh.name as warehouse_name, u.email as assigned_user_email
      FROM wms_pick_waves w
      JOIN warehouses wh ON w.warehouse_id = wh.id
      LEFT JOIN users u ON w.assigned_user_id = u.id
      WHERE w.id = $1 AND w.tenant_id = $2
    `, [waveId,tenantId]);

    if (waveRes.rows.length === 0) return null;
    const wave = waveRes.rows[0];

    const tasksRes = await pool.query(`
      SELECT t.*, p.name as product_name, p.sku, p.barcode,
             loc.location_code, loc.zone_name, loc.aisle_code, loc.rack_number, loc.shelf_tier, loc.bin_position,
             lot.lot_number, lot.expiry_date,
             hu.hu_code as target_hu_code
      FROM wms_pick_tasks t
      JOIN products p ON t.product_id = p.id
      JOIN warehouse_locations loc ON t.location_id = loc.id
      LEFT JOIN inventory_lots lot ON t.lot_id = lot.id
      LEFT JOIN handling_units hu ON t.target_handling_unit_id = hu.id
      WHERE t.wave_id = $1 AND t.tenant_id = $2
      ORDER BY t.sequence_number ASC
    `, [waveId, tenantId]);

    wave.tasks = tasksRes.rows;
    return wave;
  }

  /**
   * List all waves
   */
  async getWaves(filters = {}) {
    let query = `
      SELECT w.*, wh.name as warehouse_name, u.email as assigned_user_email,
             (SELECT COUNT(*) FROM wms_pick_tasks WHERE wave_id = w.id) as total_tasks,
             (SELECT COUNT(*) FROM wms_pick_tasks WHERE wave_id = w.id AND status = 'picked') as completed_tasks
      FROM wms_pick_waves w
      JOIN warehouses wh ON w.warehouse_id = wh.id
      LEFT JOIN users u ON w.assigned_user_id = u.id
      WHERE w.tenant_id = $1
    `;
    const params = [filters.tenant_id];

    if (filters.warehouse_id) {
      params.push(filters.warehouse_id);
      query += ` AND w.warehouse_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      query += ` AND w.status = $${params.length}`;
    }

    query += ' ORDER BY w.created_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    return result.rows;
  }
}

module.exports = new WMSPickingService();
