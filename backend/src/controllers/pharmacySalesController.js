const pool = require('../config/database');

/**
 * Eczane POS & Banko Hızlı Satış, Veresiye & Hasta Cari Masası Controller
 */

// Create POS Sale Transaction
const createPosSale = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      patient_id = null,
      items = [], // [{ product_id, gtin, serial_number, quantity, unit_price }, ...]
      payment_method = 'cash', // 'cash' | 'credit_card' | 'veresiye' | 'sgk_copay'
      discount_amount = 0,
      sgk_coverage_amount = 0,
      patient_copay_amount = 0,
      warehouse_id = 2 // default retail shelf
    } = req.body;
    const tenantId = req.user.tenantId;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Satış sepetinde en az 1 ürün bulunmalıdır.' });
    }

    await client.query('BEGIN');

    // Dynamically resolve valid warehouse
    let targetWhId = warehouse_id;
    const whCheck = await client.query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2', [targetWhId, tenantId]);
    if (whCheck.rows.length === 0) {
      const fallbackWh = await client.query('SELECT id FROM warehouses WHERE tenant_id = $1 ORDER BY id ASC LIMIT 1', [tenantId]);
      if (fallbackWh.rows.length > 0) {
        targetWhId = fallbackWh.rows[0].id;
      } else {
        const newWh = await client.query(`INSERT INTO warehouses (tenant_id, name, type, location) VALUES ($1, 'Eczane Bankosu', 'retail', 'Banko') RETURNING id`, [tenantId]);
        targetWhId = newWh.rows[0].id;
      }
    }

    // Calculate total amount
    for(const item of items){
      const lots=await require('../services/stockHealthService').lotAvailability(tenantId,item.product_id,targetWhId,client);
      if(lots.length||(await client.query('SELECT id FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 LIMIT 1',[tenantId,item.product_id,targetWhId])).rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'Lotlu depo ürününü lot seçilen kasa veya WMS satış akışından çıkarın.'});}
      if(item.serial_number){
        const batch=(await client.query('SELECT expiry_date,status,product_id FROM medicine_batches WHERE tenant_id=$1 AND serial_number=$2',[tenantId,item.serial_number])).rows[0];
        const days=batch?require('../services/stockHealthService').daysUntil(batch.expiry_date):NaN;
        if(!batch||Number(batch.product_id)!==Number(item.product_id)||batch.status!=='in_stock'||days!==null&&(!Number.isFinite(days)||days<0)){await client.query('ROLLBACK');return res.status(409).json({error:'İlaç seri kaydı satılamaz; stok ve son kullanma tarihini doğrulayın.'});}
      }
    }
    let totalAmount = 0;
    for (const item of items) {
      const q = parseInt(item.quantity, 10) || 1;
      const price = parseFloat(item.unit_price) || 0;
      totalAmount += q * price;
    }

    const discount = parseFloat(discount_amount) || 0;
    const netAmount = Math.max(0, totalAmount - discount);
    const receiptNo = `FIS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Insert POS Sale record
    const saleInsert = await client.query(`
      INSERT INTO pos_sales (
        tenant_id, receipt_no, patient_id, total_amount, discount_amount,
        net_amount, payment_method, sgk_coverage_amount, patient_copay_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed')
      RETURNING *
    `, [
      tenantId,
      receiptNo,
      patient_id ? parseInt(patient_id, 10) : null,
      totalAmount,
      discount,
      netAmount,
      payment_method,
      parseFloat(sgk_coverage_amount) || 0,
      parseFloat(patient_copay_amount) || 0
    ]);

    const saleId = saleInsert.rows[0].id;

    // 2. Insert Sale Items & Decrement Stock
    for (const item of items) {
      const q = parseInt(item.quantity, 10) || 1;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const itemTotal = q * unitPrice;

      await client.query(`
        INSERT INTO pos_sale_items (
          tenant_id, sale_id, product_id, gtin, serial_number, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [tenantId, saleId, item.product_id, item.gtin || null, item.serial_number || null, q, unitPrice, itemTotal]);

      // Decrement stock in retail warehouse
      await client.query(`
        UPDATE stock_records
        SET quantity = MAX(0, quantity - $1), updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2 AND warehouse_id = $3 AND tenant_id = $4
      `, [q, item.product_id, targetWhId, tenantId]);

      // Stock movement log
      await client.query(`
        INSERT INTO stock_movements (
          tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note
        ) VALUES ($1, $2, $3, $4, 'outbound', 'pos_sale', $5)
      `, [tenantId, item.product_id, targetWhId, -Math.abs(q), `Banko Satışı / Fiş: ${receiptNo}`]);

      // If serial number was provided, mark batch as dispensed
      if (item.serial_number) {
        await client.query(`
          UPDATE medicine_batches 
          SET status = 'dispensed'
          WHERE serial_number = $1 AND tenant_id = $2
        `, [item.serial_number, tenantId]);
      }
    }

    // 3. Handle Veresiye (Patient Debt) if selected
    if (payment_method === 'veresiye' && patient_id) {
      await client.query(`
        INSERT INTO patient_debts (tenant_id, patient_id, sale_id, amount, paid_amount, status, due_date, notes)
        VALUES ($1, $2, $3, $4, 0, 'unpaid', date('now', '+30 days'), $5)
      `, [tenantId, patient_id, saleId, netAmount, `Fiş #${receiptNo} Veresiye Borcu`]);

      await client.query(`
        UPDATE patient_accounts 
        SET current_balance = current_balance + $1
        WHERE id = $2 AND tenant_id = $3
      `, [netAmount, patient_id, tenantId]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      sale: saleInsert.rows[0],
      receipt_no: receiptNo,
      net_amount: netAmount,
      items_count: items.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create POS sale error:', error);
    res.status(500).json({ error: error.message || 'Satış kaydedilemedi.' });
  } finally {
    client.release();
  }
};

