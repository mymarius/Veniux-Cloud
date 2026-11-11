// Züccaciye paketi: takım (set) ve parça eşleme, hassas raf konumu etiketleri, kırılgan ürün yerleşim denetimi, fiyat güncelleme.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const PRESET_TAGS = ['Üst raf', 'Alt raf', 'Kırılgan bölge', 'Vitrin', 'Ağır ürün', 'Islak alan'];
const SAFE_FOR_FRAGILE = ['Kırılgan bölge', 'Vitrin'];
const positive = (value, label, max = 100000) => { const n = Number(value); if (!Number.isFinite(n) || n <= 0 || n > max) fail(label + ' geçersiz.'); return n; };

// ---------- Takımlar ----------
async function stockByProduct(user, ids, warehouse) {
  if (!ids.length) return new Map();
  const params = [user.tenantId, ...ids];
  let sql = `SELECT product_id,SUM(quantity) AS q FROM stock_records WHERE tenant_id=$1 AND product_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`;
  if (warehouse) { params.push(warehouse); sql += ' AND warehouse_id=$' + params.length; }
  const rows = (await db.query(sql + ' GROUP BY product_id', params)).rows;
  return new Map(rows.map(r => [Number(r.product_id), Number(r.q)]));
}

// Durum: parçalar hedef set sayısını karşılıyor mu. Eksik parça için "tekli sat veya takviye yap" uyarısı üretilir.
async function listSets(user, query = {}) {
  const warehouse = query.warehouse_id ? Number(query.warehouse_id) : null;
  if (warehouse !== null && (!Number.isSafeInteger(warehouse) || warehouse < 1)) fail('Depo geçersiz.');
  const sets = (await db.query('SELECT id,name,target_sets,note FROM product_sets WHERE tenant_id=$1 ORDER BY name', [user.tenantId])).rows;
  const items = (await db.query('SELECT i.set_id,i.product_id,i.quantity,p.name,p.unit FROM product_set_items i JOIN products p ON p.id=i.product_id AND p.tenant_id=i.tenant_id WHERE i.tenant_id=$1 ORDER BY p.name', [user.tenantId])).rows;
  const stock = await stockByProduct(user, [...new Set(items.map(i => Number(i.product_id)))], warehouse);
  const alerts = [];
  const result = sets.map(s => {
    const parts = items.filter(i => Number(i.set_id) === Number(s.id)).map(i => {
      const per = Number(i.quantity), have = stock.get(Number(i.product_id)) || 0, target = Number(s.target_sets), need = per * target, missing = Math.max(0, Math.round((need - have) * 1000) / 1000);
      return { product_id: Number(i.product_id), name: i.name, unit: i.unit, per_set: per, stock: have, needed_for_target: need, missing, complete_sets: Math.floor(have / per + 1e-9) };
    });
    const complete = parts.length ? Math.min(...parts.map(p => p.complete_sets)) : 0;
    for (const p of parts.filter(x => x.missing > 0)) alerts.push({ set_id: Number(s.id), set_name: s.name, product_id: p.product_id, missing: p.missing, message: `${s.name} için ${p.name} ${p.missing} ${p.unit || 'adet'} eksik (hedef ${s.target_sets} takım): tekli sat veya takviye yap.` });
    return { id: Number(s.id), name: s.name, target_sets: Number(s.target_sets), note: s.note, complete_sets: complete, ok: complete >= Number(s.target_sets), parts };
  });
  return { sets: result, alerts };
}

async function saveSet(user, id, body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 120) fail('Takım adı 2-120 karakter olmalı.');
  const target = Number.isInteger(Number(body.target_sets)) ? Number(body.target_sets) : 1;
  if (target < 1 || target > 1000) fail('Hedef takım sayısı 1-1000 olmalı.');
  const parts = Array.isArray(body.items) ? body.items : [];
  if (!parts.length || parts.length > 60) fail('Takımda 1-60 parça olmalı.');
  const seen = new Set(), clean = parts.map(p => { const pid = Number(p?.product_id); if (!Number.isSafeInteger(pid) || pid < 1 || seen.has(pid)) fail('Parça listesi geçersiz veya tekrar ediyor.'); seen.add(pid); return { pid, qty: positive(p.quantity, 'Parça adedi', 1000) }; });
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null;
  return db.transaction(async tx => {
    for (const p of clean) if (!(await tx.query("SELECT id FROM products WHERE id=$1 AND tenant_id=$2", [p.pid, user.tenantId])).rows[0]) fail('Ürün bulunamadı: ' + p.pid, 404);
    let setId;
    if (id) {
      setId = Number(id);
      const done = await tx.query('UPDATE product_sets SET name=$1,target_sets=$2,note=$3 WHERE id=$4 AND tenant_id=$5', [name, target, note, setId, user.tenantId]);
      if (done.rowCount !== 1) fail('Takım bulunamadı.', 404);
      await tx.query('DELETE FROM product_set_items WHERE set_id=$1 AND tenant_id=$2', [setId, user.tenantId]);
    } else {
      setId = Number((await tx.query('INSERT INTO product_sets (tenant_id,name,target_sets,note) VALUES ($1,$2,$3,$4) RETURNING id', [user.tenantId, name, target, note])).rows[0].id);
    }
    for (const p of clean) await tx.query('INSERT INTO product_set_items (set_id,tenant_id,product_id,quantity) VALUES ($1,$2,$3,$4)', [setId, user.tenantId, p.pid, p.qty]);
    return { id: setId, name };
  });
}

