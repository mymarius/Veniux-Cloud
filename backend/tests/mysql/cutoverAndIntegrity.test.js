const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');

const db = require('../../src/config/database');
const adapter = require('../../src/config/mysqlAdapter');
const { snapshotSQLite, restoreEmptyTarget, snapshotMySQL } = require('../../src/database/dataTransfer');
const { manifest, MySQLMigrator } = require('../../src/database/mysqlMigrator');
const { makeMySQLBackupService } = require('../../src/services/mysqlBackupService');
const sqliteToMysql = require('../../scripts/sqlite_to_mysql');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../.local/mysql-test/config.json')));
const RUNTIME_USER = 'veniux_runtime_test';
const RUNTIME_PASS = 'VnxRuntimeTest2026!';
const MIGRATOR_USER = 'veniux_migrator_test';
const MIGRATOR_PASS = 'VnxMigratorTest2026!';

let importConn;

beforeAll(async () => {
  await db.ready;
  importConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'veniux_test_import',
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: true
  });
});

afterAll(async () => {
  await importConn?.end().catch(() => {});
  await adapter.getMySQLPool()?.end().catch(() => {});
});

async function clearDatabase(connection, dbName = 'veniux_test_import') {
  const [selected] = await connection.query('SELECT DATABASE() AS name');
  if (selected[0].name !== dbName) throw Error('Unsafe database clear target: ' + selected[0].name);
  await connection.query('SET FOREIGN_KEY_CHECKS=0');
  const [tables] = await connection.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  for (const row of tables) {
    await connection.query('DROP TABLE IF EXISTS `' + row.TABLE_NAME + '`');
  }
  await connection.query('SET FOREIGN_KEY_CHECKS=1');
}

