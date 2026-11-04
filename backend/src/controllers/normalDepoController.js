const pool = require('../config/database');
const stock = require('./stockController');
const read = handler => async (req, res) => { try { res.json(await handler(req.user.tenantId)); } catch (error) { res.status(500).json({ error: 'Depo bilgileri alınamadı.' }); } };
exports.getDashboardStats = read(async tenant => {
  const products = await pool.query("SELECT COUNT(*) AS count FROM products WHERE module_type = 'NORMAL' AND tenant_id = $1", [tenant]);
  const locations = await pool.query("SELECT COUNT(*) AS count FROM warehouse_locations l JOIN warehouses w ON w.id=l.warehouse_id WHERE w.warehouse_type='NORMAL' AND l.tenant_id=$1 AND w.tenant_id=$1", [tenant]);
  return { totalProducts: products.rows[0].count, totalLocations: locations.rows[0].count };
});
exports.getProducts = read(async tenant => (await pool.query("SELECT * FROM products WHERE module_type='NORMAL' AND tenant_id=$1 ORDER BY created_at DESC", [tenant])).rows);
exports.getWarehouses = read(async tenant => (await pool.query("SELECT * FROM warehouses WHERE warehouse_type='NORMAL' AND tenant_id=$1 ORDER BY created_at DESC", [tenant])).rows);
exports.getLocations = read(async tenant => (await pool.query("SELECT l.*, w.name AS warehouse_name FROM warehouse_locations l JOIN warehouses w ON w.id=l.warehouse_id WHERE w.warehouse_type='NORMAL' AND w.tenant_id=$1 AND l.tenant_id=$1", [tenant])).rows);
exports.getMovements = read(async tenant => (await pool.query("SELECT m.*, p.name AS product_name, w.name AS warehouse_name FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN warehouses w ON w.id=m.warehouse_id WHERE p.module_type='NORMAL' AND m.tenant_id=$1 AND p.tenant_id=$1 AND w.tenant_id=$1 ORDER BY m.id DESC", [tenant])).rows);
const validate = async (req, res, transfer) => {
  const body = req.body;
  if (!Number.isSafeInteger(Number(body.quantity)) || Number(body.quantity) <= 0) {
    res.status(400).json({ error: 'Miktar pozitif tam sayı olmalıdır.' }); return false;
  }
  const product = await pool.query("SELECT id FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [body.productId, req.user.tenantId]);
  if (!product.rows.length) { res.status(404).json({ error: 'Ürün bulunamadı.' }); return false; }
  for (const id of transfer ? [body.sourceWarehouseId, body.targetWarehouseId] : [body.warehouseId]) {
    const warehouse = await pool.query("SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2 AND warehouse_type='NORMAL'", [id, req.user.tenantId]);
    if (!warehouse.rows.length) { res.status(404).json({ error: 'Depo bulunamadı.' }); return false; }
  }
  return true;
};
exports.inboundReceive = async (req, res, next) => {
  try {
    if (!await validate(req, res, false)) return;
    const { productId, warehouseId, quantity, notes, locationId } = req.body;
    if (locationId) {
      return res.status(400).json({ error: 'Raflı kabul için WMS mal kabul işlemini kullanın.' });
    }
    req.body = { product_id: productId, warehouse_id: warehouseId, change_amount: Number(quantity), movement_type: 'inbound', note: notes };
    return stock.createMovement(req, res);
  } catch (error) { next(error); }
};
exports.createTransfer = async (req, res, next) => {
  try {
    if (!await validate(req, res, true)) return;
    const { productId, sourceWarehouseId, targetWarehouseId, quantity, notes } = req.body;
    req.body = { product_id: productId, from_warehouse_id: sourceWarehouseId, to_warehouse_id: targetWarehouseId, quantity: Number(quantity), note: notes };
    return stock.transferStock(req, res);
  } catch (error) { next(error); }
};
