const pool = require('../config/database');

// Get all products with stock aggregations
const getAllProducts = async (req, res) => {
  try {
    const { category, supplier_id, search, status } = req.query;

    let query = `
      SELECT 
        p.*, 
        s.name as supplier_name,
        COALESCE((SELECT SUM(quantity) FROM stock_records WHERE product_id = p.id), 0) as total_quantity,
        COALESCE((SELECT COUNT(DISTINCT warehouse_id) FROM stock_records WHERE product_id = p.id AND quantity > 0), 0) as warehouse_count
      FROM products p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id 
      WHERE p.tenant_id = $1 AND 1=1
    `;
    const params = [req.user.tenantId];
    let paramIndex = 2;

    if (category) {
      query += ` AND LOWER(TRIM(p.category)) = LOWER(TRIM($${paramIndex}))`;
      params.push(category.trim());
      paramIndex++;
    }

    if (supplier_id) {
      query += ` AND p.supplier_id = $${paramIndex}`;
      params.push(supplier_id);
      paramIndex++;
    }

    if (search) {
      query += ` AND (p.name LIKE '%' || $${paramIndex} || '%' OR p.sku LIKE '%' || $${paramIndex} || '%' OR p.barcode LIKE '%' || $${paramIndex} || '%')`;
      params.push(search);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);

    // Compute stock status
    const canViewCost = ['admin', 'manager'].includes(req.user.role) || req.user.isPlatformAdmin;
    const productsWithStatus = result.rows.map(p => {
      const totalQty = p.total_quantity || 0;
      let stockStatus = 'in_stock';
      if (totalQty === 0) {
        stockStatus = 'out_of_stock';
      } else if (p.min_stock_level > 0 && totalQty <= p.min_stock_level) {
        stockStatus = 'low_stock';
      }

      const item = {
        ...p,
        total_quantity: totalQty,
        stock_status: stockStatus,
      };

      if (canViewCost) {
        item.inventory_value = totalQty * (p.purchase_price || 0);
      } else {
        item.purchase_price = null;
        item.purchase_price_tax_basis = null;
        item.depocu_fiyati = null;
        delete item.inventory_value;
      }

      return item;
    });

    if (status) {
      return res.json(productsWithStatus.filter(p => p.stock_status === status));
    }

    res.json(productsWithStatus);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get product by ID with warehouse stock breakdown
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT p.*, s.name as supplier_name, s.contact_name, s.email as supplier_email, s.phone as supplier_phone
      FROM products p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id 
      WHERE p.id = $1 AND p.tenant_id = $2
    `, [id, req.user.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = { ...result.rows[0] };
    const canViewCost = ['admin', 'manager'].includes(req.user.role) || req.user.isPlatformAdmin;
    if (!canViewCost) {
      product.purchase_price = null;
      product.purchase_price_tax_basis = null;
      product.depocu_fiyati = null;
    }

    // Fetch warehouse stocks for this product
    const warehouseStock = await pool.query(`
      SELECT sr.warehouse_id, sr.quantity, sr.updated_at, w.name as warehouse_name, w.location, w.type
      FROM stock_records sr
      JOIN warehouses w ON sr.warehouse_id = w.id
      WHERE sr.product_id = $1
    `, [id]);

    // Fetch recent movements
    const recentMovements = await pool.query(`
      SELECT sm.*, w.name as warehouse_name
      FROM stock_movements sm
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.product_id = $1
      ORDER BY sm.created_at DESC
      LIMIT 10
    `, [id]);

    res.json({
      ...product,
      warehouse_stocks: warehouseStock.rows,
      recent_movements: recentMovements.rows
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new product
const createProduct = async (req, res) => {
  try {
    const taxBasis=req.body.purchase_price_tax_basis??null,vat=req.body.kdv_orani??10;
    if((taxBasis!==null&&!['inclusive','exclusive'].includes(taxBasis))||!require('../services/retailCostService').vatValid(vat))return res.status(400).json({error:'Alış fiyatı KDV temeli veya KDV oranı geçersiz.'});
    const {
      sku,
      name,
      category,
      barcode,
      unit = 'adet',
      purchase_price = 0,
      sale_price = 0,
      min_stock_level = 0,
      max_stock_level = 1000,
      supplier_id = null
    } = req.body;

    if(!Number.isFinite(Number(min_stock_level))||Number(min_stock_level)<0||Number(min_stock_level)>1000000000)return res.status(400).json({error:'Minimum stok sıfır veya pozitif bir sayı olmalıdır.'});
    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and name are required' });
    }

    const moduleType = req.body.module_type || (req.body.is_medicine ? 'PHARMACY' : 'NORMAL');
    if (!['NORMAL', 'PHARMACY'].includes(moduleType)) return res.status(400).json({error:'Geçersiz ürün modülü.'});
    if (supplier_id && !(await pool.query('SELECT id FROM suppliers WHERE id=$1 AND tenant_id=$2',[supplier_id,req.user.tenantId])).rows.length) return res.status(404).json({error:'Tedarikçi bulunamadı.'});

    const existingProduct = await pool.query('SELECT id FROM products WHERE sku = $1 AND tenant_id = $2', [sku, req.user.tenantId]);

    if (existingProduct.rows.length > 0) {
      return res.status(409).json({ error: 'SKU already exists' });
    }

    const cleanCategory = category && typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'Genel';

    const result = await pool.query(
      `INSERT INTO products (sku, name, category, barcode, unit, purchase_price, sale_price, min_stock_level, max_stock_level, supplier_id, tenant_id, module_type, is_medicine,purchase_price_tax_basis,kdv_orani) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,$14,$15) RETURNING *`,
      [
        sku.trim(),
        name.trim(),
        cleanCategory,
        barcode ? barcode.trim() : null,
        unit || 'adet',
        purchase_price || 0,
        sale_price || 0,
        min_stock_level || 0,
        max_stock_level || 1000,
        supplier_id || null
      , req.user.tenantId, moduleType, moduleType === 'PHARMACY' ? 1 : 0,taxBasis,Number(vat)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sku,
      name,
      category,
      barcode,
      unit = 'adet',
      purchase_price = 0,
      sale_price = 0,
      min_stock_level = 0,
      max_stock_level = 1000,
      supplier_id = null
    } = req.body;

    if(!Number.isFinite(Number(min_stock_level))||Number(min_stock_level)<0||Number(min_stock_level)>1000000000)return res.status(400).json({error:'Minimum stok sıfır veya pozitif bir sayı olmalıdır.'});
    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and name are required' });
    }

    const existingProduct = await pool.query('SELECT * FROM products WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const taxBasis=req.body.purchase_price_tax_basis===undefined?existingProduct.rows[0].purchase_price_tax_basis:req.body.purchase_price_tax_basis;
    const vat=req.body.kdv_orani===undefined?existingProduct.rows[0].kdv_orani:req.body.kdv_orani;
    if((taxBasis!==null&&!['inclusive','exclusive'].includes(taxBasis))||!require('../services/retailCostService').vatValid(vat))return res.status(400).json({error:'Alış fiyatı KDV temeli veya KDV oranı geçersiz.'});

    const skuCheck = await pool.query(
      'SELECT id FROM products WHERE sku = $1 AND id != $2',
      [sku, id]
    );

    if (skuCheck.rows.length > 0) {
      return res.status(409).json({ error: 'SKU already exists' });
    }

    const cleanCategory = category && typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'Genel';

    const result = await pool.query(
      `UPDATE products 
       SET sku = $1, name = $2, category = $3, barcode = $4, unit = $5, purchase_price = $6, sale_price = $7, min_stock_level = $8, max_stock_level = $9, supplier_id = $10, updated_at = CURRENT_TIMESTAMP,purchase_price_tax_basis=$13,kdv_orani=$14
       WHERE id = $11 AND tenant_id = $12 RETURNING *`,
      [
        sku.trim(),
        name.trim(),
        cleanCategory,
        barcode ? barcode.trim() : null,
        unit || 'adet',
        purchase_price || 0,
        sale_price || 0,
        min_stock_level || 0,
        max_stock_level || 1000,
        supplier_id || null,
        id,
        req.user.tenantId,taxBasis,Number(vat)
      ]
    );

    await pool.transaction(async tx=>{await require('../services/stockAlertSync').syncWarehouseStockAlert(tx,req.user.tenantId,id);await tx.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'product.cost_basis_updated','product',$3,$4)",[req.user.tenantId,req.user.email,String(id),JSON.stringify({user_id:req.user.userId,before:{price:existingProduct.rows[0].purchase_price,basis:existingProduct.rows[0].purchase_price_tax_basis,vat:existingProduct.rows[0].kdv_orani},after:{price:purchase_price,basis:taxBasis,vat:Number(vat)}})]);});
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const check = await pool.query('SELECT id, name FROM products WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }

    const procurementHistory=await pool.query('SELECT id FROM purchase_order_items WHERE tenant_id=$1 AND product_id=$2 UNION ALL SELECT id FROM wms_inbound_items WHERE tenant_id=$1 AND product_id=$2 LIMIT 1',[req.user.tenantId,id]);
    if(procurementHistory.rows.length)return res.status(409).json({error:'Satın alma veya mal kabul geçmişi bulunan ürün silinemez. İşlem ilişkileri korunmalıdır.'});

    const db = typeof pool.getDb === 'function' ? pool.getDb() : null;
    if (db) {
      try {
        db.pragma('foreign_keys = OFF');
        const delTables = [
          'inventory_transactions',
          'inventory_reservations',
          'inventory_lots',
          'inventory_serial_numbers',
          'wms_inbound_items',
          'wms_pick_tasks',
          'quarantine_stock',
          'stock_records',
          'stock_movements',
          'medicine_batches',
          'purchase_order_items',
          'stock_count_items',
          'colored_prescriptions',
          'pos_sale_items',
          'medicine_return_items',
          'patient_reminders',
          'pharmacy_invoice_items',
          'alerts',
          'product_uoms',
          'product_bin_records'
        ];
        for (const t of delTables) {
          try {
            const col = (t === 'colored_prescriptions' || t === 'patient_reminders') ? 'medicine_id' : 'product_id';
            const scoped=db.prepare(`PRAGMA table_info("${t}")`).all().some(c=>c.name==='tenant_id');
            db.prepare(`DELETE FROM "${t}" WHERE "${col}" = ?${scoped?' AND tenant_id = ?':''}`).run(...(scoped?[id,req.user.tenantId]:[id]));
          } catch (e) {
            // ignore if table/col missing
          }
        }
          db.prepare('DELETE FROM products WHERE id = ? AND tenant_id = ?').run(id,req.user.tenantId);
      } finally {
        db.pragma('foreign_keys = ON');
      }
    } else {
      await pool.query('DELETE FROM products WHERE id = $1 AND tenant_id = $2', [id,req.user.tenantId]);
    }

    res.json({ message: 'Ürün ve ilgili tüm kayıtları başarıyla silindi' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: error.message || 'Ürün silinemedi' });
  }
};

// Get product categories list
const getCategories = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TRIM(category) as name,
        COUNT(id) as count
      FROM products 
        WHERE tenant_id = $1 AND category IS NOT NULL AND TRIM(category) != ''
      GROUP BY TRIM(category)
      ORDER BY name ASC
      `,[req.user.tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories
};
