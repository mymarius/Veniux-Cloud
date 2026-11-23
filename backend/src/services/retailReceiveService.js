// Perakende mal kabulü: tek satır (hızlı ekleme) ve toplu kabul aynı satır mantığını kullanır.
// Satır: mevcut ürün (product_id [+ barcode/pack_unit]) ya da yeni ürün (name, unit, purchase_price, sale_price [+ barcode]).
// Miktar her zaman tam sayıdır (koli/paket ile gelirse temel birime çevrilir). Stok ve hareket kaydı çağıranın işlemi içinde yazılır.
const crypto = require('crypto');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const MAX_BATCH_LINES = 500;

function barcode(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 128 || /[\x00-\x1f]/.test(value)) fail('Geçerli bir barkod girin.');
  return value.trim();
}

// Veritabanına dokunmayan biçim denetimi. Dönüş: { code, qty }
function checkLine(body) {
  if (!body || typeof body !== 'object') fail('Satır geçersiz.');
  const code = body.barcode ? barcode(body.barcode) : null;
  const qty = Number(body.quantity);
  if (!['number', 'string'].includes(typeof body.quantity) || !Number.isSafeInteger(qty) || qty <= 0 || qty > 1000000) fail('Miktar 1 ile 1.000.000 arasında tam sayı olmalıdır.');
  if (body.pack_unit !== undefined && (typeof body.pack_unit !== 'string' || !body.pack_unit.trim() || body.pack_unit.length > 20)) fail('Ambalaj birimi geçersiz.');
  return { code, qty };
}