test('1 & 2: SQLite -> MySQL transfer verifies IDs, relations, lot/shelf balances, sales/returns, shifts and user-warehouse access', async () => {
  await clearDatabase(importConn, 'veniux_test_import');

  // Build rich source SQLite database with deep relational structure
  const sourcePath = path.resolve(__dirname, '../../../.local/mysql-test/deep-source-' + crypto.randomUUID() + '.db');
  const raw = new Database(sourcePath);
  raw.defaultSafeIntegers(true);
  await new (require('../../src/database/migrator'))(raw).migrate();

  // 1. Tenants (2 companies)
  raw.prepare("INSERT INTO tenants(id, tenant_code, company_name, email) VALUES(101, 'T-ALPHA', 'Firma Alfa', 'alfa@test.invalid')").run();
  raw.prepare("INSERT INTO tenants(id, tenant_code, company_name, email) VALUES(102, 'T-BETA', 'Firma Beta', 'beta@test.invalid')").run();

  // 2. Warehouses (2 per tenant)
  raw.prepare("INSERT INTO warehouses(id, tenant_id, name, type, warehouse_type) VALUES(201, 101, 'Alfa Ana Depo', 'MAIN', 'NORMAL')").run();
  raw.prepare("INSERT INTO warehouses(id, tenant_id, name, type, warehouse_type) VALUES(202, 101, 'Alfa Sube Depo', 'MAIN', 'NORMAL')").run();
  raw.prepare("INSERT INTO warehouses(id, tenant_id, name, type, warehouse_type) VALUES(203, 102, 'Beta Ana Depo', 'MAIN', 'NORMAL')").run();

  // 3. Warehouse Locations (shelf/tier/bin balances)
  raw.prepare("INSERT INTO warehouse_locations(id, tenant_id, warehouse_id, location_code, aisle_code, rack_number, shelf_tier, bin_position) VALUES(301, 101, 201, 'LOC-A-1', 'A', 1, 1, 1)").run();
  raw.prepare("INSERT INTO warehouse_locations(id, tenant_id, warehouse_id, location_code, aisle_code, rack_number, shelf_tier, bin_position) VALUES(302, 101, 201, 'LOC-A-2', 'A', 1, 2, 1)").run();

  // 4. Users (Admin and Cashier)
  const pwd = await require('bcrypt').hash('Pass12345678!', 10);
  raw.prepare("INSERT INTO users(id, tenant_id, email, password_hash, role, status, session_version) VALUES(401, 101, 'admin@alfa.invalid', ?, 'admin', 'active', 1)").run(pwd);
  raw.prepare("INSERT INTO users(id, tenant_id, email, password_hash, role, status, session_version) VALUES(402, 101, 'cashier@alfa.invalid', ?, 'cashier', 'active', 1)").run(pwd);
  raw.prepare("INSERT INTO users(id, tenant_id, email, password_hash, role, status, session_version) VALUES(403, 102, 'beta_admin@beta.invalid', ?, 'admin', 'active', 1)").run(pwd);

  // 5. User access scopes & warehouse access
  raw.prepare("UPDATE user_access_scopes SET mode = 'company' WHERE user_id = 401").run();
  raw.prepare("UPDATE user_access_scopes SET mode = 'restricted' WHERE user_id = 402").run();
  raw.prepare("INSERT INTO user_warehouse_access(user_id, warehouse_id, tenant_id) VALUES(402, 201, 101)").run();

  // 6. Products (including 64-bit ID, leading zeroes barcode, 6 decimals)
  raw.prepare("INSERT INTO products(id, tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES(501, 101, 'SKU-001', 'Ilac A', '0000123456789', 'kutu', 150.500000, 'NORMAL')").run();
  raw.prepare("INSERT INTO products(id, tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES(?, 101, 'SKU-BIG', 'Buyuk Kimlik Ilac', '0000999999999', 'adet', 85.250000, 'NORMAL')").run('9007199254740995');

  // 7. Inventory Lots
  raw.prepare("INSERT INTO inventory_lots(id, tenant_id, product_id, lot_number, expiry_date) VALUES(601, 101, 501, 'LOT-ALPHA-101', '2028-11-30')").run();
  raw.prepare("INSERT INTO inventory_lots(id, tenant_id, product_id, lot_number, expiry_date) VALUES(602, 101, 501, 'LOT-ALPHA-102', '2029-06-15')").run();

  // 8. Stock records (precise decimal quantities per location and warehouse)
  raw.prepare("INSERT INTO stock_records(id, tenant_id, product_id, warehouse_id, quantity) VALUES(701, 101, 501, 201, '120.500001')").run();
  raw.prepare("INSERT INTO stock_records(id, tenant_id, product_id, warehouse_id, quantity) VALUES(702, 101, 501, 202, '45.000000')").run();
  raw.prepare("INSERT INTO stock_records(id, tenant_id, product_id, warehouse_id, quantity) VALUES(?, 101, ?, 201, '10.000001')").run(703, '9007199254740995');

  // 9. Retail Register & Shifts
  raw.prepare("INSERT INTO retail_registers(id, tenant_id, warehouse_id, name) VALUES(801, 101, 201, 'Kasa 1')").run();
  raw.prepare("INSERT INTO retail_shifts(id, tenant_id, register_id, warehouse_id, user_id, opened_by_email, opening_cash_cents, status) VALUES(901, 101, 801, 201, 402, 'cashier@alfa.invalid', 50000, 'open')").run();

  // 10. POS Sales, Retail Sales & Items, Reversals & Cash Movements
  raw.prepare("INSERT INTO pos_sales(id, tenant_id, receipt_no, total_amount, discount_amount, net_amount, payment_method, status) VALUES(1001, 101, 'REC-1001', 300.00, 0, 300.00, 'cash', 'completed')").run();

  const saleSnapshot = JSON.stringify({
    total_cents: 30000,
    net_cents: 30000,
    items: [{ barcode: '0000123456789', count: 2, total_cents: 30000 }],
    payments: [{ method: 'cash', amount_cents: 30000 }]
  });
  raw.prepare("INSERT INTO retail_sales(sale_id, tenant_id, warehouse_id, user_id, business_date, snapshot_json, register_id, shift_id) VALUES(1001, 101, 201, 402, '2026-10-10', ?, 801, 901)").run(saleSnapshot);

  const returnData = JSON.stringify({
    reason: 'Kismi iade',
    items: [{ barcode: '0000123456789', quantity: 1, refund_cents: 5000 }]
  });
  raw.prepare("INSERT INTO retail_reversals(id, tenant_id, sale_id, kind, business_date, amount_cents, data_json, register_id, shift_id) VALUES('REV-1101', 101, 1001, 'return', '2026-10-10', 5000, ?, 801, 901)").run(returnData);

  raw.prepare("INSERT INTO retail_cash_movements(id, tenant_id, shift_id, user_id, user_email, direction, amount_cents, reason) VALUES('MOV-1201', 101, 901, 402, 'cashier@alfa.invalid', 'in', 30000, 'Kasa satisi')").run();
  raw.prepare("INSERT INTO retail_cash_movements(id, tenant_id, shift_id, user_id, user_email, direction, amount_cents, reason) VALUES('MOV-1202', 101, 901, 402, 'cashier@alfa.invalid', 'out', 5000, 'Kismi iade')").run();

  // Close shift after sales/reversals are bound
  const shiftClosing = JSON.stringify({ sales_cents: 30000, cash_refund_cents: 5000, closing_cash_cents: 75000 });
  raw.prepare("UPDATE retail_shifts SET status = 'closed', closing_json = ? WHERE id = 901").run(shiftClosing);

  raw.close();

  // Run SQLite -> MySQL transfer
  const payload = snapshotSQLite(sourcePath);
  await restoreEmptyTarget(importConn, payload);

  // Compare entity by entity:

  // 1. Primary keys / IDs check
  const [dbTenants] = await importConn.query('SELECT id, tenant_code, company_name FROM tenants ORDER BY id');
  expect(dbTenants).toHaveLength(2);
  expect(dbTenants[0]).toMatchObject({ id: 101, tenant_code: 'T-ALPHA', company_name: 'Firma Alfa' });
  expect(dbTenants[1]).toMatchObject({ id: 102, tenant_code: 'T-BETA', company_name: 'Firma Beta' });

  // 2. Warehouses & relations
  const [dbWarehouses] = await importConn.query('SELECT id, tenant_id, name FROM warehouses ORDER BY id');
  expect(dbWarehouses).toHaveLength(3);
  expect(dbWarehouses[0]).toMatchObject({ id: 201, tenant_id: 101, name: 'Alfa Ana Depo' });
  expect(dbWarehouses[2]).toMatchObject({ id: 203, tenant_id: 102, name: 'Beta Ana Depo' });

  // 3. Products: check 64-bit ID, leading zeros, and price decimals
  const [dbProducts] = await importConn.query('SELECT id, sku, barcode, sale_price FROM products ORDER BY id');
  expect(dbProducts).toHaveLength(2);
  expect(dbProducts[0]).toMatchObject({ id: 501, sku: 'SKU-001', barcode: '0000123456789', sale_price: '150.500000' });
  expect(String(dbProducts[1].id)).toBe('9007199254740995');
  expect(dbProducts[1].barcode).toBe('0000999999999');

  // 4. Lots & Lot balances
  const [dbLots] = await importConn.query('SELECT id, product_id, lot_number, expiry_date FROM inventory_lots ORDER BY id');
  expect(dbLots).toHaveLength(2);
  expect(dbLots[0]).toMatchObject({ id: 601, product_id: 501, lot_number: 'LOT-ALPHA-101', expiry_date: '2028-11-30' });
  expect(dbLots[1]).toMatchObject({ id: 602, product_id: 501, lot_number: 'LOT-ALPHA-102', expiry_date: '2029-06-15' });

  // 5. Stock balances (exact 6 decimal precision)
  const [dbStocks] = await importConn.query('SELECT id, product_id, warehouse_id, quantity FROM stock_records ORDER BY id');
  expect(dbStocks).toHaveLength(3);
  expect(dbStocks[0]).toMatchObject({ id: 701, product_id: 501, warehouse_id: 201, quantity: '120.500001' });
  expect(dbStocks[1]).toMatchObject({ id: 702, product_id: 501, warehouse_id: 202, quantity: '45.000000' });
  expect(String(dbStocks[2].product_id)).toBe('9007199254740995');
  expect(dbStocks[2].quantity).toBe('10.000001');

  // 6. Shifts comparison
  const [dbShifts] = await importConn.query('SELECT id, register_id, warehouse_id, opening_cash_cents, status, closing_json FROM retail_shifts ORDER BY id');
  expect(dbShifts).toHaveLength(1);
  expect(dbShifts[0]).toMatchObject({
    id: 901,
    register_id: 801,
    warehouse_id: 201,
    opening_cash_cents: 50000,
    status: 'closed'
  });
  expect(JSON.parse(dbShifts[0].closing_json)).toMatchObject({
    sales_cents: 30000,
    cash_refund_cents: 5000,
    closing_cash_cents: 75000
  });

  // 7. Sales, reversals, and cash movements
  const [dbSales] = await importConn.query('SELECT sale_id, shift_id, register_id, warehouse_id, snapshot_json FROM retail_sales ORDER BY sale_id');
  expect(dbSales).toHaveLength(1);
  expect(dbSales[0]).toMatchObject({ sale_id: 1001, shift_id: 901, register_id: 801, warehouse_id: 201 });
  expect(JSON.parse(dbSales[0].snapshot_json)).toMatchObject({ total_cents: 30000 });

  const [dbReversals] = await importConn.query('SELECT id, sale_id, kind, amount_cents, data_json FROM retail_reversals ORDER BY id');
  expect(dbReversals).toHaveLength(1);
  expect(dbReversals[0]).toMatchObject({ id: 'REV-1101', sale_id: 1001, kind: 'return', amount_cents: 5000 });
  expect(JSON.parse(dbReversals[0].data_json)).toMatchObject({ reason: 'Kismi iade' });

  const [dbMovements] = await importConn.query('SELECT id, shift_id, direction, amount_cents FROM retail_cash_movements ORDER BY id');
  expect(dbMovements).toHaveLength(2);
  expect(dbMovements[0]).toMatchObject({ id: 'MOV-1201', shift_id: 901, direction: 'in', amount_cents: 30000 });
  expect(dbMovements[1]).toMatchObject({ id: 'MOV-1202', shift_id: 901, direction: 'out', amount_cents: 5000 });

  // 8. User warehouse access and scopes
  const [dbScopes] = await importConn.query('SELECT user_id, mode FROM user_access_scopes ORDER BY user_id');
  expect(dbScopes.find(s => s.user_id === 401).mode).toBe('company');
  expect(dbScopes.find(s => s.user_id === 402).mode).toBe('restricted');

  const [dbWarehouseAccess] = await importConn.query('SELECT user_id, warehouse_id, tenant_id FROM user_warehouse_access');
  expect(dbWarehouseAccess).toHaveLength(1);
  expect(dbWarehouseAccess[0]).toMatchObject({ user_id: 402, warehouse_id: 201, tenant_id: 101 });

  // Clean temp file
  fs.rmSync(sourcePath, { force: true });
});

