// Online mağaza (ayrı paket: online_store): işletme ayarı, ürün yayını, herkese açık vitrin verisi ve sipariş.
// Ödeme: kapıda, havale/EFT, mağazadan teslim (online kart ödemesi yok). Stok kasayla aynı havuzdan düşer.
// Tasarım ve gerekçeler: docs/ONLINE-MAGAZA-PLANI.md
const crypto = require('crypto');
const db = require('../config/database');
const { ciLike } = require('./sqlSearch');
const extras = require('./onlineStoreExtras');

const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const lock = () => (db.getEngine() === 'mysql' ? ' FOR UPDATE' : '');
const round = (v, d = 2) => Math.round(Number(v) * 10 ** d) / 10 ** d;
const cents = v => Math.round(Number(v) * 100);
const fromCents = c => c / 100;
const allowedWarehouses = user => (user.accessScope && user.accessScope.mode !== 'company' ? new Set((user.accessScope.warehouse_ids || []).map(Number)) : null);

const RESERVED = new Set(['admin', 'api', 'giris', 'kayit', 'magaza', 'sepet', 'siparis', 'deneme', 'login', 'register', 'sektor', 'm', 'assets', 'static', 'public', 'health', 'veniux', 'destek', 'iletisim']);
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const STATUSES = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
// Geçerli durum geçişleri. Teslim edilmiş ve iptal edilmiş sipariş değişmez.
const NEXT = { new: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready', 'confirmed', 'cancelled'], ready: ['delivered', 'preparing', 'cancelled'], delivered: [], cancelled: [] };
const OPEN_STATUSES = ['new', 'confirmed', 'preparing', 'ready'];
// Faz 1: yalnız tam sayı adetle satılan ürünler. Tartılı/ölçülü birimler vitrinde gösterilmez.
const MEASURED_UNITS = new Set(['kg', 'kilo', 'kilogram', 'g', 'gr', 'gram', 'l', 'lt', 'litre', 'm', 'mt', 'metre', 'cm', 'm2', 'm3']);
const measured = unit => MEASURED_UNITS.has(String(unit || '').trim().toLowerCase().replace(/\./g, ''));
const LOW_STOCK = 5;

const text = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const longText = (value, max) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const flag = (value, fallback = 0) => (value === undefined || value === null ? fallback : (value === true || value === 1 || value === '1' || value === 'true') ? 1 : 0);
const money = (value, fallback = 0, max = 1000000) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) fail('Tutar geçersiz.');
  return round(n);
};
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
// 05xx xxx xx xx, +90 5xx..., 5xx...: tek biçime (05XXXXXXXXX) çevrilir.
function normalizePhone(value) {
  const digits = String(value || '').replace(/[^0-9+]/g, '').replace(/^\+90/, '0').replace(/^90(?=5\d{9}$)/, '0');
  const local = /^5\d{9}$/.test(digits) ? '0' + digits : digits;
  return /^05\d{9}$/.test(local) ? local : null;
}
const maskPhone = phone => (phone ? phone.slice(0, 4) + ' *** ** ' + phone.slice(-2) : '');
const audit = (tx, user, action, id, details) => tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email || null, action, 'online_store', Number.isSafeInteger(Number(id)) && id !== null && id !== '' ? Number(id) : null, JSON.stringify(details || {})]);

