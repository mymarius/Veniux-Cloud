// Çevrimdışı kasa satışlarının sunucuya sonradan kabulü (karar A): satış yine kayda geçer, stok eksiye düşmez,
// stok açığı "uyuşmazlık" olarak yazılır ve yönetici sayımla doğrular. Yalnız stok açığı bu yolla kabul edilir;
// tarihi geçmiş/bloke lot, kapalı vardiya gibi diğer ret nedenleri olduğu gibi kalır (satış cihazda "kabul edilmedi" olarak durur).
const crypto = require('crypto');
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const RECEIPT = /^E[A-Z0-9]{3}-\d{8}-\d{5}$/;
const MAX_AGE_MS = 7 * 86400000, SKEW_MS = 5 * 60000;

// Başlık: X-Veniux-Offline: <geçici fiş no>|<satışın cihazda yapıldığı ISO zaman>. Gövdede değil başlıkta gider; böylece aynı satışın
// çevrimiçi ilk denemesi ile kuyruktan tekrarı aynı Idempotency-Key ve aynı gövdeyle eşleşir.
function parseHeader(value, now = Date.now()) {
  if (value === undefined || value === null || value === '') return null;
  const parts = String(value).split('|');
  if (parts.length !== 2 || !RECEIPT.test(parts[0])) fail('Çevrimdışı satış bilgisi geçersiz.');
  const time = Date.parse(parts[1]);
  if (!Number.isFinite(time) || time > now + SKEW_MS || now - time > MAX_AGE_MS) fail('Çevrimdışı satış zamanı geçersiz veya 7 günden eski.');
  return { receiptNo: parts[0], offlineAt: new Date(time).toISOString() };
}

// Satılan miktar eldeki stoktan fazlaysa fark kadar stok düzeltmesi girilir (stok sıfırda kalır, eksiye düşmez); satış normal yoldan kaydolur.
async function coverShortfalls(tx, user, warehouseId, needed) {
  const shortages = [];
  for (const [productId, quantity] of needed) {
    const rows = (await tx.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 ORDER BY id' + (db.getEngine() === 'mysql' ? ' FOR UPDATE' : ''), [user.tenantId, warehouseId, productId])).rows;
    const have = rows.reduce((sum, r) => sum + Number(r.quantity), 0), missing = Number((Number(quantity) - have).toFixed(6));
    if (missing <= 0.0000001) continue;
    if (rows.length) await tx.query('UPDATE stock_records SET quantity=ROUND(quantity+$1,6),updated_at=CURRENT_TIMESTAMP WHERE id=$2', [missing, rows[0].id]);
    else await tx.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)', [user.tenantId, productId, warehouseId, missing]);
    const movement = (await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'inbound','offline_shortfall','Çevrimdışı satış stok açığı düzeltmesi') RETURNING id", [user.tenantId, productId, warehouseId, missing])).rows[0];
    await require('./inventoryTransactionService').recordProjectedEntry(tx, { tenant_id: user.tenantId, warehouse_id: warehouseId, product_id: productId, transaction_type: 'RECEIVE', quantity: missing, reference_type: 'stock_movement', reference_id: movement.id, user_id: user.userId, notes: 'Çevrimdışı satış stok açığı düzeltmesi' });
    shortages.push({ product_id: Number(productId), quantity: missing });
  }
  return shortages;
}

async function assertReceiptFree(tx, user, offline) {
  const used = (await tx.query('SELECT sale_id FROM pos_offline_sales WHERE tenant_id=$1 AND emergency_receipt_no=$2', [user.tenantId, offline.receiptNo])).rows[0];
  if (used) fail('Bu geçici fiş numarası başka bir satışta kullanılmış.', 409);
}

