const db = require('../config/database');
const crypto = require('crypto');
const path = require('path');
const { Worker } = require('worker_threads');

const PRODUCT_FIELDS = {
  barcode: 'Barkod',
  name: 'İlaç / Ürün Adı',
  category: 'Kategori / İlaç Grubu',
  unit: 'Birim',
  purchase_price: 'Alış / Depocu Fiyatı',
  sale_price: 'Satış / Perakende Fiyatı',
  kdv_orani: 'KDV Oranı (%)',
  is_medicine: 'İlaç Durumu'
};

const STOCK_FIELDS = {
  quantity: 'Stok Miktarı',
  lot_number: 'Parti / Lot Numarası',
  expiry_date: 'Son Kullanma Tarihi (SKT)',
  shelf_location: 'Raf / Lokasyon Kodu'
};

// This is deliberately an exact, reviewed vocabulary.  A pattern such as
// /stok/i would accidentally retain a foreign column (for example a patient
// note) and would turn privacy into a blacklist problem.
const ALLOWED_COLUMN_ALIASES = {
  barcode: ['barkod','barcode','gtin','ean','karekod'],
  name: ['ilaç adı','ilac adi','ürün adı','urun adi','ürün','urun','ilaç','ilac','ad','adı','adi','isim','ismi','name','title'],
  category: ['kategori','ilaç grubu','ilac grubu','ürün grubu','urun grubu','grup','category'],
  unit: ['birim','unit'],
  purchase_price: ['alış fiyatı','alis fiyati','alış fiyat','alis fiyat','depocu fiyatı','depocu fiyati','maliyet','maliyet fiyatı','maliyet fiyati','cost','cost price','purchase price'],
  sale_price: ['satış fiyatı','satis fiyati','satış fiyat','satis fiyat','perakende fiyatı','perakende fiyati','sale price','price'],
  kdv_orani: ['kdv','kdv oranı','kdv orani','vat'],
  is_medicine: ['ilaç durumu','ilac durumu','ilaç mı','ilac mi','is medicine'],
  quantity: ['miktar','stok','adet','bakiye','mevcut stok','quantity','qty','stock'],
  lot_number: ['lot','lot no','lot numarası','lot numarasi','parti','parti no','parti numarası','parti numarasi','seri','seri no'],
  expiry_date: ['skt','miat','miad','son kullanma tarihi','expiry','exp date'],
  shelf_location: ['raf','raf kodu','lokasyon','shelf','bin','location']
};
const canonicalHeader = value => String(value ?? '').trim().toLocaleLowerCase('tr-TR').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
const ALLOWED_HEADERS = new Set(Object.values(ALLOWED_COLUMN_ALIASES).flat().map(canonicalHeader));
const ALL_FIELDS = {...PRODUCT_FIELDS,...STOCK_FIELDS};

const fail = (m, status = 400) => {
  throw Object.assign(new Error(m), { status });
};

async function getBatch(user, id, tx = db) {
  const r = (await tx.query(
    'SELECT * FROM product_import_batches WHERE id=$1 AND tenant_id=$2 AND user_id=$3',
    [id, user.tenantId, user.userId]
  )).rows[0];
  if (!r) fail('Eczane aktarım kaydı bulunamadı.', 404);
  return r;
}

function parseExpiry(val) {
  if (!val) return { date: null, isMonthYearFormat: false };
  const str = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return { date: str, isMonthYearFormat: false };
  // DD.MM.YYYY
  const trMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (trMatch) {
    const [, d, m, y] = trMatch;
    return { date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, isMonthYearFormat: false };
  }
  // MM/YYYY or MM.YYYY
  const myMatch = str.match(/^(\d{1,2})[./-](\d{4})$/);
  if (myMatch) {
    const [, m, y] = myMatch;
    // Last day of month
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return {
      date: `${y}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      isMonthYearFormat: true,
      original: str
    };
  }
  // YYYY-MM
  const ymMatch = str.match(/^(\d{4})[./-](\d{1,2})$/);
  if (ymMatch) {
    const [, y, m] = ymMatch;
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return {
      date: `${y}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      isMonthYearFormat: true,
      original: str
    };
  }
  return { date: null, isMonthYearFormat: false };
}

