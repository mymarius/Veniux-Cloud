const pool = require('../config/database');

class WMSRuleEngine {
  /**
   * Evaluate Putaway Rules for a product
   */
  async evaluatePutaway(product, warehouseId, tenantId) {
    const rulesRes = await pool.query(`
      SELECT * FROM wms_business_rules 
      WHERE tenant_id = $2 AND (warehouse_id = $1 OR warehouse_id IS NULL) AND rule_type = 'PUTAWAY' AND is_active = 1
      ORDER BY priority ASC
    `, [warehouseId, tenantId]);

    // Check Cold Storage rule
    if (product.category?.includes('Soğuk') || product.name?.includes('Flakon') || product.name?.includes('İnsülin')) {
      return { target_zone: 'COLD_STORAGE', tier: 1 };
    }

    // Default fast-pick or general rule
    return { target_zone: 'FAST_PICK', tier: 1 };
  }

  /**
   * Evaluate Allocation Strategy (FEFO vs FIFO)
   */
  async evaluateAllocationStrategy(productId, tenantId) {
    const prodRes = await pool.query('SELECT is_medicine FROM products WHERE id = $1 AND tenant_id = $2', [productId, tenantId]);
    const isMed = prodRes.rows[0]?.is_medicine === 1;
    // Medicines always use FEFO
    return isMed ? 'FEFO' : 'FIFO';
  }
}

module.exports = new WMSRuleEngine();
