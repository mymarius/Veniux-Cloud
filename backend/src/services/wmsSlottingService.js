const pool = require('../config/database');
const warehouseLocationService = require('./warehouseLocationService');

class WMSSlottingService {
  /**
   * Run ABC Velocity Analysis for a warehouse
   */
  async getABCVelocityAnalysis(warehouseId, period = '30d',tenantId) {
    if (!['30d','90d'].includes(period)) throw Object.assign(new Error('Dönem 30d veya 90d olmalıdır.'),{status:400});
    let dateFilter = "datetime('now', '-30 days')";
    if (period === '90d') dateFilter = "datetime('now', '-90 days')";

    // Query outbound movements per product to calculate velocity
    const query = `
      SELECT p.id as product_id, p.name as product_name, p.sku, p.category,
             COALESCE(SUM(ABS(tx.quantity)), 0) as total_outbound_qty,
             COUNT(tx.id) as pick_frequency
      FROM products p
      LEFT JOIN inventory_transactions tx ON p.id = tx.product_id 
        AND tx.tenant_id = p.tenant_id
        AND tx.warehouse_id = $1 
        AND tx.transaction_type IN ('PICK', 'SHIP', 'TRANSFER_OUT')
        AND tx.created_at >= ${dateFilter}
      WHERE p.tenant_id = $2 AND p.module_type = 'NORMAL'
      GROUP BY p.id, p.name, p.sku, p.category
      ORDER BY total_outbound_qty DESC, pick_frequency DESC
    `;

    const result = await pool.query(query, [warehouseId,tenantId]);
    const products = result.rows;
    const totalMovement = products.reduce((sum, p) => sum + (parseFloat(p.total_outbound_qty) || 0), 0);

    const classifiedProducts = require('./stockMovementAnalysis').classify(products);

    return {
      warehouse_id: warehouseId,
      period,
      total_movement_units: totalMovement,
      total_products: products.length,
      class_a_count: classifiedProducts.filter(p => p.abc_class === 'A').length,
      class_b_count: classifiedProducts.filter(p => p.abc_class === 'B').length,
      class_c_count: classifiedProducts.filter(p => p.abc_class === 'C').length,
      inactive_count: classifiedProducts.filter(p => p.abc_class === 'D').length,
      products: classifiedProducts
    };
  }

  /**
   * Get intelligent slotting and reorganization recommendations
   */
  async getSlottingRecommendations(warehouseId,tenantId) {
    const analysis = await this.getABCVelocityAnalysis(warehouseId, '30d',tenantId);
    const classAProducts = analysis.products.filter(p => p.abc_class === 'A');

    const recommendations = [];

    for (const prod of classAProducts) {
      // Find current locations for this A-class product
      const currentLocRes = await pool.query(`
        SELECT loc.*, pbr.quantity 
        FROM product_bin_records pbr
        JOIN warehouse_locations loc ON pbr.location_id = loc.id
        WHERE pbr.product_id = $1 AND loc.warehouse_id = $2 AND pbr.quantity > 0
      `, [prod.product_id, warehouseId]);

      const isSuboptimal = currentLocRes.rows.some(loc => loc.shelf_tier > 1 || loc.zone_name === 'BULK');

      if (isSuboptimal || currentLocRes.rows.length === 0) {
        recommendations.push({
          product_id: prod.product_id,
          product_name: prod.product_name,
          sku: prod.sku,
          abc_class: 'A',
          current_locations: currentLocRes.rows.map(l => l.location_code),
          recommended_zone: 'FAST_PICK',
          recommended_tier: 1,
          reason: 'YÃ¼ksek Ã§Ä±kÄ±ÅŸ hÄ±zÄ± (A Grubu) nedeniyle alt kat veya hÄ±zlÄ± toplama koridoruna (Aisles A) taÅŸÄ±nmasÄ± Ã¶nerilir.'
        });
      }
    }

    return recommendations;
  }

  /**
   * Check Replenishment Needs (Find low stock in pick faces)
   */
  async checkReplenishmentNeeds(warehouseId) {
    const query = `
      SELECT pbr.product_id, p.name as product_name, p.sku, p.min_stock_level,
             pbr.location_id, loc.location_code, loc.shelf_tier,
             pbr.quantity as pick_face_qty,
             COALESCE((
               SELECT SUM(bulk_pbr.quantity) 
               FROM product_bin_records bulk_pbr 
               JOIN warehouse_locations bulk_loc ON bulk_pbr.location_id = bulk_loc.id
               WHERE bulk_pbr.product_id = pbr.product_id 
                 AND bulk_loc.warehouse_id = $1 
                 AND bulk_loc.shelf_tier > 1
             ), 0) as available_in_bulk
      FROM product_bin_records pbr
      JOIN warehouse_locations loc ON pbr.location_id = loc.id
      JOIN products p ON pbr.product_id = p.id
      WHERE loc.warehouse_id = $1 
        AND loc.location_type = 'pick_face'
        AND pbr.quantity <= 15
      ORDER BY pbr.quantity ASC
    `;

    const result = await pool.query(query, [warehouseId]);
    return result.rows.map(row => ({
      ...row,
      needed_replenishment_qty: Math.max(20, 50 - parseFloat(row.pick_face_qty)),
      is_urgent: parseFloat(row.pick_face_qty) <= 5
    }));
  }
}

module.exports = new WMSSlottingService();
