const pool = require('../config/database');
const inventoryTransactionService = require('./inventoryTransactionService');
const wmsEventService = require('./wmsEventService');

class WMSPackingService {
  /**
   * Create a new Handling Unit (Pallet, Box, Tote)
   */
  async createHandlingUnit(data) {
    const {
      tenant_id,
      warehouse_id,
      hu_type = 'BOX', // 'PALLET','BOX','TOTE','CART'
      parent_hu_id = null,
      max_weight_kg = 500,
      custom_code = null
    } = data;

    const prefix = hu_type.substring(0, 3).toUpperCase();
    const huCode = custom_code || `${prefix}-${new Date().getFullYear()}-${require('crypto').randomUUID()}`;
    const ssccCode = hu_type === 'PALLET' ? `0869${String(Date.now()).slice(-14)}` : null;

    const query = `
      INSERT INTO handling_units (
        tenant_id, hu_code, sscc_code, hu_type, warehouse_id, parent_hu_id, max_weight_kg, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
      RETURNING *
    `;
    const result = await pool.query(query, [tenant_id, huCode, ssccCode, hu_type, warehouse_id, parent_hu_id, max_weight_kg]);
    return result.rows[0];
  }

  /**
   * Dispatch / Ship a Handling Unit or Order Outbound
   */
  async dispatchShipment(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        tenant_id,
        warehouse_id,
        handling_unit_id,
        carrier_company = 'Öz Lojistik',
        plate_number = null,
        driver_name = null,
        waybill_no = null,
        actual_weight_kg = 0,
        user_id = null,
        device_id = null
      } = data;

      const huRes = await client.query('SELECT * FROM handling_units WHERE id = $1 AND tenant_id=$2 AND warehouse_id=$3', [handling_unit_id,tenant_id,warehouse_id]);
      if (huRes.rows.length === 0) throw new Error('Taşıma birimi (Handling Unit) bulunamadı');
      const hu = huRes.rows[0];
      if(hu.status==='shipped')throw new Error('Bu taşıma birimi zaten sevk edilmiş.');

      // Update HU status to shipped
      await client.query(`
        UPDATE handling_units 
        SET status = 'shipped', weight_kg = $1
        WHERE id = $2 AND tenant_id = $3
      `, [actual_weight_kg, handling_unit_id, tenant_id]);

      await client.query('COMMIT');
      wmsEventService.emit('inventory.shipped', { handling_unit_id, hu_code: hu.hu_code, carrier: carrier_company });

      return {
        success: true,
        hu_code: hu.hu_code,
        carrier_company,
        waybill_no: waybill_no || `SEVK-${Date.now()}`,
        status: 'shipped'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List Handling Units
   */
  async getHandlingUnits(warehouseId, tenantId) {
    const query = `
      SELECT hu.*, loc.location_code, w.name as warehouse_name
      FROM handling_units hu
      JOIN warehouses w ON hu.warehouse_id = w.id
      LEFT JOIN warehouse_locations loc ON hu.current_location_id = loc.id
      WHERE hu.warehouse_id = $1 AND hu.tenant_id = $2
      ORDER BY hu.created_at DESC
    `;
    const result = await pool.query(query, [warehouseId, tenantId]);
    return result.rows;
  }

  /**
   * Dock & Gate Appointments
   */
  async getDockAppointments(warehouseId, tenantId) {
    const query = `
      SELECT * FROM wms_dock_appointments
      WHERE warehouse_id = $1 AND tenant_id = $2
      ORDER BY appointment_time ASC
    `;
    const result = await pool.query(query, [warehouseId, tenantId]);
    return result.rows;
  }

  async createDockAppointment(data) {
    const {
      tenant_id,
      warehouse_id,
      dock_code,
      direction = 'INBOUND',
      appointment_time,
      carrier_company,
      driver_name,
      driver_phone,
      plate_number,
      notes
    } = data;

    const query = `
      INSERT INTO wms_dock_appointments (
        tenant_id,warehouse_id, dock_code, direction, appointment_time, 
        carrier_company, driver_name, driver_phone, plate_number, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,$10)
      RETURNING *
    `;
    const result = await pool.query(query, [
      tenant_id,warehouse_id, dock_code, direction, appointment_time,
      carrier_company, driver_name, driver_phone, plate_number, notes
    ]);
    return result.rows[0];
  }
}

module.exports = new WMSPackingService();
