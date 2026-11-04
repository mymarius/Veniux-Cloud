const pool = require('../config/database');

/**
 * Renkli Reçete (Kırmızı, Yeşil, Mor, Turuncu) & İl Sağlık Denetim Masası Controller
 */

// Get all colored prescription records
const getColoredPrescriptions = async (req, res) => {
  try {
    const { type, search, start_date, end_date } = req.query;

    let query = `
      SELECT 
        cp.*,
        p.name as medicine_name,
        p.sku,
        p.kamu_fiyati,
        p.depocu_fiyati
      FROM colored_prescriptions cp
      JOIN products p ON cp.medicine_id = p.id
      WHERE cp.tenant_id = $1
    `;
    const params = [req.user.tenantId];

    if (type) {
      params.push(type.toLowerCase());
      query += ` AND cp.prescription_type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (cp.prescription_no LIKE $${params.length} OR cp.patient_tc LIKE $${params.length} OR cp.patient_name LIKE $${params.length} OR cp.doctor_name LIKE $${params.length} OR p.name LIKE $${params.length})`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND DATE(cp.created_at) >= DATE($${params.length})`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND DATE(cp.created_at) <= DATE($${params.length})`;
    }

    query += ' ORDER BY cp.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get colored prescriptions error:', error);
    res.status(500).json({ error: 'Renkli reçeteler listelenemedi.' });
  }
};

// Create a new colored prescription entry (Kırmızı/Yeşil reçete satışı)
const createColoredPrescription = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      prescription_no,
      prescription_type = 'kirmizi',
      patient_tc,
      patient_name,
      doctor_name,
      doctor_diploma_no,
      protocol_no,
      medicine_id,
      gtin,
      serial_number,
      quantity = 1,
      notes,
      warehouse_id = null // default retail pharmacy shelf
    } = req.body;

    if (!prescription_no || !patient_tc || !patient_name || !medicine_id) {
      return res.status(400).json({ error: 'Reçete No, Hasta TC, Hasta Adı ve İlaç seçimi zorunludur.' });
    }

    await client.query('BEGIN');

    // Dynamically resolve valid warehouse
    let targetWhId = warehouse_id;
    const whCheck = await client.query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id=$2', [targetWhId,req.user.tenantId]);
    if (whCheck.rows.length === 0) {
      const fallbackWh = await client.query('SELECT id FROM warehouses WHERE tenant_id = $1 ORDER BY id ASC LIMIT 1', [req.user.tenantId]);
      if (fallbackWh.rows.length > 0) {
        targetWhId = fallbackWh.rows[0].id;
      } else {
        const newWh = await client.query(`INSERT INTO warehouses (tenant_id, name, type, location) VALUES ($1, 'Eczane Bankosu', 'retail', 'Banko') RETURNING id`, [req.user.tenantId]);
        targetWhId = newWh.rows[0].id;
      }
    }

    // 1. Insert colored prescription record
    const insertRes = await client.query(`
      INSERT INTO colored_prescriptions (
        tenant_id, prescription_no, prescription_type, patient_tc, patient_name,
        doctor_name, doctor_diploma_no, protocol_no, medicine_id,
        gtin, serial_number, quantity, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'dispensed', $13)
      RETURNING *
    `, [
      req.user.tenantId,
      prescription_no.trim(),
      prescription_type.toLowerCase(),
      patient_tc.trim(),
      patient_name.trim(),
      doctor_name ? doctor_name.trim() : null,
      doctor_diploma_no ? doctor_diploma_no.trim() : null,
      protocol_no ? protocol_no.trim() : null,
      parseInt(medicine_id, 10),
      gtin || null,
      serial_number || null,
      parseInt(quantity, 10) || 1,
      notes || null
    ]);

    // 2. Decrement stock in Pharmacy Warehouse
    await client.query(`
      UPDATE stock_records 
      SET quantity = MAX(0, quantity - $1), updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $2 AND warehouse_id = $3
    `, [quantity, medicine_id, targetWhId]);

    // 3. Log Stock Movement
    await client.query(`
      INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note)
      VALUES ($1, $2, $3, $4, 'outbound', 'colored_prescription', $5)
    `, [
      req.user.tenantId,
      medicine_id,
      targetWhId,
      -Math.abs(quantity),
      `Renkli Reçeteli Satış (${prescription_type.toUpperCase()}): Reçete #${prescription_no}`
    ]);

    // 4. Update medicine batch status to dispensed if serial provided
    if (serial_number) {
      await client.query(`
        UPDATE medicine_batches 
        SET status = 'dispensed'
        WHERE serial_number = $1 AND tenant_id = $2
      `, [serial_number, req.user.tenantId]);
    }

    await client.query('COMMIT');
    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Create colored prescription error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Reçete kaydı oluşturulamadı.' });
  } finally {
    client.release();
  }
};

// Get İl Sağlık Müdürlüğü Denetim & İcmal Raporu
const getInspectionReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month ? month.padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0');

    const result = await pool.query(`
      SELECT 
        cp.prescription_type,
        COUNT(cp.id) as total_prescriptions,
        SUM(cp.quantity) as total_boxes_dispensed,
        p.name as medicine_name,
        p.sku,
        p.gtin
      FROM colored_prescriptions cp
      JOIN products p ON cp.medicine_id = p.id
      WHERE strftime('%Y-%m', cp.created_at) = $1
      GROUP BY cp.prescription_type, p.id, p.name, p.sku, p.gtin
      ORDER BY cp.prescription_type, total_boxes_dispensed DESC
    `, [`${currentYear}-${currentMonth}`]);

    const summary = await pool.query(`
      SELECT 
        prescription_type,
        COUNT(*) as presc_count,
        SUM(quantity) as box_count
      FROM colored_prescriptions
      WHERE strftime('%Y-%m', created_at) = $1
      GROUP BY prescription_type
    `, [`${currentYear}-${currentMonth}`]);

    res.json({
      period: `${currentYear}-${currentMonth}`,
      summary: summary.rows,
      details: result.rows
    });
  } catch (error) {
    console.error('Get inspection report error:', error);
    res.status(500).json({ error: 'Denetim raporu alınamadı.' });
  }
};

module.exports = {
  getColoredPrescriptions,
  createColoredPrescription,
  getInspectionReport
};
