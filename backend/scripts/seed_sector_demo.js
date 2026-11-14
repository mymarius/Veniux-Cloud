'use strict';
// Sektör paketleri için örnek veri: müşteri demosunu gerçek veriye benzer ürünlerle gösterir.
// Kullanım (canlıda Plesk Node konsolu):
//   exec -- node --env-file=../cloud-private/install.env backend/scripts/seed_sector_demo.js --tenant 7 --sector hirdavat
//   --sector: hirdavat | zuccaciye | pide | hepsi    (aynı komut tekrar çalışırsa mevcut örnek veriye dokunmaz)
// Yalnızca "Veniux Demo – " ile başlayan işletmede çalışır; gerçek müşteri verisine yazmaz. Sektör paketini de bu işletme için açar.
const args = process.argv.slice(2);
const read = name => { const at = args.indexOf('--' + name); return at >= 0 ? args[at + 1] : undefined; };

const PACKS = { hirdavat: ['hardware'], zuccaciye: ['tableware'], pide: ['restaurant'], hepsi: ['hardware', 'tableware', 'restaurant'] };
function ean13(seed) {
  const d = ('869' + String(seed).padStart(9, '0')).slice(0, 12).split('').map(Number);
  return d.join('') + ((10 - (d.reduce((t, n, i) => t + n * (i % 2 ? 3 : 1), 0) % 10)) % 10);
}

