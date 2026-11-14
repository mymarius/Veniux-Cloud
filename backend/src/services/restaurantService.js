// Pide / restoran paketi: garson siparişi (masa, paket, motor), mutfak ekranı, reçeteye göre anlık stok düşümü,
// esnaf için gün sonu özeti ve yeni sipariş akışı. Her şey telefonda çalışır; ayrı bilgisayar gerekmez.
const crypto = require('crypto');
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const TYPES = ['masa', 'paket', 'motor'];
const ITEM_STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'];
const businessDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const lock = () => (db.getEngine() === 'mysql' ? ' FOR UPDATE' : '');
const allowedWarehouses = user => (user.accessScope && user.accessScope.mode !== 'company' ? new Set((user.accessScope.warehouse_ids || []).map(Number)) : null);
const round = (v, d = 2) => Math.round(Number(v) * 10 ** d) / 10 ** d;

// ---------- Masalar ve menü ----------
async function tables(user) {
  const rows = (await db.query('SELECT id,name,active FROM restaurant_tables WHERE tenant_id=$1 ORDER BY name', [user.tenantId])).rows;
  const open = (await db.query("SELECT id,table_id,total_amount FROM restaurant_orders WHERE tenant_id=$1 AND status='open' AND table_id IS NOT NULL", [user.tenantId])).rows;
  return { items: rows.map(t => { const o = open.find(x => Number(x.table_id) === Number(t.id)); return { id: Number(t.id), name: t.name, active: Number(t.active) === 1, open_order_id: o ? Number(o.id) : null, open_total: o ? round(o.total_amount) : 0 }; }) };
}

async function saveTable(user, id, body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 30) fail('Masa adı 1-30 karakter olmalı.');
  const active = body.active === false ? 0 : 1;
  const duplicate = (await db.query('SELECT id FROM restaurant_tables WHERE tenant_id=$1 AND name=$2', [user.tenantId, name])).rows[0];
  if (duplicate && Number(duplicate.id) !== Number(id)) fail('Bu adda bir masa var.', 409);
  if (id) {
    const done = await db.query('UPDATE restaurant_tables SET name=$1,active=$2 WHERE id=$3 AND tenant_id=$4', [name, active, Number(id), user.tenantId]);
    if (done.rowCount !== 1) fail('Masa bulunamadı.', 404);
    return { id: Number(id), name, active: active === 1 };
  }
  const row = (await db.query('INSERT INTO restaurant_tables (tenant_id,name,active) VALUES ($1,$2,$3) RETURNING id', [user.tenantId, name, active])).rows[0];
  return { id: Number(row.id), name, active: active === 1 };
}

// Menü: "menü" işaretli ürünler; hiç işaret yoksa satış fiyatı olan tüm ürünler.
async function menu(user) {
  const flagged = (await db.query("SELECT product_id FROM product_attributes WHERE tenant_id=$1 AND attr_key='menu' AND attr_value='1'", [user.tenantId])).rows.map(r => Number(r.product_id));
  const all = (await db.query("SELECT id,name,category,unit,sale_price FROM products WHERE tenant_id=$1 AND module_type='NORMAL' AND sale_price>0 ORDER BY category,name LIMIT 500", [user.tenantId])).rows;
  const optionRows = (await db.query('SELECT product_id,name,price FROM restaurant_menu_options WHERE tenant_id=$1 ORDER BY product_id,position', [user.tenantId])).rows;
  const optionMap = new Map();
  for (const r of optionRows) optionMap.set(Number(r.product_id), [...(optionMap.get(Number(r.product_id)) || []), { name: r.name, price: round(r.price) }]);
  const items = (flagged.length ? all.filter(p => flagged.includes(Number(p.id))) : all).map(p => ({ id: Number(p.id), name: p.name, category: p.category || 'Diğer', unit: p.unit, price: round(p.sale_price), options: (optionMap.get(Number(p.id)) || []).map(o => ({ name: o.name, price: o.price })) }));
  return { items, configured: flagged.length > 0 };
}

// Ürün seçenekleri ("Kaşarlı +20 ₺", "Acılı"): restaurant_menu_options tablosunda sıralı tutulur. İsteğe bağlı malzeme stoktan düşer.
async function setMenuOptions(user, productId, body = {}) {
  const id = Number(productId), list = Array.isArray(body.options) ? body.options : null;
  if (!Number.isSafeInteger(id) || id < 1) fail('Ürün geçersiz.');
  if (!list || list.length > 20) fail('Bir üründe en çok 20 seçenek olur.');
  const seen = new Set();
  const clean = list.map(o => {
    const name = typeof o?.name === 'string' ? o.name.trim().replace(/\s+/g, ' ') : '';
    const price = Number(o?.price ?? 0);
    if (name.length < 1 || name.length > 40 || /[<>]/.test(name) || seen.has(name.toLocaleLowerCase('tr-TR'))) fail('Seçenek adı 1-40 karakter olmalı ve tekrar etmemeli.');
    if (!Number.isFinite(price) || price < 0 || price > 100000) fail('Seçenek fiyatı geçersiz: ' + name);
    seen.add(name.toLocaleLowerCase('tr-TR'));
    const ingredient = o.ingredient_id == null || o.ingredient_id === '' ? null : Number(o.ingredient_id), qty = ingredient ? Number(o.ingredient_qty) : null;
    if (ingredient !== null && (!Number.isSafeInteger(ingredient) || ingredient < 1 || ingredient === id || !Number.isFinite(qty) || qty <= 0 || qty > 100000)) fail('Seçenek malzemesi geçersiz: ' + name);
    return { name, price: round(price), ingredient_id: ingredient, ingredient_qty: qty };
  });
  return db.transaction(async tx => {
    if (!(await tx.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0]) fail('Ürün bulunamadı.', 404);
    for (const o of clean.filter(x => x.ingredient_id)) if (!(await tx.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [o.ingredient_id, user.tenantId])).rows[0]) fail('Malzeme bulunamadı: ' + o.ingredient_id, 404);
    await tx.query('DELETE FROM restaurant_menu_options WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id]);
    for (const [position, o] of clean.entries()) await tx.query('INSERT INTO restaurant_menu_options (tenant_id,product_id,position,name,price,ingredient_id,ingredient_qty) VALUES ($1,$2,$3,$4,$5,$6,$7)', [user.tenantId, id, position, o.name, o.price, o.ingredient_id, o.ingredient_qty]);
    return { product_id: id, options: clean };
  });
}
// Siparişte seçilen seçenekler adla gelir; yalnız tanımlı olanlar kabul edilir, fiyat sunucudan alınır.
async function pickOptions(tx, user, productId, names) {
  if (names == null) return [];
  if (!Array.isArray(names) || names.length > 10) fail('Bir kalemde en çok 10 seçenek seçilir.');
  const defined = (await tx.query('SELECT name,price,ingredient_id,ingredient_qty FROM restaurant_menu_options WHERE tenant_id=$1 AND product_id=$2 ORDER BY position', [user.tenantId, productId])).rows
    .map(o => ({ name: o.name, price: round(o.price), ingredient_id: o.ingredient_id == null ? null : Number(o.ingredient_id), ingredient_qty: o.ingredient_qty == null ? null : Number(o.ingredient_qty) }));
  const picked = [...new Set(names.map(n => String(n ?? '').trim()))].filter(Boolean);
  return picked.map(n => { const o = defined.find(d => d.name === n); if (!o) fail('Bu üründe böyle bir seçenek yok: ' + n); return o; });
}

