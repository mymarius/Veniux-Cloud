'use strict';
// Züccaciye: kırık/fire kaydı ve çeyiz-düğün listesi.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const round = (v, d = 2) => Math.round(Number(v) * 10 ** d) / 10 ** d;
const boss = user => { if (!['admin', 'manager'].includes(user.role)) fail('Bu işlemi yalnız yönetici ve müdür yapar.', 403); };
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/[\x00-\x1f<>]/g, '').slice(0, max) : '') || null;
const scope = user => (user.accessScope && user.accessScope.mode !== 'company' ? new Set((user.accessScope.warehouse_ids || []).map(Number)) : null);

// ---------- Kırık / fire ----------
// Kırılan ürün stoktan düşer (eksiye inmez), maliyeti (alış fiyatı) kaydedilir. Satış değildir; kasaya yansımaz.
const REASONS = { kirik: 'Kırık', fire: 'Fire / kayıp', musteri: 'Müşteri kırdı', tedarikci: 'Tedarikçiden hasarlı' };
async function breakage(user, body = {}) {
  const reason = body.reason;
  if (!REASONS[reason]) fail('Sebep seçin: kırık, fire, müşteri kırdı veya tedarikçiden hasarlı.');
  const product = Number(body.product_id), warehouse = Number(body.warehouse_id), qty = Number(String(body.quantity ?? '').replace(',', '.'));
  if (!Number.isSafeInteger(product) || product < 1 || !Number.isSafeInteger(warehouse) || warehouse < 1) fail('Ürün ve mağaza/depo gerekli.');
  if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) fail('Adet geçersiz.');
  const allowed = scope(user);
  if (allowed && !allowed.has(warehouse)) fail('Bu mağaza için yetkiniz yok.', 403);
  const note = text(body.note, 200);
  return db.transaction(async tx => {
    const p = (await tx.query("SELECT id,name,unit,purchase_price FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [product, user.tenantId])).rows[0];
    if (!p) fail('Ürün bulunamadı.', 404);
    if (!(await tx.query('SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2', [warehouse, user.tenantId])).rows[0]) fail('Mağaza/depo bulunamadı.', 404);
    const rows = (await tx.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 AND quantity>0 ORDER BY id' + (db.getEngine() === 'mysql' ? ' FOR UPDATE' : ''), [user.tenantId, warehouse, product])).rows;
    const have = rows.reduce((t, r) => t + Number(r.quantity), 0);
    if (have + 1e-9 < qty) fail(`Stokta ${round(have, 3)} ${p.unit || 'adet'} var; daha fazlası kırık yazılamaz.`, 409);
    let left = qty;
    for (const r of rows) { const take = Math.min(Number(r.quantity), left); if (take <= 0) continue; await tx.query('UPDATE stock_records SET quantity=ROUND(quantity-$1,6),updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [take, r.id, user.tenantId]); left = round(left - take, 6); if (left <= 0) break; }
    const cost = round(qty * Number(p.purchase_price || 0));
    const move = (await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'adjustment','tableware_breakage',$5) RETURNING id", [user.tenantId, product, warehouse, -qty, REASONS[reason] + (note ? ': ' + note : '')])).rows[0];
    await require('./inventoryTransactionService').recordProjectedEntry(tx, { tenant_id: user.tenantId, warehouse_id: warehouse, product_id: product, transaction_type: 'DAMAGE', quantity: -qty, reference_type: 'stock_movement', reference_id: move.id, user_id: user.userId, reason_code: 'breakage_' + reason, notes: note });
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'tableware.breakage', 'product', product, JSON.stringify({ warehouse_id: warehouse, quantity: qty, reason, cost, note })]);
    await require('./stockAlertSync').syncWarehouseStockAlert(tx, user.tenantId, product, warehouse);
    return { product_id: product, name: p.name, quantity: qty, reason: REASONS[reason], cost, movement_id: Number(move.id) };
  });
}

// Son N günün kırık/fire özeti: sebebe göre adet ve maliyet, en çok kırılan ürünler.
async function breakageReport(user, query = {}) {
  const days = Math.min(Math.max(parseInt(query.days, 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const rows = (await db.query("SELECT m.product_id,p.name,p.unit,p.purchase_price,m.change_amount,m.note,m.created_at FROM stock_movements m JOIN products p ON p.id=m.product_id AND p.tenant_id=m.tenant_id WHERE m.tenant_id=$1 AND m.source='tableware_breakage' AND m.created_at>=$2 ORDER BY m.id DESC LIMIT 2000", [user.tenantId, since])).rows;
  const byReason = new Map(), byProduct = new Map();
  for (const r of rows) {
    const qty = -Number(r.change_amount), cost = round(qty * Number(r.purchase_price || 0));
    const reason = Object.values(REASONS).find(x => String(r.note || '').startsWith(x)) || 'Diğer';
    const a = byReason.get(reason) || { reason, quantity: 0, cost: 0 }; a.quantity = round(a.quantity + qty, 3); a.cost = round(a.cost + cost); byReason.set(reason, a);
    const b = byProduct.get(Number(r.product_id)) || { product_id: Number(r.product_id), name: r.name, unit: r.unit, quantity: 0, cost: 0 }; b.quantity = round(b.quantity + qty, 3); b.cost = round(b.cost + cost); byProduct.set(Number(r.product_id), b);
  }
  const reasons = [...byReason.values()].sort((a, b) => b.cost - a.cost);
  return { days, total_cost: round(reasons.reduce((t, r) => t + r.cost, 0)), reasons, products: [...byProduct.values()].sort((a, b) => b.cost - a.cost).slice(0, 20), recent: rows.slice(0, 20).map(r => ({ name: r.name, quantity: -Number(r.change_amount), note: r.note, at: r.created_at })) };
}

// ---------- Çeyiz / düğün listesi ----------
// Müşteri istediklerini seçer; mağaza kalemleri satıldıkça "alındı" işaretler. Liste WhatsApp ile paylaşılabilir metne dönüşür.
async function registries(user, query = {}) {
  const status = query.status === 'closed' ? 'closed' : 'open';
  const rows = (await db.query('SELECT id,title,owner_name,phone,event_date,status,created_at FROM gift_registries WHERE tenant_id=$1 AND status=$2 ORDER BY event_date,id DESC LIMIT 200', [user.tenantId, status])).rows;
  const counts = new Map((await db.query('SELECT registry_id,COUNT(*) AS n,SUM(CASE WHEN bought>=wanted THEN 1 ELSE 0 END) AS done FROM gift_registry_items WHERE tenant_id=$1 GROUP BY registry_id', [user.tenantId])).rows.map(r => [Number(r.registry_id), r]));
  return { items: rows.map(r => ({ id: Number(r.id), title: r.title, owner_name: r.owner_name, phone: r.phone, event_date: r.event_date, status: r.status, items: Number(counts.get(Number(r.id))?.n || 0), completed: Number(counts.get(Number(r.id))?.done || 0) })) };
}

function cleanRegistry(body) {
  const title = text(body.title, 120);
  if (!title || title.length < 2) fail('Liste adı gerekli (örn. Ayşe & Mehmet çeyiz listesi).');
  const phone = text(body.phone, 20);
  if (phone && !/^[0-9 +()-]{7,20}$/.test(phone)) fail('Telefon numarası geçersiz.');
  const date = text(body.event_date, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Tarih YYYY-AA-GG biçiminde olmalı.');
  return { title, owner_name: text(body.owner_name, 120), phone, event_date: date, note: text(body.note, 500) };
}

async function saveRegistry(user, id, body = {}) {
  boss(user);
  const r = cleanRegistry(body);
  if (id) {
    const status = body.status === 'closed' ? 'closed' : 'open';
    const done = await db.query('UPDATE gift_registries SET title=$1,owner_name=$2,phone=$3,event_date=$4,note=$5,status=$6 WHERE id=$7 AND tenant_id=$8', [r.title, r.owner_name, r.phone, r.event_date, r.note, status, Number(id), user.tenantId]);
    if (done.rowCount !== 1) fail('Liste bulunamadı.', 404);
    return { id: Number(id), ...r, status };
  }
  const row = (await db.query("INSERT INTO gift_registries (tenant_id,title,owner_name,phone,event_date,note,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,'open',$7) RETURNING id", [user.tenantId, r.title, r.owner_name, r.phone, r.event_date, r.note, user.userId])).rows[0];
  return { id: Number(row.id), ...r, status: 'open' };
}

async function registry(user, id) {
  const r = (await db.query('SELECT * FROM gift_registries WHERE id=$1 AND tenant_id=$2', [Number(id), user.tenantId])).rows[0];
  if (!r) fail('Liste bulunamadı.', 404);
  const items = (await db.query('SELECT i.id,i.product_id,i.set_id,i.wanted,i.bought,i.note,p.name AS product_name,p.sale_price,s.name AS set_name,c.sale_price AS set_price FROM gift_registry_items i LEFT JOIN products p ON p.id=i.product_id AND p.tenant_id=i.tenant_id LEFT JOIN product_sets s ON s.id=i.set_id AND s.tenant_id=i.tenant_id LEFT JOIN product_set_codes c ON c.set_id=i.set_id AND c.tenant_id=i.tenant_id WHERE i.tenant_id=$1 AND i.registry_id=$2 ORDER BY i.id', [user.tenantId, Number(id)])).rows;
  const list = items.map(i => ({ id: Number(i.id), product_id: i.product_id == null ? null : Number(i.product_id), set_id: i.set_id == null ? null : Number(i.set_id), name: i.set_name || i.product_name || 'Silinmiş ürün', price: i.set_id ? (i.set_price == null ? null : round(i.set_price)) : round(i.sale_price || 0), wanted: Number(i.wanted), bought: Number(i.bought), note: i.note }));
  const remaining = list.filter(i => i.bought < i.wanted);
  return { id: Number(r.id), title: r.title, owner_name: r.owner_name, phone: r.phone, event_date: r.event_date, note: r.note, status: r.status, items: list,
    remaining_total: round(remaining.reduce((t, i) => t + (i.price || 0) * (i.wanted - i.bought), 0)),
    share_text: [r.title + (r.event_date ? ' · ' + r.event_date.split('-').reverse().join('.') : ''), 'Henüz alınmayanlar:', ...remaining.map(i => `- ${i.name}: ${i.wanted - i.bought} adet${i.price ? ' (' + i.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL)' : ''}`), 'Mağazamızdan alabilir, listeden düşürebilirsiniz.'].join('\n') };
}

async function addRegistryItem(user, id, body = {}) {
  boss(user);
  const wanted = Number(body.wanted ?? 1);
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > 1000) fail('İstenen adet 1-1000 olmalı.');
  const product = body.product_id == null ? null : Number(body.product_id), set = body.set_id == null ? null : Number(body.set_id);
  if ((product === null) === (set === null)) fail('Bir ürün veya bir takım seçin.');
  return db.transaction(async tx => {
    const r = (await tx.query("SELECT id,status FROM gift_registries WHERE id=$1 AND tenant_id=$2", [Number(id), user.tenantId])).rows[0];
    if (!r) fail('Liste bulunamadı.', 404);
    if (r.status !== 'open') fail('Kapanmış listeye kalem eklenmez.', 409);
    if (product !== null && !(await tx.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [product, user.tenantId])).rows[0]) fail('Ürün bulunamadı.', 404);
    if (set !== null && !(await tx.query('SELECT id FROM product_sets WHERE id=$1 AND tenant_id=$2', [set, user.tenantId])).rows[0]) fail('Takım bulunamadı.', 404);
    const same = (await tx.query('SELECT id,wanted FROM gift_registry_items WHERE tenant_id=$1 AND registry_id=$2 AND ' + (product !== null ? 'product_id=$3' : 'set_id=$3'), [user.tenantId, Number(id), product ?? set])).rows[0];
    if (same) { await tx.query('UPDATE gift_registry_items SET wanted=$1 WHERE id=$2', [Number(same.wanted) + wanted, same.id]); return { id: Number(same.id), merged: true }; }
    const row = (await tx.query('INSERT INTO gift_registry_items (tenant_id,registry_id,product_id,set_id,wanted,bought,note) VALUES ($1,$2,$3,$4,$5,0,$6) RETURNING id', [user.tenantId, Number(id), product, set, wanted, text(body.note, 200)])).rows[0];
    return { id: Number(row.id), merged: false };
  });
}

// Alındı işareti: kasada satış yapıldıktan sonra personel listeden düşer. Kim aldı isteğe bağlı not.
async function markBought(user, registryId, itemId, body = {}) {
  if (!['admin', 'manager', 'cashier'].includes(user.role)) fail('Yetkiniz yok.', 403);
  const delta = Number(body.quantity ?? 1);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000) fail('Adet geçersiz.');
  return db.transaction(async tx => {
    const i = (await tx.query('SELECT i.id,i.wanted,i.bought,r.status FROM gift_registry_items i JOIN gift_registries r ON r.id=i.registry_id AND r.tenant_id=i.tenant_id WHERE i.id=$1 AND i.registry_id=$2 AND i.tenant_id=$3', [Number(itemId), Number(registryId), user.tenantId])).rows[0];
    if (!i) fail('Kalem bulunamadı.', 404);
    if (i.status !== 'open') fail('Liste kapanmış.', 409);
    const bought = Number(i.bought) + delta;
    if (bought < 0) fail('Alınan adet sıfırın altına inemez.');
    if (bought > Number(i.wanted)) fail(`Bu kalemden ${i.wanted} adet isteniyor; ${Number(i.wanted) - Number(i.bought)} adet kaldı.`, 409);
    await tx.query('UPDATE gift_registry_items SET bought=$1 WHERE id=$2', [bought, Number(itemId)]);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'tableware.registry_bought', 'gift_registry', Number(registryId), JSON.stringify({ item_id: Number(itemId), delta, buyer: text(body.buyer, 80) })]);
    return { item_id: Number(itemId), bought, wanted: Number(i.wanted) };
  });
}

async function removeRegistryItem(user, registryId, itemId) {
  boss(user);
  const done = await db.query('DELETE FROM gift_registry_items WHERE id=$1 AND registry_id=$2 AND tenant_id=$3 AND bought=0', [Number(itemId), Number(registryId), user.tenantId]);
  if (done.rowCount !== 1) fail('Kalem bulunamadı ya da alınmış; alınmış kalem silinmez.', 409);
  return { removed: true };
}

module.exports = { REASONS, breakage, breakageReport, registries, saveRegistry, registry, addRegistryItem, markBought, removeRegistryItem };
