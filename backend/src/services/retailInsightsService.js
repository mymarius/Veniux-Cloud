// Kasa raporları: en çok satanlar, kasiyer bazlı satış, saat bazlı yoğunluk; stok raporu: ölü stok.
// Tutarlar kasadaki satış kaydından (iade ve iptal düşülmüş net) okunur. Kâr/zarar için mevcut brüt kâr raporu kullanılır.
// Kısıtlı (şube) kullanıcı yalnız atanmış depolarının satışını ve stoğunu görür.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const day = /^\d{4}-\d{2}-\d{2}$/;
const TR_OFFSET_MS = 3 * 3600000; // Türkiye yıl boyu UTC+3.

function range(query) {
  const to = day.test(query.to || '') ? query.to : new Date(Date.now() + TR_OFFSET_MS).toISOString().slice(0, 10);
  const from = day.test(query.from || '') ? query.from : new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10);
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) fail('Tarih aralığı geçersiz (en çok bir yıl).');
  return { from, to };
}
const allowedSet = user => user.accessScope && user.accessScope.mode !== 'company' ? new Set((user.accessScope.warehouse_ids || []).map(Number)) : null;

async function sales(user, from, to) {
  const allowed = allowedSet(user);
  const rows = (await db.query('SELECT r.sale_id,r.warehouse_id,r.user_id,r.register_id,g.name AS register_name,r.snapshot_json,u.email,u.full_name FROM retail_sales r LEFT JOIN users u ON u.id=r.user_id AND u.tenant_id=r.tenant_id LEFT JOIN retail_registers g ON g.id=r.register_id AND g.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.business_date>=$2 AND r.business_date<=$3 ORDER BY r.sale_id', [user.tenantId, from, to])).rows;
  return rows.filter(r => !allowed || allowed.has(Number(r.warehouse_id))).map(r => ({ ...r, snapshot: JSON.parse(r.snapshot_json) }));
}

async function insights(user, query = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Raporlar için yönetici yetkisi gerekli.', 403);
  const { from, to } = range(query);
  const list = await sales(user, from, to);
  const registers = new Map(), products = new Map(), cashiers = new Map(), hours = Array.from({ length: 24 }, (_, hour) => ({ hour, receipts: 0, net_cents: 0 }));
  for (const sale of list) {
    const s = sale.snapshot, net = Number(s.net_cents || 0) - Number(s.refunded_cents || 0);
    if (s.status === 'cancelled') continue;
    for (const line of s.items || []) {
      const key = Number(line.product_id), p = products.get(key) || { product_id: key, name: line.name, unit: line.unit, quantity: 0, net_cents: 0 };
      p.quantity = Number((p.quantity + Number(line.quantity || 0) - Number(line.returned_quantity || 0)).toFixed(6));
      p.net_cents += Number(line.net_cents || 0) - Number(line.refunded_cents || 0);
      products.set(key, p);
    }
    const c = cashiers.get(Number(sale.user_id)) || { user_id: Number(sale.user_id), name: sale.full_name || null, email: sale.email || s.cashier || null, receipts: 0, net_cents: 0, discount_cents: 0, refunded_cents: 0 };
    const rk = Number(sale.register_id || 0), rg = registers.get(rk) || { register_id: rk || null, name: sale.register_name || 'Kasa tanımsız', receipts: 0, net_cents: 0, refunded_cents: 0 };
    rg.receipts++; rg.net_cents += net; rg.refunded_cents += Number(s.refunded_cents || 0); registers.set(rk, rg);
    c.receipts++; c.net_cents += net; c.discount_cents += Number(s.discount_cents || 0); c.refunded_cents += Number(s.refunded_cents || 0);
    cashiers.set(Number(sale.user_id), c);
    const at = Date.parse(s.created_at);
    if (Number.isFinite(at)) { const h = hours[new Date(at + TR_OFFSET_MS).getUTCHours()]; h.receipts++; h.net_cents += net; }
  }
  // Kasiyer performansı: kapattığı vardiyalardaki kasa farkı ve yaptığı iade/iptaller. Kapanış tarihi UTC günüyle eşlenir.
  const allowed = allowedSet(user), saleIds = new Set(list.map(s => Number(s.sale_id)));
  const nextDay = new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10);
  const closedShifts = (await db.query("SELECT id,warehouse_id,closing_json FROM retail_shifts WHERE tenant_id=$1 AND status='closed' AND closed_at>=$2 AND closed_at<$3", [user.tenantId, from, nextDay])).rows;
  const reversals = (await db.query('SELECT sale_id,amount_cents,data_json FROM retail_reversals WHERE tenant_id=$1 AND business_date>=$2 AND business_date<=$3', [user.tenantId, from, to])).rows;
  const person = (id, email) => { if (!cashiers.has(id)) cashiers.set(id, { user_id: id, name: null, email: email || null, receipts: 0, net_cents: 0, discount_cents: 0, refunded_cents: 0 }); return cashiers.get(id); };
  for (const shift of closedShifts) {
    if (allowed && !allowed.has(Number(shift.warehouse_id))) continue;
    const closing = JSON.parse(shift.closing_json || '{}');
    if (!closing.closed_by_id) continue;
    const c = person(Number(closing.closed_by_id), closing.closed_by), diff = Number(closing.difference_cents || 0);
    c.shifts_closed = (c.shifts_closed || 0) + 1;
    c.difference_cents = (c.difference_cents || 0) + diff;
    if (diff < 0) c.short_cents = (c.short_cents || 0) + Math.abs(diff);
  }
  for (const reversal of reversals) {
    if (allowed && !saleIds.has(Number(reversal.sale_id))) continue;
    const data = JSON.parse(reversal.data_json || '{}');
    if (!data.user_id) continue;
    const c = person(Number(data.user_id), data.user_email);
    c.reversal_count = (c.reversal_count || 0) + 1;
    c.reversal_cents = (c.reversal_cents || 0) + Number(reversal.amount_cents || 0);
  }
  for (const c of cashiers.values()) for (const key of ['shifts_closed', 'difference_cents', 'short_cents', 'reversal_count', 'reversal_cents']) c[key] = c[key] || 0;
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const all = [...products.values()].filter(p => p.quantity > 0 || p.net_cents > 0);
  return {
    from, to,
    top_by_revenue: [...all].sort((a, b) => b.net_cents - a.net_cents).slice(0, limit),
    top_by_quantity: [...all].sort((a, b) => b.quantity - a.quantity).slice(0, limit),
    cashiers: [...cashiers.values()].sort((a, b) => b.net_cents - a.net_cents).map(c => ({ ...c, average_cents: c.receipts ? Math.round(c.net_cents / c.receipts) : 0 })),
    hours,
    registers: [...registers.values()].sort((a, b) => b.net_cents - a.net_cents),
    busiest_hour: hours.reduce((best, h) => h.receipts > best.receipts ? h : best, hours[0]).receipts ? hours.reduce((best, h) => h.receipts > best.receipts ? h : best, hours[0]).hour : null,
  };
}

