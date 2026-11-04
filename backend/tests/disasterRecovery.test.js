// Kurtarma tatbikatı: ürünün kendi yedeği indirilir, boş bir klasöre yeni veritabanı olarak açılır, stok ve hareket
// toplamları kaynakla birebir karşılaştırılır, sonra uygulama ayrı süreçte o veriyle başlatılıp okunur ve yazılır.
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { makeBackupService } = require('../src/services/backupService');
const { createTenant, createWarehouse, createProduct } = require('./factories');

jest.setTimeout(60000);

const totalsOf = raw => {
  const grouped = (table, column) => Object.fromEntries(raw.prepare(`SELECT tenant_id, product_id, warehouse_id, SUM(${column}) AS q, COUNT(*) AS n FROM ${table} GROUP BY tenant_id, product_id, warehouse_id`).all()
    .map(row => [`${row.tenant_id}/${row.product_id}/${row.warehouse_id}`, { quantity: Number(row.q), rows: Number(row.n) }]));
  return { stock: grouped('stock_records', 'quantity'), bins: grouped2(raw), movements: grouped('stock_movements', 'change_amount'), ledger: grouped('inventory_transactions', 'quantity') };
};
const grouped2 = raw => Object.fromEntries(raw.prepare('SELECT tenant_id, product_id, location_id, SUM(quantity) AS q FROM product_bin_records GROUP BY tenant_id, product_id, location_id').all()
  .map(row => [`${row.tenant_id}/${row.product_id}/${row.location_id}`, Number(row.q)]));

const freePort = () => new Promise(resolve => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

describe('backup restored onto an empty database', () => {
  let owner, warehouse, product, ledgerProduct, root, service, before, restoredPath, payload, child;
  const auth = () => ({ Authorization: `Bearer ${owner.token}` });

  beforeAll(async () => {
    owner = await createTenant();
    warehouse = await createWarehouse(owner.tenantId);
    product = await createProduct(owner.tenantId);
    ledgerProduct = await createProduct(owner.tenantId);
    const movement = await request(app).post('/api/stock/movement').set(auth()).set('Idempotency-Key', 'recovery-movement')
      .send({ product_id: product.id, warehouse_id: warehouse.id, change_amount: 42, movement_type: 'inbound' });
    expect(movement.status).toBeLessThan(300);
    const inbound = await request(app).post('/api/terminal/operations/inbound').set(auth()).set('Idempotency-Key', 'recovery-inbound')
      .send({ warehouse_id: warehouse.id, product_id: ledgerProduct.id, quantity: 8 });
    expect(inbound.status).toBe(200);

    root = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-recovery-'));
    service = makeBackupService({ root: path.join(root, 'backups'), filesRoot: path.join(root, 'images') });
    fs.mkdirSync(path.join(root, 'images'));
    before = totalsOf(db.getDb());
    const user = { userId: owner.userId, tenantId: owner.tenantId, email: owner.email, role: 'admin', isPlatformAdmin: true };
    const row = await service.create(user);
    payload = service.unpack(await service.exportBackup(user, row.id));
    await service.validate(payload);

    // Yeni makine: içinde hiçbir şey olmayan klasöre yalnızca yedekteki veritabanı açılır.
    const fresh = path.join(root, 'fresh');
    fs.mkdirSync(fresh);
    expect(fs.readdirSync(fresh)).toEqual([]);
    restoredPath = path.join(fresh, 'stok_takip.db');
    fs.writeFileSync(restoredPath, Buffer.from(payload.database, 'base64'));
  });

  afterAll(async () => {
    if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); }
    if (root && root.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  test('the comparison is not empty: the expected totals exist in the source', () => {
    const key = `${owner.tenantId}/${product.id}/${warehouse.id}`;
    expect(before.stock[key].quantity).toBe(42);
    expect(before.movements[key].quantity).toBe(42);
    expect(before.ledger[`${owner.tenantId}/${ledgerProduct.id}/${warehouse.id}`].quantity).toBe(8);
  });

  test('stock and movement totals match the source exactly; the database is intact', () => {
    const restored = new Database(restoredPath, { readonly: true });
    try {
      expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(restored.pragma('foreign_key_check')).toEqual([]);
      expect(totalsOf(restored)).toEqual(before);
      const versions = database => database.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
      expect(versions(restored)).toEqual(versions(db.getDb()));
    } finally { restored.close(); }
  });

  test('a changed total would be caught', () => {
    const restored = new Database(restoredPath, { readonly: true });
    try {
      const copy = JSON.parse(JSON.stringify(totalsOf(restored)));
      copy.movements[`${owner.tenantId}/${product.id}/${warehouse.id}`].quantity -= 1;
      expect(copy).not.toEqual(before);
    } finally { restored.close(); }
  });

  test('the application runs on the restored data, reads the same stock and writes only there', async () => {
    const port = await freePort();
    const secret = 'recovery-drill-only-secret';
    let output = '';
    child = spawn(process.execPath, ['src/index.js'], {
      cwd: path.join(__dirname, '..'),
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'development', JWT_SECRET: secret, PORT: String(port), HOST: '127.0.0.1', VENIUX_DATA_DIR: path.dirname(restoredPath), VENIUX_DISABLE_BACKGROUND_JOBS: '1' },
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const base = `http://127.0.0.1:${port}`;
    let health = null;
    for (let i = 0; i < 150 && !health; i++) {
      if (child.exitCode !== null) throw new Error(`Uygulama başlamadı: ${output.slice(-800)}`);
      try { const res = await fetch(`${base}/health`); if (res.ok) health = await res.json(); } catch { await new Promise(r => setTimeout(r, 200)); }
    }
    expect(health).not.toBeNull();

    const version = new Database(restoredPath, { readonly: true });
    const user = version.prepare('SELECT session_version FROM users WHERE id = ?').get(owner.userId);
    version.close();
    const headers = { Authorization: `Bearer ${jwt.sign({ userId: owner.userId, tenantId: owner.tenantId, sessionVersion: user.session_version }, secret)}`, 'Content-Type': 'application/json' };
    const stock = async () => (await (await fetch(`${base}/api/stock/records?warehouse_id=${warehouse.id}`, { headers })).json()).filter(r => r.product_id === product.id).reduce((sum, r) => sum + Number(r.quantity), 0);
    expect(await stock()).toBe(42);
    const write = await fetch(`${base}/api/stock/movement`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': 'recovery-after-restore' }, body: JSON.stringify({ product_id: product.id, warehouse_id: warehouse.id, change_amount: 5, movement_type: 'inbound' }) });
    expect(write.status).toBe(201);
    expect(await stock()).toBe(47);
    // Kaynak veritabanı etkilenmez.
    expect(totalsOf(db.getDb())).toEqual(before);
  });
});
