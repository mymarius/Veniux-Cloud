// Şubeler (depolar) arası stok ve satış raporu.
// Stok yalnız stock_records'tan okunur: transfer kaynaktan düşüp hedefe eklendiği için firma toplamı değişmez.
// Satış tutarı kasadaki net tutardır (iade ve iptal düşülmüş). Kısıtlı kullanıcı yalnız atanmış depolarını görür.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const day = /^\d{4}-\d{2}-\d{2}$/;

async function report(user, query = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const to = day.test(query.to || '') ? query.to : today;
  const from = day.test(query.from || '') ? query.from : to.slice(0, 8) + '01';
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) fail('Tarih aralığı geçersiz (en çok bir yıl).');
  const scope = user.accessScope || { mode: 'restricted', warehouse_ids: [] };
  const allowed = scope.mode === 'company' ? null : new Set(scope.warehouse_ids.map(Number));
  const warehouses = (await db.query('SELECT id,name FROM warehouses WHERE tenant_id=$1 ORDER BY id', [user.tenantId])).rows.filter(w => !allowed || allowed.has(Number(w.id)));
  const stock = new Map((await db.query(`SELECT s.warehouse_id, COALESCE(SUM(s.quantity),0) AS units, COALESCE(SUM(s.quantity*COALESCE(p.purchase_price,0)),0) AS value
    FROM stock_records s JOIN products p ON p.id=s.product_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=$1 GROUP BY s.warehouse_id`, [user.tenantId])).rows.map(r => [Number(r.warehouse_id), r]));
  const sales = new Map((await db.query(`SELECT r.warehouse_id, COUNT(*) AS receipts, COALESCE(SUM(p.net_amount),0) AS net
    FROM retail_sales r JOIN pos_sales p ON p.id=r.sale_id AND p.tenant_id=r.tenant_id
    WHERE r.tenant_id=$1 AND r.business_date>=$2 AND r.business_date<=$3 GROUP BY r.warehouse_id`, [user.tenantId, from, to])).rows.map(r => [Number(r.warehouse_id), r]));
  const branches = warehouses.map(w => {
    const s = stock.get(Number(w.id)), t = sales.get(Number(w.id));
    return { warehouse_id: Number(w.id), name: w.name, stock_units: Number(s?.units || 0), stock_value_cents: Math.round(Number(s?.value || 0) * 100), receipts: Number(t?.receipts || 0), net_sales_cents: Math.round(Number(t?.net || 0) * 100) };
  });
  const total = k => branches.reduce((sum, b) => sum + b[k], 0);
  return { from, to, scope: scope.mode === 'company' ? 'company' : 'restricted', branches, totals: { stock_units: total('stock_units'), stock_value_cents: total('stock_value_cents'), receipts: total('receipts'), net_sales_cents: total('net_sales_cents') } };
}

module.exports = { report };
