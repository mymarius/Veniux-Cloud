const pool = require('../config/database');
const ledger = require('../services/inventoryTransactionService');

// Sayım farkı kesinleştiği anda yöneticiye görünür; eksik para kaybı olduğu için uyarı düzeyindedir.
async function notifyVariance(client, tenantId, count, productId, applied) {
  const product = (await client.query('SELECT name,purchase_price FROM products WHERE id=$1 AND tenant_id=$2', [productId, tenantId])).rows[0];
  const units = Math.abs(applied), value = units * Number(product?.purchase_price || 0);
  const message = `Sayım #${count.count_no}: ${product?.name || 'Ürün'} ${units} adet ${applied < 0 ? 'eksik' : 'fazla'} çıktı${value ? ` (yaklaşık ${value.toLocaleString('tr-TR')} TL)` : ''}.`;
  await client.query("INSERT INTO alerts (tenant_id,product_id,warehouse_id,alert_type,severity,message,status) VALUES ($1,$2,$3,'count_variance',$4,$5,'unread')", [tenantId, productId, count.warehouse_id, applied < 0 ? 'warning' : 'info', message]);
}

// 1. Get all stock counts
const getAllStockCounts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sc.*,
        w.name as warehouse_name,
        COUNT(sci.id) as total_items,
        SUM(CASE WHEN sci.difference != 0 THEN 1 ELSE 0 END) as discrepancy_count
      FROM stock_counts sc
      JOIN warehouses w ON sc.warehouse_id = w.id
      LEFT JOIN stock_count_items sci ON sc.id = sci.count_id
      WHERE sc.tenant_id = $1
      GROUP BY sc.id
      ORDER BY sc.created_at DESC
    `, [req.user.tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get stock counts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2. Get stock count detail
const getStockCountById = async (req, res) => {
  try {
    const { id } = req.params;

    const countRes = await pool.query(`
      SELECT sc.*, w.name as warehouse_name
      FROM stock_counts sc
      JOIN warehouses w ON sc.warehouse_id = w.id
      WHERE sc.id = $1 AND sc.tenant_id = $2
    `, [id, req.user.tenantId]);

    if (countRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sayım kaydı bulunamadı.' });
    }

    const itemsRes = await pool.query(`
      SELECT 
        sci.*,
        p.sku,
        p.name as product_name,
        p.unit,
        p.purchase_price
      FROM stock_count_items sci
      JOIN products p ON sci.product_id = p.id
      WHERE sci.count_id = $1 AND sci.tenant_id = $2
      ORDER BY p.name ASC
    `, [id, req.user.tenantId]);

    res.json({
      ...countRes.rows[0],
      items: itemsRes.rows
    });
  } catch (error) {
    console.error('Get stock count detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. Start a new Stock Count (Otomatik mevcut sistem stoğunu kopyalar)
const createStockCount = async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, notes } = req.body;
    const userEmail = req.user?.email || 'admin@example.com';
    const tenantId = req.user.tenantId;

    if (!warehouse_id) {
      return res.status(400).json({ error: 'Sayım yapılacak depo seçilmelidir.' });
    }

    await client.query('BEGIN');

    const countNo = `SYM-${Date.now().toString().slice(-6)}`;
    const countRes = await client.query(`
      INSERT INTO stock_counts (tenant_id, count_no, warehouse_id, status, notes, counted_by)
      VALUES ($1, $2, $3, 'in_progress', $4, $5) RETURNING *
    `, [tenantId, countNo, warehouse_id, notes || 'Dönemsel Fiziksel Stok Sayımı', userEmail]);

    const countId = countRes.rows[0].id;

    // Fetch all products with their current stock in this warehouse
    const productsRes = await client.query(`
      SELECT 
        p.id as product_id,
        COALESCE(sr.quantity, 0) as current_quantity
      FROM products p
      LEFT JOIN stock_records sr ON p.id = sr.product_id AND sr.warehouse_id = $1 AND sr.tenant_id = $2
      WHERE p.tenant_id = $2
    `, [warehouse_id, tenantId]);

    for (const prod of productsRes.rows) {
      await client.query(`
        INSERT INTO stock_count_items (tenant_id, count_id, product_id, system_quantity, counted_quantity, difference)
        VALUES ($1, $2, $3, $4, $4, 0)
      `, [tenantId, countId, prod.product_id, prod.current_quantity]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Fiziksel sayım oturumu başlatıldı.',
      stock_count: countRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create stock count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// 4. Update Count Item (Fiziksel sayılan miktarı girme)
const updateStockCountItem = async (req, res) => {
  try {
    const { count_id, item_id } = req.params;
    const { counted_quantity, notes } = req.body;
    const tenantId = req.user.tenantId;

    const countCheck = await pool.query('SELECT status FROM stock_counts WHERE id = $1 AND tenant_id = $2', [count_id, tenantId]);
    if (countCheck.rows.length === 0 || countCheck.rows[0].status === 'completed') {
      return res.status(400).json({ error: 'Tamamlanmış sayım düzenlenemez.' });
    }

    const itemRes = await pool.query('SELECT system_quantity FROM stock_count_items WHERE id = $1 AND tenant_id = $2 AND count_id=$3', [item_id, tenantId,count_id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Kalem bulunamadı.' });

    const systemQty = itemRes.rows[0].system_quantity;
    const countedQty = parseInt(counted_quantity, 10) || 0;
    const diff = countedQty - systemQty;

    await pool.query(`
      UPDATE stock_count_items 
      SET counted_quantity = $1, difference = $2, notes = $3 
      WHERE id = $4 AND tenant_id = $5
    `, [countedQty, diff, notes || null, item_id, tenantId]);

    res.json({ message: 'Sayım miktarı kaydedildi.', difference: diff });
  } catch (error) {
    console.error('Update stock count item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 5. Finalize Stock Count (Sayımı Onayla & Sayım Fark Fişi ile Stokları Eşitle)
const finalizeStockCount = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const countRes = await client.query('SELECT * FROM stock_counts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (countRes.rows.length === 0) return res.status(404).json({ error: 'Sayım oturumu bulunamadı.' });

    const count = countRes.rows[0];
    if (count.status === 'completed') {
      return res.status(400).json({ error: 'Bu sayım zaten tamamlanmış.' });
    }

    await client.query('BEGIN');

    const itemsRes = await client.query('SELECT * FROM stock_count_items WHERE count_id = $1 AND tenant_id = $2', [id, tenantId]);
    const items = itemsRes.rows;

    for (const item of items) {
      if (item.difference !== 0) {
        // Update stock record to counted_quantity
        const stockRes = await client.query(
          'SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3',
          [item.product_id, count.warehouse_id, tenantId]
        );
        // Sayım başladıktan sonra stok değişmiş olabilir; kayıtlar gerçekte uygulanan farkı taşır.
        const applied = Number(item.counted_quantity) - Number(stockRes.rows[0]?.quantity || 0);

        if (stockRes.rows.length > 0) {
          await client.query(
            'UPDATE stock_records SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
            [item.counted_quantity, stockRes.rows[0].id, tenantId]
          );
        } else {
          await client.query(
            'INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($1, $2, $3, $4)',
            [tenantId, item.product_id, count.warehouse_id, item.counted_quantity]
          );
        }

        // Create adjustment movement ledger entry
        await client.query(`
          INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note)
          VALUES ($1, $2, $3, $4, 'adjustment', 'stocktake', $5)
        `, [
          tenantId,
          item.product_id,
          count.warehouse_id,
          applied,
          `Sayım Fark Fişi #${count.count_no} (${item.system_quantity} -> ${item.counted_quantity})`
        ]);
        if (applied !== 0) await notifyVariance(client, tenantId, count, item.product_id, applied);
        if (applied !== 0) await ledger.recordProjectedEntry(client, { tenant_id: tenantId, warehouse_id: count.warehouse_id, product_id: item.product_id, transaction_type: 'COUNT_ADJUSTMENT', quantity: applied, reference_type: 'stock_count', reference_id: count.id, user_id: req.user.userId, notes: `Sayım Fark Fişi #${count.count_no}` });
      }
    }

    await client.query(`
      UPDATE stock_counts 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    await client.query('COMMIT');

    res.json({ message: `Sayım #${count.count_no} başarıyla kesinleştirildi ve stok fark fişleri kesildi.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Finalize stock count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllStockCounts,
  getStockCountById,
  createStockCount,
  updateStockCountItem,
  finalizeStockCount
};
