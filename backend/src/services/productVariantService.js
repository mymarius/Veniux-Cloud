const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Varyantlı ürün: her beden/renk kombinasyonu kendi barkodu, stoğu ve fiyatı olan gerçek bir üründür.
// Böylece kasa, stok, sayım ve rapor mevcut akışlarla aynen çalışır; yalnız toplu oluşturma kolaylaştırılır.
const MAX_COMBOS = 120;
const slug = v => String(v).trim().toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').replace(/[^A-Z0-9]+/g, '').slice(0, 12);
const clean = list => [...new Set((Array.isArray(list) ? list : String(list || '').split(',')).map(v => String(v).trim()).filter(Boolean))].slice(0, 40);

function ean13(body12) {
  const sum = [...body12].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body12 + ((10 - (sum % 10)) % 10);
}

async function freeBarcode(tx, tenantId, seed) {
  for (let n = 0; n < 50; n++) {
    const body = '29' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
    const code = ean13(body);
    if (!(await tx.query('SELECT 1 FROM products WHERE tenant_id=$1 AND barcode=$2', [tenantId, code])).rows.length) return code;
  }
  fail('Barkod üretilemedi, tekrar deneyin.', 500);
}

async function create(user, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  const name = String(body.name || '').trim(), prefix = slug(body.sku_prefix || '');
  if (!name) fail('Ürün adı gerekli.');
  if (!prefix) fail('Stok kodu öneki gerekli (örn. TS).');
  const sizes = clean(body.sizes), colors = clean(body.colors);
  if (!sizes.length && !colors.length) fail('En az bir beden veya renk girin.');
  const combos = [];
  for (const s of sizes.length ? sizes : [null]) for (const c of colors.length ? colors : [null]) combos.push({ size: s, color: c });
  if (combos.length > MAX_COMBOS) fail(`Tek seferde en fazla ${MAX_COMBOS} çeşit oluşturulabilir (şu an ${combos.length}).`);
  const sale = Number(body.sale_price ?? 0), buy = Number(body.purchase_price ?? 0), vat = Number(body.kdv_orani ?? 10);
  if (![sale, buy].every(v => Number.isFinite(v) && v >= 0)) fail('Fiyatlar geçersiz.');
  if (!require('./retailCostService').vatValid(vat)) fail('KDV oranı geçersiz.');
  const category = String(body.category || '').trim() || 'Genel';
  return db.transaction(async tx => {
    const created = [], skipped = [];
    for (const { size, color } of combos) {
      const parts = [size, color].filter(Boolean);
      const sku = [prefix, ...parts.map(slug)].join('-'), label = [name, ...parts].join(' · ');
      if ((await tx.query('SELECT 1 FROM products WHERE tenant_id=$1 AND sku=$2', [user.tenantId, sku])).rows.length) { skipped.push(sku); continue; }
      const barcode = await freeBarcode(tx, user.tenantId);
      await tx.query("INSERT INTO products (sku,name,category,barcode,unit,purchase_price,sale_price,min_stock_level,max_stock_level,tenant_id,module_type,is_medicine,kdv_orani) VALUES ($1,$2,$3,$4,'adet',$5,$6,0,1000,$7,'NORMAL',0,$8)", [sku, label, category, barcode, buy, sale, user.tenantId, vat]);
      created.push({ sku, name: label, barcode });
    }
    return { created, skipped };
  });
}

module.exports = { create, MAX_COMBOS, ean13 };
