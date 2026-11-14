// Hırdavat paketi: telefonda hızlı ürün arama (ölçü filtresi, raf/koridor bilgisi) ve kritik stok listesi.
// Arama Türkçe büyük/küçük harf kurallarıyla bellekte yapılır; bir işletmenin ürün listesi yüzlerce-binlerce satırdır.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const lower = value => String(value ?? '').toLocaleLowerCase('tr-TR');
// Aramada Türkçe karakter esnek: "dubel" "Dübel"i, "civata" "Cıvata"yı bulur. Ürün adı değişmez, yalnız karşılaştırma katlanır.
const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
const fold = value => lower(value).normalize('NFC').replace(/[çğıöşüâîû]/g, c => FOLD[c]).replace(/i̇/g, 'i');
// "3 numara vida": bu sözcükler aramada anlam taşımaz, sayı ise ölçü olarak aranır.
const STOP = new Set(['numara', 'numaralı', 'no', 'nolu', 'mm', 'cm', 'adet', 'tane', 'var', 'mı', 'mi', 'mu', 'mü', 'bir', 'olan']);
// size: ölçü özeti (M4x30). diameter/length/material/finish: ayrıntılı ölçü. equiv: muadil grubu kodu (aynı kodlu ürünler birbirinin muadili).
const ATTRIBUTE_KEYS = ['size', 'fragile', 'menu', 'diameter', 'length', 'material', 'finish', 'equiv'];
const SEARCH_ATTRS = ['size', 'fragile', 'diameter', 'length', 'material', 'finish', 'equiv'];
const MAX_CANDIDATES = 20000;
const FOLDED_STOP = new Set([...STOP].map(w => fold(w)));

function tokens(query) {
  return lower(query).split(/[\s,;]+/).map(fold).filter(t => t && !FOLDED_STOP.has(t)).slice(0, 8);
}

async function candidates(user) {
  const products = (await db.query("SELECT id,sku,name,barcode,category,unit,sale_price,min_stock_level,supplier_id FROM products WHERE tenant_id=$1 AND module_type='NORMAL' ORDER BY name LIMIT " + MAX_CANDIDATES, [user.tenantId])).rows;
  const attrs = (await db.query(`SELECT product_id,attr_key,attr_value FROM product_attributes WHERE tenant_id=$1 AND attr_key IN (${SEARCH_ATTRS.map(k => "'" + k + "'").join(',')})`, [user.tenantId])).rows;
  const map = new Map();
  for (const a of attrs) { const o = map.get(Number(a.product_id)) || {}; o[a.attr_key] = a.attr_value; map.set(Number(a.product_id), o); }
  return products.map(p => ({ ...p, id: Number(p.id), attributes: map.get(Number(p.id)) || {} }));
}

// Sayı kelimesi tam sayı olarak aranır ("3" -> "M3x20" bulunur, "M4x30" bulunmaz); metin kelimesi parça eşleşir.
const hasWord = (text, word) => (/^\d+$/.test(word) ? new RegExp('(^|[^0-9])' + word + '([^0-9]|$)').test(text) : text.includes(word));
const haystack = p => fold([p.name, p.sku, p.barcode, p.category, p.attributes.size, p.attributes.diameter, p.attributes.length, p.attributes.material, p.attributes.finish].filter(Boolean).join(' '));