// Tek satırı işler: ürünü bulur/oluşturur, stoğu artırır, hareket ve denetim kaydı yazar. Dönüş: satır sonucu.
// ctx: { tenant, user, requestId }; opts: { source, note, reason }
async function receiveLine(client, ctx, warehouse, body, opts = {}) {
  const { tenant, user, requestId } = ctx;
  const source = opts.source || 'retail_quick_add', note = opts.note || 'Telefon / terminal hızlı kabul', reason = opts.reason || 'retail_quick_add';
  const { code, qty } = checkLine(body);
  let product, created = false;
  if (body.product_id) {
    product = (await client.query("SELECT * FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [body.product_id, tenant])).rows[0];
    if (!product) fail('Ürün bulunamadı.', 404);
    if (code && product.barcode !== code && !(await client.query('SELECT id FROM product_uoms WHERE tenant_id=$1 AND product_id=$2 AND barcode=$3', [tenant, product.id, code])).rows.length) fail('Barkod ile ürün eşleşmiyor.', 409);
  } else {
    if (body.pack_unit !== undefined) fail('Yeni ürün koli/paket ile kabul edilemez; önce ürünü adet olarak ekleyip birimlerini tanımlayın.');
    if (code && (await client.query('SELECT id FROM products WHERE tenant_id=$1 AND barcode=$2', [tenant, code])).rows.length) fail('Ürün zaten kayıtlı. Barkodu yeniden sorgulayın.', 409);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200) fail('Ürün adı gerekli.');
    for (const field of ['purchase_price', 'sale_price']) if (!['number', 'string'].includes(typeof body[field]) || String(body[field]).trim() === '' || !Number.isFinite(Number(body[field])) || Number(body[field]) < 0 || Number(body[field]) > 10000000 || Math.abs(Number(body[field]) * 100 - Math.round(Number(body[field]) * 100)) > 0.00001) fail('Fiyatları en fazla iki ondalık basamakla girin.');
    if (!['adet', 'paket', 'kutu', 'kg', 'litre', 'metre'].includes(body.unit)) fail('Geçerli bir birim seçin.');
    product = (await client.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,purchase_price,sale_price,category,module_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'NORMAL') RETURNING *", [tenant, 'RTL-' + crypto.randomUUID(), body.name.trim(), code, body.unit, Number(body.purchase_price), Number(body.sale_price), 'Perakende'])).rows[0];
    created = true;
  }
  // Koli/paket ile kabul: okutulan barkod bir birimse ya da birim adı verildiyse miktar temel birime çevrilir.
  let pack = null;
  if (body.product_id) {
    const byCode = code && product.barcode !== code ? (await client.query('SELECT uom_code,conversion_factor FROM product_uoms WHERE tenant_id=$1 AND product_id=$2 AND barcode=$3', [tenant, product.id, code])).rows[0] : null;
    const byName = body.pack_unit !== undefined ? (await client.query('SELECT uom_code,conversion_factor FROM product_uoms WHERE tenant_id=$1 AND product_id=$2 AND uom_code=$3', [tenant, product.id, body.pack_unit.trim().toLocaleLowerCase('tr-TR')])).rows[0] : null;
    if (body.pack_unit !== undefined && !byName) fail('Bu üründe "' + body.pack_unit + '" birimi tanımlı değil.', 404);
    if (byCode && byName && byCode.uom_code !== byName.uom_code) fail('Okutulan barkod ile seçilen birim farklı.', 409);
    pack = byCode || byName || null;
  }
  const units = pack ? qty : null, factor = pack ? Number(pack.conversion_factor) : 1, baseQty = Math.round(qty * factor * 1e6) / 1e6;
  if (!Number.isSafeInteger(baseQty)) fail(`1 ${pack.uom_code} = ${factor} ${product.unit || 'adet'}; kabul edilen toplam tam sayı olmalı.`);
  const current = (await client.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3', [tenant, product.id, warehouse.id])).rows[0];
  const total = Number(current?.quantity || 0) + baseQty;
  if (!Number.isSafeInteger(total)) fail('Stok miktarı sınırı aşıldı.');
  if (current) await client.query('UPDATE stock_records SET quantity=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [total, current.id]);
  else await client.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)', [tenant, product.id, warehouse.id, baseQty]);
  const movement = (await client.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'inbound',$5,$6) RETURNING id", [tenant, product.id, warehouse.id, baseQty, source, note])).rows[0];
  await require('./inventoryTransactionService').recordProjectedEntry(client, { tenant_id: tenant, warehouse_id: warehouse.id, product_id: product.id, transaction_type: 'RECEIVE', quantity: baseQty, reference_type: 'stock_movement', reference_id: movement.id, user_id: user.userId, reason_code: reason });
  await client.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'retail.receive','stock',$3,$4)", [tenant, user.email, movement.id, JSON.stringify({ requestId, productId: product.id, warehouseId: warehouse.id, quantity: baseQty, pack: pack ? { unit: pack.uom_code, count: units, factor } : null, ...(opts.batch ? { batch: opts.batch } : {}) })]);
  if (created && code) await require('./sharedCatalogService').contribute(client, { tenantId: tenant, barcode: code, name: product.name, unit: product.unit });
  return { product: { id: product.id, name: product.name, unit: product.unit }, quantity: baseQty, pack: pack ? { unit: pack.uom_code, count: units, factor } : null, total_quantity: total, movement_id: movement.id, created };
}

// Toplu kabul: tüm satırlar tek işlemde (hepsi ya da hiçbiri). Aynı barkodla yeni ürün birden fazla satırda gelirse ilk satır ürünü
// oluşturur, sonrakiler o ürüne eklenir. Dönüş: { lines, line_count, total_units, new_products }
async function receiveBatch(client, ctx, warehouse, lines, batchId) {
  const out = [], createdByCode = new Map();
  let totalUnits = 0, newProducts = 0;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    try {
      const code = line && typeof line.barcode === 'string' ? line.barcode.trim() : null;
      if (!line.product_id && code && createdByCode.has(code)) line = { warehouse_id: line.warehouse_id, product_id: createdByCode.get(code), barcode: code, quantity: line.quantity };
      const r = await receiveLine(client, ctx, warehouse, line, { source: 'retail_bulk_receive', note: 'Toplu mal kabul', reason: 'retail_bulk_receive', batch: batchId });
      if (r.created) { newProducts++; if (code) createdByCode.set(code, r.product.id); }
      totalUnits += r.quantity;
      out.push({ index: i, ...r });
    } catch (error) {
      error.line_index = i;
      error.message = 'Satır ' + (i + 1) + ': ' + error.message;
      throw error;
    }
  }
  return { lines: out, line_count: out.length, total_units: totalUnits, new_products: newProducts };
}

module.exports = { checkLine, receiveLine, receiveBatch, MAX_BATCH_LINES };