async function deleteSet(user, id) {
  const setId = Number(id);
  return db.transaction(async tx => {
    const done = await tx.query('DELETE FROM product_sets WHERE id=$1 AND tenant_id=$2', [setId, user.tenantId]);
    if (done.rowCount !== 1) fail('Takım bulunamadı.', 404);
    await tx.query('DELETE FROM product_set_items WHERE set_id=$1 AND tenant_id=$2', [setId, user.tenantId]);
    return { id: setId, deleted: true };
  });
}

// ---------- Hassas raf konumu ----------
async function locations(user, query = {}) {
  const warehouse = query.warehouse_id ? Number(query.warehouse_id) : null;
  const params = [user.tenantId]; let sql = 'SELECT id,warehouse_id,location_code,zone_name,aisle_code,rack_number,shelf_tier,bin_position FROM warehouse_locations WHERE tenant_id=$1';
  if (warehouse) { params.push(warehouse); sql += ' AND warehouse_id=$2'; }
  const rows = (await db.query(sql + ' ORDER BY location_code LIMIT 500', params)).rows;
  const tags = (await db.query('SELECT location_id,tag FROM location_tags WHERE tenant_id=$1', [user.tenantId])).rows;
  return { items: rows.map(l => ({ id: Number(l.id), warehouse_id: Number(l.warehouse_id), code: l.location_code, zone: l.zone_name, aisle: l.aisle_code, rack: Number(l.rack_number), shelf: Number(l.shelf_tier), bin: Number(l.bin_position), tags: tags.filter(t => Number(t.location_id) === Number(l.id)).map(t => t.tag) })) };
}

async function setTags(user, locationId, tags) {
  const id = Number(locationId);
  if (!Array.isArray(tags) || tags.length > 8) fail('En çok 8 etiket verilebilir.');
  const clean = [...new Set(tags.map(t => String(t ?? '').trim()))].filter(Boolean);
  if (clean.some(t => t.length > 30 || /[\x00-\x1f<>]/.test(t))) fail('Etiket en çok 30 karakter olmalı.');
  return db.transaction(async tx => {
    if (!(await tx.query('SELECT id FROM warehouse_locations WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0]) fail('Konum bulunamadı.', 404);
    await tx.query('DELETE FROM location_tags WHERE tenant_id=$1 AND location_id=$2', [user.tenantId, id]);
    for (const tag of clean) await tx.query('INSERT INTO location_tags (tenant_id,location_id,tag) VALUES ($1,$2,$3)', [user.tenantId, id, tag]);
    return { location_id: id, tags: clean };
  });
}

// Çırak yanlış rafa koymasın: kırılgan ürün yalnız "Kırılgan bölge" veya "Vitrin" etiketli rafa; alt rafa ve ağır ürün rafına uyarı.
async function placementCheck(user, query = {}) {
  const product = Number(query.product_id), location = Number(query.location_id);
  if (!Number.isSafeInteger(product) || product < 1 || !Number.isSafeInteger(location) || location < 1) fail('Ürün ve konum gerekli.');
  const p = (await db.query('SELECT id,name FROM products WHERE id=$1 AND tenant_id=$2', [product, user.tenantId])).rows[0];
  const l = (await db.query('SELECT id,location_code FROM warehouse_locations WHERE id=$1 AND tenant_id=$2', [location, user.tenantId])).rows[0];
  if (!p || !l) fail('Ürün veya konum bulunamadı.', 404);
  const fragile = (await db.query("SELECT attr_value FROM product_attributes WHERE tenant_id=$1 AND product_id=$2 AND attr_key='fragile'", [user.tenantId, product])).rows[0]?.attr_value === '1';
  const tags = (await db.query('SELECT tag FROM location_tags WHERE tenant_id=$1 AND location_id=$2', [user.tenantId, location])).rows.map(t => t.tag);
  const warnings = [];
  if (fragile) {
    if (!tags.some(t => SAFE_FOR_FRAGILE.includes(t))) warnings.push(`${p.name} kırılgan; ${l.location_code} rafı "Kırılgan bölge" veya "Vitrin" olarak işaretli değil.`);
    if (tags.includes('Alt raf')) warnings.push('Kırılgan ürün alt rafa konmaz (ezilme/kırılma riski).');
    if (tags.includes('Ağır ürün')) warnings.push('Bu raf ağır ürünler için ayrılmış; kırılgan ürün altında ezilebilir.');
  } else if (tags.includes('Kırılgan bölge')) warnings.push(`${l.location_code} kırılgan ürünlere ayrılmış bir bölge; sıradan ürün koymayın.`);
  return { ok: warnings.length === 0, fragile, tags, warnings };
}

// Telefonda "fiyat güncellendi": satış fiyatı değişir; etiket kuyruğa istemciden mevcut etiket servisiyle gönderilir.
async function priceLabel(user, body = {}, key) {
  const product = Number(body.product_id), price = Number(body.price);
  if (!Number.isSafeInteger(product) || product < 1) fail('Ürün geçersiz.');
  if (!Number.isFinite(price) || price < 0 || price > 99999999) fail('Fiyat geçersiz.');
  const rounded = Math.round(price * 100) / 100;
  return db.transaction(async tx => {
    const p = (await tx.query("SELECT id,name,sale_price FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [product, user.tenantId])).rows[0];
    if (!p) fail('Ürün bulunamadı.', 404);
    const before = Number(p.sale_price);
    if (before !== rounded) {
      await tx.query('UPDATE products SET sale_price=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [rounded, product, user.tenantId]);
      await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'tableware.price_updated', 'product', product, JSON.stringify({ before, after: rounded })]);
    }
    return { product_id: product, name: p.name, price: rounded, previous_price: before, changed: before !== rounded };
  });
}

module.exports = { PRESET_TAGS, listSets, saveSet, deleteSet, locations, setTags, placementCheck, priceLabel };