async function setMenu(user, productId, body = {}) {
  const id = Number(productId);
  return db.transaction(async tx => {
    if (!(await tx.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0]) fail('Ürün bulunamadı.', 404);
    await tx.query("DELETE FROM product_attributes WHERE tenant_id=$1 AND product_id=$2 AND attr_key='menu'", [user.tenantId, id]);
    if (body.menu !== false) await tx.query("INSERT INTO product_attributes (tenant_id,product_id,attr_key,attr_value) VALUES ($1,$2,'menu','1')", [user.tenantId, id]);
    return { product_id: id, menu: body.menu !== false };
  });
}

// ---------- Reçete ----------
async function recipes(user) {
  const rows = (await db.query('SELECT r.product_id,r.ingredient_id,r.quantity,p.name AS product_name,i.name AS ingredient_name,i.unit FROM product_recipes r JOIN products p ON p.id=r.product_id AND p.tenant_id=r.tenant_id JOIN products i ON i.id=r.ingredient_id AND i.tenant_id=r.tenant_id WHERE r.tenant_id=$1 ORDER BY p.name,i.name', [user.tenantId])).rows;
  const map = new Map();
  for (const r of rows) { const e = map.get(Number(r.product_id)) || { product_id: Number(r.product_id), name: r.product_name, ingredients: [] }; e.ingredients.push({ ingredient_id: Number(r.ingredient_id), name: r.ingredient_name, unit: r.unit, quantity: Number(r.quantity) }); map.set(Number(r.product_id), e); }
  return { items: [...map.values()] };
}

async function setRecipe(user, productId, body = {}) {
  const id = Number(productId), list = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (!Number.isSafeInteger(id) || id < 1) fail('Ürün geçersiz.');
  if (list.length > 30) fail('Bir reçetede en çok 30 malzeme olur.');
  const seen = new Set(), clean = list.map(x => { const iid = Number(x?.ingredient_id), q = Number(x?.quantity); if (!Number.isSafeInteger(iid) || iid < 1 || iid === id || seen.has(iid) || !Number.isFinite(q) || q <= 0 || q > 100000) fail('Reçete satırı geçersiz.'); seen.add(iid); return { iid, q }; });
  return db.transaction(async tx => {
    if (!(await tx.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0]) fail('Ürün bulunamadı.', 404);
    for (const c of clean) if (!(await tx.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [c.iid, user.tenantId])).rows[0]) fail('Malzeme bulunamadı: ' + c.iid, 404);
    await tx.query('DELETE FROM product_recipes WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id]);
    for (const c of clean) await tx.query('INSERT INTO product_recipes (tenant_id,product_id,ingredient_id,quantity) VALUES ($1,$2,$3,$4)', [user.tenantId, id, c.iid, c.q]);
    return { product_id: id, ingredients: clean.length };
  });
}