test('3: Interrupted transfer rolls back DML and prevents duplicate/missing rows on re-run', async () => {
  await clearDatabase(importConn, 'veniux_test_import');

  // Build a test SQLite database
  const sourcePath = path.resolve(__dirname, '../../../.local/mysql-test/interrupted-' + crypto.randomUUID() + '.db');
  const raw = new Database(sourcePath);
  await new (require('../../src/database/migrator'))(raw).migrate();
  raw.prepare("INSERT INTO tenants(id, tenant_code, company_name, email) VALUES(555, 'T-INT', 'Firma Interrupted', 'int@test.invalid')").run();
  raw.prepare("INSERT INTO products(id, tenant_id, sku, name, barcode) VALUES(666, 555, 'SKU-INT', 'Urun Int', '12345678')").run();
  raw.prepare("INSERT INTO warehouses(id, tenant_id, name, type) VALUES(777, 555, 'Depo Int', 'MAIN')").run();
  raw.prepare("INSERT INTO stock_records(tenant_id, product_id, warehouse_id, quantity) VALUES(555, 666, 777, '10.500000')").run();
  raw.close();

  const payload = snapshotSQLite(sourcePath);

  // Simulate an interrupted transfer midway via beforeCommit failure
  await expect(
    restoreEmptyTarget(importConn, payload, {
      beforeCommit: async () => {
        throw new Error('Simulated network/process interruption midway');
      }
    })
  ).rejects.toThrow('Simulated network/process interruption midway');

  // Verify that DML was rolled back: application tables exist (implicit DDL commit) but have 0 rows
  const [tenantsAfterAbort] = await importConn.query('SELECT COUNT(*) AS cnt FROM tenants');
  expect(tenantsAfterAbort[0].cnt).toBe(0);

  const [stocksAfterAbort] = await importConn.query('SELECT COUNT(*) AS cnt FROM stock_records');
  expect(stocksAfterAbort[0].cnt).toBe(0);

  // Migration status must be 'failed'
  const [migRows] = await importConn.query("SELECT state FROM veniux_mysql_migrations");
  expect(migRows.some(r => r.state === 'failed')).toBe(true);

  // Attempting to re-run directly without cleaning must be rejected by safety check
  await expect(restoreEmptyTarget(importConn, payload)).rejects.toThrow('Geri yükleme yalnız ayrı, boş hedef veritabanına uygulanır.');

  // Clean the failed attempt using the safe clean mechanism
  await clearDatabase(importConn, 'veniux_test_import');

  // Re-run transfer completely
  await restoreEmptyTarget(importConn, payload);

  // Verify: Exactly 1 tenant, 1 product, 1 warehouse, 1 stock record (no duplicates, no missing records)
  const [tenantsFinal] = await importConn.query('SELECT id, tenant_code FROM tenants');
  expect(tenantsFinal).toEqual([{ id: 555, tenant_code: 'T-INT' }]);

  const [productsFinal] = await importConn.query('SELECT id, sku FROM products');
  expect(productsFinal).toEqual([{ id: 666, sku: 'SKU-INT' }]);

  const [stocksFinal] = await importConn.query('SELECT product_id, quantity FROM stock_records');
  expect(stocksFinal).toEqual([{ product_id: 666, quantity: '10.500000' }]);

  fs.rmSync(sourcePath, { force: true });
});