// Ölü stok: stoğu olan ama son N günde hiç çıkışı (satış, sevk) olmayan ürünler; bağlı kalan maliyet ile.
async function deadStock(user, query = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Raporlar için yönetici yetkisi gerekli.', 403);
  const days = Math.min(365, Math.max(7, Number.parseInt(query.days, 10) || 60));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const allowed = allowedSet(user);
  const stock = (await db.query('SELECT s.product_id,s.warehouse_id,SUM(s.quantity) AS qty FROM stock_records s WHERE s.tenant_id=$1 GROUP BY s.product_id,s.warehouse_id HAVING SUM(s.quantity)>0', [user.tenantId])).rows.filter(r => !allowed || allowed.has(Number(r.warehouse_id)));
  const moved = new Set((await db.query("SELECT DISTINCT product_id,warehouse_id FROM stock_movements WHERE tenant_id=$1 AND change_amount<0 AND movement_type='outbound' AND created_at>=$2", [user.tenantId, since])).rows.map(r => r.product_id + ':' + r.warehouse_id));
  const last = new Map((await db.query("SELECT product_id,warehouse_id,MAX(created_at) AS at FROM stock_movements WHERE tenant_id=$1 AND change_amount<0 AND movement_type='outbound' GROUP BY product_id,warehouse_id", [user.tenantId])).rows.map(r => [r.product_id + ':' + r.warehouse_id, r.at]));
  const products = new Map((await db.query('SELECT id,name,sku,barcode,purchase_price FROM products WHERE tenant_id=$1', [user.tenantId])).rows.map(p => [Number(p.id), p]));
  const warehouses = new Map((await db.query('SELECT id,name FROM warehouses WHERE tenant_id=$1', [user.tenantId])).rows.map(w => [Number(w.id), w.name]));
  const items = stock.filter(r => !moved.has(r.product_id + ':' + r.warehouse_id)).map(r => {
    const p = products.get(Number(r.product_id)) || {}, qty = Number(r.qty);
    return { product_id: Number(r.product_id), name: p.name || null, sku: p.sku || null, barcode: p.barcode || null, warehouse_id: Number(r.warehouse_id), warehouse: warehouses.get(Number(r.warehouse_id)) || null, quantity: qty, value_cents: Math.round(qty * Number(p.purchase_price || 0) * 100), last_outbound_at: last.get(r.product_id + ':' + r.warehouse_id) || null };
  }).sort((a, b) => b.value_cents - a.value_cents);
  return { days, items: items.slice(0, 500), total_value_cents: items.reduce((t, i) => t + i.value_cents, 0), count: items.length };
}

module.exports = { insights, deadStock };