// Get POS Sales History
const getPosSales = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*,
        p.full_name as patient_name,
        p.phone as patient_phone,
        (SELECT COUNT(*) FROM pos_sale_items WHERE sale_id = s.id AND tenant_id = $1) as total_items
      FROM pos_sales s
      LEFT JOIN patient_accounts p ON s.patient_id = p.id
      WHERE s.tenant_id = $1
      ORDER BY s.created_at DESC
      LIMIT 100
    `, [req.user.tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get POS sales error:', error);
    res.status(500).json({ error: 'Satış geçmişi yüklenemedi.' });
  }
};

// Get Patient Accounts (Hasta & Veresiye Defteri)
const getPatientAccounts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pa.*,
        (SELECT COUNT(*) FROM patient_debts WHERE patient_id = pa.id AND status = 'unpaid' AND tenant_id = $1) as unpaid_debt_count
      FROM patient_accounts pa
      WHERE pa.tenant_id = $1
      ORDER BY pa.current_balance DESC, pa.full_name ASC
    `, [req.user.tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get patient accounts error:', error);
    res.status(500).json({ error: 'Hasta listesi yüklenemedi.' });
  }
};

// Create Patient Account
const createPatientAccount = async (req, res) => {
  try {
    const { tc_no, full_name, phone, address, notes } = req.body;
    const tenantId = req.user.tenantId;

    if (!full_name) {
      return res.status(400).json({ error: 'Hasta adı soyadı zorunludur.' });
    }

    if (tc_no) {
      const existing = await pool.query('SELECT * FROM patient_accounts WHERE tc_no = $1 AND tenant_id = $2', [tc_no.trim(), tenantId]);
      if (existing.rows.length > 0) {
        return res.status(200).json(existing.rows[0]);
      }
    }

    await pool.query(`
      INSERT INTO patient_accounts (tenant_id, tc_no, full_name, phone, address, notes, current_balance)
      VALUES ($1, $2, $3, $4, $5, $6, 0)
    `, [
      tenantId,
      tc_no ? tc_no.trim() : null,
      full_name.trim(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      notes || null
    ]);

    const created = await pool.query('SELECT * FROM patient_accounts WHERE full_name = $1 AND tenant_id = $2 ORDER BY id DESC LIMIT 1', [full_name.trim(), tenantId]);

    res.status(201).json(created.rows[0]);
  } catch (error) {
    console.error('Create patient account error:', error);
    res.status(500).json({ error: 'Hasta hesabı oluşturulamadı.' });
  }
};

// Record payment towards Patient Debt
const payPatientDebt = async (req, res) => {
  const client = await pool.connect();
  try {
    const { patient_id, amount, notes } = req.body;
    const payAmount = parseFloat(amount);
    const tenantId = req.user.tenantId;

    if (!patient_id || isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Geçerli bir hasta ve ödeme tutarı belirtiniz.' });
    }

    await client.query('BEGIN');

    // Reduce balance
    await client.query(`
      UPDATE patient_accounts 
      SET current_balance = MAX(0, current_balance - $1)
      WHERE id = $2 AND tenant_id = $3
    `, [payAmount, patient_id, tenantId]);

    await client.query('COMMIT');
    res.json({ message: 'Ödeme başarıyla tahsil edildi.', paid_amount: payAmount });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pay patient debt error:', error);
    res.status(500).json({ error: 'Ödeme işlenemedi.' });
  } finally {
    client.release();
  }
};

module.exports = {
  createPosSale,
  getPosSales,
  getPatientAccounts,
  createPatientAccount,
  payPatientDebt
};
