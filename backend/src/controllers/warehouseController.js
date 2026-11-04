const pool = require('../config/database');

// Get all warehouses with stats
const getAllWarehouses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        w.*,
        COALESCE((SELECT COUNT(DISTINCT product_id) FROM stock_records WHERE warehouse_id = w.id AND quantity > 0), 0) as unique_product_count,
        COALESCE((SELECT SUM(quantity) FROM stock_records WHERE warehouse_id = w.id), 0) as total_stored_quantity,
        COALESCE((SELECT SUM(sr.quantity * p.purchase_price) FROM stock_records sr JOIN products p ON sr.product_id = p.id WHERE sr.warehouse_id = w.id), 0) as total_warehouse_value
      FROM warehouses w 
      ORDER BY w.created_at DESC
    `);

    const warehousesWithStats = result.rows.map(w => {
      const capacity = w.capacity || 10000;
      const stored = w.total_stored_quantity || 0;
      const occupancyRate = Math.min(100, Math.round((stored / capacity) * 100));

      return {
        ...w,
        occupancy_rate: occupancyRate
      };
    });

    res.json(warehousesWithStats);
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(error.status||500).json({ error: error.status?error.message:'Internal server error' });
  }
};

// Get warehouse by ID with stock inventory
const getWarehouseById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM warehouses WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const warehouse = result.rows[0];

    // Fetch all stock records in this warehouse
    const stocks = await pool.query(`
      SELECT sr.*, p.sku, p.name as product_name, p.category, p.unit, p.min_stock_level, p.purchase_price, p.sale_price
      FROM stock_records sr
      JOIN products p ON sr.product_id = p.id
      WHERE sr.warehouse_id = $1
      ORDER BY sr.quantity DESC
    `, [id]);

    // Fetch recent movements for this warehouse
    const movements = await pool.query(`
      SELECT sm.*, p.sku, p.name as product_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE sm.warehouse_id = $1 OR sm.target_warehouse_id = $1
      ORDER BY sm.created_at DESC
      LIMIT 15
    `, [id]);

    res.json({
      ...warehouse,
      inventory: stocks.rows,
      recent_movements: movements.rows
    });
  } catch (error) {
    console.error('Get warehouse error:', error);
    res.status(error.status||500).json({ error: error.status?error.message:'Internal server error' });
  }
};

// Create new warehouse
const createWarehouse = async (req, res) => {
  try {
    const { name, type, location, capacity, source_config } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const result = await pool.query(
      `INSERT INTO warehouses (name, type, location, capacity, source_config, tenant_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, location || null, capacity || 10000, source_config || null, req.user.tenantId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(error.status||500).json({ error: error.status?error.message:'Internal server error' });
  }
};

// Update warehouse
const updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, location, capacity, source_config } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const existingWarehouse = await pool.query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);

    if (existingWarehouse.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const result = await pool.query(
      `UPDATE warehouses 
       SET name = $1, type = $2, location = $3, capacity = $4, source_config = $5 
       WHERE id = $6 RETURNING *`,
      [name, type, location || null, capacity || 10000, source_config || null, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update warehouse error:', error);
    res.status(error.status||500).json({ error: error.status?error.message:'Internal server error' });
  }
};

// Delete warehouse
const deleteWarehouse = async (req, res) => {
  try {
    const { id } = req.params;

    const check = await pool.query('SELECT id, name FROM warehouses WHERE id = $1 AND tenant_id = $2', [id,req.user.tenantId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Depo bulunamadı' });
    }

    const db = typeof pool.getDb === 'function' ? pool.getDb() : null;
    if (db) {
      try {
        db.pragma('foreign_keys = OFF');
        const delTables = [
          'inventory_transactions',
          'inventory_reservations',
          'handling_units',
          'warehouse_devices',
          'wms_business_rules',
          'cold_chain_devices',
          'alerts',
          'stock_records',
          'stock_movements',
          'stock_counts',
          'medicine_batches',
          'wms_pick_waves',
          'wms_inbound_receipts',
          'wms_dock_appointments',
          'quarantine_stock',
          'warehouse_nodes',
          'warehouse_edges',
          'warehouse_locations'
        ];
        for (const t of delTables) {
          try {
            const scoped=db.prepare(`PRAGMA table_info("${t}")`).all().some(c=>c.name==='tenant_id');
            db.prepare(`DELETE FROM "${t}" WHERE warehouse_id = ?${scoped?' AND tenant_id = ?':''}`).run(...(scoped?[id,req.user.tenantId]:[id]));
          } catch (e) {
            // ignore if table/column does not exist
          }
        }
        // This legacy cleanup disables foreign keys, so explicitly remove and
        // audit user assignments instead of leaving dangling access grants.
        db.transaction(()=>{
          require('../services/accessScopeService').warehouseDeleted(db,req.user,id);
          db.prepare('DELETE FROM warehouses WHERE id = ? AND tenant_id = ?').run(id,req.user.tenantId);
        })();
      } finally {
        db.pragma('foreign_keys = ON');
      }
    } else {
      await pool.query('DELETE FROM warehouses WHERE id = $1 AND tenant_id = $2', [id,req.user.tenantId]);
    }

    res.json({ message: 'Depo ve ilgili tüm veriler başarıyla silindi' });
  } catch (error) {
    console.error('Delete warehouse error:', error);
    res.status(500).json({ error: error.message || 'Depo silinemedi' });
  }
};

module.exports = {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
};
