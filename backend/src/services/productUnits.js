'use strict';
// Ürün birimleri (ambalaj/ölçü): ürünün stok birimi temel birimdir (adet, metre, kg...). Koli, paket, makara gibi
// birimler temel birimin katıdır: "1 koli = 200 adet", "1 makara = 100 metre". Mevcut product_uoms tablosu kullanılır;
// kasa (scannerService.lookup) birimin barkodunu okutunca çarpan kadar temel birim satar ve stoktan düşer.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const round = (v, d = 6) => Math.round(Number(v) * 10 ** d) / 10 ** d;
const SUGGESTED = ['koli', 'paket', 'kutu', 'düzine', 'deste', 'makara', 'top', 'rulo', 'çuval', 'kova', 'set', 'kg', 'metre'];
const MAX_UNITS = 6;

async function productOf(tx, user, productId) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id < 1) fail('Ürün geçersiz.');
  const p = (await tx.query("SELECT id,name,unit,barcode,sale_price FROM products WHERE id=$1 AND tenant_id=$2 AND module_type='NORMAL'", [id, user.tenantId])).rows[0];
  if (!p) fail('Ürün bulunamadı.', 404);
  return p;
}

const shape = (p, rows) => {
  const base = Number(p.sale_price);
  return rows.map(u => ({ unit: u.uom_code, factor: round(u.conversion_factor), barcode: u.barcode || null, price: Math.round(base * Number(u.conversion_factor) * 100) / 100 }))
    .sort((a, b) => a.factor - b.factor);
};

async function list(user, productId, tx = db) {
  const p = await productOf(tx, user, productId);
  const rows = (await tx.query('SELECT uom_code,conversion_factor,barcode FROM product_uoms WHERE tenant_id=$1 AND product_id=$2 AND COALESCE(is_base_uom,0)=0', [user.tenantId, p.id])).rows;
  return { product_id: Number(p.id), base_unit: p.unit || 'adet', units: shape(p, rows), suggested: SUGGESTED };
}

// Tüm birimler tek seferde kaydedilir (eksik olan silinir). Barkod işletmede eşsiz olmalı: başka ürünün veya
// başka birimin barkoduyla çakışırsa kasa yanlış ürünü/miktarı satar.
async function save(user, productId, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Ürün birimlerini yalnız yönetici ve müdür değiştirir.', 403);
  const input = Array.isArray(body.units) ? body.units : null;
  if (!input || input.length > MAX_UNITS) fail(`Bir üründe en çok ${MAX_UNITS} birim tanımlanır.`);
  return db.transaction(async tx => {
    const p = await productOf(tx, user, productId);
    const baseUnit = String(p.unit || 'adet').toLocaleLowerCase('tr-TR');
    const seenUnit = new Set(), seenCode = new Set();
    const clean = input.map(u => {
      const unit = typeof u?.unit === 'string' ? u.unit.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ') : '';
      if (unit.length < 1 || unit.length > 20 || /[<>\x00-\x1f]/.test(unit)) fail('Birim adı 1-20 karakter olmalı.');
      if (unit === baseUnit) fail(`"${unit}" ürünün temel birimi; ayrıca tanımlanmaz.`);
      if (seenUnit.has(unit)) fail(`"${unit}" birimi iki kez yazılmış.`);
      seenUnit.add(unit);
      const factor = Number(String(u.factor ?? '').replace(',', '.'));
      if (!Number.isFinite(factor) || factor <= 0 || factor > 1000000) fail(`1 ${unit} kaç ${baseUnit}? 0'dan büyük bir sayı yazın.`);
      if (Math.abs(factor - 1) < 1e-9) fail(`1 ${unit} = 1 ${baseUnit} olamaz; aynı birimdir.`);
      const code = typeof u.barcode === 'string' && u.barcode.trim() ? u.barcode.trim() : null;
      if (code !== null) {
        if (code.length > 64 || /[\x00-\x1f\s]/.test(code)) fail(`${unit} barkodu geçersiz.`);
        if (seenCode.has(code)) fail(`${code} barkodu iki birimde kullanılmış.`);
        seenCode.add(code);
      }
      return { unit, factor: round(factor), barcode: code };
    });
    for (const u of clean.filter(x => x.barcode)) {
      const product = (await tx.query("SELECT id,name FROM products WHERE tenant_id=$1 AND (barcode=$2 OR gtin=$2 OR sku=$2)", [user.tenantId, u.barcode])).rows[0];
      if (product) fail(`${u.barcode} barkodu "${product.name}" ürününe ait; ${u.unit} için başka barkod kullanın.`, 409);
      const other = (await tx.query('SELECT u.product_id,p.name FROM product_uoms u JOIN products p ON p.id=u.product_id WHERE u.tenant_id=$1 AND u.barcode=$2 AND u.product_id<>$3', [user.tenantId, u.barcode, p.id])).rows[0];
      if (other) fail(`${u.barcode} barkodu "${other.name}" ürününün bir biriminde kullanılıyor.`, 409);
    }
    const before = (await tx.query('SELECT uom_code,conversion_factor,barcode FROM product_uoms WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, p.id])).rows;
    await tx.query('DELETE FROM product_uoms WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, p.id]);
    for (const u of clean) await tx.query('INSERT INTO product_uoms (tenant_id,product_id,uom_code,conversion_factor,is_base_uom,barcode) VALUES ($1,$2,$3,$4,0,$5)', [user.tenantId, p.id, u.unit, u.factor, u.barcode]);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'product.units_updated', 'product', p.id,
      JSON.stringify({ before: before.map(b => ({ unit: b.uom_code, factor: Number(b.conversion_factor), barcode: b.barcode })), after: clean })]);
    return list(user, p.id, tx);
  });
}

// "1.250 adet" yerine "6 koli + 50 adet": en büyük tam katlı birimden başlayarak böler. Ondalık temel birimde (metre, kg)
// kalan küsuratlı gösterilir. Negatif stokta bölme yapılmaz.
function breakdown(quantity, baseUnit, units) {
  const q = round(quantity);
  const base = baseUnit || 'adet';
  if (!(q > 0) || !units || !units.length) return null;
  const parts = [];
  let rest = q;
  for (const u of [...units].filter(x => x.factor > 1).sort((a, b) => b.factor - a.factor)) {
    const n = Math.floor(rest / u.factor + 1e-9);
    if (n > 0) { parts.push(`${n} ${u.unit}`); rest = round(rest - n * u.factor); }
  }
  if (!parts.length) return null;
  if (rest > 1e-9) parts.push(`${String(round(rest, 3)).replace('.', ',')} ${base}`);
  return parts.join(' + ');
}

async function unitsFor(tenantId, productIds, tx = db) {
  const map = new Map();
  if (!productIds.length) return map;
  const rows = (await tx.query(`SELECT product_id,uom_code,conversion_factor,barcode FROM product_uoms WHERE tenant_id=$1 AND COALESCE(is_base_uom,0)=0 AND product_id IN (${productIds.map((_, i) => '$' + (i + 2)).join(',')})`, [tenantId, ...productIds])).rows;
  for (const r of rows) map.set(Number(r.product_id), [...(map.get(Number(r.product_id)) || []), { unit: r.uom_code, factor: round(r.conversion_factor), barcode: r.barcode || null }]);
  return map;
}

module.exports = { list, save, breakdown, unitsFor, SUGGESTED };