async function search(user, query = {}) {
  const q = typeof query.q === 'string' ? query.q.slice(0, 100) : '';
  const size = typeof query.size === 'string' ? lower(query.size.trim()).slice(0, 40) : '';
  const category = typeof query.category === 'string' ? lower(query.category.trim()).slice(0, 80) : '';
  const material = typeof query.material === 'string' ? lower(query.material.trim()).slice(0, 40) : '';
  const finish = typeof query.finish === 'string' ? lower(query.finish.trim()).slice(0, 40) : '';
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 30, 1), 60);
  const words = tokens(q);
  const warehouse = query.warehouse_id ? Number(query.warehouse_id) : null;
  if (warehouse !== null && (!Number.isSafeInteger(warehouse) || warehouse < 1)) fail('Depo geçersiz.');
  const rows = (await candidates(user)).filter(p => {
    if (size && lower(p.attributes.size) !== size) return false;
    if (category && lower(p.category) !== category) return false;
    if (material && lower(p.attributes.material) !== material) return false;
    if (finish && lower(p.attributes.finish) !== finish) return false;
    const text = haystack(p);
    return words.every(w => hasWord(text, w));
  });
  // Tam eşleşen barkod/SKU başa gelir.
  const exact = lower(q.trim());
  rows.sort((a, b) => (Number(lower(b.barcode) === exact || lower(b.sku) === exact) - Number(lower(a.barcode) === exact || lower(a.sku) === exact)) || a.name.localeCompare(b.name, 'tr'));
  const page = rows.slice(0, limit);
  const all = await candidates(user);
  if (!page.length) return { items: [], total: rows.length };
  const equivIds = [...new Set(page.flatMap(p => equivalentCandidates(p, all).map(x => x.id)))];
  const equivStock = new Map();
  if (equivIds.length) for (const r of (await db.query(`SELECT product_id,COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND product_id IN (${equivIds.map((_, i) => '$' + (i + 2)).join(',')}) GROUP BY product_id`, [user.tenantId, ...equivIds])).rows) equivStock.set(Number(r.product_id), Number(r.q));
  const ids = page.map(p => p.id), marks = ids.map((_, i) => '$' + (i + 2)).join(',');
  const stock = (await db.query(`SELECT s.product_id,s.warehouse_id,w.name AS warehouse_name,SUM(s.quantity) AS quantity FROM stock_records s JOIN warehouses w ON w.id=s.warehouse_id WHERE s.tenant_id=$1 AND s.product_id IN (${marks}) GROUP BY s.product_id,s.warehouse_id,w.name`, [user.tenantId, ...ids])).rows;
  const bins = (await db.query(`SELECT b.product_id,b.quantity,l.id AS location_id,l.warehouse_id,l.location_code,l.zone_name,l.aisle_code,l.rack_number,l.shelf_tier,l.bin_position FROM product_bin_records b JOIN warehouse_locations l ON l.id=b.location_id WHERE b.tenant_id=$1 AND b.product_id IN (${marks}) AND b.quantity>0 ORDER BY l.location_code`, [user.tenantId, ...ids])).rows;
  const locIds = [...new Set(bins.map(b => Number(b.location_id)))];
  const tags = locIds.length ? (await db.query(`SELECT location_id,tag FROM location_tags WHERE tenant_id=$1 AND location_id IN (${locIds.map((_, i) => '$' + (i + 2)).join(',')})`, [user.tenantId, ...locIds])).rows : [];
  const tagMap = new Map();
  for (const t of tags) tagMap.set(Number(t.location_id), [...(tagMap.get(Number(t.location_id)) || []), t.tag]);
  const units = require('./productUnits');
  const unitMap = await units.unitsFor(user.tenantId, ids);
  return {
    total: rows.length,
    items: page.map(p => {
      const perWarehouse = stock.filter(s => Number(s.product_id) === p.id && (!warehouse || Number(s.warehouse_id) === warehouse)).map(s => ({ warehouse_id: Number(s.warehouse_id), warehouse_name: s.warehouse_name, quantity: Number(s.quantity) }));
      const locations = bins.filter(b => Number(b.product_id) === p.id && (!warehouse || Number(b.warehouse_id) === warehouse)).map(b => ({ location_id: Number(b.location_id), location_code: b.location_code, zone: b.zone_name, aisle: b.aisle_code, rack: Number(b.rack_number), shelf: Number(b.shelf_tier), bin: Number(b.bin_position), quantity: Number(b.quantity), tags: tagMap.get(Number(b.location_id)) || [] }));
      const own = (unitMap.get(p.id) || []).sort((a, b) => a.factor - b.factor).map(u => ({ ...u, list_price: Math.round(Number(p.sale_price) * u.factor * 100) / 100, price: u.custom_price ?? Math.round(Number(p.sale_price) * u.factor * 100) / 100 }));
      const stockTotal = perWarehouse.reduce((s, x) => s + x.quantity, 0);
      const details = { diameter: p.attributes.diameter || null, length: p.attributes.length || null, material: p.attributes.material || null, finish: p.attributes.finish || null, equiv: p.attributes.equiv || null };
      return { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, category: p.category, unit: p.unit, sale_price: Number(p.sale_price), size: p.attributes.size || null, fragile: p.attributes.fragile === '1', details, equivalents: equivalentsOf(p, all, equivStock), stock_total: stockTotal, stock_text: units.breakdown(stockTotal, p.unit, own), units: own, stock: perWarehouse.map(w => ({ ...w, text: units.breakdown(w.quantity, p.unit, own) })), locations };
    })
  };
}