// ---------- Mağaza ayarı ----------
const storeRow = async (tenantId, runner = db) => (await runner.query('SELECT * FROM online_stores WHERE tenant_id=$1', [tenantId])).rows[0] || null;
function shapeStore(row) {
  if (!row) return null;
  return {
    slug: row.slug, name: row.name, tagline: row.tagline || '', about: row.about || '', contact_email: row.contact_email || '', public_phone: row.public_phone || '',
    cod_enabled: Boolean(Number(row.cod_enabled)), transfer_enabled: Boolean(Number(row.transfer_enabled)), pickup_enabled: Boolean(Number(row.pickup_enabled)),
    transfer_note: row.transfer_note || '', delivery_fee: round(row.delivery_fee), free_delivery_over: row.free_delivery_over == null ? null : round(row.free_delivery_over),
    min_order: round(row.min_order), warehouse_id: row.warehouse_id == null ? null : Number(row.warehouse_id),
    published: Boolean(Number(row.published)), accepting_orders: Boolean(Number(row.accepting_orders)), terms_text: row.terms_text || ''
  };
}
async function getSettings(user) {
  const row = await storeRow(user.tenantId);
  const warehouses = (await db.query("SELECT id,name FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id", [user.tenantId])).rows.map(w => ({ id: Number(w.id), name: w.name }));
  const scope = allowedWarehouses(user);
  return { store: shapeStore(row), warehouses: scope ? warehouses.filter(w => scope.has(w.id)) : warehouses };
}
async function slugAvailable(user, slug) {
  const value = String(slug || '').toLowerCase();
  if (!SLUG.test(value)) return { available: false, reason: 'Adres 3-40 karakter olmalı; yalnız küçük harf (a-z), rakam ve tire kullanılabilir, tireyle başlayıp bitemez.' };
  if (RESERVED.has(value)) return { available: false, reason: 'Bu ad ayrılmış, başka bir ad seçin.' };
  const row = (await db.query('SELECT tenant_id FROM online_stores WHERE slug=$1', [value])).rows[0];
  return row && Number(row.tenant_id) !== user.tenantId ? { available: false, reason: 'Bu adres başka bir mağazada kullanılıyor.' } : { available: true };
}
async function saveSettings(user, body = {}) {
  const current = await storeRow(user.tenantId);
  const slug = body.slug === undefined ? current && current.slug : String(body.slug || '').toLowerCase().trim();
  if (!slug) fail('Mağaza adresi (kısa ad) gerekli.');
  const check = await slugAvailable(user, slug);
  if (!check.available) fail(check.reason, 409, 'SLUG_TAKEN');
  const name = body.name === undefined ? current && current.name : text(body.name, 80);
  if (!name || name.length < 2) fail('Mağaza adı en az 2 karakter olmalı.');
  const email = body.contact_email === undefined ? (current && current.contact_email) || null : text(body.contact_email, 120) || null;
  if (email && !EMAIL.test(email)) fail('İletişim e-postası geçersiz.');
  const publicPhone = body.public_phone === undefined ? (current && current.public_phone) || null : (text(body.public_phone, 20) ? normalizePhone(body.public_phone) : null);
  if (body.public_phone && !publicPhone) fail('Sitede gösterilecek telefon geçersiz.');
  const pick = (key, fallback) => flag(body[key], current ? Number(current[key]) : fallback);
  const cod = pick('cod_enabled', 1), transfer = pick('transfer_enabled', 0), pickup = pick('pickup_enabled', 1);
  const deliveryFee = body.delivery_fee === undefined ? round(current ? current.delivery_fee : 0) : money(body.delivery_fee);
  const freeOver = body.free_delivery_over === undefined ? (current && current.free_delivery_over != null ? round(current.free_delivery_over) : null) : (body.free_delivery_over === null || body.free_delivery_over === '' ? null : money(body.free_delivery_over));
  const minOrder = body.min_order === undefined ? round(current ? current.min_order : 0) : money(body.min_order);
  const transferNote = body.transfer_note === undefined ? (current && current.transfer_note) || null : longText(body.transfer_note, 600) || null;
  if (transfer && !transferNote) fail('Havale/EFT açıksa IBAN ve açıklama yazın.');
  let warehouse = body.warehouse_id === undefined ? (current && current.warehouse_id != null ? Number(current.warehouse_id) : null) : (body.warehouse_id === null ? null : Number(body.warehouse_id));
  if (warehouse != null) {
    const ok = Number.isSafeInteger(warehouse) && (await db.query("SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2 AND warehouse_type='NORMAL'", [warehouse, user.tenantId])).rows[0];
    if (!ok) fail('Stok deposu bulunamadı.', 404);
    const scope = allowedWarehouses(user);
    if (scope && !scope.has(warehouse)) fail('Bu depo için yetkiniz yok.', 403);
  }
  const published = pick('published', 0);
  // Yayına yeni alınan mağaza sipariş almaya başlar; sonradan yönetici isterse yalnız siparişi durdurabilir.
  let accepting = body.accepting_orders !== undefined ? flag(body.accepting_orders) : (published && !(current && Number(current.published)) ? 1 : (current ? Number(current.accepting_orders) : 0));
  if (published) {
    if (!warehouse) fail('Yayınlamak için stok deposunu seçin.');
    if (!cod && !transfer && !pickup) fail('Yayınlamak için en az bir ödeme/teslimat seçeneği açın.');
    if (!(await db.query('SELECT 1 FROM online_product_settings WHERE tenant_id=$1 AND published=1 LIMIT 1', [user.tenantId])).rows[0]) fail('Yayınlamak için en az bir ürünü mağazada yayına alın.');
  } else accepting = 0;
  const tagline = body.tagline === undefined ? (current && current.tagline) || null : text(body.tagline, 140) || null;
  const about = body.about === undefined ? (current && current.about) || null : longText(body.about, 2000) || null;
  const terms = body.terms_text === undefined ? (current && current.terms_text) || null : longText(body.terms_text, 6000) || null;
  await db.transaction(async tx => {
    const params = [user.tenantId, slug, name, tagline, about, email, publicPhone, cod, transfer, pickup, transferNote, deliveryFee, freeOver, minOrder, warehouse, published, accepting, terms];
    if (current) await tx.query('UPDATE online_stores SET slug=$2,name=$3,tagline=$4,about=$5,contact_email=$6,public_phone=$7,cod_enabled=$8,transfer_enabled=$9,pickup_enabled=$10,transfer_note=$11,delivery_fee=$12,free_delivery_over=$13,min_order=$14,warehouse_id=$15,published=$16,accepting_orders=$17,terms_text=$18,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1', params);
    else await tx.query('INSERT INTO online_stores (tenant_id,slug,name,tagline,about,contact_email,public_phone,cod_enabled,transfer_enabled,pickup_enabled,transfer_note,delivery_fee,free_delivery_over,min_order,warehouse_id,published,accepting_orders,terms_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)', params);
    await audit(tx, user, 'online_store.settings', user.tenantId, { slug, published, accepting_orders: accepting });
  });
  return (await getSettings(user));
}

