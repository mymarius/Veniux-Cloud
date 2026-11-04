const pool = require('../config/database');

const generateReturnNo = async (client) => {
  const year = new Date().getFullYear();
  const query = `
    SELECT return_no FROM medicine_returns 
    WHERE return_no LIKE $1 
    ORDER BY return_no DESC LIMIT 1
  `;
  const { rows } = await client.query(query, [`IAD-${year}-%`]);
  
  let nextNum = 1;
  if (rows.length > 0) {
    const lastNum = parseInt(rows[0].return_no.split('-')[2], 10);
    nextNum = lastNum + 1;
  }
  
  return `IAD-${year}-${nextNum.toString().padStart(6, '0')}`;
};

const returnManagementService = {
  createReturn: async (data) => {
    const { depot_id, return_reason, items, notes } = data;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const return_no = await generateReturnNo(client);
      
      let total_items = 0;
      let total_value = 0;
      
      for (const item of items) {
        total_items += item.quantity;
        total_value += item.quantity * (item.unit_value || 0);
      }
      
      const insertReturnQuery = `
        INSERT INTO medicine_returns 
          (tenant_id,return_no, depot_id, return_reason, status, total_items, total_value, notes)
        VALUES ($8,$1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const returnResult = await client.query(insertReturnQuery, [
        return_no, depot_id, return_reason, 'pending', total_items, total_value, notes,data.tenant_id
      ]);
      const newReturn = returnResult.rows[0];
      
      const insertItemQuery = `
        INSERT INTO medicine_return_items
          (tenant_id,return_id, product_id, batch_id, gtin, serial_number, quantity, unit_value, reason_detail)
        VALUES ($9,$1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      for (const item of items) {
        await client.query(insertItemQuery, [
          newReturn.id, item.product_id, item.batch_id, item.gtin, item.serial_number, 
          item.quantity, item.unit_value || 0, item.reason_detail,data.tenant_id
        ]);
      }
      
      await client.query('COMMIT');
      return newReturn;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getReturns: async (filters = {}) => {
    const { status, depot_id, startDate, endDate } = filters;
    let query = `
      SELECT mr.*, pd.name as depot_name 
      FROM medicine_returns mr
      LEFT JOIN pharmacy_depots pd ON mr.depot_id = pd.id
      WHERE mr.tenant_id=$1
    `;
    const params = [filters.tenant_id];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND mr.status = $${paramIndex++}`;
      params.push(status);
    }
    if (depot_id) {
      query += ` AND mr.depot_id = $${paramIndex++}`;
      params.push(depot_id);
    }
    if (startDate) {
      query += ` AND mr.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND mr.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }
    
    query += ` ORDER BY mr.created_at DESC`;
    
    const { rows } = await pool.query(query, params);
    return rows;
  },

  getReturnById: async (id,tenantId) => {
    const query = `
      SELECT mr.*, pd.name as depot_name 
      FROM medicine_returns mr
      LEFT JOIN pharmacy_depots pd ON mr.depot_id = pd.id
      WHERE mr.id = $1 AND mr.tenant_id=$2
    `;
    const { rows } = await pool.query(query, [id,tenantId]);
    const returnRecord = rows[0];
    
    if (returnRecord) {
      const itemsQuery = `
        SELECT mri.*, p.name as product_name
        FROM medicine_return_items mri
        LEFT JOIN products p ON mri.product_id = p.id
        WHERE mri.return_id = $1
      `;
      const itemsResult = await pool.query(itemsQuery, [id]);
      returnRecord.items = itemsResult.rows;
    }
    
    return returnRecord;
  },

  updateReturnStatus: async (id, status, creditData = {},tenantId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const returnQuery = `SELECT * FROM medicine_returns WHERE id = $1 AND tenant_id=$2`;
      const returnResult = await client.query(returnQuery, [id,tenantId]);
      const currentReturn = returnResult.rows[0];
      
      if (!currentReturn) throw new Error('İade kaydı bulunamadı.');
      
      let updateQuery = `UPDATE medicine_returns SET status = $1`;
      const params = [status];
      let paramIndex = 2;
      
      if (status === 'credit_received') {
        const { credit_note_no, credit_amount } = creditData;
        updateQuery += `, credit_note_no = $${paramIndex++}, credit_amount = $${paramIndex++}`;
        params.push(credit_note_no, credit_amount);
      } else if (status === 'shipped') {
        updateQuery += `, completed_at = CURRENT_TIMESTAMP`;
        
        const itemsQuery = `SELECT * FROM medicine_return_items WHERE return_id = $1`;
        const itemsResult = await client.query(itemsQuery, [id]);
        
        for (const item of itemsResult.rows) {
          const updateStockQuery = `
            UPDATE inventory_stock
            SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $2 AND batch_id = $3
          `;
          await client.query(updateStockQuery, [item.quantity, item.product_id, item.batch_id]);
        }
      }
      
      updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
      params.push(id);
      
      const { rows } = await client.query(updateQuery, params);
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getReturnSummary: async (tenantId) => {
    const aggregateQuery = `
      SELECT 
        (SELECT COUNT(*) FROM medicine_returns WHERE tenant_id=$1 AND status = 'pending') as total_pending_returns,
        (SELECT COALESCE(SUM(total_value), 0) FROM medicine_returns WHERE tenant_id=$1 AND status = 'pending') as total_value_at_risk
    `;
    const aggResult = await pool.query(aggregateQuery,[tenantId]);
    
    const reasonQuery = `
      SELECT return_reason, COUNT(*) as count
      FROM medicine_returns
      WHERE tenant_id=$1
      GROUP BY return_reason
    `;
    const reasonResult = await pool.query(reasonQuery,[tenantId]);
    
    return {
      total_pending_returns: parseInt(aggResult.rows[0].total_pending_returns, 10),
      total_value_at_risk: parseFloat(aggResult.rows[0].total_value_at_risk),
      returns_by_reason: reasonResult.rows
    };
  }
};

module.exports = returnManagementService;