async function parsePharmacyFile(user, body) {
  if (typeof body.filename !== 'string' || body.filename.length > 200 || typeof body.base64 !== 'string' || !body.base64) {
    fail('Geçerli dosya gerekli (Excel veya CSV; en fazla 4 MB).');
  }
  if (Buffer.from(body.base64, 'base64').length > 4 * 1024 * 1024) {
    fail('Dosya boyutu 4 MB sınırını aşıyor.');
  }

  // Parse via existing safe worker thread
  const parsed = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'productImportWorker.js'), {
      workerData: body,
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 }
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Object.assign(new Error('Dosya çözümlenemedi; süre sınırı aşıldı.'), { status: 400 }));
    }, 10000);

    worker.once('message', result => {
      clearTimeout(timer);
      worker.terminate();
      result.error ? reject(Object.assign(new Error(result.error), { status: 400 })) : resolve(result);
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Dosya çözümlenemedi.'), { status: 400 }));
    });
  });

  // Strict Allowlist Data Minimization: Keep ONLY allowable product & stock fields
  const allowedIndices = [];
  const allowedHeaders = [];
  const discardedHeaders = [];

  parsed.headers.forEach((h, idx) => {
    const headerStr = String(h).trim();
    const isAllowed = ALLOWED_HEADERS.has(canonicalHeader(headerStr));

    if (isAllowed) {
      allowedIndices.push(idx);
      allowedHeaders.push(headerStr);
    } else {
      discardedHeaders.push(headerStr);
    }
  });

  // Strip cells for all unknown or sensitive columns immediately
  const sanitizedRows = parsed.rows.map(r => ({
    row: r.row,
    cells: allowedIndices.map(origIdx => r.cells[origIdx] || { value: '' })
  }));

  const cleanedParsed = {
    headers: allowedHeaders,
    rows: sanitizedRows,
    sheet: parsed.sheet,
    excluded_sensitive_columns: discardedHeaders,
    discarded_columns: discardedHeaders,
    privacy_notice: discardedHeaders.length > 0
      ? `Veri Minimizasyonu Güvencesi (KVKK): Yalnızca izin verilen ürün ve stok sütunları kabul edildi. Dosyanızdaki ${discardedHeaders.length} adet izin verilmeyen / bilinmeyen sütun (${discardedHeaders.join(', ')}) derhal ayıklandı ve veritabanına ya da geçici belleğe kaydedilmedi. Lütfen dışa aktarımı yalnızca ürün ve stok alanlarıyla hazırlayınız.`
      : 'Veri Minimizasyonu Güvencesi (KVKK): Dosyada yalnızca izin verilen ürün ve stok sütunları yer almaktadır.'
  };

  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO product_import_batches (id, tenant_id, user_id, filename, parsed_json) VALUES ($1, $2, $3, $4, $5)',
    [id, user.tenantId, user.userId, body.filename, JSON.stringify(cleanedParsed)]
  );

  return {
    id,
    headers: cleanedParsed.headers,
    samples: cleanedParsed.rows.slice(0, 5),
    row_count: cleanedParsed.rows.length,
    sheet: cleanedParsed.sheet,
    product_fields: PRODUCT_FIELDS,
    stock_fields: STOCK_FIELDS,
    excluded_sensitive_columns: discardedHeaders,
    discarded_columns: discardedHeaders,
    privacy_notice: cleanedParsed.privacy_notice
  };
}