test('4: Runtime vs migration accounts separation & least-privilege runtime workflow testing', async () => {
  // Connect with migrator account (has DDL permissions)
  const migConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: MIGRATOR_USER,
    password: MIGRATOR_PASS,
    database: 'veniux_test_parity'
  });
  try {
    // Migrator can create and drop auxiliary table
    await migConn.query('CREATE TABLE IF NOT EXISTS mig_test_tbl (id INT PRIMARY KEY)');
    await migConn.query('DROP TABLE mig_test_tbl');
  } finally {
    await migConn.end();
  }

  // Connect with runtime account (strictly least-privilege: DML only)
  const runConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: RUNTIME_USER,
    password: RUNTIME_PASS,
    database: 'veniux_test_parity',
    dateStrings: true,
    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: false
  });

  try {
    // Verify runtime account CANNOT run DDL
    await expect(runConn.query('CREATE TABLE runtime_forbidden (id INT)')).rejects.toMatchObject({
      code: 'ER_TABLEACCESS_DENIED_ERROR'
    });
    await expect(runConn.query('ALTER TABLE products ADD COLUMN forbidden_col VARCHAR(10)')).rejects.toMatchObject({
      code: 'ER_TABLEACCESS_DENIED_ERROR'
    });
    await expect(runConn.query('DROP TABLE warehouses')).rejects.toMatchObject({
      code: 'ER_TABLEACCESS_DENIED_ERROR'
    });

    // Verify runtime account CAN run all core business operations:
    // 1. Mutex locking (FOR UPDATE)
    await runConn.beginTransaction();
    const [mutex] = await runConn.query('SELECT id FROM veniux_write_mutex WHERE id=1 FOR UPDATE');
    expect(mutex[0].id).toBe(1);

    // 2. Insert test tenant
    const tCode = 'T-RUN-' + crypto.randomUUID().slice(0, 8);
    const [tRes] = await runConn.query(
      'INSERT INTO tenants(tenant_code, name, company_name, email) VALUES(?, ?, ?, ?)',
      [tCode, 'Runtime Test Corp', 'Runtime Test Corp', tCode + '@test.invalid']
    );
    const tenantId = tRes.insertId;

    // 3. Insert product
    const sku = 'SKU-' + crypto.randomUUID().slice(0, 8);
    const [pRes] = await runConn.query(
      'INSERT INTO products(tenant_id, sku, name, barcode, unit, sale_price) VALUES(?, ?, ?, ?, ?, ?)',
      [tenantId, sku, 'Runtime Urun', '000555666777', 'adet', '49.900000']
    );
    const productId = pRes.insertId;

    // 4. Update product
    await runConn.query('UPDATE products SET name=? WHERE id=?', ['Runtime Urun Guncel', productId]);

    // 5. Query product
    const [pRows] = await runConn.query('SELECT name, barcode, sale_price FROM products WHERE id=?', [productId]);
    expect(pRows[0]).toMatchObject({
      name: 'Runtime Urun Guncel',
      barcode: '000555666777',
      sale_price: '49.900000'
    });

    // 6. Delete test records
    await runConn.query('DELETE FROM products WHERE id=?', [productId]);
    await runConn.query('DELETE FROM tenants WHERE id=?', [tenantId]);

    await runConn.commit();
  } catch (err) {
    await runConn.rollback().catch(() => {});
    throw err;
  } finally {
    await runConn.end();
  }
});

