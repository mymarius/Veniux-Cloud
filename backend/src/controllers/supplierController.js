const pool = require('../config/database');
const service = require('../services/procurementService');
const wrap = work => async (req, res) => {
  try {
    await work(req, res);
  } catch (e) {
    res.status(e.status || 400).json({
      error: e.message
    });
  }
};
const getAllSuppliers = wrap(async (req, res) => res.json((await pool.query(`SELECT s.*,(SELECT COUNT(*) FROM products p WHERE p.tenant_id=s.tenant_id AND (p.supplier_id=s.id OR EXISTS (SELECT 1 FROM purchase_order_items i JOIN purchase_orders o ON o.id=i.order_id WHERE i.product_id=p.id AND i.tenant_id=s.tenant_id AND o.supplier_id=s.id AND o.tenant_id=s.tenant_id) OR EXISTS (SELECT 1 FROM wms_inbound_items i JOIN wms_inbound_receipts r ON r.id=i.receipt_id WHERE i.product_id=p.id AND i.tenant_id=s.tenant_id AND r.supplier_id=s.id AND r.tenant_id=s.tenant_id AND i.received_qty>0))) AS product_count,(SELECT COUNT(*) FROM purchase_orders o WHERE o.supplier_id=s.id AND o.tenant_id=s.tenant_id) AS order_count FROM suppliers s WHERE s.tenant_id=$1 ORDER BY s.created_at DESC`, [req.user.tenantId])).rows));
const getSupplierById = wrap(async (req, res) => {
  const t = req.user.tenantId,
    id = req.params.id,
    s = (await pool.query('SELECT * FROM suppliers WHERE id=$1 AND tenant_id=$2', [id, t])).rows[0];
  if (!s) return res.status(404).json({
    error: 'Tedarikçi bulunamadı.'
  });
  const products = (await pool.query('SELECT DISTINCT p.id,p.sku,p.name,p.category,p.min_stock_level,p.purchase_price,p.sale_price,p.module_type FROM products p WHERE p.tenant_id=$1 AND (p.supplier_id=$2 OR EXISTS (SELECT 1 FROM purchase_order_items i JOIN purchase_orders o ON o.id=i.order_id WHERE i.product_id=p.id AND i.tenant_id=$1 AND o.supplier_id=$2 AND o.tenant_id=$1) OR EXISTS (SELECT 1 FROM wms_inbound_items i JOIN wms_inbound_receipts r ON r.id=i.receipt_id WHERE i.product_id=p.id AND i.tenant_id=$1 AND r.supplier_id=$2 AND r.tenant_id=$1 AND i.received_qty>0))', [t, id])).rows;
  const commercial = ['admin', 'manager'].includes(req.user.role);
  const orders = commercial ? (await service.list(req.user)).filter(o => o.supplier_id === Number(id)) : [];
  res.json({
    ...s,
    products:products.filter(p=>req.user.moduleType==='BOTH'||p.module_type===req.user.moduleType),
    orders,
    deliveries: commercial ? await service.deliveries(req.user, id) : [],
    returns: commercial ? (await pool.query('SELECT * FROM supplier_return_documents WHERE tenant_id=$1 AND supplier_id=$2 ORDER BY created_at DESC', [t, id])).rows : []
  });
});
function fields(body) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200) throw Object.assign(Error('Tedarikçi adı gerekli.'), {
    status: 400
  });
  const days = Number(body.lead_time_days ?? 3);
  if (!Number.isInteger(days) || days < 0 || days > 3650) throw Object.assign(Error('Temin süresi geçersiz.'), {
    status: 400
  });
  return [body.name.trim(), ...['contact_name', 'email', 'phone', 'address', 'tax_no'].map(k => body[k] == null ? null : String(body[k]).slice(0, k === 'address' ? 1000 : 200)), days];
}
const createSupplier = wrap(async (req, res) => {
  const values = fields(req.body);
  const row = await pool.transaction(async tx => {
    const r = (await tx.query('INSERT INTO suppliers (name,contact_name,email,phone,address,tax_no,lead_time_days,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [...values, req.user.tenantId])).rows[0];
    await service.audit(tx, req.user, 'supplier.create', r.id, {
      after: r
    });
    return r;
  });
  res.status(201).json(row);
});
const updateSupplier = wrap(async (req, res) => {
  const values = fields(req.body);
  const row = await pool.transaction(async tx => {
    const before = (await tx.query('SELECT * FROM suppliers WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenantId])).rows[0];
    if (!before) throw Object.assign(Error('Tedarikçi bulunamadı.'), {
      status: 404
    });
    const r = (await tx.query('UPDATE suppliers SET name=$1,contact_name=$2,email=$3,phone=$4,address=$5,tax_no=$6,lead_time_days=$7 WHERE id=$8 AND tenant_id=$9 RETURNING *', [...values, req.params.id, req.user.tenantId])).rows[0];
    await service.audit(tx, req.user, 'supplier.update', r.id, {
      before,
      after: r
    });
    return r;
  });
  res.json(row);
});
const deleteSupplier = wrap(async (req, res) => {
  await pool.transaction(async tx => {
    const s = (await tx.query('SELECT * FROM suppliers WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenantId])).rows[0];
    if (!s) throw Object.assign(Error('Tedarikçi bulunamadı.'), {
      status: 404
    });
    for (const table of ['products', 'purchase_orders', 'wms_inbound_receipts', 'supplier_return_documents']) if ((await tx.query(`SELECT id FROM ${table} WHERE tenant_id=$1 AND supplier_id=$2 LIMIT 1`, [req.user.tenantId, s.id])).rows.length) throw Object.assign(Error('Ürün veya işlem geçmişi bulunan tedarikçi silinemez.'), {
      status: 409
    });
    await tx.query('DELETE FROM suppliers WHERE id=$1 AND tenant_id=$2', [s.id, req.user.tenantId]);
    await service.audit(tx, req.user, 'supplier.delete', s.id, {
      before: s
    });
  });
  res.json({
    message: 'Tedarikçi silindi.'
  });
});
const returnSupplier = wrap(async (req, res) => res.json(await service.supplierReturn(req.user, req.params.id, null, req.body, req.get('Idempotency-Key'))));
module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  returnSupplier
};
