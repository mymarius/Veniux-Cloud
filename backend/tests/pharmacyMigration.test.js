const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/database');
const service = require('../src/services/pharmacyMigrationService');

describe('Pharmacy Migration Service (Farmakom & Excel/CSV)', () => {
  let testUser;
  let testWarehouseId;

  beforeAll(async () => {
    await db.ready;
    const tenantCode = 'PHARM-MIG-' + crypto.randomUUID().slice(0, 8);
    const tRes = await db.query(
      "INSERT INTO tenants (tenant_code, company_name, email) VALUES ($1, 'Mig Eczanesi', 'mig@eczane.invalid') RETURNING id",
      [tenantCode]
    );
    const tenantId = tRes.rows[0].id;

    const uRes = await db.query(
      "INSERT INTO users (tenant_id, email, password_hash, role, status) VALUES ($1, $2, 'hash', 'admin', 'active') RETURNING id",
      [tenantId, 'eczaci_' + tenantCode + '@eczane.invalid']
    );
    const userId = uRes.rows[0].id;

    const wRes = await db.query(
      "INSERT INTO warehouses (tenant_id, name, type, warehouse_type) VALUES ($1, 'Eczane Ana Raf', 'MAIN', 'NORMAL') RETURNING id",
      [tenantId]
    );
    testWarehouseId = wRes.rows[0].id;

    testUser = { tenantId, userId, email: 'eczaci@eczane.invalid', role: 'admin' };
  });

  test('1. Data Minimization & Allowlist: Strips patient, prescription, and all unknown columns from uploaded file', async () => {
    // CSV with product columns AND sensitive patient data AND arbitrary unknown columns
    const csvContent = [
      'Barkod;İlaç Adı;Hasta Adı;Reçete No;TC Kimlik;Kategori;Birim;Alış Fiyatı;Satış Fiyatı;KDV Oranı;Mevcut Stok;Lot No;SKT;Raf;Müşteri Notu;Bilinmeyen Sütun',
      '8699546010012;Parol 500 mg Tablet;Ahmet Yılmaz;REC-98214;12345678901;Ağrı Kesici;kutu;45.50;65.00;10;50;LOT-2026A;2028-11-30;RAF-A1;Hassas Müşteri Notu;Gereksiz Veri',
      '8699508090014;Aspirin 100 mg;Fatma Demir;REC-98215;98765432109;Kalp Damar;kutu;30.00;45.00;10;25;LOT-2026B;15.06.2027;RAF-B2;Başka Not;X123'
    ].join('\r\n');

    const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');

    const parsed = await service.parsePharmacyFile(testUser, {
      filename: 'farmakom-stok-ve-recete-raporu.csv',
      base64
    });

    expect(parsed.id).toBeDefined();
    // Verify disallowed / foreign columns were identified and DISCARDED
    expect(parsed.discarded_columns).toContain('Hasta Adı');
    expect(parsed.discarded_columns).toContain('Reçete No');
    expect(parsed.discarded_columns).toContain('TC Kimlik');
    expect(parsed.discarded_columns).toContain('Müşteri Notu');
    expect(parsed.discarded_columns).toContain('Bilinmeyen Sütun');

    // Headers in parsed result MUST NOT contain sensitive or unknown columns
    expect(parsed.headers).not.toContain('Hasta Adı');
    expect(parsed.headers).not.toContain('Reçete No');
    expect(parsed.headers).not.toContain('TC Kimlik');
    expect(parsed.headers).not.toContain('Müşteri Notu');
    expect(parsed.headers).not.toContain('Bilinmeyen Sütun');

    // Commercial allowed columns must be preserved
    expect(parsed.headers).toContain('Barkod');
    expect(parsed.headers).toContain('İlaç Adı');
    expect(parsed.headers).toContain('Mevcut Stok');
    expect(parsed.headers).toContain('Lot No');
    expect(parsed.headers).toContain('SKT');
    expect(parsed.headers).toContain('Raf');

    expect(parsed.privacy_notice).toContain('Veri Minimizasyonu Güvencesi');

    // Verify DB does not contain discarded column data in parsed_json
    const dbRow = (await db.query('SELECT parsed_json FROM product_import_batches WHERE id=$1', [parsed.id])).rows[0];
    const dbJson = JSON.parse(dbRow.parsed_json);
    expect(dbJson.headers).not.toContain('Hasta Adı');
    expect(dbJson.headers).not.toContain('Müşteri Notu');
    // Ensure cell contents don't leak into stored rows
    const serializedRows = JSON.stringify(dbJson.rows);
    expect(serializedRows).not.toContain('Ahmet Yılmaz');
    expect(serializedRows).not.toContain('Hassas Müşteri Notu');
  });

  test('1b. Exact allowlist rejects look-alike columns and retains no raw upload outside the batch', async () => {
    const csvContent = [
      'Barkod;İlaç Adı;Hasta Stok Notu;Stok Geçmişi;Miktar',
      '8699555010011;Allowlist Test;Ayşe için hassas not;reçete geçmişi;7'
    ].join('\n');
    const parsed = await service.parsePharmacyFile(testUser, {filename:'allowlist.csv',base64:Buffer.from(csvContent).toString('base64')});
    expect(parsed.headers).toEqual(['Barkod','İlaç Adı','Miktar']);
    expect(parsed.discarded_columns).toEqual(expect.arrayContaining(['Hasta Stok Notu','Stok Geçmişi']));
    const row=(await db.query('SELECT filename,parsed_json,preview_json,result_json FROM product_import_batches WHERE id=$1',[parsed.id])).rows[0];
    expect(JSON.stringify(row)).not.toMatch(/Ayşe için hassas not|reçete geçmişi/i);
    expect(row.filename).toBe('allowlist.csv');
  });

  test('2. Preview and MM/YYYY Month-End Rule: Requires explicit user confirmation for day-less dates', async () => {
    const csvContent = [
      'Barkod;İlaç Adı;Kategori;Birim;Alış Fiyatı;Satış Fiyatı;KDV;Miktar;Lot;SKT;Raf',
      '8699546010099;Augmentin 1000 mg;Antibiyotik;kutu;80.00;120.00;10;15;LOT-AUG-1;31.12.2027;RAF-ANT-1',
      '8699546010099;Augmentin 1000 mg (Mükerrer);Antibiyotik;kutu;80.00;120.00;10;10;LOT-AUG-2;2028-05-15;RAF-ANT-2',
      '8699525010011;Majezik 100 mg;Ağrı Kesici;kutu;55.00;85.00;10;40;;08/2026;RAF-AGR-1'
    ].join('\r\n');

    const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');
    const parsed = await service.parsePharmacyFile(testUser, {
      filename: 'farmakom-export.csv',
      base64
    });

    const mapping = {};
    parsed.headers.forEach((h, idx) => {
      if (h === 'Barkod') mapping.barcode = idx;
      if (h === 'İlaç Adı') mapping.name = idx;
      if (h === 'Kategori') mapping.category = idx;
      if (h === 'Birim') mapping.unit = idx;
      if (h === 'Alış Fiyatı') mapping.purchase_price = idx;
      if (h === 'Satış Fiyatı') mapping.sale_price = idx;
      if (h === 'KDV') mapping.kdv_orani = idx;
      if (h === 'Miktar') mapping.quantity = idx;
      if (h === 'Lot') mapping.lot_number = idx;
      if (h === 'SKT') mapping.expiry_date = idx;
      if (h === 'Raf') mapping.shelf_location = idx;
    });

    const preview = await service.previewPharmacyBatch(testUser, parsed.id, {
      mapping,
      policy: 'update',
      import_mode: 'catalog_and_stock',
      warehouse_id: testWarehouseId
    });

    expect(preview.reconciliation).toBeDefined();
    expect(preview.reconciliation.total_source_rows).toBe(3);
    // Duplicate barcode detection (8699546010099 appeared twice)
    expect(preview.sample_preview.some(r => r.errors.some(e => e.includes('mükerrer')))).toBe(true);

    // MM/YYYY month-end rule detected and reported in reconciliation
    expect(preview.reconciliation.has_month_year_expiry).toBe(true);
    expect(preview.reconciliation.month_year_expiry_count).toBe(1);
    expect(preview.reconciliation.month_end_rule_notice).toContain('ayın son gününe');

    // Attempting commit WITHOUT explicit confirmation must fail with 400
    await expect(service.commitPharmacyBatch(testUser, parsed.id)).rejects.toThrow(
      'confirm_month_end_rule: true'
    );

    // Committing WITH explicit confirmation succeeds
    const commitRes = await service.commitPharmacyBatch(testUser, parsed.id, { confirm_month_end_rule: true });
    expect(commitRes.success).toBe(true);

    // Verify converted date in DB
    const majezikProduct = (await db.query('SELECT id FROM products WHERE tenant_id=$1 AND barcode=$2', [testUser.tenantId, '8699525010011'])).rows[0];
    const lotRes = await db.query('SELECT expiry_date FROM inventory_lots WHERE tenant_id=$1 AND product_id=$2', [testUser.tenantId, majezikProduct.id]);
    expect(lotRes.rows[0].expiry_date).toBe('2026-08-31');
  });

  test('3. Atomic Commit & Idempotency: Duplicate commits and retry do not duplicate products or add double stock', async () => {
    const csvContent = [
      'Barkod;İlaç Adı;Kategori;Birim;Alış Fiyatı;Satış Fiyatı;KDV;Miktar;Lot;SKT;Raf',
      '8699111223344;Ecopirin 150 mg;Kardiyoloji;kutu;25.00;40.00;10;60;LOT-ECO-2026;2028-10-31;RAF-KARDIO-1',
      '8699222334455;Nexium 40 mg;Gastroloji;kutu;90.00;140.00;10;30;LOT-NEX-2027;2029-01-15;RAF-GASTRO-2'
    ].join('\r\n');

    const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');
    const parsed = await service.parsePharmacyFile(testUser, {
      filename: 'farmakom-valid.csv',
      base64
    });

    const mapping = {};
    parsed.headers.forEach((h, idx) => {
      if (h === 'Barkod') mapping.barcode = idx;
      if (h === 'İlaç Adı') mapping.name = idx;
      if (h === 'Kategori') mapping.category = idx;
      if (h === 'Birim') mapping.unit = idx;
      if (h === 'Alış Fiyatı') mapping.purchase_price = idx;
      if (h === 'Satış Fiyatı') mapping.sale_price = idx;
      if (h === 'KDV') mapping.kdv_orani = idx;
      if (h === 'Miktar') mapping.quantity = idx;
      if (h === 'Lot') mapping.lot_number = idx;
      if (h === 'SKT') mapping.expiry_date = idx;
      if (h === 'Raf') mapping.shelf_location = idx;
    });

    await service.previewPharmacyBatch(testUser, parsed.id, {
      mapping,
      policy: 'update',
      import_mode: 'catalog_and_stock',
      warehouse_id: testWarehouseId
    });

    // 1st Commit
    const commitResult = await service.commitPharmacyBatch(testUser, parsed.id);
    expect(commitResult.success).toBe(true);
    expect(commitResult.summary.products_added).toBe(2);
    expect(commitResult.summary.total_quantity_imported).toBe(90);

    // Verify stock in DB after 1st commit
    const p1 = (await db.query('SELECT id FROM products WHERE tenant_id=$1 AND barcode=$2', [testUser.tenantId, '8699111223344'])).rows[0];
    const s1 = (await db.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3', [testUser.tenantId, testWarehouseId, p1.id])).rows[0];
    expect(Number(s1.quantity)).toBe(60);

    // 2nd Commit (idempotent duplicate submission on same batch)
    const commit2 = await service.commitPharmacyBatch(testUser, parsed.id);
    expect(commit2.success).toBe(true);

    // Stock must NOT have doubled! It must remain exactly 60!
    const s2 = (await db.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3', [testUser.tenantId, testWarehouseId, p1.id])).rows[0];
    expect(Number(s2.quantity)).toBe(60);

    // Product count must remain exactly 1 for this barcode
    const pCount = (await db.query('SELECT COUNT(*) as count FROM products WHERE tenant_id=$1 AND barcode=$2', [testUser.tenantId, '8699111223344'])).rows[0];
    expect(Number(pCount.count)).toBe(1);
  });
});
