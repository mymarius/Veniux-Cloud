const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Kasiyer hareketleri: fişten ürün silme, sepeti boşaltma, satışsız çıkış. Mevcut denetim günlüğüne (audit_logs) yazılır; şema değişmez.
const TYPES = { line_removed: 'Fişten ürün silindi', cart_cleared: 'Sepet boşaltıldı', no_sale_exit: 'Satışsız çıkış' };
const text = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

async function record(user, body = {}) {
  const type = String(body.type || '');
  if (!TYPES[type]) fail('Hareket türü geçersiz.');
  const details = JSON.stringify({
    product: text(body.product, 120),
    quantity: Number.isFinite(Number(body.quantity)) ? Number(body.quantity) : null,
    amount: Number.isFinite(Number(body.amount)) ? Math.round(Number(body.amount) * 100) / 100 : null,
    lines: Number.isInteger(body.lines) ? body.lines : null,
    note: text(body.note, 200)
  });
  await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)', [user.tenantId, user.email, 'pos.' + type, 'pos_event', details]);
  return { ok: true };
}

async function list(user, query = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  const params = [user.tenantId];
  let where = "tenant_id=$1 AND action LIKE 'pos.%' AND entity_type='pos_event'";
  if (query.type && TYPES[query.type]) { params.push('pos.' + query.type); where += ` AND action=$${params.length}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.from || '')) { params.push(query.from + ' 00:00:00'); where += ` AND created_at>=$${params.length}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.to || '')) { params.push(query.to + ' 23:59:59'); where += ` AND created_at<=$${params.length}`; }
  const rows = (await db.query(`SELECT id,user_email,action,details,created_at FROM audit_logs WHERE ${where} ORDER BY id DESC LIMIT 300`, params)).rows;
  const items = rows.map(r => {
    let d = {};
    try { d = JSON.parse(r.details || '{}'); } catch { /* bozuk kayıt boş gösterilir */ }
    const type = String(r.action).slice(4);
    return { id: Number(r.id), at: r.created_at, user: r.user_email, type, label: TYPES[type] || type, ...d };
  });
  const by = {};
  for (const i of items) {
    const k = i.user || '—';
    by[k] ||= { user: k, line_removed: 0, cart_cleared: 0, no_sale_exit: 0 };
    by[k][i.type] = (by[k][i.type] || 0) + 1;
  }
  const summary = Object.values(by).sort((a, b) => (b.line_removed + b.cart_cleared) - (a.line_removed + a.cart_cleared));
  return { items, summary, types: TYPES };
}

module.exports = { record, list, TYPES };