// Muadil: aynı muadil grubu kodu olanlar; kod yoksa aynı kategori ve aynı ölçüdeki ürünler. En çok 3, stokta olanlar.
function equivalentCandidates(p, all) {
  const group = lower(p.attributes.equiv || ''), size = lower(p.attributes.size || ''), cat = lower(p.category || '');
  if (!group && !(size && cat)) return [];
  return all.filter(o => o.id !== p.id && (group ? lower(o.attributes.equiv || '') === group : lower(o.attributes.size || '') === size && lower(o.category || '') === cat)).slice(0, 20);
}
function equivalentsOf(p, all, stock) {
  return equivalentCandidates(p, all).map(o => ({ id: o.id, name: o.name, sale_price: Number(o.sale_price), stock: stock.get(o.id) || 0, unit: o.unit })).filter(o => o.stock > 0).sort((a, b) => b.stock - a.stock).slice(0, 3);
}

// Ölçü ve kategori düğmeleri: o anki aramaya göre tek dokunuşla daraltmak için.
async function facets(user, query = {}) {
  const words = tokens(query.q || '');
  const rows = (await candidates(user)).filter(p => words.every(w => hasWord(haystack(p), w)));
  const count = (key) => { const m = new Map(); for (const p of rows) { const v = key(p); if (v) m.set(v, (m.get(v) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'tr', { numeric: true })).slice(0, 60).map(([value, n]) => ({ value, count: n })); };
  return { sizes: count(p => p.attributes.size), categories: count(p => p.category), materials: count(p => p.attributes.material), finishes: count(p => p.attributes.finish), total: rows.length };
}

async function setAttributes(user, productId, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Ürün özelliklerini yalnız yönetici ve müdür değiştirir.', 403);
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id < 1) fail('Ürün geçersiz.');
  const entries = Object.entries(body).filter(([k]) => ATTRIBUTE_KEYS.includes(k));
  if (!entries.length) fail('Değiştirilecek özellik yok.');
  for (const [k, v] of entries) if (v !== null && (typeof v !== 'string' && typeof v !== 'number' || String(v).trim().length > 40)) fail('Özellik değeri geçersiz: ' + k);
  return db.transaction(async tx => {
    if (!(await tx.query('SELECT id FROM products WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0]) fail('Ürün bulunamadı.', 404);
    for (const [key, raw] of entries) {
      const value = raw === null || String(raw).trim() === '' ? null : String(raw).trim();
      await tx.query('DELETE FROM product_attributes WHERE tenant_id=$1 AND product_id=$2 AND attr_key=$3', [user.tenantId, id, key]);
      if (value !== null) await tx.query('INSERT INTO product_attributes (tenant_id,product_id,attr_key,attr_value) VALUES ($1,$2,$3,$4)', [user.tenantId, id, key, value]);
    }
    return { product_id: id, updated: entries.map(([k]) => k) };
  });
}

// Kritik stok: toplam stok, ürünün asgari stok düzeyine eşit veya altına inmiş ürünler ("3 numara vida bitiyor, toptancıya yaz").
async function critical(user) {
  const rows = (await db.query(`SELECT p.id,p.name,p.sku,p.unit,p.min_stock_level,p.supplier_id,COALESCE(SUM(s.quantity),0) AS total
    FROM products p LEFT JOIN stock_records s ON s.product_id=p.id AND s.tenant_id=p.tenant_id
    WHERE p.tenant_id=$1 AND p.module_type='NORMAL' AND p.min_stock_level>0 GROUP BY p.id,p.name,p.sku,p.unit,p.min_stock_level,p.supplier_id ORDER BY p.name`, [user.tenantId])).rows;
  const low = rows.filter(r => Number(r.total) <= Number(r.min_stock_level));
  const suppliers = new Map();
  const ids = [...new Set(low.map(r => r.supplier_id).filter(Boolean).map(Number))];
  if (ids.length) for (const s of (await db.query(`SELECT id,name,phone FROM suppliers WHERE tenant_id=$1 AND id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [user.tenantId, ...ids])).rows) suppliers.set(Number(s.id), s);
  const unitMap = await require('./productUnits').unitsFor(user.tenantId, low.map(r => Number(r.id)));
  const items = low.map(r => {
    const total = Number(r.total), min = Number(r.min_stock_level), supplier = r.supplier_id ? suppliers.get(Number(r.supplier_id)) : null;
    return { id: Number(r.id), name: r.name, unit: r.unit, stock: total, minimum: min, empty: total <= 0, supplier: supplier ? { name: supplier.name, phone: supplier.phone || null } : null,
      message: r.name + (total <= 0 ? ' bitti' : ' bitiyor (' + (require('./productUnits').breakdown(total, r.unit, unitMap.get(Number(r.id)) || []) || total + ' ' + (r.unit || 'adet')) + ' kaldı)') + ', toptancıya yaz.' };
  }).sort((a, b) => Number(b.empty) - Number(a.empty) || a.name.localeCompare(b.name, 'tr'));
  return { items, count: items.length, empty: items.filter(i => i.empty).length };
}


// Toplu zam/indirim: kategori, tedarikçi veya arama sonucuna yüzde ya da tutar. Önce önizleme (apply=false), sonra uygulama.
// Fiyat seçilen adıma yuvarlanır (0,05 / 0,10 / 0,50 / 1 ₺). Koliye özel fiyatlar aynı oranla güncellenir. Her değişiklik denetimde.
const ROUNDING = [0.01, 0.05, 0.1, 0.5, 1];
async function bulkPrice(user, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Toplu fiyat değişikliğini yalnız yönetici ve müdür yapar.', 403);
  const percent = body.percent == null || body.percent === '' ? null : Number(String(body.percent).replace(',', '.'));
  const amount = body.amount == null || body.amount === '' ? null : Number(String(body.amount).replace(',', '.'));
  if ((percent === null) === (amount === null)) fail('Yüzde ya da tutardan birini girin.');
  if (percent !== null && (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 300)) fail('Yüzde -90 ile 300 arasında olmalı.');
  if (amount !== null && (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1000000)) fail('Tutar geçersiz.');
  const step = body.rounding == null ? 0.01 : Number(body.rounding);
  if (!ROUNDING.includes(step)) fail('Yuvarlama adımı geçersiz.');
  const target = body.target === 'purchase' ? 'purchase_price' : 'sale_price';
  const category = typeof body.category === 'string' && body.category.trim() ? lower(body.category.trim()) : null;
  const supplier = body.supplier_id == null || body.supplier_id === '' ? null : Number(body.supplier_id);
  if (supplier !== null && (!Number.isSafeInteger(supplier) || supplier < 1)) fail('Tedarikçi geçersiz.');
  const words = tokens(typeof body.q === 'string' ? body.q.slice(0, 100) : '');
  if (!category && supplier === null && !words.length) fail('Kategori, tedarikçi veya arama ile ürünleri daraltın; tüm kataloğa toplu zam yapılmaz.');
  const pick = (await candidates(user)).filter(p => (!category || lower(p.category) === category) && (supplier === null || Number(p.supplier_id) === supplier) && words.every(w => hasWord(haystack(p), w)));
  if (pick.length > 2000) fail('Bir seferde en çok 2000 ürün değiştirilebilir; seçimi daraltın.');
  const ids = pick.map(p => p.id);
  const current = new Map();
  if (ids.length) for (const r of (await db.query(`SELECT id,sale_price,purchase_price FROM products WHERE tenant_id=$1 AND id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [user.tenantId, ...ids])).rows) current.set(Number(r.id), Number(r[target]));
  const next = v => { const raw = percent !== null ? v * (1 + percent / 100) : v + amount; const r = Math.round(Math.round(raw / step) * step * 100) / 100; return Math.max(0, r); };
  const changes = pick.map(p => ({ id: p.id, name: p.name, category: p.category, before: current.get(p.id) ?? 0, after: next(current.get(p.id) ?? 0) })).filter(c => c.after !== c.before);
  const skipped = pick.length - changes.length;
  if (!body.apply) return { preview: true, target, matched: pick.length, changed: changes.length, skipped, items: changes.slice(0, 300) };
  if (!changes.length) fail('Değişecek fiyat yok.', 409);
  if (Number(body.expected_count) !== changes.length) fail('Önizlemeden sonra ürün listesi değişti; önizlemeyi yenileyin.', 409);
  await db.transaction(async tx => {
    for (const c of changes) await tx.query(`UPDATE products SET ${target}=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3`, [c.after, c.id, user.tenantId]);
    if (target === 'sale_price' && percent !== null) for (const c of changes) {
      for (const u of (await tx.query('SELECT uom_code,sale_price FROM product_unit_prices WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, c.id])).rows)
        await tx.query('UPDATE product_unit_prices SET sale_price=$1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND product_id=$3 AND uom_code=$4', [next(Number(u.sale_price)), user.tenantId, c.id, u.uom_code]);
    }
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'hardware.bulk_price', 'product', null,
      JSON.stringify({ target, percent, amount, rounding: step, category, supplier_id: supplier, q: body.q || null, count: changes.length, changes: changes.slice(0, 2000).map(c => [c.id, c.before, c.after]) })]);
  });
  return { preview: false, target, changed: changes.length, skipped };
}

// Kritik stoktan satın alma taslağı: her ürün asgari stoğun iki katına tamamlanır, en büyük ambalaja (koli) yukarı yuvarlanır,
// tedarikçiye göre ayrı taslak siparişler açılır. Tedarikçisi olmayan ürün atlanır. Stok değişmez; sipariş taslak kalır.
async function criticalOrder(user, body = {}, key) {
  if (!['admin', 'manager'].includes(user.role)) fail('Satın alma taslağını yalnız yönetici ve müdür oluşturur.', 403);
  if (typeof key !== 'string' || !key.trim() || key.length > 80) fail('Tekrar göndermeyi önleyen işlem anahtarı gerekli.');
  const warehouse = Number(body.warehouse_id);
  if (!Number.isSafeInteger(warehouse) || warehouse < 1) fail('Siparişin gireceği mağaza/depo gerekli.');
  const wanted = Array.isArray(body.product_ids) && body.product_ids.length ? new Set(body.product_ids.map(Number)) : null;
  const low = (await critical(user)).items.filter(i => !wanted || wanted.has(i.id));
  if (!low.length) fail('Kritik seviyede ürün yok.', 409);
  const ids = low.map(i => i.id);
  const info = new Map((await db.query(`SELECT id,supplier_id,purchase_price FROM products WHERE tenant_id=$1 AND id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [user.tenantId, ...ids])).rows.map(r => [Number(r.id), r]));
  const units = await require('./productUnits').unitsFor(user.tenantId, ids);
  const groups = new Map(), skipped = [];
  for (const i of low) {
    const row = info.get(i.id);
    if (!row || !row.supplier_id) { skipped.push({ product_id: i.id, name: i.name, reason: 'Tedarikçi tanımlı değil' }); continue; }
    let quantity = Math.max(i.minimum * 2 - Math.max(i.stock, 0), i.minimum);
    const pack = (units.get(i.id) || []).filter(u => u.factor > 1 && !['kg', 'litre', 'metre'].includes(u.unit)).sort((a, b) => b.factor - a.factor)[0];
    let packs = null;
    if (pack) { packs = Math.ceil(quantity / pack.factor - 1e-9); quantity = Math.round(packs * pack.factor * 1e6) / 1e6; }
    quantity = Math.ceil(quantity);
    const sid = Number(row.supplier_id);
    if (!groups.has(sid)) groups.set(sid, { supplier_id: sid, target_warehouse_id: warehouse, notes: 'Kritik stoktan oluşturuldu', items: [], lines: [] });
    groups.get(sid).items.push({ product_id: i.id, quantity, unit_price: Number(row.purchase_price) || 0 });
    groups.get(sid).lines.push({ product_id: i.id, name: i.name, quantity, pack: pack ? { unit: pack.unit, count: packs } : null });
  }
  if (!groups.size) fail('Kritik ürünlerin hiçbirinde tedarikçi tanımlı değil. Ürünlere tedarikçi atayın.', 409);
  const procurement = require('./procurementService'), orders = [];
  for (const [sid, g] of groups) {
    const r = await procurement.create(user, { supplier_id: g.supplier_id, target_warehouse_id: g.target_warehouse_id, notes: g.notes, items: g.items }, key + ':' + sid);
    orders.push({ order_id: Number(r.order.id), order_no: r.order.order_no, supplier_id: sid, lines: g.lines });
  }
  return { orders, skipped };
}

module.exports = { search, facets, setAttributes, critical, tokens, bulkPrice, criticalOrder };