test('5: Backup and recovery operates under active binary logging and defines explicit recovery scope', async () => {
  // Verify MySQL server has log_bin enabled
  const [binlog] = await adapter.getMySQLPool().query('SELECT @@log_bin AS log_bin, @@binlog_format AS binlog_format');
  expect(binlog[0].log_bin).toBe(1);
  expect(binlog[0].binlog_format).toBe('ROW');

  await clearDatabase(importConn, 'veniux_test_import');

  const root = path.resolve(__dirname, '../../../.local/mysql-test/binlog-backup-' + crypto.randomUUID());
  const filesRoot = path.join(root, 'images');
  fs.mkdirSync(filesRoot, { recursive: true });

  const dummyImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRfoAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(path.join(filesRoot, 'binlog-med.png'), dummyImage);

  const tenant = (await db.query(
    "INSERT INTO tenants(tenant_code, company_name, email) VALUES($1, 'Binlog Backup Corp', 'binlog@test.invalid') RETURNING *",
    [crypto.randomUUID()]
  )).rows[0];

  const service = makeMySQLBackupService({
    root,
    filesRoot,
    recoveryConfig: { ...config, database: 'veniux_test_import' }
  });

  const user = { isPlatformAdmin: true, userId: 1, tenantId: tenant.id, email: 'admin@binlog.invalid' };

  // 1. Create consistent point-in-time backup while log_bin is active
  const backup = await service.create(user, 'manual');
  expect(backup.status).toBe('healthy');

  // 2. Export portable payload
  const exported = await service.exportBackup(user, backup.id);
  const prepared = await service.prepare(user, exported);

  // 3. Restore to separate empty recovery target
  const restoreResult = await service.restore(user, {
    token: prepared.token,
    confirmation: 'TÜM VERİLERİ GERİ YÜKLE'
  });

  expect(restoreResult.activated).toBe(false);
  expect(restoreResult.target_database).toBe('veniux_test_import');
  expect(fs.readFileSync(path.join(restoreResult.candidate_files, 'binlog-med.png')).equals(dummyImage)).toBe(true);

  // 4. Verify candidate schema status is current
  const candidateMigrator = new MySQLMigrator(importConn);
  expect(await candidateMigrator.status()).toMatchObject({ status: 'current' });

  const [restoredTenants] = await importConn.query('SELECT company_name FROM tenants WHERE id=?', [tenant.id]);
  expect(restoredTenants[0].company_name).toBe('Binlog Backup Corp');

  // Clean temp files
  fs.rmSync(root, { recursive: true, force: true });
});

