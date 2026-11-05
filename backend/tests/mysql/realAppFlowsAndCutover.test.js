const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const net = require('net');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const db = require('../../src/config/database');
const adapter = require('../../src/config/mysqlAdapter');
const { JWT_SECRET } = require('../../src/middlewares/authMiddleware');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../.local/mysql-test/config.json')));
const RUNTIME_USER = 'veniux_runtime_test';
const RUNTIME_PASS = 'VnxRuntimeTest2026!';
const MIGRATOR_USER = 'veniux_migrator_test';
const MIGRATOR_PASS = 'VnxMigratorTest2026!';
const PROMOTED_DB = 'veniux_test_import';

let adminConn, runtimeConn;
let testRoot;
let apiChild, apiPort, runnerPath;

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const p = server.address().port;
  await new Promise(r => server.close(r));
  return p;
}

function launchProcess(scriptPath, args, env) {
  let output = '';
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: path.resolve(__dirname, '../..'),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', d => { output += d.toString(); });
  child.stderr.on('data', d => { output += d.toString(); });
  return { child, getOutput: () => output };
}

beforeAll(async () => {
  await db.ready;
  testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-real-flows-'));

  adminConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: PROMOTED_DB,
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: true
  });

  runtimeConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: RUNTIME_USER,
    password: RUNTIME_PASS,
    database: PROMOTED_DB,
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: true
  });

  // Launch shared background API server connected to PROMOTED_DB under RUNTIME_USER
  apiPort = await getAvailablePort();
  const childEnv = {
    ...process.env,
    NODE_ENV: 'test',
    VENIUX_MYSQL_TEST: '1',
    DB_ENGINE: 'mysql',
    DB_HOST: config.host,
    DB_PORT: String(config.port),
    DB_USER: RUNTIME_USER,
    DB_PASSWORD: RUNTIME_PASS,
    DB_NAME: PROMOTED_DB,
    PORT: String(apiPort),
    HOST: '127.0.0.1',
    JWT_SECRET: JWT_SECRET,
    VENIUX_DISABLE_BACKGROUND_JOBS: '1'
  };

  const runnerCode = [
    "process.env.NODE_ENV = 'test';",
    "process.env.VENIUX_MYSQL_TEST = '1';",
    "const app = require('../../src/index');",
    "const server = app.listen(" + apiPort + ", '127.0.0.1', () => {",
    "  console.log('API_READY');",
    "});",
    "process.on('SIGTERM', () => { server.close(); process.exit(0); });"
  ].join('\n');

  runnerPath = path.resolve(__dirname, 'temp-api-runner-' + apiPort + '.cjs');
  fs.writeFileSync(runnerPath, runnerCode);

  const launched = launchProcess(runnerPath, [], childEnv);
  apiChild = launched.child;

  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (launched.getOutput().includes('API_READY')) { ready = true; break; }
    try {
      const h = await fetch(`http://127.0.0.1:${apiPort}/health`);
      if (h.status === 200) { ready = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) {
    throw Error('Shared API server failed to start. Output: ' + launched.getOutput());
  }
});

