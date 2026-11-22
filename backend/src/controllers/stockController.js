const pool = require('../config/database');
const { ciLike } = require('../services/sqlSearch');
const ledger = require('../services/inventoryTransactionService');
const recordOperation = async (client, req, action, details) => {
  await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)', [req.user.tenantId,req.user.email,action,'stock',JSON.stringify({requestId:req.requestId,...details,user_id:req.user.userId})]);
};
const integer = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isSafeInteger(Number(value));

// Create stock movement (Inbound, Outbound, Adjustment, Waste, Return)
const createMovement = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { product_id, warehouse_id, change_amount, movement_type, source, note } = req.body;

    // Validation
    if (!product_id || !warehouse_id || change_amount === undefined || !movement_type) {
      return res.status(400).json({ 
        error: 'product_id, warehouse_id, change_amount, and movement_type are required' 
      });
    }

    const amount = Number(change_amount);
    if (!integer(change_amount) || amount === 0) {
      return res.status(400).json({ error: 'change_amount must be a non-zero integer' });
    }

    // Check if product exists
    const productCheck = await client.query(
      'SELECT id, name, sku, unit, min_stock_level FROM products WHERE id = $1 AND tenant_id = $2',
      [product_id, req.user.tenantId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if warehouse exists
    const warehouseCheck = await client.query(
      'SELECT id, name FROM warehouses WHERE id = $1 AND tenant_id = $2',
      [warehouse_id, req.user.tenantId]
    );

    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    await client.query('BEGIN');

    // Get current stock record
    if(amount<0&&((await require('../services/stockHealthService').lotAvailability(req.user.tenantId,product_id,warehouse_id,client)).length||(await client.query('SELECT id FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 LIMIT 1',[req.user.tenantId,product_id,warehouse_id])).rows.length)){await client.query('ROLLBACK');return res.status(409).json({error:'Lotlu stok çıkışını kasa veya lot seçilen WMS işlemi üzerinden yapın.'});}
    const stockRecordCheck = await client.query(
      'SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3',
      [product_id, warehouse_id, req.user.tenantId]
    );

    // MySQL ondalık sütunları metin döndürür ("49.000000"); toplama metin birleştirmesine dönüşüp stok çıkışını yanlışlıkla reddetmesin.
    const currentQty = stockRecordCheck.rows.length > 0 ? Number(stockRecordCheck.rows[0].quantity) : 0;
    const newQuantity = currentQty + amount;

    // Prevent negative stock on outbound unless specifically allowed
    if (newQuantity < 0 || !Number.isSafeInteger(newQuantity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Yetersiz stok! Mevcut stok: ${currentQty}, çıkış yapılmak istenen: ${Math.abs(amount)}` 
      });
    }

    // Insert stock movement record
    const movementResult = await client.query(
      `INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.tenantId, product_id, warehouse_id, amount, movement_type, source || 'manual', note || null]
    );

    // Update or create stock record
    if (stockRecordCheck.rows.length > 0) {
      await client.query(
        'UPDATE stock_records SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        [amount, stockRecordCheck.rows[0].id, req.user.tenantId]
      );
    } else {
      await client.query(
        'INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($1, $2, $3, $4)',
        [req.user.tenantId, product_id, warehouse_id, Math.max(0, amount)]
      );
    }

    await ledger.recordProjectedEntry(client,{tenant_id:req.user.tenantId,warehouse_id,product_id,transaction_type:amount>0?'RECEIVE':'SHIP',quantity:amount,reference_type:'stock_movement',reference_id:movementResult.rows[0].id,user_id:req.user.userId,reason_code:movement_type,notes:note||null});
    await require('../services/stockAlertSync').syncStockAlert(client,{tenant_id:req.user.tenantId,product_id,warehouse_id,quantity:newQuantity,min_stock_level:productCheck.rows[0].min_stock_level,product_name:productCheck.rows[0].name,unit:productCheck.rows[0].unit,warehouse_name:warehouseCheck.rows[0].name});

    await recordOperation(client, req, 'stock.movement', {product_id,warehouse_id,amount,movement_type});
    await client.query('COMMIT');

    res.status(201).json({
      message: 'Stock movement created successfully',
      movement: movementResult.rows[0],
      current_quantity: newQuantity
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create movement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Transfer stock between warehouses (Atomic operation)
const transferStock = async (req, res) => {
  const client = await pool.connect();

  try {
    const { product_id, from_warehouse_id, to_warehouse_id, quantity, note } = req.body;

    if (!product_id || !from_warehouse_id || !to_warehouse_id || !quantity) {
      return res.status(400).json({ 
        error: 'product_id, from_warehouse_id, to_warehouse_id and quantity are required' 
      });
    }

    const transferQty = Number(quantity);
    if (!integer(quantity) || transferQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    if (parseInt(from_warehouse_id, 10) === parseInt(to_warehouse_id, 10)) {
      return res.status(400).json({ error: 'Kaynak ve hedef depo aynı olamaz' });
    }

    // Check product and warehouses
    const productCheck = await client.query('SELECT id, name, sku FROM products WHERE id = $1 AND tenant_id = $2', [product_id, req.user.tenantId]);
    if (productCheck.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const fromWhCheck = await client.query('SELECT id, name FROM warehouses WHERE id = $1 AND tenant_id = $2', [from_warehouse_id, req.user.tenantId]);
    if (fromWhCheck.rows.length === 0) return res.status(404).json({ error: 'Source warehouse not found' });

    const toWhCheck = await client.query('SELECT id, name FROM warehouses WHERE id = $1 AND tenant_id = $2', [to_warehouse_id, req.user.tenantId]);
    if (toWhCheck.rows.length === 0) return res.status(404).json({ error: 'Target warehouse not found' });

    await client.query('BEGIN');

    // Check source warehouse stock
    if(((await require('../services/stockHealthService').lotAvailability(req.user.tenantId,product_id,from_warehouse_id,client)).length||(await client.query('SELECT id FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 LIMIT 1',[req.user.tenantId,product_id,from_warehouse_id])).rows.length)){await client.query('ROLLBACK');return res.status(409).json({error:'Lotlu stok transferinde lot seçilen WMS işlemini kullanın; lot tarihleri korunmalıdır.'});}
    const sourceStock = await client.query(
      'SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3',
      [product_id, from_warehouse_id, req.user.tenantId]
    );

    const sourceQty = sourceStock.rows.length > 0 ? sourceStock.rows[0].quantity : 0;
    if (sourceQty < transferQty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Yetersiz kaynak stok! ${fromWhCheck.rows[0].name} deposunda yalnızca ${sourceQty} adet mevcut.` 
      });
    }

    // Deduct from source warehouse atomically
    const updateResult = await client.query(
      'UPDATE stock_records SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 AND warehouse_id = $3 AND tenant_id = $4 AND quantity >= $1',
      [transferQty, product_id, from_warehouse_id, req.user.tenantId]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock or race condition detected during transfer.' });
    }

    // Add to target warehouse
    const targetStock = await client.query(
      'SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3',
      [product_id, to_warehouse_id, req.user.tenantId]
    );

    if (targetStock.rows.length > 0) {
      await client.query(
        'UPDATE stock_records SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        [transferQty, targetStock.rows[0].id, req.user.tenantId]
      );
    } else {
      await client.query(
        'INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($1, $2, $3, $4)',
        [req.user.tenantId, product_id, to_warehouse_id, transferQty]
      );
    }

    // Create movement ledger record
    const transferNote = note || `${fromWhCheck.rows[0].name} -> ${toWhCheck.rows[0].name} Transfer`;
    const movementResult = await client.query(
      `INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, target_warehouse_id, change_amount, movement_type, source, note)
       VALUES ($1, $2, $3, $4, $5, 'transfer', 'depot_transfer', $6) RETURNING *`,
      [req.user.tenantId, product_id, from_warehouse_id, to_warehouse_id, -transferQty, transferNote]
    );

    await ledger.recordProjectedEntry(client,{tenant_id:req.user.tenantId,warehouse_id:from_warehouse_id,product_id,transaction_type:'TRANSFER_OUT',quantity:-transferQty,reference_type:'stock_movement',reference_id:movementResult.rows[0].id,user_id:req.user.userId,notes:transferNote});
    await ledger.recordProjectedEntry(client,{tenant_id:req.user.tenantId,warehouse_id:to_warehouse_id,product_id,transaction_type:'TRANSFER_IN',quantity:transferQty,reference_type:'stock_movement',reference_id:movementResult.rows[0].id,user_id:req.user.userId,notes:transferNote});
    await recordOperation(client, req, 'stock.transfer', {product_id,from_warehouse_id,to_warehouse_id,quantity:transferQty});
    await client.query('COMMIT');

    res.status(200).json({
      message: 'Transfer completed successfully',
      transfer: movementResult.rows[0],
      source_warehouse: fromWhCheck.rows[0].name,
      target_warehouse: toWhCheck.rows[0].name,
      transferred_quantity: transferQty
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transfer stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Quick Stock Adjustment (Sayım Düzeltmesi)
const adjustStock = async (req, res) => {
  const client = await pool.connect();

  try {
    const { product_id, warehouse_id, new_quantity, reason } = req.body;

    if (!product_id || !warehouse_id || new_quantity === undefined) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and new_quantity are required' });
    }

    const targetQty = Number(new_quantity);
    if (!integer(new_quantity) || targetQty < 0) {
      return res.status(400).json({ error: 'new_quantity must be a non-negative integer' });
    }

    const productCheck = await client.query('SELECT id FROM products WHERE id = $1 AND tenant_id = $2', [product_id, req.user.tenantId]);
    const warehouseCheck = await client.query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2', [warehouse_id, req.user.tenantId]);
    if (!productCheck.rows.length || !warehouseCheck.rows.length) {
      return res.status(404).json({ error: 'Product or warehouse not found' });
    }

    await client.query('BEGIN');

    const stockRecord = await client.query(
      'SELECT id, quantity FROM stock_records WHERE product_id = $1 AND warehouse_id = $2 AND tenant_id = $3',
      [product_id, warehouse_id, req.user.tenantId]
    );

    const oldQty = stockRecord.rows.length > 0 ? stockRecord.rows[0].quantity : 0;
    const diff = targetQty - oldQty;
    if(diff!==0&&((await require('../services/stockHealthService').lotAvailability(req.user.tenantId,product_id,warehouse_id,client)).length||(await client.query('SELECT id FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 LIMIT 1',[req.user.tenantId,product_id,warehouse_id])).rows.length)){await client.query('ROLLBACK');return res.status(409).json({error:'Lotlu stok sayımını lot seçilen WMS sayımı üzerinden yapın.'});}

    if (diff === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No change in stock level', current_quantity: oldQty });
    }

    // Record movement
    await client.query(
      `INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note)
       VALUES ($1, $2, $3, $4, 'adjustment', 'stock_count', $5)`,
      [req.user.tenantId, product_id, warehouse_id, diff, reason || `Fiziksel Sayım Düzeltmesi (${oldQty} -> ${targetQty})`]
    );

    // Update stock record
    if (stockRecord.rows.length > 0) {
      await client.query(
        'UPDATE stock_records SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        [targetQty, stockRecord.rows[0].id, req.user.tenantId]
      );
    } else {
      await client.query(
        'INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($1, $2, $3, $4)',
        [req.user.tenantId, product_id, warehouse_id, targetQty]
      );
    }

    await ledger.recordProjectedEntry(client,{tenant_id:req.user.tenantId,warehouse_id,product_id,transaction_type:'COUNT_ADJUSTMENT',quantity:diff,reference_type:'stock_adjust',user_id:req.user.userId,notes:reason||null});
    await recordOperation(client, req, 'stock.adjustment', {product_id,warehouse_id,previous:oldQty,quantity:targetQty,reason:reason || `Fiziksel Sayım Düzeltmesi (${oldQty} -> ${targetQty})`});
    await client.query('COMMIT');

    res.json({
      message: 'Stock adjusted successfully',
      old_quantity: oldQty,
      new_quantity: targetQty,
      difference: diff
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Import stock from Excel / CSV
const importStock = async (req, res) => {
  // Legacy absolute-quantity import bypassed lot and receipt invariants.
  return res.status(410).json({ error: 'Doğrudan stok miktarı aktarımı kapalıdır. Ürün içe aktarma için Ürünler, stok girişi için Mal Kabul ekranını kullanın.', code: 'LEGACY_STOCK_IMPORT_DISABLED' });
};

// Get stock records (Multi-warehouse matrix)
const getStockRecords = async (req, res) => {
  try {
    const { warehouse_id, category, search, product_id } = req.query;

    let query = `
      SELECT 
        sr.*, 
        p.sku, 
        p.name as product_name, 
        p.category, 
        p.unit, 
        p.barcode,
        p.purchase_price, 
        p.sale_price, 
        p.min_stock_level,
        p.max_stock_level,
        w.name as warehouse_name, 
        w.type as warehouse_type,
        (sr.quantity * p.purchase_price) as stock_valuation
      FROM stock_records sr 
      JOIN products p ON sr.product_id = p.id 
      JOIN warehouses w ON sr.warehouse_id = w.id 
      WHERE sr.tenant_id = $1 AND 1=1
    `;
    const params = [req.user.tenantId];
    let paramIndex = 2;

    if (warehouse_id) {
      query += ` AND sr.warehouse_id = $${paramIndex}`;
      params.push(warehouse_id);
      paramIndex++;
    }

    if (product_id) {
      query += ` AND sr.product_id = $${paramIndex}`;
      params.push(product_id);
      paramIndex++;
    }

    if (category) {
      query += ` AND LOWER(TRIM(p.category)) = LOWER(TRIM($${paramIndex}))`;
      params.push(category.trim());
      paramIndex++;
    }

    if (search) {
      query += ` AND (${ciLike('p.name', `'%' || $${paramIndex} || '%'`)} OR ${ciLike('p.sku', `'%' || $${paramIndex} || '%'`)} OR ${ciLike('p.barcode', `'%' || $${paramIndex} || '%'`)})`;
      params.push(search);
      paramIndex++;
    }

    query += ` ORDER BY sr.updated_at DESC, sr.id DESC`;
    // İsteğe bağlı sayfalama (?limit=1..2000&offset=n); limit yoksa tüm liste (eski davranış).
    if (req.query.limit !== undefined) {
      const limit = Number.parseInt(req.query.limit, 10), offset = Number.parseInt(req.query.offset ?? 0, 10) || 0;
      if (!Number.isInteger(limit) || limit < 1 || limit > 2000 || offset < 0) return res.status(400).json({ error: 'Geçersiz sayfa sınırı.' });
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get stock records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get stock movements
const getStockMovements = async (req, res) => {
  try {
    const { product_id, warehouse_id, movement_type, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        sm.*, 
        p.sku, 
        p.name as product_name, 
        p.unit,
        p.purchase_price as unit_cost,
        w.name as warehouse_name,
        tw.name as target_warehouse_name
      FROM stock_movements sm 
      JOIN products p ON sm.product_id = p.id 
      JOIN warehouses w ON sm.warehouse_id = w.id 
      LEFT JOIN warehouses tw ON sm.target_warehouse_id = tw.id
      WHERE sm.tenant_id = $1 AND 1=1
    `;
    const params = [req.user.tenantId];
    let paramIndex = 2;

    if (product_id) {
      query += ` AND sm.product_id = $${paramIndex}`;
      params.push(product_id);
      paramIndex++;
    }

    if (warehouse_id) {
      query += ` AND (sm.warehouse_id = $${paramIndex} OR sm.target_warehouse_id = $${paramIndex})`;
      params.push(warehouse_id);
      paramIndex++;
    }

    if (movement_type) {
      query += ` AND sm.movement_type = $${paramIndex}`;
      params.push(movement_type);
      paramIndex++;
    }

    query += ` ORDER BY sm.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit, 10) || 100);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Ürün başına stok toplamı (tek geçişte gruplanmış). İlişkili alt sorgu yerine türetilmiş tablo kullanılır:
// 50 bin üründe ürün başına bir stock_records araması yerine stock_records bir kez taranır.
const PER_PRODUCT_QTY = `
  FROM products p
  LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM stock_records WHERE tenant_id = $1 GROUP BY product_id) s ON s.product_id = p.id
  WHERE p.tenant_id = $1`;

// Depo dağılımı: yalnız çağıranın depoları ve kayıtları (önceden tüm kiracıların depoları toplanıyordu).
const warehouseDistributionRows = async tenantId => (await pool.query(`
  SELECT w.id, w.name, w.capacity,
    COALESCE(x.stored_quantity, 0) AS stored_quantity,
    COALESCE(x.total_value, 0) AS total_value
  FROM warehouses w
  LEFT JOIN (
    SELECT sr.warehouse_id, SUM(sr.quantity) AS stored_quantity, SUM(sr.quantity * p.purchase_price) AS total_value
    FROM stock_records sr JOIN products p ON p.id = sr.product_id
    WHERE sr.tenant_id = $1 GROUP BY sr.warehouse_id
  ) x ON x.warehouse_id = w.id
  WHERE w.tenant_id = $1`, [tenantId])).rows;

// Get comprehensive analytics dashboard data
const getStockAnalytics = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    // 1-3. Kategori kırılımı ve toplamlar tek geçişte (ürün başına bir kez gruplanan stok toplamı); özet kalemleri kategorilerden toplanır
    const warehouseCount = await pool.query('SELECT COUNT(DISTINCT warehouse_id) AS count FROM stock_records WHERE tenant_id = $1', [tenantId]);
    const categoryBreakdown = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM(p.category), ''), 'Genel') AS category,
        COUNT(*) AS product_count,
        COALESCE(SUM(COALESCE(s.qty, 0)), 0) AS total_quantity,
        COALESCE(SUM(COALESCE(s.qty, 0) * p.purchase_price), 0) AS total_value,
        COALESCE(SUM(COALESCE(s.qty, 0) * p.sale_price), 0) AS potential_revenue,
        COALESCE(SUM(CASE WHEN s.product_id IS NOT NULL AND p.min_stock_level > 0 AND s.qty <= p.min_stock_level THEN 1 ELSE 0 END), 0) AS critical_count,
        COALESCE(SUM(CASE WHEN COALESCE(s.qty, 0) = 0 THEN 1 ELSE 0 END), 0) AS out_count
      ${PER_PRODUCT_QTY}
      GROUP BY COALESCE(NULLIF(TRIM(p.category), ''), 'Genel')
      ORDER BY total_value DESC
    `, [tenantId]);
    const sumOf = key => categoryBreakdown.rows.reduce((t, r) => t + Number(r[key] || 0), 0);
    const summary = {
      total_valuation: sumOf('total_value'), total_potential_revenue: sumOf('potential_revenue'), total_units_stored: sumOf('total_quantity'),
      total_products: sumOf('product_count'), total_warehouses: Number(warehouseCount.rows[0]?.count || 0),
      critical_stock_count: sumOf('critical_count'), out_of_stock_count: sumOf('out_count')
    };

    // 4. Warehouse Distribution
    const warehouseDistribution = await warehouseDistributionRows(tenantId);

    // 5. Son 14 günün günlük giriş/çıkışı (kiracı + tarih aralığı; indeks stock_movements(tenant_id, created_at))
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 19).replace('T', ' ');
    const recentMovementsTrend = await pool.query(`
      SELECT * FROM (
        SELECT
          date(sm.created_at) AS date,
          SUM(CASE WHEN sm.change_amount > 0 THEN sm.change_amount ELSE 0 END) AS inbound,
          SUM(CASE WHEN sm.change_amount < 0 THEN ABS(sm.change_amount) ELSE 0 END) AS outbound
        FROM stock_movements sm
        WHERE sm.tenant_id = $1 AND sm.created_at >= $2
        GROUP BY date(sm.created_at)
        ORDER BY date DESC
        LIMIT 14
      ) recent ORDER BY date ASC
    `, [tenantId, since]);

    // 6. Top 5 Highest Value Products
    const topValueProducts = await pool.query(`
      SELECT p.sku, p.name, p.category,
        COALESCE(SUM(sr.quantity), 0) AS total_quantity,
        COALESCE(SUM(sr.quantity * p.purchase_price), 0) AS total_valuation
      FROM stock_records sr JOIN products p ON p.id = sr.product_id
      WHERE sr.tenant_id = $1 AND p.tenant_id = $1
      GROUP BY p.id, p.sku, p.name, p.category
      ORDER BY total_valuation DESC
      LIMIT 5
    `, [tenantId]);

    res.json({
      summary,
      category_breakdown: categoryBreakdown.rows.map(({ product_count, total_quantity, total_value, category }) => ({ category, product_count, total_quantity, total_value })),
      warehouse_distribution: warehouseDistribution,
      movements_trend: recentMovementsTrend.rows,
      top_value_products: topValueProducts.rows
    });
  } catch (error) {
    console.error('Get stock analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Pano özeti: ürün/stok kayıtlarının tamamını indirmeden stok sağlığı, değer ve "en çok" listeleri.
// ?warehouse_id= verilirse yalnız o depoda kaydı olan ürünler ve o depodaki miktar sayılır (NormalDashboard ile aynı kural).
// Ürün başına stok toplamı tek geçişte hesaplanır (kategori sorgusu); liste sorguları yalnız ilk 8 satırı üretir.
const getDashboardSummary = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const warehouseId = req.query.warehouse_id ? Number.parseInt(req.query.warehouse_id, 10) : null;
    if (req.query.warehouse_id && !Number.isInteger(warehouseId)) return res.status(400).json({ error: 'Geçersiz depo.' });
    const params = warehouseId ? [tenantId, warehouseId] : [tenantId];
    const wh = warehouseId ? ' AND warehouse_id = $2' : '';
    const num = v => Number(v || 0);
    const qtyOf = `COALESCE((SELECT SUM(sr.quantity) FROM stock_records sr WHERE sr.product_id = p.id AND sr.tenant_id = $1${warehouseId ? ' AND sr.warehouse_id = $2' : ''}), 0)`;
    const hasRecord = warehouseId ? ' AND EXISTS (SELECT 1 FROM stock_records x WHERE x.product_id = p.id AND x.tenant_id = $1 AND x.warehouse_id = $2)' : '';

    // 1. Kategori başına toplamlar (özet, sağlık sayıları ve kategori listeleri bunlardan türetilir)
    const cats = (await pool.query(`
      SELECT COALESCE(NULLIF(p.category, ''), 'Diğer') AS name,
        COUNT(*) AS product_count,
        COALESCE(SUM(s.n), 0) AS record_count,
        COALESCE(SUM(COALESCE(s.qty, 0)), 0) AS qty,
        COALESCE(SUM(COALESCE(s.qty, 0) * p.purchase_price), 0) AS value,
        COALESCE(SUM(COALESCE(s.qty, 0) * p.sale_price), 0) AS sale_value,
        COALESCE(SUM(CASE WHEN COALESCE(s.qty, 0) <= 0 THEN 1 ELSE 0 END), 0) AS out_count,
        COALESCE(SUM(CASE WHEN COALESCE(s.qty, 0) > 0 AND p.min_stock_level > 0 AND s.qty <= p.min_stock_level THEN 1 ELSE 0 END), 0) AS critical_count,
        COALESCE(SUM(CASE WHEN COALESCE(s.qty, 0) > 0 AND NOT (p.min_stock_level > 0 AND s.qty <= p.min_stock_level) AND p.max_stock_level > 0 AND s.qty > p.max_stock_level THEN 1 ELSE 0 END), 0) AS excess_count
      FROM products p
      ${warehouseId ? 'JOIN' : 'LEFT JOIN'} (SELECT product_id, SUM(quantity) AS qty, COUNT(*) AS n FROM stock_records WHERE tenant_id = $1${wh} GROUP BY product_id) s ON s.product_id = p.id
      WHERE p.tenant_id = $1
      GROUP BY COALESCE(NULLIF(p.category, ''), 'Diğer')`, params)).rows;
    const sum = key => cats.reduce((t, r) => t + num(r[key]), 0);
    const health = { out: sum('out_count'), critical: sum('critical_count'), excess: sum('excess_count') };
    health.healthy = sum('product_count') - health.out - health.critical - health.excess;

    // 2. Dikkat gerektirenler: önce tükenenler, sonra kritikler (ilk 8)
    const pick = (cond, limit) => pool.query(`
      SELECT p.id, p.sku, p.name, p.min_stock_level, ${qtyOf} AS qty
      FROM products p
      WHERE p.tenant_id = $1${hasRecord} AND ${cond}
      ORDER BY p.id LIMIT ${limit}`, params);
    const outRows = (await pick(`${qtyOf} <= 0`, 8)).rows;
    const criticalRows = outRows.length < 8
      ? (await pick(`p.min_stock_level > 0 AND ${qtyOf} > 0 AND ${qtyOf} <= p.min_stock_level`, 8 - outRows.length)).rows : [];

    // 3. En değerli / en yüksek stoklu ürünler (ilk 8)
    const top = async order => (await pool.query(`
      SELECT p.name, p.sku, SUM(sr.quantity) AS qty, SUM(sr.quantity) * p.purchase_price AS value,
        SUM(sr.quantity) * (p.sale_price - p.purchase_price) AS margin
      FROM stock_records sr JOIN products p ON p.id = sr.product_id
      WHERE sr.tenant_id = $1 AND p.tenant_id = $1${warehouseId ? ' AND sr.warehouse_id = $2' : ''}
      GROUP BY p.id, p.name, p.sku, p.purchase_price, p.sale_price
      HAVING SUM(sr.quantity) > 0
      ORDER BY ${order}, p.id LIMIT 8`, params)).rows;
    const topByValue = await top('SUM(sr.quantity) * p.purchase_price DESC');
    const topByQty = await top('SUM(sr.quantity) DESC');

    // 4. Depo kırılımı seçili depodan bağımsız: tüm depolar ("depoya göre değer" paneli)
    const byWarehouse = (await pool.query(`
      SELECT w.name, SUM(sr.quantity * p.purchase_price) AS value, SUM(sr.quantity) AS qty
      FROM stock_records sr JOIN products p ON p.id = sr.product_id JOIN warehouses w ON w.id = sr.warehouse_id
      WHERE sr.tenant_id = $1 GROUP BY w.id, w.name ORDER BY value DESC`, [tenantId])).rows;

    const row = r => ({ ...r, qty: num(r.qty), value: num(r.value), margin: num(r.margin) });
    const by = key => [...cats].sort((a, b) => num(b[key]) - num(a[key])).slice(0, 8).map(r => [r.name, num(r[key])]);
    res.json({
      product_count: sum('product_count'), record_count: sum('record_count'), units: sum('qty'),
      value: sum('value'), sale_value: sum('sale_value'), health,
      attention: [...outRows, ...criticalRows].map(r => ({ ...r, qty: num(r.qty), min_stock_level: num(r.min_stock_level) })),
      top_by_value: topByValue.map(row), top_by_qty: topByQty.map(row),
      categories: by('value'), categories_qty: by('qty'),
      by_warehouse: byWarehouse.map(r => ({ name: r.name || 'Depo', value: num(r.value), qty: num(r.qty) }))
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Dashboard Metrics for Executive View
const getDashboardMetrics = async (req, res) => {
  try {
    // 1. Total SKU & Stats
    const totalStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_sku,
        COALESCE(SUM(sr.quantity), 0) as total_stock_count,
        COALESCE(SUM(sr.quantity * p.purchase_price), 0) as total_valuation
      FROM products p
      LEFT JOIN stock_records sr ON p.id = sr.product_id AND sr.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1
    `, [req.user.tenantId]);

    // 2. Low Stock Count
    const lowStock = await pool.query(`
      SELECT COUNT(*) as count FROM (
        SELECT p.id, COALESCE(SUM(sr.quantity), 0) as current_stock, p.min_stock_level
        FROM products p
        LEFT JOIN stock_records sr ON p.id = sr.product_id AND sr.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1 AND p.min_stock_level > 0
        GROUP BY p.id, p.min_stock_level
        HAVING COALESCE(SUM(sr.quantity), 0) <= p.min_stock_level
      )
    `, [req.user.tenantId]);

    // 3. Out of stock count
    const outOfStock = await pool.query(`
      SELECT COUNT(*) as count FROM products p
      WHERE p.tenant_id = $1 AND (SELECT COALESCE(SUM(quantity), 0) FROM stock_records WHERE product_id = p.id) = 0
    `, [req.user.tenantId]);

    // 4. Active unread alerts count
    const activeAlerts = await pool.query(`
      SELECT COUNT(*) as count FROM alerts WHERE tenant_id = $1 AND status = 'unread'
    `, [req.user.tenantId]);

    // 5. Top critical products
    const topCritical = await pool.query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.min_stock_level,
        p.unit,
        COALESCE(SUM(sr.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN stock_records sr ON p.id = sr.product_id AND sr.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1 AND p.min_stock_level > 0
      GROUP BY p.id, p.sku, p.name, p.min_stock_level, p.unit
      HAVING COALESCE(SUM(sr.quantity), 0) <= p.min_stock_level
      ORDER BY current_stock ASC
      LIMIT 5
    `, [req.user.tenantId]);

    // 6. Recent Movements
    const recentMovements = await pool.query(`
      SELECT 
        sm.id,
        sm.product_id,
        sm.warehouse_id,
        sm.change_amount,
        sm.movement_type,
        sm.note,
        sm.created_at,
        p.name as product_name,
        p.sku,
        w.name as warehouse_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      ORDER BY sm.created_at DESC
      LIMIT 8
    `);

    // 7. Warehouse distribution
    const warehouseDist = { rows: (await warehouseDistributionRows(req.user.tenantId)).sort((x, y) => Number(y.stored_quantity) - Number(x.stored_quantity)) };

    res.json({
      total_sku: totalStats.rows[0]?.total_sku || 0,
      total_stock_count: totalStats.rows[0]?.total_stock_count || 0,
      total_valuation: totalStats.rows[0]?.total_valuation || 0,
      low_stock_count: lowStock.rows[0]?.count || 0,
      out_of_stock_count: outOfStock.rows[0]?.count || 0,
      active_alerts_count: activeAlerts.rows[0]?.count || 0,
      top_critical_products: topCritical.rows,
      recent_movements: recentMovements.rows,
      warehouse_distribution: warehouseDist.rows
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createMovement,
  transferStock,
  adjustStock,
  importStock,
  getStockRecords,
  getStockMovements,
  getStockAnalytics,
  getDashboardMetrics,
  getDashboardSummary
};
