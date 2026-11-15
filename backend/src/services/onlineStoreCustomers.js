// Online mağaza müşterileri (CRM): her siparişte telefon numarasına göre müşteri kaydı açılır/güncellenir.
// Sipariş sayısı ve toplam harcama iptalde geri alınır. Müşteri, işletmenin isteğiyle anonimleştirilebilir (KVKK silme talebi).
const db = require('../config/database');
const { ciLike } = require('./sqlSearch');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const round = (v, d = 2) => Math.round(Number(v) * 10 ** d) / 10 ** d;
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const OPEN = ['new', 'confirmed', 'preparing', 'ready'];

async function recordOrder(tx, tenantId, orderId, c, total) {
  const have = (await tx.query('SELECT id FROM online_customers WHERE tenant_id=$1 AND phone=$2', [tenantId, c.phone])).rows[0];
  let id;
  if (have) {
    id = Number(have.id);
    await tx.query('UPDATE online_customers SET name=$3,email=COALESCE($4,email),city=COALESCE($5,city),address=COALESCE($6,address),order_count=order_count+1,total_spent=ROUND(total_spent+$7,2),last_order_at=CURRENT_TIMESTAMP,anonymized=0 WHERE id=$1 AND tenant_id=$2', [id, tenantId, c.name, c.email || null, c.city || null, c.address || null, total]);
  } else {
    id = Number((await tx.query('INSERT INTO online_customers (tenant_id,phone,name,email,city,address,order_count,total_spent) VALUES ($1,$2,$3,$4,$5,$6,1,$7) RETURNING id', [tenantId, c.phone, c.name, c.email || null, c.city || null, c.address || null, total])).rows[0].id);
  }
  await tx.query('INSERT INTO online_order_customers (order_id,tenant_id,customer_id) VALUES ($1,$2,$3)', [orderId, tenantId, id]);
  return id;
}
// Sipariş iptalinde müşterinin sayaçları geri alınır.
async function reverseOrder(tx, tenantId, orderId, total) {
  const link = (await tx.query('SELECT customer_id FROM online_order_customers WHERE order_id=$1 AND tenant_id=$2', [orderId, tenantId])).rows[0];
  if (!link) return;
  await tx.query('UPDATE online_customers SET order_count=CASE WHEN order_count>0 THEN order_count-1 ELSE 0 END,total_spent=CASE WHEN total_spent>=$3 THEN ROUND(total_spent-$3,2) ELSE 0 END WHERE id=$1 AND tenant_id=$2', [Number(link.customer_id), tenantId, total]);
}
const shape = r => ({ id: Number(r.id), name: r.name, phone: r.anonymized ? '' : r.phone, email: r.email || '', city: r.city || '', address: r.address || '', order_count: Number(r.order_count), total_spent: round(r.total_spent), first_order_at: r.first_order_at, last_order_at: r.last_order_at, anonymized: Boolean(Number(r.anonymized)) });

async function list(user, query = {}) {
  const page = Math.max(0, Number.parseInt(query.page, 10) || 0), size = 50;
  const where = ['tenant_id=$1']; const params = [user.tenantId];
  const q = text(query.q, 60);
  if (q) { params.push('%' + q + '%'); where.push('(' + ciLike('name', '$' + params.length) + ' OR phone LIKE $' + params.length + ')'); }
  if (query.repeat === '1') where.push('order_count>=2');
  const base = `FROM online_customers WHERE ${where.join(' AND ')}`;
  const total = Number((await db.query('SELECT COUNT(*) AS n ' + base, params)).rows[0].n);
  const sum = (await db.query('SELECT COUNT(*) AS n,COALESCE(SUM(CASE WHEN order_count>=2 THEN 1 ELSE 0 END),0) AS r FROM online_customers WHERE tenant_id=$1', [user.tenantId])).rows[0];
  const rows = (await db.query(`SELECT * ${base} ORDER BY last_order_at DESC,id DESC LIMIT ${size} OFFSET ${page * size}`, params)).rows;
  return { total, page, page_size: size, all: Number(sum.n), repeat: Number(sum.r), items: rows.map(shape) };
}
async function get(user, id) {
  const cid = Number(id);
  const row = Number.isSafeInteger(cid) ? (await db.query('SELECT * FROM online_customers WHERE id=$1 AND tenant_id=$2', [cid, user.tenantId])).rows[0] : null;
  if (!row) fail('Müşteri bulunamadı.', 404);
  const orders = (await db.query('SELECT o.id,o.number,o.status,o.total,o.created_at FROM online_orders o JOIN online_order_customers l ON l.order_id=o.id AND l.tenant_id=o.tenant_id WHERE l.tenant_id=$1 AND l.customer_id=$2 ORDER BY o.id DESC LIMIT 50', [user.tenantId, cid])).rows;
  return { ...shape(row), orders: orders.map(o => ({ id: Number(o.id), number: 'S-' + String(o.number).padStart(6, '0'), status: o.status, total: round(o.total), created_at: o.created_at })) };
}
async function anonymize(user, id) {
  const cid = Number(id);
  const row = Number.isSafeInteger(cid) ? (await db.query('SELECT id FROM online_customers WHERE id=$1 AND tenant_id=$2', [cid, user.tenantId])).rows[0] : null;
  if (!row) fail('Müşteri bulunamadı.', 404);
  const open = Number((await db.query(`SELECT COUNT(*) AS n FROM online_orders o JOIN online_order_customers l ON l.order_id=o.id AND l.tenant_id=o.tenant_id WHERE l.tenant_id=$1 AND l.customer_id=$2 AND o.status IN (${OPEN.map(s => `'${s}'`).join(',')})`, [user.tenantId, cid])).rows[0].n);
  if (open) fail('Açık siparişi olan müşteri silinemez. Önce siparişleri tamamlayın veya iptal edin.', 409, 'OPEN_ORDERS');
  await db.transaction(async tx => {
    await tx.query("UPDATE online_orders SET customer_name='Silinmiş müşteri',phone='0000000000',email=NULL,address=NULL,note=NULL WHERE tenant_id=$1 AND id IN (SELECT order_id FROM online_order_customers WHERE tenant_id=$1 AND customer_id=$2)", [user.tenantId, cid]);
    await tx.query("UPDATE online_customers SET name='Silinmiş müşteri',phone=$3,email=NULL,city=NULL,address=NULL,anonymized=1 WHERE id=$1 AND tenant_id=$2", [cid, user.tenantId, 'silindi-' + cid]);
  });
  return { id: cid, anonymized: true };
}

module.exports = { recordOrder, reverseOrder, list, get, anonymize };