afterAll(async () => {
  if (apiChild && apiChild.exitCode === null) {
    apiChild.kill();
    await new Promise(r => apiChild.once('exit', r));
  }
  if (runnerPath && fs.existsSync(runnerPath)) {
    fs.unlinkSync(runnerPath);
  }
  await runtimeConn?.end().catch(() => {});
  await adminConn?.end().catch(() => {});
  await adapter.getMySQLPool()?.end().catch(() => {});
  if (testRoot && fs.existsSync(testRoot)) {
    fs.rmSync(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe('MySQL Real Application Flows & Multi-Process Cutover Verification', () => {

  test('1. Real service/API endpoints execute sale -> partial return -> shift close under runtime account with independent balance verification', async () => {
    // A. Setup test data in promoted target (veniux_test_import)
    const tenantCode = 'FLOW-' + crypto.randomUUID().slice(0, 8);
    const [tRes] = await adminConn.query(
      'INSERT INTO tenants (tenant_code, company_name, email, is_active) VALUES (?, ?, ?, 1)',
      [tenantCode, 'Real API Test Company', tenantCode + '@test.invalid']
    );
    const tenantId = tRes.insertId;

    await adminConn.query(
      "INSERT INTO licenses (tenant_id, license_key, expires_at, enabled_features_json) VALUES (?, ?, '2030-01-01', ?)",
      [tenantId, crypto.randomUUID(), JSON.stringify({ module_type: 'NORMAL' })]
    );

    const [wRes] = await adminConn.query(
      "INSERT INTO warehouses (tenant_id, name, type, warehouse_type) VALUES (?, 'Ana Market Deposu', 'MAIN', 'NORMAL')",
      [tenantId]
    );
    const warehouseId = wRes.insertId;

    const userEmail = 'manager-' + crypto.randomUUID().slice(0, 8) + '@test.invalid';
    const [uRes] = await adminConn.query(
      "INSERT INTO users (tenant_id, email, password_hash, role, full_name, status, session_version) VALUES (?, ?, 'disabled', 'manager', 'Magaza Yoneticisi', 'active', 1)",
      [tenantId, userEmail]
    );
    const userId = uRes.insertId;

    await adminConn.query(
      "UPDATE user_access_scopes SET mode='company' WHERE user_id=?",
      [userId]
    );

    const barcode = '8690' + Math.floor(100000000 + Math.random() * 900000000);
    const unitPrice = 25.50; // 2550 cents
    const [pRes] = await adminConn.query(
      "INSERT INTO products (tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES (?, ?, 'Gercek API Test Urunu', ?, 'adet', ?, 'NORMAL')",
      [tenantId, 'SKU-' + barcode, barcode, unitPrice]
    );
    const productId = pRes.insertId;

    const initialStockQty = 10.000000;
    await adminConn.query(
      "INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, ?)",
      [tenantId, productId, warehouseId, initialStockQty]
    );

    const token = jwt.sign(
      { userId, tenantId, sessionVersion: 1 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const baseUrl = `http://127.0.0.1:${apiPort}/api`;
    const authedFetch = (endpoint, options = {}) => fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID(),
        ...(options.headers || {})
      }
    });

    // B. Flow 1: Shift Opening via real HTTP API
    const openCashNumber = 100.00;
    const expectedOpeningCents = 10000;
    const openRes = await authedFetch('/scanner/shifts/open', {
      method: 'POST',
      body: JSON.stringify({
        warehouse_id: warehouseId,
        opening_cash: openCashNumber.toFixed(2)
      })
    });
    expect(openRes.status).toBe(201);
    const openBody = await openRes.json();
    expect(openBody.shift_id).toBeDefined();
    expect(openBody.status).toBe('open');
    expect(openBody.opening_cash_cents).toBe(expectedOpeningCents);
    const shiftId = openBody.shift_id;
    const registerId = openBody.register_id;

    // C. Flow 2: Sale via real HTTP API (Sell 2 items @ 25.50 TL)
    const sellCount = 2;
    const expectedGrossCents = sellCount * Math.round(unitPrice * 100); // 5100 cents (51.00 TL)
    const expectedNetCents = expectedGrossCents;
    const cashReceived = 60.00; // 6000 cents
    const expectedChangeCents = 900; // 9.00 TL

    const saleRes = await authedFetch('/scanner/sale', {
      method: 'POST',
      body: JSON.stringify({
        warehouse_id: warehouseId,
        shift_id: shiftId,
        register_id: registerId,
        items: [{ barcode, count: sellCount }],
        payments: [{ method: 'cash', amount: (expectedNetCents / 100).toFixed(2) }],
        cash_received: cashReceived.toFixed(2)
      })
    });
    expect(saleRes.status).toBe(201);
    const saleBody = await saleRes.json();
    expect(saleBody.sale_id).toBeDefined();
    expect(saleBody.total).toBe(51.00);
    expect(saleBody.change).toBe(9.00);
    const saleId = saleBody.sale_id;

    // Verify stock deducted from 10 to 8 via runtimeConn
    const expectedStockAfterSale = initialStockQty - sellCount; // 8.000000
    const [stockAfterSale] = await runtimeConn.query(
      'SELECT quantity FROM stock_records WHERE tenant_id=? AND product_id=? AND warehouse_id=?',
      [tenantId, productId, warehouseId]
    );
    expect(Number(stockAfterSale[0].quantity)).toBe(expectedStockAfterSale);

    // Verify movement ledger recorded outbound 2
    const [movementsSale] = await runtimeConn.query(
      "SELECT change_amount, movement_type FROM stock_movements WHERE tenant_id=? AND product_id=? ORDER BY id DESC LIMIT 1",
      [tenantId, productId]
    );
    expect(Number(movementsSale[0].change_amount)).toBe(-sellCount);
    expect(movementsSale[0].movement_type).toBe('outbound');

    // D. Flow 3: Partial Return via real HTTP API (Return 1 item out of 2)
    const saleDetailRes = await authedFetch(`/scanner/sales/${saleId}`);
    expect(saleDetailRes.status).toBe(200);
    const saleDetail = await saleDetailRes.json();
    const saleItemId = saleDetail.snapshot.items[0].id;

    const returnCount = 1;
    const expectedRefundCents = returnCount * Math.round(unitPrice * 100); // 2550 cents (25.50 TL)
    const returnRes = await authedFetch(`/scanner/sales/${saleId}/return`, {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Musteri begenmedi - kismi iade',
        shift_id: shiftId,
        register_id: registerId,
        items: [{ id: saleItemId, quantity: returnCount, disposition: 'saleable' }]
      })
    });
    expect(returnRes.status).toBe(200);
    const returnBody = await returnRes.json();
    expect(returnBody.refund).toBe(25.50);
    expect(returnBody.cash_refund).toBe(25.50);
    expect(returnBody.status).toBe('partially_returned');

    // Verify stock restored from 8 to 9
    const expectedStockAfterReturn = expectedStockAfterSale + returnCount; // 9.000000
    const [stockAfterReturn] = await runtimeConn.query(
      'SELECT quantity FROM stock_records WHERE tenant_id=? AND product_id=? AND warehouse_id=?',
      [tenantId, productId, warehouseId]
    );
    expect(Number(stockAfterReturn[0].quantity)).toBe(expectedStockAfterReturn);

    // Verify movement ledger recorded inbound 1
    const [movementsReturn] = await runtimeConn.query(
      "SELECT change_amount, movement_type FROM stock_movements WHERE tenant_id=? AND product_id=? ORDER BY id DESC LIMIT 1",
      [tenantId, productId]
    );
    expect(Number(movementsReturn[0].change_amount)).toBe(returnCount);
    expect(movementsReturn[0].movement_type).toBe('inbound');

    // E. Flow 4: Shift Detail and Closing via real HTTP API
    const expectedNetSalesCents = expectedGrossCents - expectedRefundCents; // 2550 cents
    const expectedDrawerCashCents = expectedOpeningCents + expectedGrossCents - expectedRefundCents; // 12550 cents

    const shiftDetailRes = await authedFetch(`/scanner/shifts/${shiftId}`);
    expect(shiftDetailRes.status).toBe(200);
    const shiftDetail = await shiftDetailRes.json();
    expect(shiftDetail.sales_cents).toBe(expectedGrossCents);
    expect(shiftDetail.cash_refund_cents).toBe(expectedRefundCents);
    expect(shiftDetail.net_cents).toBe(expectedNetSalesCents);
    expect(shiftDetail.expected_cash_cents).toBe(expectedDrawerCashCents);

    // Close shift with counted cash = 125.50 TL
    const closeRes = await authedFetch(`/scanner/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify({
        counted_cash: (expectedDrawerCashCents / 100).toFixed(2)
      })
    });
    expect(closeRes.status).toBe(200);
    const closeBody = await closeRes.json();
    expect(closeBody.status).toBe('closed');
    expect(closeBody.difference_cents).toBe(0);

    // F. Verify DB trigger enforcement: closed shift is immutable
    const [closedShiftRows] = await runtimeConn.query(
      'SELECT status, closing_json FROM retail_shifts WHERE id=?',
      [shiftId]
    );
    expect(closedShiftRows[0].status).toBe('closed');
    const closingJson = JSON.parse(closedShiftRows[0].closing_json);
    expect(closingJson.sales_cents).toBe(expectedGrossCents);
    expect(closingJson.cash_refund_cents).toBe(expectedRefundCents);
    expect(closingJson.net_cents).toBe(expectedNetSalesCents);
    expect(closingJson.difference_cents).toBe(0);

    // Tampering with financial attributes of closed shift must be rejected by trigger
    await expect(
      runtimeConn.query('UPDATE retail_shifts SET opening_cash_cents=99999 WHERE id=?', [shiftId])
    ).rejects.toThrow();
  });

  test('2. Two running API processes & two targets cutover protection: In-flight queued requests are fenced off, obsolete target rejects writes, 0 sales on old target, promoted target accepts writes, and rollback restores without data loss', async () => {
    const SOURCE_DB = 'veniux_test_parity';

    const sourceAdminConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: SOURCE_DB,
      supportBigNumbers: true,
      bigNumberStrings: false,
      dateStrings: true
    });

    await sourceAdminConn.query('UPDATE veniux_write_mutex SET is_active=1, fence_version=1 WHERE id=1');
    await adminConn.query('UPDATE veniux_write_mutex SET is_active=1, fence_version=1 WHERE id=1');

    // 1. Setup test data on SOURCE_DB (Target A)
    const tCode = 'CUT-' + crypto.randomUUID().slice(0, 8);
    const [tA] = await sourceAdminConn.query(
      'INSERT INTO tenants (tenant_code, company_name, email, is_active) VALUES (?, ?, ?, 1)',
      [tCode, 'Cutover Source Corp', tCode + '@test.invalid']
    );
    const tenantIdA = tA.insertId;

    await sourceAdminConn.query(
      "INSERT INTO licenses (tenant_id, license_key, expires_at, enabled_features_json) VALUES (?, ?, '2030-01-01', ?)",
      [tenantIdA, crypto.randomUUID(), JSON.stringify({ module_type: 'NORMAL' })]
    );

    const [wA] = await sourceAdminConn.query(
      "INSERT INTO warehouses (tenant_id, name, type, warehouse_type) VALUES (?, 'Target A Depo', 'MAIN', 'NORMAL')",
      [tenantIdA]
    );
    const warehouseIdA = wA.insertId;

    const [uA] = await sourceAdminConn.query(
      "INSERT INTO users (tenant_id, email, password_hash, role, full_name, status, session_version) VALUES (?, ?, 'disabled', 'manager', 'Target A Manager', 'active', 1)",
      [tenantIdA, 'mgrA-' + tCode + '@test.invalid']
    );
    const userIdA = uA.insertId;
    await sourceAdminConn.query("UPDATE user_access_scopes SET mode='company' WHERE user_id=?", [userIdA]);

    const barcodeA = '8690' + Math.floor(100000000 + Math.random() * 900000000);
    const [pA] = await sourceAdminConn.query(
      "INSERT INTO products (tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES (?, ?, 'Target A Item', ?, 'adet', 30.00, 'NORMAL')",
      [tenantIdA, 'SKU-' + barcodeA, barcodeA]
    );
    const productIdA = pA.insertId;

    await sourceAdminConn.query(
      "INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, 10.000000)",
      [tenantIdA, productIdA, warehouseIdA]
    );

    const [regA] = await sourceAdminConn.query(
      "INSERT INTO retail_registers (tenant_id, warehouse_id, name) VALUES (?, ?, 'Target A Kasa')",
      [tenantIdA, warehouseIdA]
    );
    const registerIdA = regA.insertId;

    const [sA] = await sourceAdminConn.query(
      "INSERT INTO retail_shifts (tenant_id, warehouse_id, user_id, register_id, opened_by_email, status, opening_cash_cents) VALUES (?, ?, ?, ?, 'mgrA@test.invalid', 'open', 5000)",
      [tenantIdA, warehouseIdA, userIdA, registerIdA]
    );
    const shiftIdA = sA.insertId;

    const tokenA = jwt.sign(
      { userId: userIdA, tenantId: tenantIdA, sessionVersion: 1 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Setup corresponding test data on PROMOTED_DB (Target B)
    const [tB] = await adminConn.query(
      'INSERT INTO tenants (tenant_code, company_name, email, is_active) VALUES (?, ?, ?, 1)',
      [tCode + '-B', 'Cutover Promoted Corp', tCode + '-B@test.invalid']
    );
    const tenantIdB = tB.insertId;

    await adminConn.query(
      "INSERT INTO licenses (tenant_id, license_key, expires_at, enabled_features_json) VALUES (?, ?, '2030-01-01', ?)",
      [tenantIdB, crypto.randomUUID(), JSON.stringify({ module_type: 'NORMAL' })]
    );

    const [wB] = await adminConn.query(
      "INSERT INTO warehouses (tenant_id, name, type, warehouse_type) VALUES (?, 'Target B Depo', 'MAIN', 'NORMAL')",
      [tenantIdB]
    );
    const warehouseIdB = wB.insertId;

    const [uB] = await adminConn.query(
      "INSERT INTO users (tenant_id, email, password_hash, role, full_name, status, session_version) VALUES (?, ?, 'disabled', 'manager', 'Target B Manager', 'active', 1)",
      [tenantIdB, 'mgrB-' + tCode + '@test.invalid']
    );
    const userIdB = uB.insertId;
    await adminConn.query("UPDATE user_access_scopes SET mode='company' WHERE user_id=?", [userIdB]);

    const barcodeB = '8690' + Math.floor(100000000 + Math.random() * 900000000);
    const [pB] = await adminConn.query(
      "INSERT INTO products (tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES (?, ?, 'Target B Item', ?, 'adet', 30.00, 'NORMAL')",
      [tenantIdB, 'SKU-' + barcodeB, barcodeB]
    );
    const productIdB = pB.insertId;

    await adminConn.query(
      "INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, 10.000000)",
      [tenantIdB, productIdB, warehouseIdB]
    );

    const [regB] = await adminConn.query(
      "INSERT INTO retail_registers (tenant_id, warehouse_id, name) VALUES (?, ?, 'Target B Kasa')",
      [tenantIdB, warehouseIdB]
    );
    const registerIdB = regB.insertId;

    const [sB] = await adminConn.query(
      "INSERT INTO retail_shifts (tenant_id, warehouse_id, user_id, register_id, opened_by_email, status, opening_cash_cents) VALUES (?, ?, ?, ?, 'mgrB@test.invalid', 'open', 5000)",
      [tenantIdB, warehouseIdB, userIdB, registerIdB]
    );
    const shiftIdB = sB.insertId;

    const tokenB = jwt.sign(
      { userId: userIdB, tenantId: tenantIdB, sessionVersion: 1 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Launch Process 1: API Server connected to SOURCE_DB under RUNTIME_USER
    const apiPort1 = await getAvailablePort();
    const runnerCode1 = [
      "process.env.NODE_ENV = 'test';",
      "process.env.VENIUX_MYSQL_TEST = '1';",
      "const app = require('../../src/index');",
      "const server = app.listen(" + apiPort1 + ", '127.0.0.1', () => {",
      "  console.log('API1_READY');",
      "});",
      "process.on('SIGTERM', () => { server.close(); process.exit(0); });"
    ].join('\n');

    const runnerPath1 = path.resolve(__dirname, 'temp-api-runner-' + apiPort1 + '.cjs');
    fs.writeFileSync(runnerPath1, runnerCode1);

    const proc1Env = {
      ...process.env,
      NODE_ENV: 'test',
      VENIUX_MYSQL_TEST: '1',
      DB_ENGINE: 'mysql',
      DB_HOST: config.host,
      DB_PORT: String(config.port),
      DB_USER: RUNTIME_USER,
      DB_PASSWORD: RUNTIME_PASS,
      DB_NAME: SOURCE_DB,
      PORT: String(apiPort1),
      HOST: '127.0.0.1',
      JWT_SECRET: JWT_SECRET,
      VENIUX_DISABLE_BACKGROUND_JOBS: '1'
    };

    const launched1 = launchProcess(runnerPath1, [], proc1Env);
    const apiChild1 = launched1.child;

    let ready1 = false;
    for (let i = 0; i < 120; i++) {
      if (launched1.getOutput().includes('API1_READY')) { ready1 = true; break; }
      try {
        const h = await fetch(`http://127.0.0.1:${apiPort1}/health`);
        if (h.status === 200) { ready1 = true; break; }
      } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    expect(ready1).toBe(true);

    try {
      // 4. Verify both processes report healthy with target_active: true
      const h1Initial = await (await fetch(`http://127.0.0.1:${apiPort1}/health`)).json();
      expect(h1Initial.status).toBe('ok');
      expect(h1Initial.target_active).toBe(true);

      const h2Initial = await (await fetch(`http://127.0.0.1:${apiPort}/health`)).json();
      expect(h2Initial.status).toBe('ok');
      expect(h2Initial.target_active).toBe(true);

      // 5. CUTOVER FENCING SIMULATION:
      // Open cutover maintenance transaction on Target A acquiring veniux_write_mutex FOR UPDATE
      const cutoverMaintConn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: SOURCE_DB
      });

      await cutoverMaintConn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await cutoverMaintConn.query('START TRANSACTION');
      await cutoverMaintConn.query('SELECT id FROM veniux_write_mutex WHERE id=1 FOR UPDATE');

      // 6. While Target A mutex is locked, send in-flight sale request to Process 1 (Target A)
      let req1Finished = false;
      let req1Status = null;
      let req1Body = null;

      const inFlightSalePromise = fetch(`http://127.0.0.1:${apiPort1}/api/scanner/sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          warehouse_id: warehouseIdA,
          shift_id: shiftIdA,
          register_id: registerIdA,
          items: [{ barcode: barcodeA, count: 1 }],
          payments: [{ method: 'cash', amount: '30.00' }],
          cash_received: '30.00'
        })
      }).then(async r => {
        req1Finished = true;
        req1Status = r.status;
        req1Body = await r.json().catch(() => ({}));
      });

      // Wait 350ms to ensure Request 1 has entered Process 1 and is waiting on the MySQL row mutex
      await new Promise(r => setTimeout(r, 350));
      expect(req1Finished).toBe(false);

      // 7. Apply Cutover Fence on Target A:
      // Deactivate Target A (is_active=0, fence_version++) and commit
      await cutoverMaintConn.query('UPDATE veniux_write_mutex SET is_active=0, fence_version=fence_version+1 WHERE id=1');
      await cutoverMaintConn.commit();
      await cutoverMaintConn.end();

      // 8. Row lock released! Request 1 unblocks, reads is_active=0, and is rejected with 503 TARGET_FENCED!
      await inFlightSalePromise;
      expect(req1Finished).toBe(true);
      expect(req1Status).toBe(503);
      expect(req1Body.code).toBe('TARGET_FENCED');

      // 9. Verify Target A received STRICTLY 0 sales!
      const [salesOnTargetA] = await sourceAdminConn.query(
        'SELECT sale_id FROM retail_sales WHERE tenant_id=?',
        [tenantIdA]
      );
      expect(salesOnTargetA.length).toBe(0);

      // Stock on Target A must be completely unchanged (10.000000)
      const [stockOnTargetA] = await sourceAdminConn.query(
        'SELECT quantity FROM stock_records WHERE tenant_id=? AND product_id=? AND warehouse_id=?',
        [tenantIdA, productIdA, warehouseIdA]
      );
      expect(Number(stockOnTargetA[0].quantity)).toBe(10);

      // 10. Send a second sale request to Process 1 (after fence):
      // Must be immediately rejected with 503 TARGET_FENCED
      const postCutoverRes = await fetch(`http://127.0.0.1:${apiPort1}/api/scanner/sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          warehouse_id: warehouseIdA,
          shift_id: shiftIdA,
          register_id: registerIdA,
          items: [{ barcode: barcodeA, count: 1 }],
          payments: [{ method: 'cash', amount: '30.00' }],
          cash_received: '30.00'
        })
      });
      expect(postCutoverRes.status).toBe(503);
      const postCutoverBody = await postCutoverRes.json();
      expect(postCutoverBody.code).toBe('TARGET_FENCED');

      // Process 1 health endpoint reports fenced
      const h1Fenced = await (await fetch(`http://127.0.0.1:${apiPort1}/health`)).json();
      expect(h1Fenced.status).toBe('fenced');
      expect(h1Fenced.target_active).toBe(false);

      // 11. Process 2 (connected to Promoted Target B) accepts writes:
      const saleTargetBRes = await fetch(`http://127.0.0.1:${apiPort}/api/scanner/sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenB}`,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          warehouse_id: warehouseIdB,
          shift_id: shiftIdB,
          register_id: registerIdB,
          items: [{ barcode: barcodeB, count: 2 }],
          payments: [{ method: 'cash', amount: '60.00' }],
          cash_received: '60.00'
        })
      });
      expect(saleTargetBRes.status).toBe(201);
      const saleTargetB = await saleTargetBRes.json();
      expect(saleTargetB.sale_id).toBeDefined();

      // Verify Target B recorded the sale and deducted stock (10 - 2 = 8)
      const [salesOnTargetB] = await adminConn.query(
        'SELECT sale_id FROM retail_sales WHERE tenant_id=?',
        [tenantIdB]
      );
      expect(salesOnTargetB.length).toBe(1);

      const [stockOnTargetB] = await adminConn.query(
        'SELECT quantity FROM stock_records WHERE tenant_id=? AND product_id=? AND warehouse_id=?',
        [tenantIdB, productIdB, warehouseIdB]
      );
      expect(Number(stockOnTargetB[0].quantity)).toBe(8);

      // Verify Target A STILL has 0 sales! No dual write or split brain!
      const [salesOnTargetAAfterB] = await sourceAdminConn.query(
        'SELECT sale_id FROM retail_sales WHERE tenant_id=?',
        [tenantIdA]
      );
      expect(salesOnTargetAAfterB.length).toBe(0);

      // 12. Test Failed Cutover & Rollback:
      // When cutover is aborted before completion, Target A is restored (unfenced)
      await sourceAdminConn.query('UPDATE veniux_write_mutex SET is_active=1 WHERE id=1');

      const h1Restored = await (await fetch(`http://127.0.0.1:${apiPort1}/health`)).json();
      expect(h1Restored.status).toBe('ok');
      expect(h1Restored.target_active).toBe(true);

      // Process 1 writes resume cleanly without data loss
      const rollbackSaleRes = await fetch(`http://127.0.0.1:${apiPort1}/api/scanner/sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenA}`,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          warehouse_id: warehouseIdA,
          shift_id: shiftIdA,
          register_id: registerIdA,
          items: [{ barcode: barcodeA, count: 1 }],
          payments: [{ method: 'cash', amount: '30.00' }],
          cash_received: '30.00'
        })
      });
      expect(rollbackSaleRes.status).toBe(201);
      const rollbackSale = await rollbackSaleRes.json();
      expect(rollbackSale.sale_id).toBeDefined();

      const [salesOnTargetARestored] = await sourceAdminConn.query(
        'SELECT sale_id FROM retail_sales WHERE tenant_id=?',
        [tenantIdA]
      );
      expect(salesOnTargetARestored.length).toBe(1);
    } finally {
      if (apiChild1 && apiChild1.exitCode === null) {
        apiChild1.kill();
        await new Promise(r => apiChild1.once('exit', r));
      }
      if (runnerPath1 && fs.existsSync(runnerPath1)) {
        fs.unlinkSync(runnerPath1);
      }
      await sourceAdminConn.end().catch(() => {});
    }
  });

  test('3. Promoted target persists across application process restarts (startProduction.js)', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promoted-reboot-data-'));

    try {
      require('../../src/services/deploymentService').configure(dataDir);
      const prodPort = await getAvailablePort();
      const envFile = path.join(dataDir, 'install.env');
      const envContent = require('node:util').parseEnv(fs.readFileSync(envFile, 'utf8'));

      Object.assign(envContent, {
        DB_ENGINE: 'mysql',
        DB_HOST: config.host,
        DB_PORT: String(config.port),
        DB_NAME: PROMOTED_DB,
        DB_USER: RUNTIME_USER,
        DB_PASSWORD: RUNTIME_PASS,
        PORT: String(prodPort),
        VENIUX_DATA_DIR: dataDir,
        VENIUX_DISABLE_BACKGROUND_JOBS: '1'
      });
      fs.writeFileSync(envFile, Object.entries(envContent).map(([k, v]) => k + '=' + JSON.stringify(v)).join('\n'));

      // Record deployment on the promoted target using migrator account
      const recordProc = launchProcess(
        path.resolve(__dirname, '../../scripts/mysql_migrate.js'),
        ['--record-deployment', '--confirm-target'],
        { ...process.env, ...envContent, DB_USER: MIGRATOR_USER, DB_PASSWORD: MIGRATOR_PASS, NODE_ENV: 'production' }
      );
      await new Promise(r => recordProc.child.once('exit', r));
      expect(recordProc.child.exitCode).toBe(0);

      // Boot Run 1: Start production process on promoted target
      let prodProc = launchProcess(
        path.resolve(__dirname, '../../scripts/startProduction.js'),
        ['--data-dir', dataDir],
        { ...process.env, VENIUX_DISABLE_BACKGROUND_JOBS: '1' }
      );

      let res1;
      for (let i = 0; i < 150; i++) {
        if (prodProc.child.exitCode !== null) break;
        try {
          res1 = await fetch(`http://127.0.0.1:${prodPort}/health`);
          if (res1.status === 200) break;
        } catch {}
        await new Promise(r => setTimeout(r, 100));
      }
      expect(res1?.status).toBe(200);
      const health1 = await res1.json();
      expect(health1.database).toBe('mysql');
      expect(health1.migrations.status).toBe('current');

      // Create marker record in promoted target via runtimeConn
      const markerSku = 'REBOOT-MARKER-' + crypto.randomUUID().slice(0, 8);
      const [tRow] = await runtimeConn.query('SELECT id FROM tenants LIMIT 1');
      const tenantId = tRow[0].id;
      await runtimeConn.query(
        "INSERT INTO products (tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES (?, ?, 'Reboot Marker', ?, 'adet', 1.00, 'NORMAL')",
        [tenantId, markerSku, 'BC-' + markerSku]
      );

      // Clean shutdown via /api/local-runtime/shutdown
      const serverJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'server.json'), 'utf8'));
      const exit1Promise = new Promise(r => prodProc.child.once('exit', r));
      const shutdownRes = await fetch(`http://127.0.0.1:${prodPort}/api/local-runtime/shutdown`, {
        method: 'POST',
        headers: { 'x-runtime-token': serverJson.token }
      });
      expect(shutdownRes.status).toBe(200);
      await exit1Promise;
      expect(prodProc.child.exitCode).toBe(0);

      // Boot Run 2: Restart application process from the same install.env
      prodProc = launchProcess(
        path.resolve(__dirname, '../../scripts/startProduction.js'),
        ['--data-dir', dataDir],
        { ...process.env, VENIUX_DISABLE_BACKGROUND_JOBS: '1' }
      );

      let res2;
      for (let i = 0; i < 150; i++) {
        if (prodProc.child.exitCode !== null) break;
        try {
          res2 = await fetch(`http://127.0.0.1:${prodPort}/health`);
          if (res2.status === 200) break;
        } catch {}
        await new Promise(r => setTimeout(r, 100));
      }
      expect(res2?.status).toBe(200);
      const health2 = await res2.json();
      expect(health2.database).toBe('mysql');
      expect(health2.migrations.status).toBe('current');

      // Verify marker record exists and is read from promoted target
      const [markerCheck] = await runtimeConn.query(
        'SELECT id, name FROM products WHERE tenant_id=? AND sku=?',
        [tenantId, markerSku]
      );
      expect(markerCheck.length).toBe(1);
      expect(markerCheck[0].name).toBe('Reboot Marker');

      // Clean shutdown 2
      const serverJson2 = JSON.parse(fs.readFileSync(path.join(dataDir, 'server.json'), 'utf8'));
      const exit2Promise = new Promise(r => prodProc.child.once('exit', r));
      await fetch(`http://127.0.0.1:${prodPort}/api/local-runtime/shutdown`, {
        method: 'POST',
        headers: { 'x-runtime-token': serverJson2.token }
      });
      await exit2Promise;
      expect(prodProc.child.exitCode).toBe(0);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  test('4. Old session tokens rejected via real HTTP requests upon session_version invalidation', async () => {
    const [tRow] = await runtimeConn.query('SELECT id FROM tenants LIMIT 1');
    const tenantId = tRow[0].id;

    // Ensure license exists for tenant
    const [licRows] = await adminConn.query("SELECT id FROM licenses WHERE tenant_id=?", [tenantId]);
    if (!licRows.length) {
      await adminConn.query(
        "INSERT INTO licenses (tenant_id, license_key, expires_at, enabled_features_json) VALUES (?, ?, '2030-01-01', ?)",
        [tenantId, crypto.randomUUID(), JSON.stringify({ module_type: 'NORMAL' })]
      );
    }

    const email = 'session-test-' + crypto.randomUUID().slice(0, 8) + '@test.invalid';
    const [uRes] = await adminConn.query(
      "INSERT INTO users (tenant_id, email, password_hash, role, status, session_version) VALUES (?, ?, 'disabled', 'manager', 'active', 1)",
      [tenantId, email]
    );
    const userId = uRes.insertId;
    await adminConn.query("UPDATE user_access_scopes SET mode='company' WHERE user_id=?", [userId]);

    // Issue JWT with sessionVersion = 1
    const oldToken = jwt.sign(
      { userId, tenantId, sessionVersion: 1 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Initial HTTP request: Old token is valid (session_version matches)
    const validRes = await fetch(`http://127.0.0.1:${apiPort}/api/warehouses`, {
      headers: { Authorization: `Bearer ${oldToken}` }
    });
    expect(validRes.status).toBe(200);

    // Invalidation: Increment session_version in database (as done during cutover / backup restore)
    await runtimeConn.query('UPDATE users SET session_version = session_version + 1 WHERE id=?', [userId]);

    // Re-attempt HTTP request with old token: MUST be rejected with HTTP 401
    const rejectedRes = await fetch(`http://127.0.0.1:${apiPort}/api/warehouses`, {
      headers: { Authorization: `Bearer ${oldToken}` }
    });
    expect(rejectedRes.status).toBe(401);
    const rejBody = await rejectedRes.json();
    expect(rejBody.error).toContain('Oturumunuz geçersiz veya hesabınız erişime kapalı');

    // Re-issue JWT with new sessionVersion = 2: MUST succeed with HTTP 200
    const newToken = jwt.sign(
      { userId, tenantId, sessionVersion: 2 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const freshRes = await fetch(`http://127.0.0.1:${apiPort}/api/warehouses`, {
      headers: { Authorization: `Bearer ${newToken}` }
    });
    expect(freshRes.status).toBe(200);
  });

  test('5. 64-bit ID precision preservation through API JSON responses and frontend consumption', async () => {
    // 64-bit ID exceeding Number.MAX_SAFE_INTEGER (9007199254740991)
    const BIG_64BIT_ID = '9007199254740995';

    const [tRow] = await runtimeConn.query("SELECT t.id FROM tenants t WHERE EXISTS (SELECT 1 FROM warehouses w WHERE w.tenant_id=t.id) AND EXISTS (SELECT 1 FROM users u WHERE u.tenant_id=t.id AND u.role='manager') ORDER BY t.id LIMIT 1");
    const tenantId = tRow[0].id;

    // Ensure license exists
    const [licRows] = await adminConn.query("SELECT id FROM licenses WHERE tenant_id=?", [tenantId]);
    if (!licRows.length) {
      await adminConn.query(
        "INSERT INTO licenses (tenant_id, license_key, expires_at, enabled_features_json) VALUES (?, ?, '2030-01-01', ?)",
        [tenantId, crypto.randomUUID(), JSON.stringify({ module_type: 'NORMAL' })]
      );
    }

    const [wRow] = await runtimeConn.query('SELECT id FROM warehouses WHERE tenant_id=? LIMIT 1', [tenantId]);
    const warehouseId = wRow[0].id;
    const [uRow] = await runtimeConn.query("SELECT id, email, session_version FROM users WHERE tenant_id=? AND role='manager' LIMIT 1", [tenantId]);
    const userId = uRow[0].id;

    // Clean up any previous test records with this 64-bit ID
    await adminConn.query('DELETE FROM retail_reversals WHERE sale_id=?', [BIG_64BIT_ID]);
    await adminConn.query('DELETE FROM retail_sales WHERE sale_id=?', [BIG_64BIT_ID]);
    await adminConn.query('DELETE FROM pos_sale_items WHERE sale_id=?', [BIG_64BIT_ID]);
    await adminConn.query('DELETE FROM pos_sales WHERE id=?', [BIG_64BIT_ID]);

    const barcode = '8690' + Math.floor(100000000 + Math.random() * 900000000);
    const [pRes] = await adminConn.query(
      "INSERT INTO products (tenant_id, sku, name, barcode, unit, sale_price, module_type) VALUES (?, ?, '64-bit ID Test Item', ?, 'adet', 10.00, 'NORMAL')",
      [tenantId, 'SKU-64-' + barcode, barcode]
    );
    const productId = pRes.insertId;
    const [stockRes] = await adminConn.query(
      "INSERT INTO stock_records (tenant_id, warehouse_id, product_id, quantity) VALUES (?, ?, ?, 10)",
      [tenantId, warehouseId, productId]
    );
    const stockId = stockRes.insertId;

    // Insert sale record with BIGINT id = 9007199254740995
    await adminConn.query(
      "INSERT INTO pos_sales (id, tenant_id, receipt_no, total_amount, discount_amount, net_amount, payment_method, status) VALUES (?, ?, ?, 10.00, 0.00, 10.00, 'cash', 'completed')",
      [BIG_64BIT_ID, tenantId, 'POS-64BIT-' + BIG_64BIT_ID]
    );

    const snapshot = {
      receipt_no: 'POS-64BIT-' + BIG_64BIT_ID,
      status: 'completed',
      shift_id: null,
      register_id: null,
      items: [{
        id: 1,
        product_id: productId,
        name: '64-bit ID Test Item',
        quantity: 1,
        unit: 'adet',
        unit_price: 10.00,
        gross_cents: 1000,
        net_cents: 1000,
        returned_quantity: 0,
        refunded_cents: 0,
        allocations: [{ stock_id: stockId, quantity: 1, recovered: 0 }],
        lot_allocations: []
      }],
      gross_cents: 1000,
      discount_cents: 0,
      net_cents: 1000,
      payments: { cash: 1000, credit_card: 0, received: 1000, change: 0 },
      refunded_cents: 0,
      refund_payments: { cash: 0, credit_card: 0 },
      cashier: uRow[0].email,
      created_at: new Date().toISOString()
    };

    await adminConn.query(
      "INSERT INTO retail_sales (sale_id, tenant_id, warehouse_id, user_id, business_date, snapshot_json) VALUES (?, ?, ?, ?, '2026-10-10', ?)",
      [BIG_64BIT_ID, tenantId, warehouseId, userId, JSON.stringify(snapshot)]
    );

    const token = jwt.sign(
      { userId, tenantId, sessionVersion: Number(uRow[0].session_version) },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // A. Query sale detail via HTTP GET /api/scanner/sales/:id
    const detailRes = await fetch(`http://127.0.0.1:${apiPort}/api/scanner/sales/${BIG_64BIT_ID}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(detailRes.status).toBe(200);

    const rawText = await detailRes.text();
    expect(rawText).toContain(`"sale_id":"${BIG_64BIT_ID}"`);
    expect(rawText).not.toContain('9007199254740996');

    const detailBody = JSON.parse(rawText);
    expect(typeof detailBody.sale_id).toBe('string');
    expect(detailBody.sale_id).toBe(BIG_64BIT_ID);

    // B. Query sales history via HTTP GET /api/scanner/sales
    const historyRes = await fetch(`http://127.0.0.1:${apiPort}/api/scanner/sales`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(historyRes.status).toBe(200);
    const historyBody = await historyRes.json();
    const foundSale = historyBody.find(s => String(s.sale_id) === BIG_64BIT_ID);
    expect(foundSale).toBeDefined();
    expect(foundSale.sale_id).toBe(BIG_64BIT_ID);

    // C. Verify receipt rendering via HTTP GET /api/scanner/sales/:id/receipt
    const receiptRes = await fetch(`http://127.0.0.1:${apiPort}/api/scanner/sales/${BIG_64BIT_ID}/receipt`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(receiptRes.status).toBe(200);
    expect(receiptRes.headers.get('content-type')).toContain('text/html');
    const receiptHtml = await receiptRes.text();
    expect(receiptHtml).toContain('POS-64BIT-' + BIG_64BIT_ID);

    // D. Verify partial return maintaining 64-bit precision in return object
    const [newReg] = await adminConn.query(
      'INSERT INTO retail_registers (tenant_id, warehouse_id, name) VALUES (?, ?, ?)',
      [tenantId, warehouseId, '64Bit Return Register ' + Date.now()]
    );
    const registerId = newReg.insertId;

    const [shiftRow] = await adminConn.query(
      "INSERT INTO retail_shifts (tenant_id, warehouse_id, user_id, register_id, opened_by_email, status, opening_cash_cents) VALUES (?, ?, ?, ?, 'manager@test.invalid', 'open', 5000)",
      [tenantId, warehouseId, userId, registerId]
    );
    const activeShiftId = shiftRow.insertId;

    const returnRes = await fetch(`http://127.0.0.1:${apiPort}/api/scanner/sales/${BIG_64BIT_ID}/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        reason: '64-bit ID iade testi',
        shift_id: activeShiftId,
        register_id: registerId,
        items: [{ id: 1, quantity: 1, disposition: 'saleable' }]
      })
    });

    expect(returnRes.status).toBe(200);
    const returnBody = await returnRes.json();
    expect(String(returnBody.sale_id)).toBe(BIG_64BIT_ID);
    expect(returnBody.sale_id).not.toBe(9007199254740996);
  });

});