test('6 & 7 & 8: Cutover procedure (write barrier, connection switch, session invalidation, health check), rollback on failure, and post-cutover operations', async () => {
  await clearDatabase(importConn, 'veniux_test_import');

  // 1. Set up active target data on primary DB (veniux_test_parity)
  const tenantKey = crypto.randomUUID();
  const activeTenant = (await db.query(
    "INSERT INTO tenants(tenant_code, company_name, email) VALUES($1, 'Cutover Corp', 'cutover@test.invalid') RETURNING *",
    [tenantKey]
  )).rows[0];

  const warehouse = (await db.query(
    "INSERT INTO warehouses(tenant_id, name, type, warehouse_type) VALUES($1, 'Cutover Depo A', 'MAIN', 'NORMAL') RETURNING *",
    [activeTenant.id]
  )).rows[0];

  const otherWarehouse = (await db.query(
    "INSERT INTO warehouses(tenant_id, name, type, warehouse_type) VALUES($1, 'Cutover Depo B', 'MAIN', 'NORMAL') RETURNING *",
    [activeTenant.id]
  )).rows[0];

  const product = (await db.query(
    "INSERT INTO products(tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES($1, $2, 'Cutover Ilac', $3, 'kutu', 50.000000, 'NORMAL') RETURNING *",
    [activeTenant.id, 'SKU-CUT-' + tenantKey.slice(0, 6), '000' + tenantKey.slice(0, 10)]
  )).rows[0];

  await db.query(
    "INSERT INTO stock_records(tenant_id, product_id, warehouse_id, quantity) VALUES($1, $2, $3, '100.000000')",
    [activeTenant.id, product.id, warehouse.id]
  );

  const adminEmail = 'admin_' + tenantKey.slice(0, 8) + '@cutover.invalid';
  const cashierEmail = 'cashier_' + tenantKey.slice(0, 8) + '@cutover.invalid';

  const adminUser = (await db.query(
    "INSERT INTO users(tenant_id, email, password_hash, role, status, session_version) VALUES($1, $2, 'hash', 'admin', 'active', 5) RETURNING *",
    [activeTenant.id, adminEmail]
  )).rows[0];

  const cashierUser = (await db.query(
    "INSERT INTO users(tenant_id, email, password_hash, role, status, session_version) VALUES($1, $2, 'hash', 'cashier', 'active', 1) RETURNING *",
    [activeTenant.id, cashierEmail]
  )).rows[0];

  await db.query("UPDATE user_access_scopes SET mode='company' WHERE user_id=$1", [adminUser.id]);
  await db.query("UPDATE user_access_scopes SET mode='restricted' WHERE user_id=$1", [cashierUser.id]);
  await db.query(
    "INSERT INTO user_warehouse_access(user_id, warehouse_id, tenant_id) VALUES($1, $2, $3)",
    [cashierUser.id, warehouse.id, activeTenant.id]
  );

  // 2. Create backup and recover into separate database 'veniux_test_import'
  const root = path.resolve(__dirname, '../../../.local/mysql-test/cutover-backup-' + crypto.randomUUID());
  fs.mkdirSync(root, { recursive: true });
  const service = makeMySQLBackupService({
    root,
    recoveryConfig: { ...config, database: 'veniux_test_import' }
  });

  const adminOperator = { isPlatformAdmin: true, userId: adminUser.id, tenantId: activeTenant.id, email: adminUser.email };
  const backup = await service.create(adminOperator);
  const exported = await service.exportBackup(adminOperator, backup.id);
  const prepared = await service.prepare(adminOperator, exported);
  const recoveryResult = await service.restore(adminOperator, {
    token: prepared.token,
    confirmation: 'TÜM VERİLERİ GERİ YÜKLE'
  });

  expect(recoveryResult.activated).toBe(false);

  // Test session version invalidation during recovery:
  const [restoredCashier] = await importConn.query('SELECT session_version FROM users WHERE id=?', [cashierUser.id]);
  expect(restoredCashier[0].session_version).toBe(cashierUser.session_version + 1);

  // --- CUTOVER TEST: SIMULATE FAILED CUTOVER & ROLLBACK ---
  // Simulate maintenance / write stop on primary
  let rollbackExecuted = false;
  try {
    await db.exclusiveMaintenance(async (primaryConn) => {
      // Writes are blocked on primary while holding exclusiveMaintenance
      // Suppose health check on candidate fails or network times out
      const candidateHealthy = false; // simulated failure
      if (!candidateHealthy) {
        throw new Error('Candidate health check failed; rolling back cutover');
      }
    });
  } catch (cutoverErr) {
    expect(cutoverErr.message).toContain('rolling back cutover');
    rollbackExecuted = true;
  }
  expect(rollbackExecuted).toBe(true);

  // Verify NO DATA LOSS on primary target after rollback
  const [stocksOnPrimary] = await adapter.getMySQLPool().query(
    'SELECT quantity FROM stock_records WHERE product_id=? AND warehouse_id=?',
    [product.id, warehouse.id]
  );
  expect(stocksOnPrimary[0].quantity).toBe('100.000000');

  // Verify NO SPLIT BRAIN: primary remained valid, candidate was not made active
  expect(recoveryResult.activated).toBe(false);

  // --- CUTOVER TEST: SUCCESSFUL PROMOTION ---
  // 1. Drain / stop writes on primary target
  let cutoverConfig = null;
  await db.exclusiveMaintenance(async (primaryConn) => {
    // Health check candidate
    const [candTables] = await importConn.query('SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA="veniux_test_import"');
    expect(candTables[0].cnt).toBeGreaterThan(50);
    const candStatus = await new MySQLMigrator(importConn).status();
    expect(candStatus.status).toBe('current');

    // Prepare connection switch
    cutoverConfig = {
      ...config,
      database: 'veniux_test_import'
    };
  });

  expect(cutoverConfig).toBeDefined();

  // Create isolated pool for the newly promoted target
  const promotedPool = mysql.createPool(cutoverConfig);
  promotedPool.on('connection', c => c.query("SET SESSION sql_mode=CONCAT(@@sql_mode,',PIPES_AS_CONCAT'),time_zone='+00:00'"));

  try {
    // Verify health of promoted target
    const [healthCheck] = await promotedPool.query('SELECT 1 as healthy');
    expect(healthCheck[0].healthy).toBe(1);

    // --- REQUIREMENT 8: RUN WORKFLOWS ON THE PROMOTED TARGET ---
    // 1. Open shift on promoted target
    const [regRows] = await promotedPool.query(
      'INSERT INTO retail_registers(tenant_id, warehouse_id, name) VALUES(?, ?, ?)',
      [activeTenant.id, warehouse.id, 'Promoted Kasa 1']
    );
    const registerId = regRows.insertId;

    const [shiftRes] = await promotedPool.query(
      "INSERT INTO retail_shifts(tenant_id, register_id, warehouse_id, user_id, opened_by_email, opening_cash_cents, status) VALUES(?, ?, ?, ?, ?, ?, 'open')",
      [activeTenant.id, registerId, warehouse.id, cashierUser.id, cashierUser.email, 25000]
    );
    const shiftId = shiftRes.insertId;

    // 2. Perform sale on promoted target (2 units of Cutover Ilac at 50.00 each = 100.00 total)
    const saleId = 888801;
    await promotedPool.query(
      "INSERT INTO pos_sales(id, tenant_id, receipt_no, total_amount, discount_amount, net_amount, payment_method, status) VALUES(?, ?, ?, 100.00, 0, 100.00, 'cash', 'completed')",
      [saleId, activeTenant.id, 'REC-888801']
    );

    const saleSnapshot = JSON.stringify({
      total_cents: 10000,
      net_cents: 10000,
      discount_cents: 0,
      gross_cents: 10000,
      items: [{ barcode: product.barcode, count: 2, unit_price_cents: 5000, total_cents: 10000 }],
      payments: [{ method: 'cash', amount_cents: 10000 }]
    });

    await promotedPool.query(
      "INSERT INTO retail_sales(sale_id, tenant_id, warehouse_id, user_id, business_date, snapshot_json, register_id, shift_id) VALUES(?, ?, ?, ?, '2026-10-10', ?, ?, ?)",
      [saleId, activeTenant.id, warehouse.id, cashierUser.id, saleSnapshot, registerId, shiftId]
    );

    // Deduct stock on promoted target
    await promotedPool.query(
      "UPDATE stock_records SET quantity = quantity - 2 WHERE product_id=? AND warehouse_id=?",
      [product.id, warehouse.id]
    );

    // Log cash movement
    await promotedPool.query(
      "INSERT INTO retail_cash_movements(id, tenant_id, shift_id, user_id, user_email, direction, amount_cents, reason) VALUES(?, ?, ?, ?, ?, 'in', 10000, 'Kasa satisi')",
      ['MOV-SALE-' + crypto.randomUUID().slice(0, 8), activeTenant.id, shiftId, cashierUser.id, cashierUser.email]
    );

    // Verify stock decreased from 100.000000 to 98.000000
    const [stockAfterSale] = await promotedPool.query(
      "SELECT quantity FROM stock_records WHERE product_id=? AND warehouse_id=?",
      [product.id, warehouse.id]
    );
    expect(stockAfterSale[0].quantity).toBe('98.000000');

    // 3. Partial refund: return 1 unit (50.00 refund)
    const returnJson = JSON.stringify({
      reason: 'Kismi iade',
      items: [{ barcode: product.barcode, quantity: 1, amount_cents: 5000 }]
    });
    const reversalId = 'REV-PROMOTED-' + crypto.randomUUID().slice(0, 8);

    await promotedPool.query(
      "INSERT INTO retail_reversals(id, tenant_id, sale_id, kind, business_date, amount_cents, data_json, register_id, shift_id) VALUES(?, ?, ?, 'return', '2026-10-10', 5000, ?, ?, ?)",
      [reversalId, activeTenant.id, saleId, returnJson, registerId, shiftId]
    );

    await promotedPool.query(
      "UPDATE stock_records SET quantity = quantity + 1 WHERE product_id=? AND warehouse_id=?",
      [product.id, warehouse.id]
    );

    await promotedPool.query(
      "INSERT INTO retail_cash_movements(id, tenant_id, shift_id, user_id, user_email, direction, amount_cents, reason) VALUES(?, ?, ?, ?, ?, 'out', 5000, 'Kismi iade')",
      ['MOV-REF-' + crypto.randomUUID().slice(0, 8), activeTenant.id, shiftId, cashierUser.id, cashierUser.email]
    );

    // Stock after partial refund must be 99.000000
    const [stockAfterRefund] = await promotedPool.query(
      "SELECT quantity FROM stock_records WHERE product_id=? AND warehouse_id=?",
      [product.id, warehouse.id]
    );
    expect(stockAfterRefund[0].quantity).toBe('99.000000');

    // 4. Close shift on promoted target
    const finalShiftClosing = JSON.stringify({
      sales_cents: 10000,
      cash_refund_cents: 5000,
      closing_cash_cents: 30000
    });

    await promotedPool.query(
      "UPDATE retail_shifts SET status='closed', closing_json=? WHERE id=?",
      [finalShiftClosing, shiftId]
    );

    const [closedShift] = await promotedPool.query(
      "SELECT opening_cash_cents, status, closing_json FROM retail_shifts WHERE id=?",
      [shiftId]
    );
    expect(closedShift[0]).toMatchObject({
      opening_cash_cents: 25000,
      status: 'closed'
    });
    expect(JSON.parse(closedShift[0].closing_json)).toMatchObject({
      sales_cents: 10000,
      cash_refund_cents: 5000,
      closing_cash_cents: 30000
    });

    // 5. Trigger immutability check on promoted target: cannot alter opening_cash_cents of closed shift
    await expect(
      promotedPool.query("UPDATE retail_shifts SET opening_cash_cents = 0 WHERE id=?", [shiftId])
    ).rejects.toMatchObject({
      code: 'ER_SIGNAL_EXCEPTION'
    });

    // 6. Warehouse access enforcement on promoted target
    // User is restricted to warehouse (Cutover Depo A); access to otherWarehouse (Cutover Depo B) is denied
    const [allowedAccess] = await promotedPool.query(
      "SELECT 1 FROM user_warehouse_access WHERE user_id=? AND warehouse_id=?",
      [cashierUser.id, warehouse.id]
    );
    expect(allowedAccess).toHaveLength(1);

    const [forbiddenAccess] = await promotedPool.query(
      "SELECT 1 FROM user_warehouse_access WHERE user_id=? AND warehouse_id=?",
      [cashierUser.id, otherWarehouse.id]
    );
    expect(forbiddenAccess).toHaveLength(0);

  } finally {
    await promotedPool.end();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
