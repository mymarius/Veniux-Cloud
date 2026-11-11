// Hırdavat paketi: telefonda hızlı ürün arama (ölçü filtresi, raf/koridor bilgisi) ve kritik stok listesi.
// Arama Türkçe büyük/küçük harf kurallarıyla bellekte yapılır; bir işletmenin ürün listesi yüzlerce-binlerce satırdır.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const lower = value => String(value ?? '').toLocaleLowerCase('tr-TR');
// "3 numara vida": bu sözcükler aramada anlam taşımaz, sayı ise ölçü olarak aranır.
const STOP = new Set(['numara', 'numaralı', 'no', 'nolu', 'mm', 'cm', 'adet', 'tane', 'var', 'mı', 'mi', 'mu', 'mü', 'bir', 'olan']);
const ATTRIBUTE_KEYS = ['size', 'fragile', 'menu'];
const MAX_CANDIDATES = 20000;

function tokens(query) {
  return lower(query).split(/[\s,;]+/).filter(t => t && !STOP.has(t)).slice(0, 8);
}

async function candidates(user) {
  const products = (await db.query("SELECT id,sku,name,barcode,category,unit,sale_price,min_stock_level,supplier_id FROM products WHERE tenant_id=$1 AND module_type='NORMAL' ORDER BY name LIMIT " + MAX_CANDIDATES, [user.tenantId])).rows;
  const attrs = (await db.query("SELECT product_id,attr_key,attr_value FROM product_attributes WHERE tenant_id=$1 AND attr_key IN ('size','fragile')", [user.tenantId])).rows;
  const map = new Map();
  for (const a of attrs) { const o = map.get(Number(a.product_id)) || {}; o[a.attr_key] = a.attr_value; map.set(Number(a.product_id), o); }
  return products.map(p => ({ ...p, id: Number(p.id), attributes: map.get(Number(p.id)) || {} }));
}

// Sayı kelimesi tam sayı olarak aranır ("3" -> "M3x20" bulunur, "M4x30" bulunmaz); metin kelimesi parça eşleşir.
const hasWord = (text, word) => (/^\d+$/.test(word) ? new RegExp('(^|[^0-9])' + word + '([^0-9]|$)').test(text) : text.includes(word));
const haystack = p => lower([p.name, p.sku, p.barcode, p.category, p.attributes.size].filter(Boolean).join(' '));

async function search(user, query = {}) {
  const q = typeof query.q === 'string' ? query.q.slice(0, 100) : '';
  const size = typeof query.size === 'string' ? lower(query.size.trim()).slice(0, 40) : '';
  const category = typeof query.category === 'string' ? lower(query.category.trim()).slice(0, 80) : '';
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 30, 1), 60);
  const words = tokens(q);
  const warehouse = query.warehouse_id ? Number(query.warehouse_id) : null;
  if (warehouse !== null && (!Number.isSafeInteger(warehouse) || warehouse < 1)) fail('Depo geçersiz.');
  const rows = (await candidates(user)).filter(p => {
    if (size && lower(p.attributes.size) !== size) return false;
    if (category && lower(p.category) !== category) return false;
    const text = haystack(p);
    return words.every(w => hasWord(text, w));
  });
  // Tam eşleşen barkod/SKU başa gelir.
  const exact = lower(q.trim());
  rows.sort((a, b) => (Number(lower(b.barcode) === exact || lower(b.sku) === exact) - Number(lower(a.barcode) === exact || lower(a.sku) === exact)) || a.name.localeCompare(b.name, 'tr'));
  const page = rows.slice(0, limit);
  if (!page.length) return { items: [], total: rows.length };
  const ids = page.map(p => p.id), marks = ids.map((_, i) => '$' + (i + 2)).join(',');
  const stock = (await db.query(`SELECT s.product_id,s.warehouse_id,w.name AS warehouse_name,SUM(s.quantity) AS quantity FROM stock_records s JOIN warehouses w ON w.id=s.warehouse_id WHERE s.tenant_id=$1 AND s.product_id IN (${marks}) GROUP BY s.product_id,s.warehouse_id,w.name`, [user.tenantId, ...ids])).rows;
  const bins = (await db.query(`SELECT b.product_id,b.quantity,l.id AS location_id,l.warehouse_id,l.location_code,l.zone_name,l.aisle_code,l.rack_number,l.shelf_tier,l.bin_position FROM product_bin_records b JOIN warehouse_locations l ON l.id=b.location_id WHERE b.tenant_id=$1 AND b.product_id IN (${marks}) AND b.quantity>0 ORDER BY l.location_code`, [user.tenantId, ...ids])).rows;
  const locIds = [...new Set(bins.map(b => Number(b.location_id)))];
  const tags = locIds.length ? (await db.query(`SELECT location_id,tag FROM location_tags WHERE tenant_id=$1 AND location_id IN (${locIds.map((_, i) => '$' + (i + 2)).join(',')})`, [user.tenantId, ...locIds])).rows : [];
  const tagMap = new Map();
  for (const t of tags) tagMap.set(Number(t.location_id), [...(tagMap.get(Number(t.location_id)) || []), t.tag]);
  return {
    total: rows.length,
    items: page.map(p => {
      const perWarehouse = stock.filter(s => Number(s.product_id) === p.id && (!warehouse || Number(s.warehouse_id) === warehouse)).map(s => ({ warehouse_id: Number(s.warehouse_id), warehouse_name: s.warehouse_name, quantity: Number(s.quantity) }));
      const locations = bins.filter(b => Number(b.product_id) === p.id && (!warehouse || Number(b.warehouse_id) === warehouse)).map(b => ({ location_id: Number(b.location_id), location_code: b.location_code, zone: b.zone_name, aisle: b.aisle_code, rack: Number(b.rack_number), shelf: Number(b.shelf_tier), bin: Number(b.bin_position), quantity: Number(b.quantity), tags: tagMap.get(Number(b.location_id)) || [] }));
      return { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, category: p.category, unit: p.unit, sale_price: Number(p.sale_price), size: p.attributes.size || null, fragile: p.attributes.fragile === '1', stock_total: perWarehouse.reduce((s, x) => s + x.quantity, 0), stock: perWarehouse, locations };
    })
  };
}

// Ölçü ve kategori düğmeleri: o anki aramaya göre tek dokunuşla daraltmak için.
async function facets(user, query = {}) {
  const words = tokens(query.q || '');
  const rows = (await candidates(user)).filter(p => words.every(w => hasWord(haystack(p), w)));
  const count = (key) => { const m = new Map(); for (const p of rows) { const v = key(p); if (v) m.set(v, (m.get(v) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'tr', { numeric: true })).slice(0, 60).map(([value, n]) => ({ value, count: n })); };
  return { sizes: count(p => p.attributes.size), categories: count(p => p.category), total: rows.length };
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
  const items = low.map(r => {
    const total = Number(r.total), min = Number(r.min_stock_level), supplier = r.supplier_id ? suppliers.get(Number(r.supplier_id)) : null;
    return { id: Number(r.id), name: r.name, unit: r.unit, stock: total, minimum: min, empty: total <= 0, supplier: supplier ? { name: supplier.name, phone: supplier.phone || null } : null,
      message: r.name + (total <= 0 ? ' bitti' : ' bitiyor (' + total + ' ' + (r.unit || 'adet') + ' kaldı)') + ', toptancıya yaz.' };
  }).sort((a, b) => Number(b.empty) - Number(a.empty) || a.name.localeCompare(b.name, 'tr'));
  return { items, count: items.length, empty: items.filter(i => i.empty).length };
}

module.exports = { search, facets, setAttributes, critical, tokens };