// Satış kaydedildikten sonra: geçici fiş izi, satışın çevrimdışı işareti ve stok açığı uyuşmazlıkları.
async function record(tx, user, { saleId, warehouseId, offline, shortages }) {
  await tx.query('INSERT INTO pos_offline_sales (tenant_id,sale_id,emergency_receipt_no,offline_at,conflict_count) VALUES ($1,$2,$3,$4,$5)', [user.tenantId, saleId, offline.receiptNo, offline.offlineAt, shortages.length]);
  await tx.query("UPDATE pos_sale_meta SET mode='offline' WHERE tenant_id=$1 AND sale_id=$2", [user.tenantId, saleId]);
  for (const s of shortages) {
    await tx.query("INSERT INTO pos_offline_conflicts (id,tenant_id,sale_id,warehouse_id,product_id,kind,shortfall_quantity,status) VALUES ($1,$2,$3,$4,$5,'stock_shortfall',$6,'open')", [crypto.randomUUID(), user.tenantId, saleId, warehouseId, s.product_id, s.quantity]);
  }
  await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'retail.offline_sale', 'pos_sale', saleId, JSON.stringify({ emergency_receipt_no: offline.receiptNo, offline_at: offline.offlineAt, shortages })]);
}

const allowedWarehouses = user => (user.accessScope && user.accessScope.mode !== 'company' ? new Set((user.accessScope.warehouse_ids || []).map(Number)) : null);

async function listConflicts(user, status = 'open') {
  if (!['admin', 'manager'].includes(user.role)) fail('Uyuşmazlıkları yalnız yönetici ve müdür görür.', 403);
  if (!['open', 'resolved', 'all'].includes(status)) fail('Durum geçersiz.');
  const allowed = allowedWarehouses(user);
  const rows = (await db.query(`SELECT c.id,c.sale_id,c.warehouse_id,c.product_id,p.name AS product_name,c.kind,c.shortfall_quantity,c.status,c.note,c.created_at,c.resolved_at,m.local_receipt_no,o.emergency_receipt_no,o.offline_at
    FROM pos_offline_conflicts c
    LEFT JOIN products p ON p.id=c.product_id AND p.tenant_id=c.tenant_id
    LEFT JOIN pos_sale_meta m ON m.sale_id=c.sale_id AND m.tenant_id=c.tenant_id
    LEFT JOIN pos_offline_sales o ON o.sale_id=c.sale_id AND o.tenant_id=c.tenant_id
    WHERE c.tenant_id=$1 AND ($2='all' OR c.status=$2) ORDER BY c.created_at DESC LIMIT 200`, [user.tenantId, status])).rows;
  return { items: rows.filter(r => !allowed || allowed.has(Number(r.warehouse_id))).map(r => ({ ...r, shortfall_quantity: Number(r.shortfall_quantity) })) };
}

// "Çözüldü" kaydı: yönetici sayım yapıp stoğu düzelttiğini yazar. Stok bu uç noktada değişmez; düzeltme mevcut stok ekranlarından yapılır.
async function resolve(user, id, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Uyuşmazlığı yalnız yönetici ve müdür kapatır.', 403);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length < 5 || note.length > 500) fail('En az 5, en fazla 500 karakter açıklama gerekli.');
  return db.transaction(async tx => {
    const row = (await tx.query('SELECT id,status,sale_id,warehouse_id FROM pos_offline_conflicts WHERE tenant_id=$1 AND id=$2', [user.tenantId, String(id)])).rows[0];
    const allowed = allowedWarehouses(user);
    if (!row || (allowed && !allowed.has(Number(row.warehouse_id)))) fail('Uyuşmazlık bulunamadı.', 404);
    if (row.status !== 'open') fail('Uyuşmazlık zaten kapatılmış.', 409);
    const done = await tx.query("UPDATE pos_offline_conflicts SET status='resolved',note=$1,resolved_at=CURRENT_TIMESTAMP,resolved_by=$2 WHERE tenant_id=$3 AND id=$4 AND status='open'", [note, user.userId, user.tenantId, row.id]);
    if (done.rowCount !== 1) fail('Uyuşmazlık durumu değişti.', 409);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'retail.offline_conflict_resolved', 'pos_sale', row.sale_id, JSON.stringify({ conflict_id: row.id, note })]);
    return { id: row.id, status: 'resolved' };
  });
}

module.exports = { parseHeader, coverShortfalls, assertReceiptFree, record, listConflicts, resolve, RECEIPT };