// ---------- Ürün yayını (yönetici) ----------
async function listProducts(user, query = {}) {
  const store = await storeRow(user.tenantId);
  const page = Math.max(0, Number.parseInt(query.page, 10) || 0), size = 50;
  const q = text(query.q, 80);
  const where = ["p.tenant_id=$1", "p.module_type='NORMAL'", 'p.sale_price>0'];
  const params = [user.tenantId];
  if (q) { params.push('%' + q + '%'); where.push('(' + ciLike('p.name', '$' + params.length) + ' OR ' + ciLike('p.sku', '$' + params.length) + ')'); }
  if (query.published === '1') where.push('s.published=1'); else if (query.published === '0') where.push('(s.published IS NULL OR s.published=0)');
  const sql = `FROM products p LEFT JOIN online_product_settings s ON s.tenant_id=p.tenant_id AND s.product_id=p.id WHERE ${where.join(' AND ')}`;
  const total = Number((await db.query('SELECT COUNT(*) AS n ' + sql, params)).rows[0].n);
  const rows = (await db.query(`SELECT p.id,p.name,p.sku,p.category,p.unit,p.sale_price,s.published,s.description,s.sort_order,s.max_per_order ${sql} ORDER BY p.name LIMIT ${size} OFFSET ${page * size}`, params)).rows;
  const ids = rows.map(r => Number(r.id));
  const stock = await stockMap(user.tenantId, store && store.warehouse_id != null ? Number(store.warehouse_id) : null, ids);
  const media = ids.length ? (await db.query(`SELECT product_id,COUNT(*) AS n FROM online_product_media WHERE tenant_id=$1 AND product_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')}) GROUP BY product_id`, [user.tenantId, ...ids])).rows : [];
  const mediaCount = new Map(media.map(m => [Number(m.product_id), Number(m.n)]));
  return {
    total, page, page_size: size,
    items: rows.map(r => ({
      id: Number(r.id), name: r.name, sku: r.sku, category: r.category || '', unit: r.unit, price: round(r.sale_price), published: Boolean(Number(r.published || 0)),
      description: r.description || '', sort_order: Number(r.sort_order || 0), max_per_order: r.max_per_order == null ? null : Number(r.max_per_order),
      stock: stock.has(Number(r.id)) ? stock.get(Number(r.id)) : null, images: mediaCount.get(Number(r.id)) || 0, measured_unit: measured(r.unit)
    }))
  };
}
async function setProduct(user, productId, body = {}) {
  const id = Number(productId);
  const product = Number.isSafeInteger(id) ? (await db.query("SELECT id,unit FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [id, user.tenantId])).rows[0] : null;
  if (!product) fail('Ürün bulunamadı.', 404);
  const published = flag(body.published, 0);
  if (published && measured(product.unit)) fail('Kiloyla, litreyle veya metreyle satılan ürünler şimdilik online mağazada yayınlanamaz.', 422, 'MEASURED_UNIT');
  const current = (await db.query('SELECT * FROM online_product_settings WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id])).rows[0];
  const description = body.description === undefined ? (current && current.description) || null : longText(body.description, 2000) || null;
  const sort = body.sort_order === undefined ? Number(current ? current.sort_order : 0) : Math.max(-1000, Math.min(1000, Math.trunc(Number(body.sort_order) || 0)));
  let maxPer = current && current.max_per_order != null ? Number(current.max_per_order) : null;
  if (body.max_per_order !== undefined) { maxPer = body.max_per_order === null || body.max_per_order === '' ? null : Number(body.max_per_order); if (maxPer !== null && (!Number.isSafeInteger(maxPer) || maxPer < 1 || maxPer > 1000)) fail('Sipariş başına üst sınır 1-1000 arası olmalı.'); }
  const publishedFinal = body.published === undefined ? Number(current ? current.published : 0) : published;
  await db.transaction(async tx => {
    if (current) await tx.query('UPDATE online_product_settings SET published=$3,description=$4,sort_order=$5,max_per_order=$6,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id, publishedFinal, description, sort, maxPer]);
    else await tx.query('INSERT INTO online_product_settings (tenant_id,product_id,published,description,sort_order,max_per_order) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, id, publishedFinal, description, sort, maxPer]);
  });
  return { id, published: Boolean(publishedFinal), description: description || '', sort_order: sort, max_per_order: maxPer };
}
async function bulkPublish(user, body = {}) {
  const ids = Array.isArray(body.product_ids) ? [...new Set(body.product_ids.map(Number))].filter(Number.isSafeInteger).slice(0, 500) : [];
  if (!ids.length) fail('En az bir ürün seçin.');
  const published = flag(body.published, 0);
  const rows = (await db.query(`SELECT id,unit FROM products WHERE tenant_id=$1 AND module_type='NORMAL' AND id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [user.tenantId, ...ids])).rows;
  let changed = 0; const skipped = [];
  await db.transaction(async tx => {
    for (const r of rows) {
      if (published && measured(r.unit)) { skipped.push(Number(r.id)); continue; }
      const have = (await tx.query('SELECT 1 FROM online_product_settings WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, Number(r.id)])).rows[0];
      if (have) await tx.query('UPDATE online_product_settings SET published=$3,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, Number(r.id), published]);
      else await tx.query('INSERT INTO online_product_settings (tenant_id,product_id,published) VALUES ($1,$2,$3)', [user.tenantId, Number(r.id), published]);
      changed++;
    }
    await audit(tx, user, 'online_store.bulk_publish', null, { count: changed, published: Boolean(published) });
  });
  return { changed, skipped_measured: skipped };
}

// ---------- Stok ----------
async function stockMap(tenantId, warehouse, ids, runner = db) {
  const out = new Map();
  if (!warehouse || !ids.length) return out;
  const rows = (await runner.query(`SELECT product_id,SUM(quantity) AS q FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id IN (${ids.map((_, i) => '$' + (i + 3)).join(',')}) GROUP BY product_id`, [tenantId, warehouse, ...ids])).rows;
  for (const r of rows) out.set(Number(r.product_id), Math.max(0, Math.floor(round(r.q, 6))));
  return out;
}
const stockState = q => (q === undefined || q === null || q <= 0 ? 'out' : q <= LOW_STOCK ? 'low' : 'ok');
async function takeStock(tx, tenantId, warehouse, productId, quantity, orderNo, orderId, userId) {
  const rows = (await tx.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 ORDER BY id' + lock(), [tenantId, warehouse, productId])).rows;
  const have = rows.reduce((s, r) => s + Math.max(Number(r.quantity), 0), 0);
  if (have + 1e-9 < quantity) return { ok: false, available: Math.max(0, Math.floor(have)) };
  let remaining = quantity;
  for (const row of rows) {
    const take = Math.min(Math.max(Number(row.quantity), 0), remaining);
    if (take <= 0) continue;
    await tx.query('UPDATE stock_records SET quantity=ROUND(quantity-$1,6),updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [take, row.id, tenantId]);
    remaining = round(remaining - take, 6);
    if (remaining <= 0) break;
  }
  await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'sale','online_store',$5)", [tenantId, productId, warehouse, -quantity, 'Online sipariş ' + orderNo]);
  await require('./inventoryTransactionService').recordProjectedEntry(tx, { tenant_id: tenantId, warehouse_id: warehouse, product_id: productId, transaction_type: 'SHIP', quantity: -quantity, reference_type: 'online_order', reference_id: orderId, user_id: userId || null });
  return { ok: true };
}
async function giveBackStock(tx, tenantId, warehouse, productId, quantity, orderNo, orderId, userId) {
  const row = (await tx.query('SELECT id FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 ORDER BY id LIMIT 1' + lock(), [tenantId, warehouse, productId])).rows[0];
  if (!row) return;
  await tx.query('UPDATE stock_records SET quantity=ROUND(quantity+$1,6),updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [quantity, row.id, tenantId]);
  await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'return','online_store',$5)", [tenantId, productId, warehouse, quantity, 'Online sipariş ' + orderNo + ' iptal']);
  await require('./inventoryTransactionService').recordProjectedEntry(tx, { tenant_id: tenantId, warehouse_id: warehouse, product_id: productId, transaction_type: 'RECEIVE', quantity, reference_type: 'online_order', reference_id: orderId, user_id: userId || null });
}

// ---------- Herkese açık: mağaza ve ürünler ----------
// Mağaza "yayında" ise ve işletmenin geçerli bir lisansı varsa açıktır. Hiç lisans kaydı olmayan yerel kurulumlarda lisans aranmaz.
async function tenantLicensed(tenantId) {
  const rows = (await db.query('SELECT status,expires_at FROM licenses WHERE tenant_id=$1', [tenantId])).rows;
  if (!rows.length) return true;
  const now = Date.now();
  return rows.some(r => String(r.status).toUpperCase() === 'ACTIVE' && (!r.expires_at || new Date(String(r.expires_at).replace(' ', 'T') + (String(r.expires_at).includes('Z') ? '' : 'Z')).getTime() > now));
}
async function openStore(slug) {
  const value = String(slug || '').toLowerCase();
  if (!SLUG.test(value)) return null;
  const row = (await db.query('SELECT * FROM online_stores WHERE slug=$1', [value])).rows[0];
  if (!row || !Number(row.published)) return null;
  if (!(await tenantLicensed(Number(row.tenant_id)))) return null;
  return row;
}
const notFound = () => fail('Mağaza bulunamadı.', 404, 'NO_STORE');
const imageUrl = (slug, key) => `/api/public/shop/${slug}/media/${key}`;
function shapePublicStore(row, extra = {}) {
  return {
    slug: row.slug, name: row.name, tagline: row.tagline || '', about: row.about || '', contact_email: row.contact_email || '', phone: row.public_phone || '',
    accepting_orders: Boolean(Number(row.accepting_orders)), payment: { cod: Boolean(Number(row.cod_enabled)), transfer: Boolean(Number(row.transfer_enabled)), transfer_note: Number(row.transfer_enabled) ? row.transfer_note || '' : '' },
    pickup: Boolean(Number(row.pickup_enabled)), delivery_fee: round(row.delivery_fee), free_delivery_over: row.free_delivery_over == null ? null : round(row.free_delivery_over), min_order: round(row.min_order),
    terms_text: row.terms_text || '', ...extra
  };
}
const publicWhere = (tenantId, query) => {
  const where = ["p.tenant_id=$1", "p.module_type='NORMAL'", 'p.sale_price>0', 's.published=1'];
  const params = [tenantId];
  const q = text(query.q, 60), category = text(query.category, 80);
  if (q) { params.push('%' + q + '%'); where.push('(' + ciLike('p.name', '$' + params.length) + ' OR ' + ciLike('p.category', '$' + params.length) + ')'); }
  if (category) { params.push(category); where.push('p.category=$' + params.length); }
  return { where: where.join(' AND '), params };
};
async function publicStore(slug) {
  const row = await openStore(slug) || notFound();
  const categories = (await db.query("SELECT p.category AS name,COUNT(*) AS n FROM products p JOIN online_product_settings s ON s.tenant_id=p.tenant_id AND s.product_id=p.id WHERE p.tenant_id=$1 AND p.module_type='NORMAL' AND p.sale_price>0 AND s.published=1 AND p.category IS NOT NULL AND p.category<>'' GROUP BY p.category ORDER BY p.category", [row.tenant_id])).rows;
  const ruleCount = Number((await db.query('SELECT COUNT(*) AS n FROM online_shipping_rules WHERE tenant_id=$1 AND active=1', [row.tenant_id])).rows[0].n);
  const codeCount = Number((await db.query('SELECT COUNT(*) AS n FROM online_discount_codes WHERE tenant_id=$1 AND active=1', [row.tenant_id])).rows[0].n);
  return shapePublicStore(row, { categories: categories.map(c => ({ name: c.name, count: Number(c.n) })), provinces: ruleCount ? extras.PROVINCES : [], has_codes: codeCount > 0 });
}
async function shapePublicProducts(row, rows) {
  const ids = rows.map(r => Number(r.id));
  const stock = await stockMap(Number(row.tenant_id), row.warehouse_id == null ? null : Number(row.warehouse_id), ids);
  const media = ids.length ? (await db.query(`SELECT product_id,file_key,alt FROM online_product_media WHERE tenant_id=$1 AND product_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')}) ORDER BY position,id`, [row.tenant_id, ...ids])).rows : [];
  const byProduct = new Map();
  for (const m of media) byProduct.set(Number(m.product_id), [...(byProduct.get(Number(m.product_id)) || []), { url: imageUrl(row.slug, m.file_key), alt: m.alt || '' }]);
  return rows.filter(r => !measured(r.unit)).map(r => {
    const q = stock.get(Number(r.id));
    return { id: Number(r.id), name: r.name, category: r.category || '', unit: r.unit || 'adet', price: round(r.sale_price), description: r.description || '', stock_state: stockState(q), max_per_order: r.max_per_order == null ? null : Number(r.max_per_order), images: byProduct.get(Number(r.id)) || [] };
  });
}
async function publicProducts(slug, query = {}) {
  const row = await openStore(slug) || notFound();
  const page = Math.max(0, Math.min(1000, Number.parseInt(query.page, 10) || 0)), size = 24;
  const { where, params } = publicWhere(Number(row.tenant_id), query);
  const base = `FROM products p JOIN online_product_settings s ON s.tenant_id=p.tenant_id AND s.product_id=p.id WHERE ${where}`;
  const total = Number((await db.query('SELECT COUNT(*) AS n ' + base, params)).rows[0].n);
  const rows = (await db.query(`SELECT p.id,p.name,p.category,p.unit,p.sale_price,s.description,s.max_per_order ${base} ORDER BY s.sort_order,p.name LIMIT ${size} OFFSET ${page * size}`, params)).rows;
  return { total, page, page_size: size, items: await shapePublicProducts(row, rows) };
}
async function publicProduct(slug, productId) {
  const row = await openStore(slug) || notFound();
  const id = Number(productId);
  if (!Number.isSafeInteger(id)) notFound();
  const rows = (await db.query("SELECT p.id,p.name,p.category,p.unit,p.sale_price,s.description,s.max_per_order FROM products p JOIN online_product_settings s ON s.tenant_id=p.tenant_id AND s.product_id=p.id WHERE p.tenant_id=$1 AND p.id=$2 AND p.module_type='NORMAL' AND p.sale_price>0 AND s.published=1", [row.tenant_id, id])).rows;
  const items = await shapePublicProducts(row, rows);
  if (!items.length) fail('Ürün bulunamadı.', 404, 'NO_PRODUCT');
  return items[0];
}

// ---------- Sipariş oluşturma (herkese açık) ----------
const codeOf = number => 'S-' + String(number).padStart(6, '0');
function shapeOrder(order, items) {
  return {
    number: codeOf(order.number), code: order.public_code, status: order.status, delivery_method: order.delivery_method, payment_method: order.payment_method,
    subtotal: round(order.subtotal), delivery_fee: round(order.delivery_fee), total: round(order.total), created_at: order.created_at,
    items: items.map(i => ({ product_id: Number(i.product_id), name: i.name, unit: i.unit, unit_price: round(i.unit_price), quantity: Number(i.quantity), line_total: round(i.line_total) }))
  };
}
async function createOrder(slug, body = {}, idempotencyKey, ipHash) {
  const store = await openStore(slug) || notFound();
  if (!Number(store.accepting_orders)) fail('Mağaza şu anda sipariş almıyor.', 409, 'NOT_ACCEPTING');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_.:-]{8,80}$/.test(idempotencyKey)) fail('İstek anahtarı (Idempotency-Key) gerekli.', 400, 'NO_KEY');
  // Bal küpü: botlar bu görünmez alanı doldurur; sessizce başarılı gibi yanıtlanır, kayıt açılmaz.
  if (body.website) return { number: 'S-000000', code: '', status: 'new', total: 0, items: [], ignored: true };
  if (body.consent !== true) fail('Devam etmek için aydınlatma metnini ve sipariş koşullarını onaylayın.', 400, 'NO_CONSENT');
  const tenantId = Number(store.tenant_id), warehouse = Number(store.warehouse_id);
  const delivery = body.delivery_method === 'pickup' ? 'pickup' : body.delivery_method === 'delivery' ? 'delivery' : null;
  if (!delivery) fail('Teslimat yöntemi seçin.');
  if (delivery === 'pickup' && !Number(store.pickup_enabled)) fail('Mağazadan teslim bu mağazada kapalı.');
  const payment = ['cod', 'transfer', 'pickup'].includes(body.payment_method) ? body.payment_method : null;
  if (!payment) fail('Ödeme yöntemini seçin.');
  if (payment === 'cod' && (!Number(store.cod_enabled) || delivery === 'pickup')) fail('Kapıda ödeme bu teslimat yöntemiyle kullanılamaz.');
  if (payment === 'transfer' && !Number(store.transfer_enabled)) fail('Havale/EFT bu mağazada kapalı.');
  if (payment === 'pickup' && delivery !== 'pickup') fail('Mağazada ödeme yalnız mağazadan teslimde seçilebilir.');
  const name = text(body.customer_name, 80);
  if (name.length < 2) fail('Ad soyad yazın.');
  const phone = normalizePhone(body.phone);
  if (!phone) fail('Telefon numarası geçersiz (örn. 0532 123 45 67).');
  const email = text(body.email, 120) || null;
  if (email && !EMAIL.test(email)) fail('E-posta adresi geçersiz.');
  const address = longText(body.address, 300);
  if (delivery === 'delivery' && address.length < 10) fail('Teslimat için açık adres yazın.');
  const note = longText(body.note, 300) || null;
  const lines = Array.isArray(body.items) ? body.items : [];
  if (!lines.length || lines.length > 30) fail('Sepette 1-30 ürün olmalı.');
  const wanted = new Map();
  for (const line of lines) {
    const id = Number(line && line.product_id), qty = Number(line && line.quantity);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(qty) || qty < 1 || qty > 50) fail('Sepetteki ürün veya adet geçersiz.');
    wanted.set(id, (wanted.get(id) || 0) + qty);
    if (wanted.get(id) > 50) fail('Bir üründen en çok 50 adet sipariş verilebilir.');
  }
  const expected = new Map(lines.filter(l => l && l.expected_price !== undefined).map(l => [Number(l.product_id), Number(l.expected_price)]));
  const result = await db.transaction(async tx => {
    // Tekrar gönderim: aynı anahtar aynı siparişi döner.
    const dup = (await tx.query('SELECT * FROM online_orders WHERE tenant_id=$1 AND idempotency_key=$2', [tenantId, idempotencyKey])).rows[0];
    if (dup) { const its = (await tx.query('SELECT * FROM online_order_items WHERE tenant_id=$1 AND order_id=$2 ORDER BY id', [tenantId, dup.id])).rows; return { ...shapeOrder(dup, its), repeated: true }; }
    const ids = [...wanted.keys()];
    const products = (await tx.query(`SELECT p.id,p.sku,p.name,p.unit,p.sale_price,s.max_per_order FROM products p JOIN online_product_settings s ON s.tenant_id=p.tenant_id AND s.product_id=p.id WHERE p.tenant_id=$1 AND p.module_type='NORMAL' AND p.sale_price>0 AND s.published=1 AND p.id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [tenantId, ...ids])).rows;
    const byId = new Map(products.map(p => [Number(p.id), p]));
    const unavailable = ids.filter(id => !byId.has(id) || measured(byId.get(id).unit));
    if (unavailable.length) fail('Sepetteki bazı ürünler artık satışta değil.', 409, 'PRODUCT_UNAVAILABLE');
    const changed = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (p.max_per_order != null && wanted.get(id) > Number(p.max_per_order)) fail(`"${p.name}" için sipariş başına en çok ${p.max_per_order} adet.`, 422, 'MAX_PER_ORDER');
      if (expected.has(id) && Math.abs(cents(expected.get(id)) - cents(p.sale_price)) > 0) changed.push({ product_id: id, name: p.name, price: round(p.sale_price) });
    }
    if (changed.length) throw Object.assign(new Error('Bazı ürünlerin fiyatı değişti. Yeni fiyatları kontrol edip tekrar onaylayın.'), { status: 409, code: 'PRICE_CHANGED', changed });
    let subtotal = 0;
    const priced = ids.map(id => { const p = byId.get(id), qty = wanted.get(id), line = cents(p.sale_price) * qty; subtotal += line; return { id, p, qty, line }; });
    const minOrder = cents(store.min_order);
    if (subtotal < minOrder) fail(`Minimum sipariş tutarı ${fromCents(minOrder).toFixed(2).replace('.', ',')} ₺.`, 422, 'MIN_ORDER');
    const price = await extras.priceCart(tx, store, { subtotalC: subtotal, delivery, cityInput: body.city, codeInput: body.discount_code });
    const fee = price.shippingC;
    // Stok: tek işlemde koşullu düşülür; yetmeyen olursa hiçbir şey yazılmaz.
    const orderNumber = (await (async () => {
      await tx.query('UPDATE online_stores SET order_counter=order_counter+1 WHERE tenant_id=$1', [tenantId]);
      return Number((await tx.query('SELECT order_counter FROM online_stores WHERE tenant_id=$1' + lock(), [tenantId])).rows[0].order_counter);
    })());
    const code = crypto.randomBytes(15).toString('base64url');
    const total = price.totalC;
    const inserted = (await tx.query('INSERT INTO online_orders (tenant_id,number,public_code,status,delivery_method,payment_method,customer_name,phone,email,address,note,subtotal,delivery_fee,total,warehouse_id,consent_at,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP,$16) RETURNING id', [tenantId, orderNumber, code, 'new', delivery, payment, name, phone, email, delivery === 'delivery' ? address : null, note, fromCents(subtotal), fromCents(fee), fromCents(total), warehouse, idempotencyKey])).rows[0];
    const orderId = Number(inserted.id);
    const shortages = [];
    for (const row of priced) {
      const got = await takeStock(tx, tenantId, warehouse, row.id, row.qty, codeOf(orderNumber), orderId, null);
      if (!got.ok) shortages.push({ product_id: row.id, name: row.p.name, available: got.available });
    }
    if (shortages.length) throw Object.assign(new Error('Bazı ürünlerin stoğu yetersiz.'), { status: 409, code: 'OUT_OF_STOCK', shortages });
    if (price.code) await extras.consumeCode(tx, tenantId, price.code.id);
    await tx.query('INSERT INTO online_order_extras (order_id,tenant_id,city,discount_code_id,discount_code,discount_amount,shipping_rule) VALUES ($1,$2,$3,$4,$5,$6,$7)', [orderId, tenantId, price.city, price.code ? price.code.id : null, price.code ? price.code.code : null, fromCents(price.discountC), price.rule ? price.rule.name : null]);
    for (const row of priced) await tx.query('INSERT INTO online_order_items (tenant_id,order_id,product_id,sku,name,unit,unit_price,quantity,line_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [tenantId, orderId, row.id, row.p.sku || null, row.p.name, row.p.unit || 'adet', round(row.p.sale_price), row.qty, fromCents(row.line)]);
    await tx.query('INSERT INTO online_order_events (tenant_id,order_id,from_status,to_status,note) VALUES ($1,$2,NULL,$3,$4)', [tenantId, orderId, 'new', ipHash ? 'Müşteri siparişi' : null]);
    const order = (await tx.query('SELECT * FROM online_orders WHERE id=$1 AND tenant_id=$2', [orderId, tenantId])).rows[0];
    const its = (await tx.query('SELECT * FROM online_order_items WHERE tenant_id=$1 AND order_id=$2 ORDER BY id', [tenantId, orderId])).rows;
    return { ...shapeOrder(order, its), discount: fromCents(price.discountC), discount_code: price.code ? price.code.code : '' };
  });
  if (!result.repeated) announce(store, result, { name, phone, address: delivery === 'delivery' ? address : '', note, email }).catch(() => {});
  return result;
}
// Sepet özeti: sipariş vermeden toplamları (indirim, kargo) hesaplar; sipariş oluştururken aynı hesap yapılır.
async function quote(slug, body = {}) {
  const store = await openStore(slug) || notFound();
  const delivery = body.delivery_method === 'pickup' ? 'pickup' : 'delivery';
  const lines = Array.isArray(body.items) ? body.items : [];
  if (!lines.length || lines.length > 30) fail('Sepette 1-30 ürün olmalı.');
  const wanted = new Map();
  for (const line of lines) {
    const id = Number(line && line.product_id), qty = Number(line && line.quantity);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(qty) || qty < 1 || qty > 50) fail('Sepetteki ürün veya adet geçersiz.');
    wanted.set(id, Math.min(50, (wanted.get(id) || 0) + qty));
  }
  const ids = [...wanted.keys()];
  const rows = (await db.query(`SELECT p.id,p.sale_price FROM products p JOIN online_product_settings s ON s.tenant_id=p.tenant_id AND s.product_id=p.id WHERE p.tenant_id=$1 AND p.module_type='NORMAL' AND p.sale_price>0 AND s.published=1 AND p.id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [store.tenant_id, ...ids])).rows;
  if (rows.length !== ids.length) fail('Sepetteki bazı ürünler artık satışta değil.', 409, 'PRODUCT_UNAVAILABLE');
  const subtotal = rows.reduce((s, r) => s + cents(r.sale_price) * wanted.get(Number(r.id)), 0);
  const price = await extras.priceCart(db, store, { subtotalC: subtotal, delivery, cityInput: body.city, codeInput: body.discount_code, lenientCity: true });
  return { subtotal: fromCents(price.subtotalC), discount: fromCents(price.discountC), delivery_fee: fromCents(price.shippingC), total: fromCents(price.totalC), city: price.city, code: price.code ? price.code.code : '', shipping_rule: price.rule ? price.rule.name : '' };
}
// Yeni sipariş bildirimi (en iyi çaba): işletmenin yönetici ve müdürlerine mobil bildirim, iletişim e-postasına ayrıntılı e-posta.
// Bildirim hatası siparişi asla bozmaz.
async function announce(store, order, customer) {
  const tenantId = Number(store.tenant_id);
  const tl = n => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  const lines = order.items.map(i => `${i.quantity}× ${i.name} (${tl(i.line_total)})`);
  const how = (order.delivery_method === 'pickup' ? 'Mağazadan teslim' : 'Adrese teslim') + ' · ' + (order.payment_method === 'cod' ? 'Kapıda ödeme' : order.payment_method === 'transfer' ? 'Havale/EFT' : 'Mağazada ödeme');
  try {
    await require('./pushNotifier').notifyTenant(tenantId, { title: 'Yeni online sipariş ' + order.number, body: `${customer.name} · ${tl(order.total)} · ${order.items.length} kalem`, url: '/sektor/online-magaza', tag: 'online-order-' + order.number });
  } catch { /* bildirim en iyi çaba */ }
  if (!store.contact_email) return;
  const text = [`Yeni online sipariş: ${order.number}`, '', `Müşteri: ${customer.name}`, `Telefon: ${customer.phone}`, customer.email ? `E-posta: ${customer.email}` : '', customer.address ? `Adres: ${customer.address}` : '', customer.note ? `Not: ${customer.note}` : '', '', how, '', ...lines, '', `Ara toplam: ${tl(order.subtotal)}`, `Teslimat: ${tl(order.delivery_fee)}`, `Toplam: ${tl(order.total)}`, '', 'Siparişi yönetmek için Veniux > Online Mağaza > Siparişler sayfasını açın.'].filter((v, i, a) => v !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const html = '<p><b>Yeni online sipariş: ' + esc(order.number) + '</b></p><p>' + esc(customer.name) + ' · ' + esc(customer.phone) + (customer.address ? '<br>' + esc(customer.address) : '') + (customer.note ? '<br><i>' + esc(customer.note) + '</i>' : '') + '</p><p>' + esc(how) + '</p><ul>' + lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul><p><b>Toplam: ' + esc(tl(order.total)) + '</b></p>';
  try { await require('./notificationService').sendEmail(store.contact_email, 'Yeni online sipariş ' + order.number, text, html); } catch { /* e-posta en iyi çaba */ }
}
async function publicOrder(slug, code) {
  const store = await openStore(slug) || notFound();
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{20}$/.test(code)) fail('Sipariş bulunamadı.', 404, 'NO_ORDER');
  const order = (await db.query('SELECT * FROM online_orders WHERE tenant_id=$1 AND public_code=$2', [store.tenant_id, code])).rows[0];
  if (!order) fail('Sipariş bulunamadı.', 404, 'NO_ORDER');
  const items = (await db.query('SELECT * FROM online_order_items WHERE tenant_id=$1 AND order_id=$2 ORDER BY id', [store.tenant_id, order.id])).rows;
  return { ...shapeOrder(order, items), customer_name: order.customer_name.split(' ')[0], phone: maskPhone(order.phone), transfer_note: order.payment_method === 'transfer' ? store.transfer_note || '' : '', ...(await (async () => { const x = await extras.extrasFor(db, store.tenant_id, order.id); return { discount: x.discount_amount, discount_code: x.discount_code, carrier: x.carrier, tracking_no: x.tracking_no }; })()) };
}
async function publicMedia(slug, key) {
  const store = await openStore(slug) || notFound();
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) notFound();
  const row = (await db.query('SELECT * FROM online_product_media WHERE tenant_id=$1 AND file_key=$2', [store.tenant_id, key])).rows[0];
  if (!row) notFound();
  return row;
}

// Paket hesaptan kalkmışsa mağaza kapanır (veri silinmez). Cihazsız ziyaretçi isteğinde merkezi lisans sorgulanamadığı için kontrol,
// işletmenin paket durumunu sorduğu her oturumda (ör. giriş sonrası /sector/packs/me) yapılır.
async function closeIfNoPack(tenantId, packs) {
  if (packs && packs.online_store === false) await db.query('UPDATE online_stores SET published=0,accepting_orders=0,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND (published=1 OR accepting_orders=1)', [tenantId]);
}

// ---------- Siparişler (yönetici) ----------
function visibleWarehouse(user) { const scope = allowedWarehouses(user); return scope ? [...scope] : null; }
async function listOrders(user, query = {}) {
  const page = Math.max(0, Number.parseInt(query.page, 10) || 0), size = 50;
  const where = ['o.tenant_id=$1']; const params = [user.tenantId];
  if (STATUSES.includes(query.status)) { params.push(query.status); where.push('o.status=$' + params.length); }
  else if (query.status === 'open') where.push(`o.status IN (${OPEN_STATUSES.map(s => `'${s}'`).join(',')})`);
  const q = text(query.q, 60);
  if (q) { params.push('%' + q + '%'); const at = '$' + params.length; where.push('(' + ciLike('o.customer_name', at) + ' OR o.phone LIKE ' + at + " OR CAST(o.number AS CHAR) LIKE " + at + ')'); }
  const wh = visibleWarehouse(user);
  if (wh) where.push(wh.length ? `o.warehouse_id IN (${wh.map(Number).filter(Number.isSafeInteger).join(',')})` : '1=0');
  const base = `FROM online_orders o WHERE ${where.join(' AND ')}`;
  const total = Number((await db.query('SELECT COUNT(*) AS n ' + base, params)).rows[0].n);
  const rows = (await db.query(`SELECT o.* ${base} ORDER BY o.id DESC LIMIT ${size} OFFSET ${page * size}`, params)).rows;
  return { total, page, page_size: size, items: rows.map(o => ({ id: Number(o.id), number: codeOf(o.number), status: o.status, customer_name: o.customer_name, phone: o.phone, delivery_method: o.delivery_method, payment_method: o.payment_method, total: round(o.total), created_at: o.created_at })) };
}
async function ownOrder(user, id, runner = db) {
  const orderId = Number(id);
  const order = Number.isSafeInteger(orderId) ? (await runner.query('SELECT * FROM online_orders WHERE id=$1 AND tenant_id=$2' + (runner === db ? '' : lock()), [orderId, user.tenantId])).rows[0] : null;
  if (!order) fail('Sipariş bulunamadı.', 404);
  const scope = allowedWarehouses(user);
  if (scope && !scope.has(Number(order.warehouse_id))) fail('Bu sipariş için yetkiniz yok.', 403);
  return order;
}
async function getOrder(user, id) {
  const order = await ownOrder(user, id);
  const items = (await db.query('SELECT * FROM online_order_items WHERE tenant_id=$1 AND order_id=$2 ORDER BY id', [user.tenantId, order.id])).rows;
  const events = (await db.query('SELECT from_status,to_status,note,created_at FROM online_order_events WHERE tenant_id=$1 AND order_id=$2 ORDER BY id', [user.tenantId, order.id])).rows;
  return { ...shapeOrder(order, items), id: Number(order.id), customer_name: order.customer_name, phone: order.phone, email: order.email || '', address: order.address || '', note: order.note || '', cancel_reason: order.cancel_reason || '', events, ...(({ discount_code_id, ...x }) => x)(await extras.extrasFor(db, user.tenantId, order.id)) };
}
async function setStatus(user, id, body = {}) {
  const to = body.status;
  if (!STATUSES.includes(to)) fail('Durum geçersiz.');
  return db.transaction(async tx => {
    const order = await ownOrder(user, id, tx);
    if (!(NEXT[order.status] || []).includes(to)) fail(`"${order.status}" durumundaki sipariş "${to}" olamaz.`, 409, 'BAD_TRANSITION');
    let reason = null;
    if (to === 'cancelled') {
      reason = text(body.reason, 200) || null;
      const items = (await tx.query('SELECT product_id,quantity FROM online_order_items WHERE tenant_id=$1 AND order_id=$2', [user.tenantId, order.id])).rows;
      for (const item of items) await giveBackStock(tx, user.tenantId, Number(order.warehouse_id), Number(item.product_id), Number(item.quantity), codeOf(order.number), Number(order.id), user.userId);
    }
    if (to === 'cancelled') { const x = await extras.extrasFor(tx, user.tenantId, order.id); await extras.releaseCode(tx, user.tenantId, x.discount_code_id); }
    await tx.query('UPDATE online_orders SET status=$3,cancel_reason=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2', [order.id, user.tenantId, to, reason]);
    await tx.query('INSERT INTO online_order_events (tenant_id,order_id,from_status,to_status,user_id,note) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, order.id, order.status, to, user.userId || null, reason]);
    await audit(tx, user, 'online_store.order_status', order.id, { number: codeOf(order.number), from: order.status, to });
    return { id: Number(order.id), number: codeOf(order.number), status: to };
  });
}
async function summary(user) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const rows = (await db.query('SELECT status,COUNT(*) AS n,SUM(total) AS t FROM online_orders WHERE tenant_id=$1 GROUP BY status', [user.tenantId])).rows;
  const by = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const r of rows) by[r.status] = Number(r.n);
  const today = (await db.query("SELECT COUNT(*) AS n,SUM(total) AS t FROM online_orders WHERE tenant_id=$1 AND status<>'cancelled' AND created_at>=$2", [user.tenantId, day + ' 00:00:00'])).rows[0];
  return { by_status: by, open: OPEN_STATUSES.reduce((s, k) => s + by[k], 0), today_orders: Number(today.n || 0), today_total: round(today.t || 0) };
}

// ---------- Arama motoru ve paylaşım: sayfa üst bilgisi ve site haritası ----------
// Vitrin tek sayfalı uygulama olduğundan başlık, açıklama ve yapılandırılmış veri sunucuda HTML'e eklenir (arama motorları ve paylaşım önizlemeleri JavaScript çalıştırmaz).
async function seoFor(slug, productId) {
  const store = await openStore(slug);
  if (!store) return null;
  const base = '/magaza/' + store.slug;
  const out = { title: store.name, description: (store.tagline || store.about || store.name + ' online mağazası').replace(/\s+/g, ' ').slice(0, 160), canonical: base, image: null, jsonld: null, noindex: false };
  if (productId != null) {
    const item = await publicProduct(slug, productId).catch(() => null);
    if (!item) return { ...out, notFound: true, noindex: true };
    const first = item.images[0];
    out.title = item.name + ' | ' + store.name;
    out.description = (item.description || item.name + ' ' + store.name + ' mağazasında.').replace(/\s+/g, ' ').slice(0, 160);
    out.canonical = base + '/urun/' + item.id;
    out.image = first ? first.url : null;
    out.jsonld = { '@context': 'https://schema.org', '@type': 'Product', name: item.name, description: out.description, category: item.category || undefined, image: first ? [first.url] : undefined, offers: { '@type': 'Offer', priceCurrency: 'TRY', price: item.price.toFixed(2), availability: item.stock_state === 'out' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: out.canonical } };
  } else {
    out.jsonld = { '@context': 'https://schema.org', '@type': 'Store', name: store.name, description: out.description, url: out.canonical, email: store.contact_email || undefined, telephone: store.public_phone || undefined };
  }
  return out;
}
async function sitemapFor(slug) {
  const store = await openStore(slug);
  if (!store) return null;
  const rows = (await db.query("SELECT p.id FROM products p JOIN online_product_settings s ON s.tenant_id=p.tenant_id AND s.product_id=p.id WHERE p.tenant_id=$1 AND p.module_type='NORMAL' AND p.sale_price>0 AND s.published=1 ORDER BY p.id LIMIT 2000", [store.tenant_id])).rows;
  return { slug: store.slug, ids: rows.map(r => Number(r.id)) };
}

module.exports = { quote, getSettings, saveSettings, slugAvailable, listProducts, setProduct, bulkPublish, listOrders, getOrder, setStatus, summary, publicStore, publicProducts, publicProduct, createOrder, publicOrder, publicMedia, seoFor, sitemapFor, closeIfNoPack, normalizePhone, STATUSES, NEXT, RESERVED };