(async () => {
  const db = require('../src/config/database');
  await db.ready;
  const tenantId = Number(read('tenant')), sector = read('sector') || 'hepsi';
  if (!Number.isSafeInteger(tenantId) || tenantId < 1 || !PACKS[sector]) throw new Error('Kullanım: --tenant <işletme no> --sector hirdavat|zuccaciye|pide|hepsi');
  const tenant = (await db.query('SELECT id,name FROM tenants WHERE id=$1', [tenantId])).rows[0];
  if (!tenant) throw new Error('İşletme bulunamadı.');
  if (!String(tenant.name).startsWith('Veniux Demo')) throw new Error('Güvenlik: yalnız "Veniux Demo – " ile başlayan işletmeye örnek veri yazılır.');
  const admin = (await db.query("SELECT id,email FROM users WHERE tenant_id=$1 AND role='admin' ORDER BY id LIMIT 1", [tenantId])).rows[0];
  if (!admin) throw new Error('İşletmede yönetici kullanıcı yok.');
  const user = { tenantId, userId: Number(admin.id), email: admin.email, role: 'admin', accessScope: { mode: 'company' } };

  // Depo: ana mağaza (yoksa oluştur). Örnek stoklar buraya girer.
  let warehouse = (await db.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND warehouse_type='NORMAL' ORDER BY id LIMIT 1", [tenantId])).rows[0];
  if (!warehouse) warehouse = (await db.query("INSERT INTO warehouses (name,type,warehouse_type,tenant_id) VALUES ('Ana Mağaza','MAIN','NORMAL',$1) RETURNING id", [tenantId])).rows[0];
  const warehouseId = Number(warehouse.id);
  let supplier = (await db.query("SELECT id FROM suppliers WHERE tenant_id=$1 AND name='Örnek Toptancı' LIMIT 1", [tenantId])).rows[0];
  if (!supplier) supplier = (await db.query("INSERT INTO suppliers (tenant_id,name,phone,lead_time_days) VALUES ($1,'Örnek Toptancı','05550000000',3) RETURNING id", [tenantId])).rows[0];

  let seq = 0;
  const added = [];
  async function product(sku, name, price, buy, stock, extra = {}) {
    const code = `DEMO-${tenantId}-${sku}`; // SKU işletmeler arasında benzersizdir
    let row = (await db.query('SELECT id FROM products WHERE tenant_id=$1 AND sku=$2', [tenantId, code])).rows[0];
    if (!row) {
      seq += 1;
      // Barkod SKU'dan kararlı olarak türetilir ve işletmede kullanılmıyorsa alınır; çakışırsa bir sonraki boş değer (iki ürün aynı barkodu almaz).
      let barcode = null;
      if (!extra.noBarcode) {
        let n = 10000 + ([...code].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 80000, 7));
        for (;;) {
          barcode = ean13(tenantId * 100000 + n);
          const used = (await db.query('SELECT id FROM products WHERE tenant_id=$1 AND (barcode=$2 OR gtin=$2 OR sku=$2) UNION SELECT product_id FROM product_uoms WHERE tenant_id=$1 AND barcode=$2', [tenantId, barcode])).rows[0];
          if (!used) break;
          n += 1;
        }
      }
      row = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,category,unit,purchase_price,sale_price,kdv_orani,min_stock_level,supplier_id,module_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'NORMAL') RETURNING id", [tenantId, code, name, barcode, extra.category || 'Genel', extra.unit || 'adet', buy, price, extra.vat ?? 20, extra.min ?? 0, extra.supplier === false ? null : Number(supplier.id)])).rows[0];
      if (stock > 0) await db.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)', [tenantId, row.id, warehouseId, stock]);
      added.push(name);
    }
    return Number(row.id);
  }
  const attr = (id, a) => require('../src/services/hardwareService').setAttributes(user, id, a);
  const units = (id, list) => require('../src/services/productUnits').save(user, id, { units: list });

  if (['hirdavat', 'hepsi'].includes(sector)) {
    const vida = await product('H-VIDA4', 'Vida M4x30 galvaniz', 2, 1.1, 1270, { category: 'Bağlantı', min: 400 });
    const vida5 = await product('H-VIDA5', 'Vida M5x40 galvaniz', 2.6, 1.4, 850, { category: 'Bağlantı', min: 300 });
    const dubel = await product('H-DUBEL8', 'Dübel 8 mm gri', 0.8, 0.45, 40, { category: 'Bağlantı', min: 500 });
    const dubelF = await product('H-DUBEL8F', 'Fischer dübel 8 mm', 1.1, 0.7, 600, { category: 'Bağlantı', supplier: false });
    const civata = await product('H-CIVATA10', 'Cıvata M10x60 çinko', 6, 3.2, 180, { category: 'Cıvata', min: 100 });
    const kablo = await product('H-KABLO25', 'NYA kablo 2,5 mm', 12, 8.2, 230.5, { category: 'Elektrik', unit: 'metre', min: 100 });
    const hortum = await product('H-HORTUM', 'Bahçe hortumu 1/2"', 22, 14, 120, { category: 'Bahçe', unit: 'metre', min: 50 });
    await product('H-MATKAP', 'Matkap ucu seti 13 parça', 249, 160, 21, { category: 'El aleti', min: 10 });
    await product('H-ANAHTAR', 'Fransız anahtarı 10"', 189, 118, 14, { category: 'El aleti', min: 6 });
    await product('H-BOYA', 'İç cephe boyası 15 L', 1190, 820, 9, { category: 'Boya', min: 8 });
    await product('H-SILIKON', 'Silikon şeffaf 280 ml', 79, 48, 64, { category: 'Yapıştırıcı', min: 20 });
    await product('H-ELDIVEN', 'İş eldiveni', 35, 19, 4, { category: 'İş güvenliği', min: 24 });
    await attr(vida, { size: 'M4x30', diameter: '4 mm', length: '30 mm', material: 'Çelik', finish: 'Galvaniz', equiv: 'VIDA-M4' });
    await attr(vida5, { size: 'M5x40', diameter: '5 mm', length: '40 mm', material: 'Çelik', finish: 'Galvaniz' });
    await attr(dubel, { size: '8 mm', diameter: '8 mm', length: '40 mm', material: 'Naylon', equiv: 'DUBEL-8' });
    await attr(dubelF, { size: '8 mm', diameter: '8 mm', material: 'Naylon', equiv: 'DUBEL-8' });
    await attr(civata, { size: 'M10x60', diameter: '10 mm', length: '60 mm', material: 'Çelik', finish: 'Çinko' });
    await units(vida, [{ unit: 'koli', factor: 200, barcode: ean13(tenantId * 1000 + 901), price: '360' }, { unit: 'paket', factor: 50, barcode: ean13(tenantId * 1000 + 902) }, { unit: 'kg', factor: 250, price: '420' }]);
    await units(dubel, [{ unit: 'paket', factor: 100, price: '70' }]);
    await units(kablo, [{ unit: 'makara', factor: 100, barcode: ean13(tenantId * 1000 + 903), price: '1100' }]);
    await units(hortum, [{ unit: 'rulo', factor: 25, price: '500' }]);
  }

  if (['zuccaciye', 'hepsi'].includes(sector)) {
    const bardak = await product('Z-BARDAK', 'Çay bardağı ince belli', 20, 9, 120, { category: 'Bardak', min: 36, vat: 10 });
    const tabak = await product('Z-TABAK', 'Çay tabağı', 15, 7, 120, { category: 'Tabak', min: 36, vat: 10 });
    const seker = await product('Z-SEKER', 'Şekerlik cam kapaklı', 70, 38, 20, { category: 'Servis', min: 6, vat: 10 });
    const yemek = await product('Z-YEMEK', 'Yemek tabağı 26 cm', 45, 24, 96, { category: 'Tabak', min: 24, vat: 10 });
    const corba = await product('Z-CORBA', 'Çorba kasesi', 38, 20, 72, { category: 'Kase', min: 24, vat: 10 });
    await product('Z-TENCERE', 'Çelik tencere 24 cm', 690, 420, 12, { category: 'Tencere', min: 4, vat: 10 });
    await product('Z-TAVA', 'Granit tava 28 cm', 520, 310, 9, { category: 'Tencere', min: 4, vat: 10 });
    await product('Z-CATAL', 'Çatal bıçak takımı 24 parça', 890, 520, 7, { category: 'Çatal bıçak', min: 3, vat: 10 });
    await product('Z-VAZO', 'Cam vazo 30 cm', 320, 170, 5, { category: 'Dekor', min: 2, vat: 10 });
    for (const id of [bardak, tabak, seker, yemek, corba]) await attr(id, { fragile: '1' });
    const tw = require('../src/services/tablewareService'), extras = require('../src/services/tablewareExtras');
    let set = (await db.query("SELECT id FROM product_sets WHERE tenant_id=$1 AND name='6 kişilik çay takımı'", [tenantId])).rows[0];
    if (!set) set = await tw.saveSet(user, null, { name: '6 kişilik çay takımı', target_sets: 3, items: [{ product_id: bardak, quantity: 6 }, { product_id: tabak, quantity: 6 }, { product_id: seker, quantity: 1 }] });
    await tw.setSale(user, Number(set.id), { barcode: ean13(tenantId * 1000 + 950), price: '249,90' });
    let yemekSet = (await db.query("SELECT id FROM product_sets WHERE tenant_id=$1 AND name='6 kişilik yemek takımı'", [tenantId])).rows[0];
    if (!yemekSet) await tw.saveSet(user, null, { name: '6 kişilik yemek takımı', target_sets: 2, items: [{ product_id: yemek, quantity: 6 }, { product_id: corba, quantity: 6 }] });
    if (!(await db.query("SELECT id FROM gift_registries WHERE tenant_id=$1 AND title='Ayşe & Mehmet çeyiz listesi'", [tenantId])).rows[0]) {
      const reg = await extras.saveRegistry(user, null, { title: 'Ayşe & Mehmet çeyiz listesi', owner_name: 'Ayşe Demir', phone: '0532 000 00 00', event_date: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10) });
      await extras.addRegistryItem(user, reg.id, { set_id: Number(set.id), wanted: 2 });
      await extras.addRegistryItem(user, reg.id, { product_id: seker, wanted: 1 });
    }
  }

  if (['pide', 'hepsi'].includes(sector)) {
    const un = await product('P-UN', 'Un (kg)', 0, 28, 80, { category: 'Malzeme', unit: 'kg', min: 20, vat: 1 });
    const kasar = await product('P-KASAR', 'Kaşar (kg)', 0, 340, 12, { category: 'Malzeme', unit: 'kg', min: 4, vat: 1 });
    const kiyma = await product('P-KIYMA', 'Kıyma (kg)', 0, 520, 18, { category: 'Malzeme', unit: 'kg', min: 5, vat: 1 });
    const hamur = await product('P-HAMUR', 'Pide hamuru', 0, 0, 0, { category: 'Hazırlık', min: 0, vat: 1, supplier: false });
    const pideK = await product('P-PIDEK', 'Kıymalı pide', 180, 0, 0, { category: 'Pide', vat: 10, supplier: false, noBarcode: true });
    const pideKs = await product('P-PIDEKS', 'Kaşarlı pide', 170, 0, 0, { category: 'Pide', vat: 10, supplier: false, noBarcode: true });
    const lahmacun = await product('P-LAH', 'Lahmacun', 90, 0, 0, { category: 'Pide', vat: 10, supplier: false, noBarcode: true });
    const ayran = await product('P-AYRAN', 'Ayran', 30, 12, 120, { category: 'İçecek', vat: 10, supplier: false });
    const kola = await product('P-KOLA', 'Kola 330 ml', 45, 24, 96, { category: 'İçecek', vat: 10, supplier: false });
    const kunefe = await product('P-KUNEFE', 'Künefe', 140, 0, 0, { category: 'Tatlı', vat: 10, supplier: false, noBarcode: true });
    const rs = require('../src/services/restaurantService');
    // Çok katlı reçete: pide -> hamur -> un.
    await rs.setRecipe(user, hamur, { ingredients: [{ ingredient_id: un, quantity: 0.2 }] });
    await rs.setRecipe(user, pideK, { ingredients: [{ ingredient_id: hamur, quantity: 1 }, { ingredient_id: kiyma, quantity: 0.12 }] });
    await rs.setRecipe(user, pideKs, { ingredients: [{ ingredient_id: hamur, quantity: 1 }, { ingredient_id: kasar, quantity: 0.1 }] });
    await rs.setRecipe(user, lahmacun, { ingredients: [{ ingredient_id: hamur, quantity: 0.5 }, { ingredient_id: kiyma, quantity: 0.06 }] });
    for (const id of [pideK, pideKs, lahmacun, ayran, kola, kunefe]) await rs.setMenu(user, id, { menu: true });
    await rs.setMenuOptions(user, pideK, { options: [{ name: 'Kaşarlı', price: 20, ingredient_id: kasar, ingredient_qty: 0.1 }, { name: 'Yumurtalı', price: 15 }, { name: 'Acılı', price: 0 }, { name: 'Az pişmiş', price: 0 }] });
    await rs.setMenuOptions(user, lahmacun, { options: [{ name: 'Acılı', price: 0 }, { name: 'Bol limon', price: 0 }] });
    const have = new Set((await rs.tables(user)).items.map(t => t.name));
    for (const name of ['Masa 1', 'Masa 2', 'Masa 3', 'Masa 4', 'Bahçe 1', 'Bahçe 2']) if (!have.has(name)) await rs.saveTable(user, null, { name });
  }

  for (const pack of PACKS[sector]) await db.query(db.getEngine() === 'mysql' ? 'INSERT IGNORE INTO sector_packs (tenant_id,pack) VALUES ($1,$2)' : 'INSERT OR IGNORE INTO sector_packs (tenant_id,pack) VALUES ($1,$2)', [tenantId, pack]);
  console.log(JSON.stringify({ ok: true, tenant: tenant.name, sector, packs: PACKS[sector], new_products: added.length, warehouse_id: warehouseId }, null, 2));
  await db.close();
})().catch(error => { console.error('ORNEK_VERI_YAZILAMADI:', error.message); process.exit(1); });