// ---------- Stok ----------
// Sipariş girildiği anda stoktan düşer. Eldeki miktardan fazlası düşülmez (stok eksiye inmez); eksik "shortfall" olarak döner.
async function exitStock(tx, user, warehouse, productId, quantity, orderId) {
  const rows = (await tx.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 ORDER BY id' + lock(), [user.tenantId, warehouse, productId])).rows;
  if (!rows.length) return 0; // stok takibi yapılmayan ürün (hizmet, hazır yemek vb.)
  let remaining = round(quantity, 6), taken = 0;
  for (const row of rows) {
    const take = Math.min(Math.max(Number(row.quantity), 0), remaining);
    if (take <= 0) continue;
    await tx.query('UPDATE stock_records SET quantity=ROUND(quantity-$1,6),updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [take, row.id, user.tenantId]);
    taken = round(taken + take, 6); remaining = round(remaining - take, 6);
    if (remaining <= 0) break;
  }
  if (taken > 0) {
    await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'sale','restaurant',$5)", [user.tenantId, productId, warehouse, -taken, 'Sipariş #' + orderId]);
    await require('./inventoryTransactionService').recordProjectedEntry(tx, { tenant_id: user.tenantId, warehouse_id: warehouse, product_id: productId, transaction_type: 'SHIP', quantity: -taken, reference_type: 'restaurant_order', reference_id: orderId, user_id: user.userId });
  }
  return round(quantity - taken, 6);
}

async function returnStock(tx, user, warehouse, productId, quantity, orderId) {
  const row = (await tx.query('SELECT id FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 ORDER BY id LIMIT 1', [user.tenantId, warehouse, productId])).rows[0];
  if (!row) return;
  await tx.query('UPDATE stock_records SET quantity=ROUND(quantity+$1,6),updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [quantity, row.id, user.tenantId]);
  await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'return','restaurant',$5)", [user.tenantId, productId, warehouse, quantity, 'Sipariş #' + orderId + ' iptal']);
  await require('./inventoryTransactionService').recordProjectedEntry(tx, { tenant_id: user.tenantId, warehouse_id: warehouse, product_id: productId, transaction_type: 'RECEIVE', quantity, reference_type: 'restaurant_order', reference_id: orderId, user_id: user.userId });
}

// Reçete çok katlı olabilir (pide -> hamur -> un/maya). Alt reçetesi olan malzeme açılır; en çok 4 kat, döngü reddedilir.
async function consumption(tx, user, productId, quantity, depth = 0, path = new Set()) {
  if (depth > 4 || path.has(productId)) fail('Reçete döngüsü veya çok derin reçete: ürün ' + productId + '.', 409);
  const recipe = (await tx.query('SELECT ingredient_id,quantity FROM product_recipes WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, productId])).rows;
  if (!recipe.length) return [{ product_id: productId, quantity }];
  const next = new Set(path).add(productId), out = [];
  for (const r of recipe) for (const c of await consumption(tx, user, Number(r.ingredient_id), round(Number(r.quantity) * quantity, 6), depth + 1, next)) out.push(c);
  return out;
}

// Adisyon toplamı: kalem (adet x (birim + seçenekler)) - ikram kalemler - indirim + servis ücreti. İptal kalemler sayılmaz.
async function totals(tx, user, orderId) {
  const items = (await tx.query("SELECT id,quantity,unit_price FROM restaurant_order_items WHERE tenant_id=$1 AND order_id=$2 AND status<>'cancelled'", [user.tenantId, orderId])).rows;
  const opts = (await tx.query('SELECT item_id,price FROM restaurant_item_options WHERE tenant_id=$1 AND order_id=$2', [user.tenantId, orderId])).rows;
  const adj = (await tx.query('SELECT id,item_id,kind,percent,amount FROM restaurant_order_adjustments WHERE tenant_id=$1 AND order_id=$2 ORDER BY id', [user.tenantId, orderId])).rows;
  const line = new Map(items.map(i => [Number(i.id), round(Number(i.quantity) * (Number(i.unit_price) + opts.filter(o => Number(o.item_id) === Number(i.id)).reduce((t, o) => t + Number(o.price), 0)))]));
  const gross = round([...line.values()].reduce((t, v) => t + v, 0));
  const comp = round(adj.filter(a => a.kind === 'comp' && line.has(Number(a.item_id))).reduce((t, a) => t + line.get(Number(a.item_id)), 0));
  const base = round(gross - comp);
  let discount = 0;
  for (const a of adj.filter(x => x.kind === 'discount')) discount += a.percent != null ? round((base - discount) * Number(a.percent) / 100) : Number(a.amount);
  discount = round(Math.min(discount, base));
  const service = round(adj.filter(a => a.kind === 'service').reduce((t, a) => t + (base - discount) * Number(a.percent) / 100, 0));
  return { gross, comp, discount, service, total: round(base - discount + service), lines: line };
}

async function recalc(tx, user, orderId) {
  const t = await totals(tx, user, orderId);
  await tx.query('UPDATE restaurant_orders SET total_amount=$1 WHERE id=$2 AND tenant_id=$3', [t.total, orderId, user.tenantId]);
  return t.total;
}

// ---------- Sipariş ----------
async function createOrder(user, body = {}) {
  const result = await createOrderTx(user, body);
  notifyOrder(user, body, result);
  return result;
}

// Esnafın telefonuna "sipariş geldi" (en iyi çaba; hata siparişi bozmaz).
async function notifyOrder(user, body, result) {
  try {
    const table = body.table_id ? (await db.query('SELECT name FROM restaurant_tables WHERE id=$1 AND tenant_id=$2', [Number(body.table_id), user.tenantId])).rows[0] : null;
    await require('./pushNotifier').orderCreated(user, { ...result, type: body.order_type }, table && table.name);
  } catch { /* bildirim gitmedi */ }
}

async function createOrderTx(user, body = {}) {
  const type = TYPES.includes(body.order_type) ? body.order_type : 'masa';
  const lines = Array.isArray(body.items) ? body.items : [];
  if (!lines.length || lines.length > 40) fail('Siparişte 1-40 kalem olmalı.');
  const clean = lines.map(l => { const pid = Number(l?.product_id), q = Number(l?.quantity ?? 1); if (!Number.isSafeInteger(pid) || pid < 1) fail('Ürün geçersiz.'); if (!Number.isFinite(q) || q <= 0 || q > 100) fail('Adet 0 ile 100 arasında olmalı.'); return { pid, q: round(q, 3), note: typeof l.note === 'string' ? l.note.trim().slice(0, 120) : null }; });
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;
  const scope = allowedWarehouses(user);
  return db.transaction(async tx => {
    let warehouse = Number(body.warehouse_id) || 0;
    if (!warehouse) warehouse = Number((await tx.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [user.tenantId])).rows[0]?.id || 0);
    if (!warehouse || !(await tx.query('SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2', [warehouse, user.tenantId])).rows[0]) fail('Mağaza/depo bulunamadı.', 404);
    if (scope && !scope.has(warehouse)) fail('Bu mağaza için yetkiniz yok.', 403);
    let tableId = null, order = null;
    if (type === 'masa') {
      tableId = Number(body.table_id);
      const table = Number.isSafeInteger(tableId) ? (await tx.query('SELECT id,name,active FROM restaurant_tables WHERE id=$1 AND tenant_id=$2', [tableId, user.tenantId])).rows[0] : null;
      if (!table || Number(table.active) !== 1) fail('Masa bulunamadı.', 404);
      order = (await tx.query("SELECT id FROM restaurant_orders WHERE tenant_id=$1 AND table_id=$2 AND status='open' ORDER BY id DESC LIMIT 1", [user.tenantId, tableId])).rows[0];
    }
    let orderId;
    if (order) orderId = Number(order.id);
    else orderId = Number((await tx.query('INSERT INTO restaurant_orders (tenant_id,table_id,order_type,status,warehouse_id,waiter_user_id,note,business_day) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [user.tenantId, tableId, type, 'open', warehouse, user.userId, note, businessDay()])).rows[0].id);
    const wh = Number((await tx.query('SELECT warehouse_id FROM restaurant_orders WHERE id=$1 AND tenant_id=$2', [orderId, user.tenantId])).rows[0].warehouse_id);
    const shortages = [], created = [];
    for (const [index, l] of clean.entries()) {
      const p = (await tx.query("SELECT id,name,sale_price FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [l.pid, user.tenantId])).rows[0];
      if (!p) fail('Ürün bulunamadı: ' + l.pid, 404);
      const itemId = Number((await tx.query('INSERT INTO restaurant_order_items (tenant_id,order_id,product_id,product_name,quantity,unit_price,note,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [user.tenantId, orderId, l.pid, p.name, l.q, round(p.sale_price), l.note, 'new'])).rows[0].id);
      const chosen = await pickOptions(tx, user, l.pid, lines[index] && lines[index].options);
      for (const o of chosen) await tx.query('INSERT INTO restaurant_item_options (tenant_id,order_id,item_id,name,price,ingredient_id,ingredient_qty) VALUES ($1,$2,$3,$4,$5,$6,$7)', [user.tenantId, orderId, itemId, o.name, o.price, o.ingredient_id, o.ingredient_qty]);
      const missing = [];
      for (const o of chosen.filter(x => x.ingredient_id)) {
        const short = await exitStock(tx, user, wh, o.ingredient_id, round(o.ingredient_qty * l.q, 6), orderId);
        if (short > 0) { const n = (await tx.query('SELECT name FROM products WHERE id=$1 AND tenant_id=$2', [o.ingredient_id, user.tenantId])).rows[0]?.name || String(o.ingredient_id); missing.push({ product_id: o.ingredient_id, name: n, missing: short }); }
      }
      for (const c of await consumption(tx, user, l.pid, l.q)) {
        const short = await exitStock(tx, user, wh, c.product_id, c.quantity, orderId);
        if (short > 0) { const n = (await tx.query('SELECT name FROM products WHERE id=$1 AND tenant_id=$2', [c.product_id, user.tenantId])).rows[0]?.name || String(c.product_id); missing.push({ product_id: c.product_id, name: n, missing: short }); }
      }
      if (missing.length) { await tx.query('UPDATE restaurant_order_items SET shortfall=$1 WHERE id=$2 AND tenant_id=$3', [JSON.stringify(missing), itemId, user.tenantId]); shortages.push({ item_id: itemId, product: p.name, missing }); }
      created.push({ id: itemId, product_id: l.pid, name: p.name, quantity: l.q });
    }
    const total = await recalc(tx, user, orderId);
    return { order_id: orderId, total, items: created, shortages, appended: Boolean(order) };
  });
}

async function loadOrders(user, where, params) {
  const orders = (await db.query(`SELECT o.id,o.table_id,t.name AS table_name,o.order_type,o.status,o.total_amount,o.note,o.payment_method,o.created_at,o.closed_at FROM restaurant_orders o LEFT JOIN restaurant_tables t ON t.id=o.table_id AND t.tenant_id=o.tenant_id WHERE o.tenant_id=$1 ${where} ORDER BY o.id DESC LIMIT 200`, [user.tenantId, ...params])).rows;
  if (!orders.length) return [];
  const ids = orders.map(o => Number(o.id));
  const items = (await db.query(`SELECT id,order_id,product_id,product_name,quantity,unit_price,note,status,shortfall,created_at FROM restaurant_order_items WHERE tenant_id=$1 AND order_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')}) ORDER BY id`, [user.tenantId, ...ids])).rows;
  const options = (await db.query(`SELECT item_id,name,price FROM restaurant_item_options WHERE tenant_id=$1 AND order_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')}) ORDER BY id`, [user.tenantId, ...ids])).rows;
  const adjustments = (await db.query(`SELECT id,order_id,item_id,kind,percent,amount,reason FROM restaurant_order_adjustments WHERE tenant_id=$1 AND order_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')}) ORDER BY id`, [user.tenantId, ...ids])).rows;
  const deliveries = (await db.query(`SELECT order_id,customer_name,phone,address,note,courier,status FROM restaurant_deliveries WHERE tenant_id=$1 AND order_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [user.tenantId, ...ids])).rows;
  const optionsOf = id => options.filter(x => Number(x.item_id) === id).map(x => ({ name: x.name, price: round(x.price) }));
  const extra = o => {
    const own = adjustments.filter(a => Number(a.order_id) === Number(o.id));
    const d = deliveries.find(x => Number(x.order_id) === Number(o.id));
    return { adjustments: own.map(a => ({ id: Number(a.id), item_id: a.item_id == null ? null : Number(a.item_id), kind: a.kind, percent: a.percent == null ? null : Number(a.percent), amount: a.amount == null ? null : round(a.amount), reason: a.reason })),
      delivery: d ? { customer_name: d.customer_name, phone: d.phone, address: d.address, note: d.note, courier: d.courier, status: d.status } : null,
      comped: own.filter(a => a.kind === 'comp').map(a => Number(a.item_id)) };
  };
  return orders.map(o => ({ id: Number(o.id), table_id: o.table_id == null ? null : Number(o.table_id), table: o.table_name || null, type: o.order_type, status: o.status, total: round(o.total_amount), note: o.note, payment_method: o.payment_method, created_at: o.created_at,
    items: items.filter(i => Number(i.order_id) === Number(o.id)).map(i => ({ id: Number(i.id), product_id: Number(i.product_id), name: i.product_name, quantity: Number(i.quantity), price: round(i.unit_price), note: i.note, status: i.status, shortfall: i.shortfall ? JSON.parse(i.shortfall) : null, options: optionsOf(Number(i.id)) })), ...extra(o) }));
}

// status=kitchen: hazırlanacak kalemi olan açık siparişler (mutfak ekranı); open: tüm açık; today: bugünkü tüm siparişler.
async function orders(user, query = {}) {
  const view = query.status;
  if (view === 'kitchen') {
    const list = await loadOrders(user, "AND o.status='open'", []);
    return { items: list.map(o => ({ ...o, items: o.items.filter(i => ['new', 'preparing'].includes(i.status)) })).filter(o => o.items.length).sort((a, b) => a.id - b.id) };
  }
  if (view === 'today') return { items: await loadOrders(user, 'AND o.business_day=$2', [businessDay()]) };
  return { items: await loadOrders(user, "AND o.status='open'", []) };
}

async function setItemStatus(user, orderId, itemId, body = {}) {
  const status = body.status;
  if (!ITEM_STATUSES.includes(status)) fail('Durum geçersiz.');
  return db.transaction(async tx => {
    const order = (await tx.query('SELECT id,status,warehouse_id FROM restaurant_orders WHERE id=$1 AND tenant_id=$2', [Number(orderId), user.tenantId])).rows[0];
    if (!order) fail('Sipariş bulunamadı.', 404);
    const item = (await tx.query('SELECT id,product_id,quantity,status FROM restaurant_order_items WHERE id=$1 AND order_id=$2 AND tenant_id=$3', [Number(itemId), Number(orderId), user.tenantId])).rows[0];
    if (!item) fail('Kalem bulunamadı.', 404);
    if (item.status === 'cancelled') fail('İptal edilmiş kalem değişmez.', 409);
    if (status === 'cancelled') {
      if (!['new', 'preparing'].includes(item.status)) fail('Hazırlanmış kalem iptal edilemez.', 409);
      for (const c of await consumption(tx, user, Number(item.product_id), Number(item.quantity))) await returnStock(tx, user, Number(order.warehouse_id), c.product_id, c.quantity, Number(orderId));
      for (const o of (await tx.query('SELECT ingredient_id,ingredient_qty FROM restaurant_item_options WHERE tenant_id=$1 AND item_id=$2 AND ingredient_id IS NOT NULL', [user.tenantId, Number(itemId)])).rows) await returnStock(tx, user, Number(order.warehouse_id), Number(o.ingredient_id), round(Number(o.ingredient_qty) * Number(item.quantity), 6), Number(orderId));
      await tx.query("DELETE FROM restaurant_order_adjustments WHERE tenant_id=$1 AND order_id=$2 AND item_id=$3 AND kind='comp'", [user.tenantId, Number(orderId), Number(itemId)]);
    }
    await tx.query('UPDATE restaurant_order_items SET status=$1' + (status === 'ready' ? ',ready_at=CURRENT_TIMESTAMP' : '') + ' WHERE id=$2 AND tenant_id=$3', [status, Number(itemId), user.tenantId]);
    if (status === 'cancelled') await recalc(tx, user, Number(orderId));
    return { order_id: Number(orderId), item_id: Number(itemId), status };
  });
}

// Adisyon kapanışı: nakit ve kart ayrı yazılır. Nakit, ödemeyi alan kasiyerin (yoksa mağazadaki) AÇIK VARDİYASINA "para girişi"
// olarak işlenir; böylece vardiya kapanışındaki beklenen nakit restoran tahsilatını da içerir. Açık vardiya yoksa adisyon yine kapanır,
// ama nakit sayıma eklenmediği uyarı olarak döner. Stok zaten sipariş anında düşmüştür; perakende satışı oluşturulmaz (çifte düşüm olmaz).
async function closeOrder(user, orderId, body = {}) {
  return db.transaction(tx => closeOrderTx(tx, user, orderId, body));
}
async function closeOrderTx(tx, user, orderId, body = {}) {
  {
    const order = (await tx.query('SELECT id,status,warehouse_id FROM restaurant_orders WHERE id=$1 AND tenant_id=$2', [Number(orderId), user.tenantId])).rows[0];
    if (!order) fail('Sipariş bulunamadı.', 404);
    if (order.status !== 'open') fail('Sipariş zaten kapatılmış.', 409);
    const total = await recalc(tx, user, Number(orderId)), totalCents = Math.round(total * 100);
    let cashCents, cardCents, method;
    if (body.payments && typeof body.payments === 'object') {
      cashCents = Math.round(Number(body.payments.cash || 0) * 100); cardCents = Math.round(Number(body.payments.card || 0) * 100);
      if (!Number.isFinite(cashCents) || !Number.isFinite(cardCents) || cashCents < 0 || cardCents < 0) fail('Ödeme tutarı geçersiz.');
      if (cashCents + cardCents !== totalCents) fail('Nakit ve kart toplamı adisyon tutarına (' + total.toFixed(2) + ') eşit olmalı.');
      method = cashCents && cardCents ? 'split' : cardCents ? 'card' : 'cash';
    } else {
      method = ['cash', 'card', 'other'].includes(body.payment_method) ? body.payment_method : 'cash';
      cashCents = method === 'cash' || method === 'other' ? totalCents : 0; cardCents = method === 'card' ? totalCents : 0;
    }
    const warehouse = Number(order.warehouse_id);
    const shift = cashCents > 0 || cardCents > 0
      ? ((await tx.query("SELECT id,register_id FROM retail_shifts WHERE tenant_id=$1 AND warehouse_id=$2 AND status='open' AND user_id=$3 ORDER BY id DESC LIMIT 1", [user.tenantId, warehouse, user.userId])).rows[0]
        || (await tx.query("SELECT id,register_id FROM retail_shifts WHERE tenant_id=$1 AND warehouse_id=$2 AND status='open' ORDER BY id LIMIT 1", [user.tenantId, warehouse])).rows[0])
      : null;
    let warning = null;
    if (cashCents > 0) {
      if (shift) await tx.query("INSERT INTO retail_cash_movements (id,tenant_id,shift_id,user_id,user_email,direction,amount_cents,reason) VALUES ($1,$2,$3,$4,$5,'in',$6,$7)", [crypto.randomUUID(), user.tenantId, Number(shift.id), user.userId, user.email || 'restoran', cashCents, 'Restoran adisyon #' + Number(orderId) + ' (nakit)']);
      else warning = 'Açık vardiya yok: nakit tahsilat vardiya sayımına eklenmedi.';
    }
    await tx.query("UPDATE restaurant_orders SET status='closed',payment_method=$1,cash_cents=$2,card_cents=$3,shift_id=$4,register_id=$5,closed_at=CURRENT_TIMESTAMP WHERE id=$6 AND tenant_id=$7", [method, cashCents, cardCents, shift ? Number(shift.id) : null, shift ? Number(shift.register_id) : null, Number(orderId), user.tenantId]);
    return { order_id: Number(orderId), total, payment_method: method, cash: cashCents / 100, card: cardCents / 100, shift_id: shift ? Number(shift.id) : null, warning };
  }
}

// Gün raporuna eklenen restoran toplamı (perakende toplamlarına karışmaz).
async function dayTotals(tx, tenantId, warehouse, date) {
  try {
    const r = (await tx.query("SELECT COUNT(*) AS n,COALESCE(SUM(total_amount),0) AS total,COALESCE(SUM(cash_cents),0) AS cash,COALESCE(SUM(card_cents),0) AS card FROM restaurant_orders WHERE tenant_id=$1 AND warehouse_id=$2 AND business_day=$3 AND status='closed'", [tenantId, warehouse, date])).rows[0];
    return Number(r.n) ? { orders: Number(r.n), total_cents: Math.round(Number(r.total) * 100), cash_cents: Number(r.cash), card_cents: Number(r.card) } : null;
  } catch { return null; }
}

// Esnafın telefonu: yeni siparişleri sorgular ("sipariş geldi"). after_id=0 ise yalnız son numarayı verir.
async function feed(user, query = {}) {
  const after = Math.max(0, parseInt(query.after_id, 10) || 0);
  const latest = Number((await db.query('SELECT COALESCE(MAX(id),0) AS m FROM restaurant_orders WHERE tenant_id=$1', [user.tenantId])).rows[0].m);
  if (!after) return { latest_id: latest, items: [] };
  const list = await loadOrders(user, 'AND o.id>$2', [after]);
  return { latest_id: Math.max(latest, after), items: list.reverse().map(o => ({ order_id: o.id, table: o.table, type: o.type, total: o.total, text: o.items.map(i => i.quantity + '× ' + i.name).join(', '), at: o.created_at })) };
}

// Gün sonu: kaç pide, kaç motor, ciro. İptal kalemler sayılmaz; ikram kalem adette görünür, ciroya girmez.
// Ürün satırları indirim ve servis öncesi tutardır; günün toplam cirosu adisyon toplamlarından gelir.
async function summary(user, query = {}) {
  const day = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : businessDay();
  const products = (await db.query(`SELECT i.product_id,i.product_name,SUM(i.quantity) AS qty,SUM(CASE WHEN EXISTS (SELECT 1 FROM restaurant_order_adjustments a WHERE a.tenant_id=i.tenant_id AND a.item_id=i.id AND a.kind='comp') THEN 0 ELSE i.quantity*(i.unit_price+COALESCE((SELECT SUM(x.price) FROM restaurant_item_options x WHERE x.tenant_id=i.tenant_id AND x.item_id=i.id),0)) END) AS revenue FROM restaurant_order_items i JOIN restaurant_orders o ON o.id=i.order_id AND o.tenant_id=i.tenant_id WHERE i.tenant_id=$1 AND o.business_day=$2 AND i.status<>'cancelled' AND o.status<>'cancelled' GROUP BY i.product_id,i.product_name ORDER BY qty DESC`, [user.tenantId, day])).rows;
  const byType = (await db.query("SELECT order_type,COUNT(*) AS n,SUM(total_amount) AS revenue FROM restaurant_orders WHERE tenant_id=$1 AND business_day=$2 AND status<>'cancelled' GROUP BY order_type", [user.tenantId, day])).rows;
  const open = Number((await db.query("SELECT COUNT(*) AS n FROM restaurant_orders WHERE tenant_id=$1 AND business_day=$2 AND status='open'", [user.tenantId, day])).rows[0].n);
  const orders = byType.reduce((s, r) => s + Number(r.n), 0), revenue = byType.reduce((s, r) => s + Number(r.revenue || 0), 0);
  return { date: day, orders, open_orders: open, revenue: round(revenue),
    by_type: TYPES.map(t => { const r = byType.find(x => x.order_type === t); return { type: t, orders: r ? Number(r.n) : 0, revenue: r ? round(r.revenue) : 0 }; }),
    products: products.map(p => ({ product_id: Number(p.product_id), name: p.product_name, quantity: round(p.qty, 3), revenue: round(p.revenue) })) };
}


// ---------- Masa işlemleri ----------
async function openOrder(tx, user, orderId) {
  const o = (await tx.query('SELECT id,status,table_id,warehouse_id,order_type,business_day FROM restaurant_orders WHERE id=$1 AND tenant_id=$2' + lock(), [Number(orderId), user.tenantId])).rows[0];
  if (!o) fail('Sipariş bulunamadı.', 404);
  if (o.status !== 'open') fail('Sipariş kapanmış.', 409);
  const scope = allowedWarehouses(user);
  if (scope && !scope.has(Number(o.warehouse_id))) fail('Bu mağaza için yetkiniz yok.', 403);
  return o;
}
async function activeTable(tx, user, tableId) {
  const t = Number.isSafeInteger(Number(tableId)) ? (await tx.query('SELECT id,name,active FROM restaurant_tables WHERE id=$1 AND tenant_id=$2', [Number(tableId), user.tenantId])).rows[0] : null;
  if (!t || Number(t.active) !== 1) fail('Masa bulunamadı.', 404);
  return t;
}
const openOn = async (tx, user, tableId) => (await tx.query("SELECT id FROM restaurant_orders WHERE tenant_id=$1 AND table_id=$2 AND status='open' LIMIT 1", [user.tenantId, Number(tableId)])).rows[0];

// Masa taşıma: adisyon boş masaya geçer. Dolu masaya taşımak için birleştirme kullanılır.
async function moveOrder(user, orderId, body = {}) {
  return db.transaction(async tx => {
    const o = await openOrder(tx, user, orderId);
    if (o.order_type !== 'masa') fail('Yalnız masa siparişi taşınır.');
    const t = await activeTable(tx, user, body.table_id);
    if (Number(o.table_id) === Number(t.id)) fail('Sipariş zaten bu masada.');
    if (await openOn(tx, user, t.id)) fail(t.name + ' dolu. Hesapları birleştirmek için "Masa birleştir" kullanın.', 409);
    await tx.query('UPDATE restaurant_orders SET table_id=$1 WHERE id=$2 AND tenant_id=$3', [Number(t.id), Number(o.id), user.tenantId]);
    return { order_id: Number(o.id), table_id: Number(t.id), table: t.name };
  });
}

// Masa birleştirme: kaynak adisyonun kalemleri, seçenekleri ve ikramları hedefe geçer; kaynak kapanmadan silinir (iptal olarak kalır).
async function mergeOrders(user, sourceId, body = {}) {
  return db.transaction(async tx => {
    const src = await openOrder(tx, user, sourceId), dst = await openOrder(tx, user, body.target_order_id);
    if (Number(src.id) === Number(dst.id)) fail('Aynı adisyon birleştirilemez.');
    if (Number(src.warehouse_id) !== Number(dst.warehouse_id)) fail('Farklı mağazaların adisyonu birleştirilemez.');
    if ((await tx.query("SELECT id FROM restaurant_order_adjustments WHERE tenant_id=$1 AND order_id=$2 AND kind<>'comp' LIMIT 1", [user.tenantId, Number(src.id)])).rows[0]) fail('Taşınan adisyonda indirim veya servis ücreti var; önce kaldırın.', 409);
    for (const table of ['restaurant_order_items', 'restaurant_item_options', 'restaurant_order_adjustments']) await tx.query(`UPDATE ${table} SET order_id=$1 WHERE tenant_id=$2 AND order_id=$3`, [Number(dst.id), user.tenantId, Number(src.id)]);
    await tx.query("UPDATE restaurant_orders SET status='cancelled',total_amount=0,note=$1,closed_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3", ['Adisyon #' + Number(dst.id) + ' ile birleştirildi', Number(src.id), user.tenantId]);
    const total = await recalc(tx, user, Number(dst.id));
    return { order_id: Number(dst.id), merged_from: Number(src.id), total };
  });
}

// Hesap bölme: seçilen kalemler ayrı bir adisyona alınır ve hemen ödenir; kalanlar masada açık kalır.
async function payItems(user, orderId, body = {}) {
  const ids = Array.isArray(body.item_ids) ? [...new Set(body.item_ids.map(Number))] : [];
  if (!ids.length || ids.length > 40 || ids.some(i => !Number.isSafeInteger(i) || i < 1)) fail('Ödenecek kalemleri seçin.');
  return db.transaction(async tx => {
    const o = await openOrder(tx, user, orderId);
    if ((await tx.query("SELECT id FROM restaurant_order_adjustments WHERE tenant_id=$1 AND order_id=$2 AND kind<>'comp' LIMIT 1", [user.tenantId, Number(o.id)])).rows[0]) fail('Bu adisyonda indirim veya servis ücreti var; hesabı bölmeden önce kaldırın ya da tümünü birlikte kapatın.', 409);
    const items = (await tx.query("SELECT id FROM restaurant_order_items WHERE tenant_id=$1 AND order_id=$2 AND status<>'cancelled'", [user.tenantId, Number(o.id)])).rows.map(r => Number(r.id));
    if (ids.some(i => !items.includes(i))) fail('Seçilen kalem bu adisyonda yok veya iptal edilmiş.');
    if (ids.length === items.length) fail('Tüm kalemler seçildi; hesabı normal kapatın.');
    const split = Number((await tx.query('INSERT INTO restaurant_orders (tenant_id,table_id,order_type,status,warehouse_id,waiter_user_id,note,business_day) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [user.tenantId, o.table_id, o.order_type, 'open', Number(o.warehouse_id), user.userId, 'Adisyon #' + Number(o.id) + ' bölündü', o.business_day])).rows[0].id);
    const marks = ids.map((_, i) => '$' + (i + 4)).join(',');
    await tx.query(`UPDATE restaurant_order_items SET order_id=$1 WHERE tenant_id=$2 AND order_id=$3 AND id IN (${marks})`, [split, user.tenantId, Number(o.id), ...ids]);
    await tx.query(`UPDATE restaurant_item_options SET order_id=$1 WHERE tenant_id=$2 AND order_id=$3 AND item_id IN (${marks})`, [split, user.tenantId, Number(o.id), ...ids]);
    await tx.query(`UPDATE restaurant_order_adjustments SET order_id=$1 WHERE tenant_id=$2 AND order_id=$3 AND item_id IN (${marks})`, [split, user.tenantId, Number(o.id), ...ids]);
    await recalc(tx, user, Number(o.id));
    const paid = await closeOrderTx(tx, user, split, body);
    return { ...paid, split_from: Number(o.id), remaining_total: round((await tx.query('SELECT total_amount FROM restaurant_orders WHERE id=$1 AND tenant_id=$2', [Number(o.id), user.tenantId])).rows[0].total_amount) };
  });
}

// ---------- İkram, indirim, servis ücreti ----------
const ADJUST_KINDS = ['comp', 'discount', 'service'];
async function addAdjustment(user, orderId, body = {}) {
  const kind = body.kind;
  if (!ADJUST_KINDS.includes(kind)) fail('Düzeltme türü geçersiz.');
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : '';
  return db.transaction(async tx => {
    const o = await openOrder(tx, user, orderId);
    let item = null, percent = null, amount = null;
    if (kind === 'comp') {
      item = Number(body.item_id);
      const row = Number.isSafeInteger(item) ? (await tx.query("SELECT id FROM restaurant_order_items WHERE id=$1 AND order_id=$2 AND tenant_id=$3 AND status<>'cancelled'", [item, Number(o.id), user.tenantId])).rows[0] : null;
      if (!row) fail('İkram edilecek kalem bulunamadı.', 404);
      if ((await tx.query("SELECT id FROM restaurant_order_adjustments WHERE tenant_id=$1 AND order_id=$2 AND item_id=$3 AND kind='comp'", [user.tenantId, Number(o.id), item])).rows[0]) fail('Bu kalem zaten ikram.', 409);
      if (!reason) fail('İkram için kısa bir açıklama yazın.');
    } else if (kind === 'discount') {
      if (body.percent != null) { percent = Number(body.percent); if (!Number.isFinite(percent) || percent <= 0 || percent > 100) fail('İndirim yüzdesi 0-100 arasında olmalı.'); }
      else { amount = Number(body.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) fail('İndirim tutarı geçersiz.'); amount = round(amount); }
      if (!reason) fail('İndirim için kısa bir açıklama yazın.');
    } else {
      percent = Number(body.percent);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 30) fail('Servis ücreti yüzde 0-30 arasında olmalı.');
      if ((await tx.query("SELECT id FROM restaurant_order_adjustments WHERE tenant_id=$1 AND order_id=$2 AND kind='service'", [user.tenantId, Number(o.id)])).rows[0]) fail('Bu adisyonda zaten servis ücreti var.', 409);
    }
    const id = Number((await tx.query('INSERT INTO restaurant_order_adjustments (tenant_id,order_id,item_id,kind,percent,amount,reason,user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [user.tenantId, Number(o.id), item, kind, percent, amount, reason || null, user.userId])).rows[0].id);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'restaurant.' + kind, 'restaurant_order', Number(o.id), JSON.stringify({ item_id: item, percent, amount, reason })]);
    const t = await totals(tx, user, Number(o.id));
    await tx.query('UPDATE restaurant_orders SET total_amount=$1 WHERE id=$2 AND tenant_id=$3', [t.total, Number(o.id), user.tenantId]);
    return { id, order_id: Number(o.id), kind, gross: t.gross, comp: t.comp, discount: t.discount, service: t.service, total: t.total };
  });
}
async function removeAdjustment(user, orderId, adjustmentId) {
  return db.transaction(async tx => {
    const o = await openOrder(tx, user, orderId);
    const done = await tx.query('DELETE FROM restaurant_order_adjustments WHERE id=$1 AND order_id=$2 AND tenant_id=$3', [Number(adjustmentId), Number(o.id), user.tenantId]);
    if (done.rowCount !== 1) fail('Düzeltme bulunamadı.', 404);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'restaurant.adjustment_removed', 'restaurant_order', Number(o.id), JSON.stringify({ adjustment_id: Number(adjustmentId) })]);
    return { order_id: Number(o.id), total: await recalc(tx, user, Number(o.id)) };
  });
}

// ---------- Paket servis ----------
const DELIVERY_STATUSES = ['waiting', 'on_way', 'delivered'];
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/[\x00-\x1f<>]/g, '').slice(0, max) : null) || null;
async function setDelivery(user, orderId, body = {}) {
  return db.transaction(async tx => {
    const o = (await tx.query('SELECT id,order_type FROM restaurant_orders WHERE id=$1 AND tenant_id=$2', [Number(orderId), user.tenantId])).rows[0];
    if (!o) fail('Sipariş bulunamadı.', 404);
    if (!['paket', 'motor'].includes(o.order_type)) fail('Teslimat bilgisi yalnız paket ve motor siparişine yazılır.');
    const phone = text(body.phone, 20);
    if (phone && !/^[0-9 +()-]{7,20}$/.test(phone)) fail('Telefon numarası geçersiz.');
    const status = body.status == null ? 'waiting' : body.status;
    if (!DELIVERY_STATUSES.includes(status)) fail('Teslimat durumu geçersiz.');
    const row = { customer_name: text(body.customer_name, 80), phone, address: text(body.address, 300), note: text(body.note, 200), courier: text(body.courier, 60), status };
    if (o.order_type === 'motor' && !row.address) fail('Motorlu teslimat için adres gerekli.');
    await tx.query('DELETE FROM restaurant_deliveries WHERE tenant_id=$1 AND order_id=$2', [user.tenantId, Number(o.id)]);
    await tx.query('INSERT INTO restaurant_deliveries (order_id,tenant_id,customer_name,phone,address,note,courier,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [Number(o.id), user.tenantId, row.customer_name, row.phone, row.address, row.note, row.courier, row.status]);
    return { order_id: Number(o.id), ...row };
  });
}
// Bugünkü paket ve motor siparişleri, teslim edilmeyenler önce.
async function deliveries(user) {
  const list = await loadOrders(user, "AND o.business_day=$2 AND o.order_type IN ('paket','motor') AND o.status<>'cancelled'", [businessDay()]);
  const rank = o => (o.delivery ? DELIVERY_STATUSES.indexOf(o.delivery.status) : 0);
  return { items: list.sort((a, b) => rank(a) - rank(b) || a.id - b.id) };
}

module.exports = { setMenuOptions, moveOrder, mergeOrders, payItems, addAdjustment, removeAdjustment, setDelivery, deliveries, totals, dayTotals, tables, saveTable, menu, setMenu, recipes, setRecipe, createOrder, orders, setItemStatus, closeOrder, feed, summary, businessDay };