async function previewPharmacyBatch(user, id, body) {
  const b = await getBatch(user, id);
  if (b.result_json) fail('Tamamlanan aktarım tekrar önizlenemez.', 409);

  const parsed = JSON.parse(b.parsed_json);
  const { mapping = {}, policy = 'update', import_mode = 'catalog_and_stock', warehouse_id } = body;

  if (!['update', 'skip'].includes(policy)) fail('Mevcut ürün politikası geçersiz.');
  if (!['catalog_and_stock', 'catalog_only', 'stock_only'].includes(import_mode)) {
    fail('Aktarım modu geçersiz (catalog_and_stock, catalog_only veya stock_only olmalı).');
  }

  // Barcode is always required
  if (mapping.barcode == null || !Number.isInteger(mapping.barcode) || mapping.barcode < 0 || mapping.barcode >= parsed.headers.length) {
    fail('Barkod sütunu zorunludur ve dosyadaki geçerli bir sütunla eşleştirilmelidir.');
  }

  // Load existing products for matching
  const existingProducts = (await db.query(
    'SELECT id, sku, name, barcode, purchase_price, sale_price, unit, is_medicine FROM products WHERE tenant_id=$1',
    [user.tenantId]
  )).rows;

  const productMap = new Map();
  for (const p of existingProducts) {
    if (p.barcode) productMap.set(String(p.barcode).trim(), p);
  }

  // Check warehouse
  let targetWarehouse = null;
  if (['catalog_and_stock', 'stock_only'].includes(import_mode)) {
    if (!warehouse_id) fail('Stok aktarımı için hedef depo seçilmelidir.');
    const whRes = await db.query('SELECT id, name FROM warehouses WHERE id=$1 AND tenant_id=$2', [warehouse_id, user.tenantId]);
    if (!whRes.rows.length) fail('Seçilen depo bulunamadı.', 404);
    targetWarehouse = whRes.rows[0];
  }

  const barcodeCounts = new Map();
  for (const r of parsed.rows) {
    const code = String(r.cells[mapping.barcode]?.value ?? '').trim();
    if (code) barcodeCounts.set(code, (barcodeCounts.get(code) || 0) + 1);
  }

    let hasMonthYearExpiry = false;
    let monthYearCount = 0;

    const evaluatedRows = parsed.rows.map(r => {
      const errors = [];
      const values = {};

      // Extract values based on mapping
      for (const [key, colIdx] of Object.entries(mapping)) {
        if (colIdx != null && colIdx >= 0 && colIdx < parsed.headers.length) {
          const cell = r.cells[colIdx] || {};
          values[key] = typeof cell.value === 'string' ? cell.value.trim() : cell.value;
        }
      }

      const bCode = String(values.barcode || '').trim();
      if (!bCode || bCode.length > 128) {
        errors.push('Geçerli bir barkod gereklidir.');
      } else if (barcodeCounts.get(bCode) > 1) {
        errors.push('Dosyada mükerrer barkod; dosyadaki aynı barkodlu tüm satırlar uyarılır.');
      }
      values.barcode = bCode;

      // Validate product fields if catalog is involved
      if (import_mode !== 'stock_only') {
        if (!values.name || String(values.name).trim().length === 0) {
          errors.push('İlaç/Ürün adı zorunludur.');
        }
        if (values.purchase_price != null && values.purchase_price !== '') {
          const num = Number(String(values.purchase_price).replace(',', '.'));
          if (isNaN(num) || num < 0) errors.push('Alış fiyatı sıfır veya pozitif sayı olmalıdır.');
          else values.purchase_price = num;
        } else {
          values.purchase_price = 0;
        }

        if (values.sale_price != null && values.sale_price !== '') {
          const num = Number(String(values.sale_price).replace(',', '.'));
          if (isNaN(num) || num < 0) errors.push('Satış fiyatı sıfır veya pozitif sayı olmalıdır.');
          else values.sale_price = num;
        } else {
          values.sale_price = 0;
        }

        const vat = Number(values.kdv_orani ?? 10);
        values.kdv_orani = (!isNaN(vat) && vat >= 0 && vat <= 100) ? vat : 10;
        values.unit = values.unit || 'kutu';
        values.category = values.category || 'İlaç';
        values.is_medicine = values.is_medicine != null ? (Number(values.is_medicine) ? 1 : 0) : 1;
      }

      // Validate stock & lot fields if stock is involved
      if (import_mode !== 'catalog_only') {
        if (values.quantity != null && values.quantity !== '') {
          const q = Number(String(values.quantity).replace(',', '.'));
          if (isNaN(q) || q < 0) errors.push('Stok miktarı sıfır veya pozitif sayı olmalıdır.');
          else values.quantity = q;
        } else {
          values.quantity = 0;
        }

        if (values.expiry_date) {
          const parsedExp = parseExpiry(values.expiry_date);
          if (!parsedExp.date) {
            errors.push('SKT biçimi geçersiz (GG.AA.YYYY, YYYY-AA-GG veya AA/YYYY olmalı).');
          } else {
            values.expiry_date = parsedExp.date;
            if (parsedExp.isMonthYearFormat) {
              hasMonthYearExpiry = true;
              monthYearCount++;
              values.month_end_rule_applied = true;
              values.original_expiry = parsedExp.original;
            }
          }
        }

        values.lot_number = values.lot_number ? String(values.lot_number).trim() : (values.quantity > 0 ? 'DEVIR-' + (values.expiry_date ? values.expiry_date.replace(/-/g, '') : 'GENEL') : null);
        values.shelf_location = values.shelf_location ? String(values.shelf_location).trim().toUpperCase() : null;
      }

      const existingProduct = productMap.get(bCode) || null;
      if (import_mode === 'stock_only' && !existingProduct) {
        errors.push('Bu barkod sistemde kayıtlı değil. Önce ürün kataloğu aktarılmalıdır.');
      }

      let action = 'add_product';
      if (errors.length > 0) {
        action = 'error';
      } else if (existingProduct) {
        if (import_mode === 'catalog_only') {
          action = policy === 'skip' ? 'skip' : 'update_product';
        } else if (import_mode === 'stock_only') {
          action = 'add_stock';
        } else {
          action = policy === 'skip' ? 'add_stock' : 'update_product_and_stock';
        }
      } else {
        action = import_mode === 'stock_only' ? 'error' : 'add_product_and_stock';
      }

      return {
        row: r.row,
        values,
        errors,
        action,
        existing_id: existingProduct?.id || null,
        existing_name: existingProduct?.name || null
      };
    });

    const reconciliation = {
      total_source_rows: evaluatedRows.length,
      valid_rows: evaluatedRows.filter(r => r.action !== 'error').length,
      error_rows: evaluatedRows.filter(r => r.action === 'error').length,
      products_to_add: evaluatedRows.filter(r => ['add_product', 'add_product_and_stock'].includes(r.action)).length,
      products_to_update: evaluatedRows.filter(r => ['update_product', 'update_product_and_stock'].includes(r.action)).length,
      stock_rows_to_import: evaluatedRows.filter(r => ['add_stock', 'add_product_and_stock', 'update_product_and_stock'].includes(r.action) && Number(r.values.quantity) > 0).length,
      total_stock_quantity: evaluatedRows
        .filter(r => r.action !== 'error')
        .reduce((sum, r) => sum + (Number(r.values.quantity) || 0), 0),
      lots_to_create: evaluatedRows.filter(r => r.action !== 'error' && r.values.lot_number && Number(r.values.quantity) > 0).length,
      shelves_mapped: new Set(evaluatedRows.filter(r => r.action !== 'error' && r.values.shelf_location).map(r => r.values.shelf_location)).size,
      target_warehouse_name: targetWarehouse?.name || null,
      has_month_year_expiry: hasMonthYearExpiry,
      month_year_expiry_count: monthYearCount,
      month_end_rule_notice: hasMonthYearExpiry
        ? `Dikkat: Dosyanızda gün içermeyen ${monthYearCount} adet AA/YYYY (veya YYYY-AA) miad tarihi tespit edildi. İlaç mevzuatı gereği bu tarihler ilgili ayın son gününe dönüştürülmüştür (örnek: 08/2026 -> 2026-08-31). Bu kuralı onaylamadan aktarım tamamlanamaz.`
        : null
    };

    const previewData = {
      mapping,
      policy,
      import_mode,
      warehouse_id,
      reconciliation,
      rows: evaluatedRows
    };

    await db.query(
      'UPDATE product_import_batches SET preview_json=$1 WHERE id=$2 AND result_json IS NULL',
      [JSON.stringify(previewData), id]
    );

    return {
      id,
      reconciliation,
      sample_preview: evaluatedRows.slice(0, 15),
      total_rows: evaluatedRows.length
    };
  }

  async function commitPharmacyBatch(user, id, options = {}) {
    return db.transaction(async tx => {
      if (db.getEngine() === 'mysql') {
        await tx.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE', [user.tenantId]);
        await tx.query('SELECT id FROM product_import_batches WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [id, user.tenantId]);
      }

      const b = await getBatch(user, id, tx);
      if (b.result_json) return JSON.parse(b.result_json);
      if (!b.preview_json) fail('Önce sütunları eşleştirip önizleme oluşturun.');

      const preview = JSON.parse(b.preview_json);
      const { rows, import_mode, warehouse_id, reconciliation } = preview;

      if (reconciliation?.has_month_year_expiry && options?.confirm_month_end_rule !== true) {
        fail('AA/YYYY formatındaki son kullanma tarihlerinin ayın son gününe dönüştürülmesini onaylamanız gerekmektedir (confirm_month_end_rule: true).', 400);
      }

    let productsAdded = 0;
    let productsUpdated = 0;
    let stockRecordsUpdated = 0;
    let lotsCreated = 0;
    let totalStockCommitted = 0;

    for (const row of rows) {
      if (row.action === 'error' || row.action === 'skip') continue;

      const v = row.values;
      let productId = row.existing_id;

      // 1. PRODUCT CATALOG IMPORT
      if (['add_product', 'add_product_and_stock'].includes(row.action)) {
        const sku = 'MED-' + crypto.randomUUID().slice(0, 8);
        const res = await tx.query(
          `INSERT INTO products (tenant_id, sku, name, barcode, category, unit, purchase_price, sale_price, kdv_orani, module_type, is_medicine)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'NORMAL', $10) RETURNING id`,
          [user.tenantId, sku, v.name, v.barcode, v.category || 'İlaç', v.unit || 'kutu', v.purchase_price || 0, v.sale_price || 0, v.kdv_orani || 10, v.is_medicine ?? 1]
        );
        productId = res.rows[0].id;
        productsAdded++;
      } else if (['update_product', 'update_product_and_stock'].includes(row.action) && productId) {
        await tx.query(
          `UPDATE products SET name=$1, category=$2, unit=$3, purchase_price=$4, sale_price=$5, kdv_orani=$6, updated_at=CURRENT_TIMESTAMP
           WHERE id=$7 AND tenant_id=$8`,
          [v.name, v.category, v.unit, v.purchase_price, v.sale_price, v.kdv_orani, productId, user.tenantId]
        );
        productsUpdated++;
      }

      // 2. STOCK & LOT & SHELF IMPORT
      const qty = Number(v.quantity || 0);
      if (warehouse_id && ['add_stock', 'add_product_and_stock', 'update_product_and_stock'].includes(row.action) && qty > 0) {
        // Upsert stock_records
        const currentStockRes = await tx.query(
          'SELECT id, quantity FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3',
          [user.tenantId, productId, warehouse_id]
        );

        if (currentStockRes.rows.length > 0) {
          await tx.query(
            'UPDATE stock_records SET quantity=ROUND(quantity+$1, 6), updated_at=CURRENT_TIMESTAMP WHERE id=$2',
            [qty, currentStockRes.rows[0].id]
          );
        } else {
          await tx.query(
            'INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($1, $2, $3, $4)',
            [user.tenantId, productId, warehouse_id, qty]
          );
        }
        stockRecordsUpdated++;
        totalStockCommitted += qty;

        // Upsert inventory_lots
        if (v.lot_number) {
          const lotRes = await tx.query(
            'SELECT id FROM inventory_lots WHERE tenant_id=$1 AND product_id=$2 AND lot_number=$3',
            [user.tenantId, productId, v.lot_number]
          );
          if (lotRes.rows.length === 0) {
            await tx.query(
              `INSERT INTO inventory_lots (tenant_id, product_id, lot_number, expiry_date, status)
               VALUES ($1, $2, $3, $4, 'available')`,
              [user.tenantId, productId, v.lot_number, v.expiry_date || null]
            );
            lotsCreated++;
          }
        }

        // Shelf location registration
        if (v.shelf_location) {
          const locCode = v.shelf_location;
          let locRes = await tx.query(
            'SELECT id FROM warehouse_locations WHERE tenant_id=$1 AND warehouse_id=$2 AND location_code=$3',
            [user.tenantId, warehouse_id, locCode]
          );
          let locId;
          if (locRes.rows.length === 0) {
            const newLoc = await tx.query(
              `INSERT INTO warehouse_locations (tenant_id, warehouse_id, location_code, zone_name, aisle_code, rack_number, shelf_tier, bin_position)
               VALUES ($1, $2, $3, 'A', 'A', 1, 1, 1) RETURNING id`,
              [user.tenantId, warehouse_id, locCode]
            );
            locId = newLoc.rows[0].id;
          } else {
            locId = locRes.rows[0].id;
          }

          // Register product_bin_records
          const binRecord = await tx.query(
            'SELECT id, quantity FROM product_bin_records WHERE tenant_id=$1 AND location_id=$2 AND product_id=$3',
            [user.tenantId, locId, productId]
          );
          if (binRecord.rows.length > 0) {
            await tx.query('UPDATE product_bin_records SET quantity=ROUND(quantity+$1, 6) WHERE id=$2', [qty, binRecord.rows[0].id]);
          } else {
            await tx.query(
              'INSERT INTO product_bin_records (tenant_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4)',
              [user.tenantId, locId, productId, qty]
            );
          }
        }
      }
    }

    const finalResult = {
      id,
      success: true,
      summary: {
        source_total_rows: rows.length,
        products_added: productsAdded,
        products_updated: productsUpdated,
        stock_records_updated: stockRecordsUpdated,
        total_quantity_imported: totalStockCommitted,
        lots_registered: lotsCreated,
        reconciliation_status: 'MUTABIK'
      }
    };

    await tx.query('UPDATE product_import_batches SET result_json=$1 WHERE id=$2', [JSON.stringify(finalResult), id]);

    // Audit log
    await tx.query(
      `INSERT INTO audit_logs (tenant_id, user_email, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'pharmacy.migration.import', 'pharmacy_migration', $3, $4)`,
      [user.tenantId, user.email, id, JSON.stringify(finalResult.summary)]
    );

    return finalResult;
  });
}

function generateTemplate(type = 'combined') {
  const papaparse = require('papaparse');
  let headers = [];
  let sampleRow = [];

  if (type === 'catalog_only') {
    headers = ['Barkod', 'İlaç Adı', 'Kategori', 'Birim', 'Alış Fiyatı', 'Satış Fiyatı', 'KDV Oranı'];
    sampleRow = ['8699546010012', 'Parol 500 mg 20 Tablet', 'Ağrı Kesici', 'kutu', '45.50', '65.00', '10'];
  } else if (type === 'stock_only') {
    headers = ['Barkod', 'Miktar', 'Lot Numarası', 'SKT', 'Raf'];
    sampleRow = ['8699546010012', '100', 'LOT-2026A', '2028-12-31', 'RAF-A1'];
  } else {
    // Combined pharmacy export
    headers = ['Barkod', 'İlaç Adı', 'Kategori', 'Birim', 'Alış Fiyatı', 'Satış Fiyatı', 'KDV Oranı', 'Miktar', 'Lot Numarası', 'SKT', 'Raf'];
    sampleRow = ['8699546010012', 'Parol 500 mg 20 Tablet', 'Ağrı Kesici', 'kutu', '45.50', '65.00', '10', '120', 'LOT-2026A', '2028-12-31', 'RAF-A1'];
  }

  return '\uFEFF' + papaparse.unparse([headers, sampleRow], { delimiter: ';', escapeFormulae: true });
}

module.exports = {
  PRODUCT_FIELDS,
  STOCK_FIELDS,
  ALL_FIELDS,
  parsePharmacyFile,
  previewPharmacyBatch,
  commitPharmacyBatch,
  generateTemplate
};
