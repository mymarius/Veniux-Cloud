// Firma ayrımı taraması: A firmasının her tabloya işaretli verisi yazılır, B firması kendi geçerli verisiyle
// her uca istek atar ve her istekte tek bir alana A'nın kimliğini koyar. Yanıtta A'nın işareti görünmemeli,
// A'nın satırları değişmemeli, B'nin hiçbir satırı A'nın kaydına bağlanmamalı. Kendi kimlikleriyle aynı istek
// başarılı olmalı: aksi halde reddedilme doğrulamadan gelir ve test hiçbir şey kanıtlamaz.
// İstek sınırı tek IP'den gelen taramayı keser; 429 alan istek sorguya ulaşmaz ve test boşa geçer.
// Sınırın kendisi tests/requestFirewall.test.js içinde sınanır.
jest.mock('../src/middlewares/requestFirewall', () => ({ ...jest.requireActual('../src/middlewares/requestFirewall'), createFirewall: () => (req, res, next) => next() }));
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant } = require('./factories');

const MARK = 'LEAKMARKA';
const SKIP_TABLES = new Set(['request_log', 'outbox_events', 'webhook_logs', 'request_idempotency', 'users', 'tenants', 'licenses', 'invoices', 'license_activations', 'tenant_settings', 'audit_logs', 'schema_migrations']);
// *_id sütununun işaret ettiği tablo; bildirilmiş yabancı anahtarlar bunun üstüne eklenir.
const REF = {
  product_id: 'products', warehouse_id: 'warehouses', target_warehouse_id: 'warehouses', from_warehouse_id: 'warehouses', to_warehouse_id: 'warehouses',
  supplier_id: 'suppliers', location_id: 'warehouse_locations', current_location_id: 'warehouse_locations', target_location_id: 'warehouse_locations',
  actual_location_id: 'warehouse_locations', source_location_id: 'warehouse_locations', from_location_id: 'warehouse_locations', to_location_id: 'warehouse_locations',
  lot_id: 'inventory_lots', receipt_id: 'wms_inbound_receipts', wave_id: 'wms_pick_waves', order_id: 'purchase_orders', count_id: 'stock_counts',
  handling_unit_id: 'handling_units', parent_hu_id: 'handling_units', target_handling_unit_id: 'handling_units', appointment_id: 'wms_dock_appointments',
  task_id: 'wms_pick_tasks', item_id: 'wms_inbound_items', shift_id: 'retail_shifts', customer_id: 'retail_customers', assigned_user_id: 'users'
};

const sqlite = () => db.getDb();
const columnsOf = table => sqlite().pragma(`table_info(${table})`);
const allTables = () => sqlite().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
const hasTenant = table => columnsOf(table).some(col => col.name === 'tenant_id');
const refsOf = table => {
  const refs = {};
  for (const col of columnsOf(table)) if (REF[col.name]) refs[col.name] = REF[col.name];
  for (const fk of sqlite().pragma(`foreign_key_list(${table})`)) if (fk.table !== 'tenants' && fk.table !== 'users' && fk.from !== 'tenant_id') refs[fk.from] = fk.table;
  // Rezervasyonun order_id'si dış sipariş numarasıdır; kullanıcı kimliği istekten değil oturumdan gelir.
  if (table === 'inventory_reservations') delete refs.order_id;
  return refs;
};

let seedMark = MARK;
let counter = 0;
const ids = {};

const seedTenant = tenantId => {
  const tables = allTables().filter(t => hasTenant(t) && !SKIP_TABLES.has(t));
  const pending = new Set(tables);
  for (let round = 0; round < 6 && pending.size; round++) {
    for (const table of [...pending]) {
      const refs = refsOf(table);
      const values = {};
      let ready = true;
      for (const col of columnsOf(table)) {
        if (col.pk) continue;
        const required = col.notnull && col.dflt_value === null;
        const type = String(col.type).toUpperCase();
        if (col.name === 'tenant_id') values[col.name] = tenantId;
        else if (refs[col.name]) {
          if (ids[refs[col.name]] !== undefined) values[col.name] = ids[refs[col.name]];
          else if (required) ready = false;
        } else if (col.dflt_value !== null && !/name|title|code|_no$|number|uid|sku/.test(col.name)) continue;
        else if (/DATE|TIME/.test(type)) { if (required || /expiry|date$/.test(col.name)) values[col.name] = '2090-01-01'; }
        else if (/INT|REAL|NUM|DEC|BOOL/.test(type)) { if (required) values[col.name] = 1; }
        else if (/json$/.test(col.name)) values[col.name] = '{}';
        else if (required || /name|title|code|_no$|number|uid|sku/.test(col.name)) values[col.name] = `${seedMark}-${table}-${col.name}-${++counter}`;
      }
      if (!ready) continue;
      try {
        const keys = Object.keys(values);
        const info = sqlite().prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => values[k]));
        ids[table] = Number(info.lastInsertRowid);
        pending.delete(table);
      } catch { /* bağımlılığı sonraki turda oluşur veya tablo kısıtı kabul etmez */ }
    }
  }
  return pending;
};

const routes = () => {
  const index = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  const out = [];
  for (const [, prefix, mod] of index.matchAll(/app\.use\('([^']+)', require\('([^']+)'\)\)/g)) {
    const router = require(path.join(__dirname, '../src', mod));
    for (const layer of router.stack) {
      if (layer.route) for (const method of Object.keys(layer.route.methods)) out.push([method, prefix + layer.route.path]);
    }
  }
  return out;
};

const clearIds = () => { for (const key of Object.keys(ids)) delete ids[key]; };
const ID_PATHS = [['/products', 'products'], ['/warehouses', 'warehouses'], ['/suppliers', 'suppliers'], ['/purchase-orders', 'purchase_orders'],
  ['/stock-counts', 'stock_counts'], ['/wms/locations', 'warehouse_locations'], ['/inbound/receipts', 'wms_inbound_receipts'], ['/picking/waves', 'wms_pick_waves'],
  ['/reservations', 'inventory_reservations'], ['/alerts', 'alerts'], ['/shifts', 'retail_shifts'], ['/customers', 'retail_customers'], ['/sales', 'retail_sales'], ['/settings/users', 'users']];
const fillWith = (route, I) => route.replace(/:(\w+)/g, (_, name) => {
  if (name === 'id') { const hit = ID_PATHS.find(([p]) => route.includes(p)); return String(hit ? I[hit[1]] ?? 0 : I.products); }
  if (name === 'productId') return String(I.products);
  if (name === 'count_id') return String(I.stock_counts);
  if (name === 'item_id') return String(I.stock_count_items ?? 0);
  if (name === 'scope') return 'crm';
  return String(I.products);
});

const refFields = I => ({
  warehouse_id: I.warehouses, warehouseId: I.warehouses, product_id: I.products, productId: I.products, location_id: I.warehouse_locations, locationId: I.warehouse_locations,
  supplier_id: I.suppliers, lot_id: I.inventory_lots, receipt_id: I.wms_inbound_receipts, item_id: I.wms_inbound_items, task_id: I.wms_pick_tasks, handling_unit_id: I.handling_units,
  order_id: I.purchase_orders, count_id: I.stock_counts, source_location_id: I.warehouse_locations, actual_location_id: I.warehouse_locations, target_location_id: I.warehouse_locations,
  from_location_id: I.warehouse_locations, to_location_id: I.warehouse_locations, from_warehouse_id: I.warehouses, to_warehouse_id: I.warehouses, sourceWarehouseId: I.warehouses,
  targetWarehouseId: I.warehouses, target_warehouse_id: I.warehouses, shift_id: I.retail_shifts, customer_id: I.retail_customers, parent_hu_id: I.handling_units,
  target_handling_unit_id: I.handling_units, appointment_id: I.wms_dock_appointments, register_id: I.retail_registers
});

describe('another tenant\'s ids, one at a time, on top of a valid own request', () => {
  let a, b, A, B, F, unseeded;
  let keyCounter = 0;
  const rateLimited = [];
  const call = async (who, method, url, body) => {
    const req = request(app)[method](url).set('Authorization', `Bearer ${who.token}`);
    if (method !== 'get') req.set('Idempotency-Key', `sweep-key-${++keyCounter}`);
    const res = await (method === 'get' ? req : req.send(body));
    if (res.status === 429) rateLimited.push(`${method} ${url}`);
    return res;
  };
  const ok = async (who, method, url, body) => {
    const res = await call(who, method, url, body);
    if (res.status >= 300) throw new Error(`${method} ${url} → ${res.status} ${res.text}`);
    return res.body;
  };
  const tenantTables = () => allTables().filter(t => hasTenant(t) && !SKIP_TABLES.has(t));
  const snapshot = () => {
    const rows = {};
    for (const table of [...tenantTables(), 'users']) rows[table] = JSON.stringify(sqlite().prepare(`SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY 1`).all(a.tenantId));
    return rows;
  };
  const changed = (x, y) => Object.keys(x).filter(t => x[t] !== y[t]);
  const crossReferences = () => {
    const found = [];
    for (const table of tenantTables()) {
      for (const [col, target] of Object.entries(refsOf(table))) {
        if (!allTables().includes(target) || !hasTenant(target)) continue;
        const rows = sqlite().prepare(`SELECT t.${col} AS rid FROM ${table} t JOIN ${target} r ON r.id = t.${col} WHERE t.tenant_id = ? AND r.tenant_id <> ?`).all(b.tenantId, b.tenantId);
        for (const row of rows) found.push(`${table}.${col}#${row.rid}`);
      }
    }
    return found;
  };

  beforeAll(async () => {
    a = await createTenant();
    b = await createTenant();
    ids.users = a.userId;
    unseeded = seedTenant(a.tenantId);
    const foreign = sqlite();
    foreign.prepare("UPDATE products SET barcode = 'FOREIGN-CODE-2', gtin = 'FOREIGN-GTIN-2' WHERE id = ?").run(ids.products);
    foreign.prepare('UPDATE warehouse_locations SET warehouse_id = ? WHERE id = ?').run(ids.warehouses, ids.warehouse_locations);
    foreign.prepare("UPDATE wms_inbound_receipts SET receipt_no = 'INB-FOREIGN-2' WHERE id = ?").run(ids.wms_inbound_receipts);
    foreign.prepare("UPDATE wms_pick_waves SET wave_no = 'WAV-FOREIGN-2' WHERE id = ?").run(ids.wms_pick_waves);
    foreign.prepare('UPDATE inventory_lots SET product_id = ? WHERE id = ?').run(ids.products, ids.inventory_lots);
    A = { ...ids };
    clearIds();
    seedMark = 'OWNMARKB';
    ids.users = b.userId;
    seedTenant(b.tenantId);
    B = { ...ids };
    clearIds();

    // B'nin gerçek akışla kurulmuş verisi: iki raf, stok ve taşıma birimi.
    const warehouse = B.warehouses;
    sqlite().prepare("UPDATE warehouses SET warehouse_type = 'NORMAL' WHERE id = ?").run(warehouse);
    const product = (await ok(b, 'post', '/api/products', { sku: `OWN-${Date.now()}`, name: 'Kendi urunu', barcode: `OWNBAR${Date.now()}` })).id;
    const grid = await ok(b, 'post', '/api/wms/locations/generate-grid', { warehouse_id: warehouse, aisle_code: 'OWN', rack_count: 1, tier_count: 1, bin_count: 2 });
    const [bin1, bin2] = grid.locations.map(l => l.id);
    await ok(b, 'post', '/api/wms/ledger/transaction', { warehouse_id: warehouse, location_id: bin1, product_id: product, transaction_type: 'PUTAWAY', quantity: 500 });
    const hu = (await ok(b, 'post', '/api/wms/packing/handling-units', { warehouse_id: warehouse, hu_type: 'BOX' })).id;
    F = { warehouse, product, bin1, bin2, hu };

    // A'nın gerçek sayım önizlemesi; B bunu onaylayamamalı.
    await ok(a, 'post', '/api/wms/ledger/transaction', { warehouse_id: A.warehouses, location_id: A.warehouse_locations, product_id: A.products, transaction_type: 'PUTAWAY', quantity: 9 });
    const baseline = await ok(a, 'post', '/api/wms/cycle-count/baseline', { warehouse_id: A.warehouses, location_id: A.warehouse_locations, product_id: A.products });
    A.baselineToken = baseline.baseline_token;
    A.review = (await ok(a, 'post', '/api/wms/cycle-count/preview', { baseline_token: baseline.baseline_token, counted_qty: 3 })).id;
  });

  test('marker data exists for the operational tables', () => {
    const required = ['products', 'warehouses', 'suppliers', 'warehouse_locations', 'inventory_lots', 'wms_inbound_receipts', 'wms_inbound_items', 'wms_pick_waves', 'wms_pick_tasks', 'handling_units', 'purchase_orders', 'stock_counts', 'warehouse_devices'];
    expect(required.filter(t => A[t] === undefined)).toEqual([]);
    expect([...unseeded].filter(t => required.includes(t))).toEqual([]);
  });

  const newReceipt = async () => ok(b, 'post', '/api/wms/inbound/receipts', { warehouse_id: F.warehouse, items: [{ product_id: F.product, expected_qty: 1 }] });
  const newTask = async () => (await ok(b, 'post', '/api/wms/picking/waves', { warehouse_id: F.warehouse, items: [{ product_id: F.product, requested_qty: 1 }] })).tasks[0].id;

  const newReview = async () => {
    const baseline = await ok(b, 'post', '/api/wms/cycle-count/baseline', { warehouse_id: F.warehouse, location_id: F.bin1, product_id: F.product });
    return ok(b, 'post', '/api/wms/cycle-count/preview', { baseline_token: baseline.baseline_token, counted_qty: 1 + (++keyCounter % 50) });
  };

  // [yol, kendi gövdesi, { yabancı alan: A'nın değeri }]
  const CASES = () => [
    ['/api/wms/locations/generate-grid', () => ({ warehouse_id: F.warehouse, aisle_code: `G${++keyCounter}`, rack_count: 1, tier_count: 1, bin_count: 1 }), { warehouse_id: A.warehouses }],
    ['/api/wms/locations/relocate', () => ({ warehouse_id: F.warehouse, source_location_id: F.bin1, target_location_id: F.bin2, product_id: F.product, quantity: 1 }),
      { warehouse_id: A.warehouses, source_location_id: A.warehouse_locations, target_location_id: A.warehouse_locations, product_id: A.products, lot_id: A.inventory_lots }],
    ['/api/wms/ledger/transaction', () => ({ warehouse_id: F.warehouse, location_id: F.bin1, product_id: F.product, transaction_type: 'PUTAWAY', quantity: 1 }),
      { warehouse_id: A.warehouses, location_id: A.warehouse_locations, product_id: A.products, lot_id: A.inventory_lots, handling_unit_id: A.handling_units }],
    ['/api/wms/reservations', () => ({ warehouse_id: F.warehouse, product_id: F.product, requested_qty: 1 }), { warehouse_id: A.warehouses, product_id: A.products }],
    ['/api/wms/inbound/receipts', () => ({ warehouse_id: F.warehouse, items: [{ product_id: F.product, expected_qty: 1 }] }),
      { warehouse_id: A.warehouses, supplier_id: A.suppliers, appointment_id: A.wms_dock_appointments, items: [{ product_id: A.products, expected_qty: 1 }] }],
    ['/api/wms/inbound/putaway', async () => { const r = await newReceipt(); return { receipt_id: r.id, item_id: r.items[0].id, actual_location_id: F.bin1, quantity: 1 }; },
      { receipt_id: A.wms_inbound_receipts, item_id: A.wms_inbound_items, actual_location_id: A.warehouse_locations }],
    ['/api/wms/picking/waves', () => ({ warehouse_id: F.warehouse, items: [{ product_id: F.product, requested_qty: 1 }] }),
      { warehouse_id: A.warehouses, assigned_user_id: a.userId, items: [{ product_id: A.products, requested_qty: 1 }] }],
    ['/api/wms/picking/confirm-item', async () => ({ task_id: await newTask(), picked_qty: 1 }), { task_id: A.wms_pick_tasks, target_handling_unit_id: A.handling_units }],
    ['/api/wms/packing/handling-units', () => ({ warehouse_id: F.warehouse, hu_type: 'BOX' }), { warehouse_id: A.warehouses, parent_hu_id: A.handling_units }],
    ['/api/wms/packing/dispatch', () => ({ warehouse_id: F.warehouse, handling_unit_id: F.hu }), { warehouse_id: A.warehouses, handling_unit_id: A.handling_units }],
    ['/api/wms/packing/dock-appointments', () => ({ warehouse_id: F.warehouse, dock_code: 'D1', appointment_time: '2030-01-01 10:00:00' }), { warehouse_id: A.warehouses }],
    ['/api/wms/cycle-count/baseline', () => ({ warehouse_id: F.warehouse, location_id: F.bin1, product_id: F.product }),
      { warehouse_id: A.warehouses, location_id: A.warehouse_locations, product_id: A.products }],
    ['/api/wms/cycle-count/adjust', async () => ({ review_id: (await newReview()).id, reason: 'Sayim farki' }), { review_id: A.review }],
    ['/api/terminal/register', () => ({ device_uid: `OWN-${++keyCounter}`, warehouse_id: F.warehouse }), { warehouse_id: A.warehouses }],
    ['/api/terminal/operations/inbound', () => ({ warehouse_id: F.warehouse, product_id: F.product, location_id: F.bin1, quantity: 1 }),
      { warehouse_id: A.warehouses, product_id: A.products, location_id: A.warehouse_locations }],
    ['/api/terminal/operations/outbound', () => ({ warehouse_id: F.warehouse, product_id: F.product, location_id: F.bin1, quantity: 1 }),
      { warehouse_id: A.warehouses, product_id: A.products, location_id: A.warehouse_locations }],
    ['/api/terminal/operations/relocate', () => ({ warehouse_id: F.warehouse, product_id: F.product, source_location_id: F.bin1, target_location_id: F.bin2, quantity: 1 }),
      { warehouse_id: A.warehouses, product_id: A.products, source_location_id: A.warehouse_locations, target_location_id: A.warehouse_locations }],
    ['/api/terminal/operations/count', () => ({ warehouse_id: F.warehouse, location_id: F.bin1, product_id: F.product, counted_quantity: 400 + (++keyCounter % 50) }),
      { warehouse_id: A.warehouses, location_id: A.warehouse_locations, product_id: A.products }],
    ['/api/purchase-orders', () => ({ supplier_id: B.suppliers, target_warehouse_id: F.warehouse, items: [{ product_id: F.product, quantity: 1, unit_price: 1 }] }),
      { supplier_id: A.suppliers, target_warehouse_id: A.warehouses, items: [{ product_id: A.products, quantity: 1, unit_price: 1 }] }],
    ['/api/stock-counts', () => ({ warehouse_id: F.warehouse }), { warehouse_id: A.warehouses }]
  ];

  test('every field is refused, A is untouched, and the same request with own ids succeeds', async () => {
    const problems = [];
    let before = snapshot();
    for (const [url, own, foreign] of CASES()) {
      for (const [field, value] of Object.entries(foreign)) {
        const res = await call(b, 'post', url, { ...(await own()), [field]: value });
        const label = `${url} ${field}`;
        if (res.status < 400) problems.push(`${label} accepted → ${res.status}`);
        if ((res.text || '').includes(MARK)) problems.push(`${label} leaked`);
      }
      const refs = crossReferences();
      if (refs.length) problems.push(`${url} linked ${refs.join(' ')}`);
      const after = snapshot();
      for (const table of changed(before, after)) problems.push(`${url} changed A.${table}`);
      before = after;
      const control = await call(b, 'post', url, await own());
      if (control.status >= 300) problems.push(`${url} own request failed → ${control.status} ${(control.text || '').slice(0, 160)}`);
    }
    expect(problems).toEqual([]);
  }, 120000);

  // Dış hizmete, dosya sistemine veya platform yetkisine giden yollar bu genel taramanın dışındadır.
  const OUT_OF_SWEEP = /^\/api\/(platform|license|auth|backups|settings|ai|notifications|mobile)\b|\/api\/packages\/admin|run-analysis|\/accept-invitation/;

  test('every read route given foreign ids returns none of A\'s data', async () => {
    const leaks = [];
    const query = new URLSearchParams(Object.entries(refFields(A)).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
    for (const [method, route] of routes()) {
      if (method !== 'get' || /^\/api\/(platform|license|auth|backups)\b/.test(route)) continue;
      const res = await call(b, 'get', `${fillWith(route, A)}?${query}`);
      if ((res.text || '').includes(MARK)) leaks.push(`${route} → ${res.status}`);
    }
    expect(leaks).toEqual([]);
  }, 180000);

  test('every write route, every id field: no links, no changes, no leaks', async () => {
    const values = () => ({
      name: 'B kaydi', sku: `B-${++keyCounter}`, type: 'MAIN', status: 'approved', change_amount: 1, movement_type: 'IN', new_quantity: 5, quantity: 1, requested_qty: 1, expected_qty: 1, counted_qty: 5, counted_quantity: 5,
      amount: 1, full_name: 'P', reason: 'B', notes: 'B', is_locked: true, device_uid: `B-DEV-${keyCounter}`, payment_method: 'cash', customer_name: 'C', register_code: `R${keyCounter}`, opening_cash: 0,
      aisle_code: `Q${keyCounter}`, rack_count: 1, tier_count: 1, bin_count: 1, dock_code: 'D1', appointment_time: '2030-01-01 10:00:00', hu_type: 'BOX'
    });
    const itemsOf = I => [{ product_id: I.products, quantity: 1, expected_qty: 1, requested_qty: 1, unit_price: 1, unit_cost: 1, sale_price: 1, name: 'x' }];
    const own = refFields(B);
    const foreign = refFields(A);
    const problems = [];
    let reached = 0;
    const statuses = {};
    let before = snapshot();
    for (const [method, route] of routes()) {
      if (!['post', 'put', 'patch'].includes(method) || OUT_OF_SWEEP.test(route)) continue;
      const url = fillWith(route, B);
      for (const field of Object.keys(foreign)) {
        if (foreign[field] === undefined) continue;
        const res = await call(b, method, url, { ...values(), ...own, items: itemsOf(B), [field]: foreign[field] });
        if (res.status < 400) reached++;
        (statuses[`${method.toUpperCase()} ${route}`] ||= {})[res.status] = ((statuses[`${method.toUpperCase()} ${route}`] ||= {})[res.status] || 0) + 1;
        if ((res.text || '').includes(MARK)) problems.push(`${route} ${field} leaked`);
      }
      const res = await call(b, method, url, { ...values(), ...own, items: itemsOf(A) });
      if ((res.text || '').includes(MARK)) problems.push(`${route} items leaked`);
      const refs = crossReferences();
      if (refs.length) problems.push(`${method.toUpperCase()} ${route} linked ${refs.join(' ')}`);
      const after = snapshot();
      for (const table of changed(before, after)) problems.push(`${method.toUpperCase()} ${route} changed A.${table}`);
      before = after;
    }
    if (process.env.SWEEP_REPORT) fs.writeFileSync(process.env.SWEEP_REPORT, Object.entries(statuses).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join('\n'));
    expect(problems).toEqual([]);
    expect(reached).toBeGreaterThan(0);
  }, 300000);

  test('id-addressed writes and deletes from B change nothing of A\'s', async () => {
    const violations = [];
    let before = snapshot();
    for (const [method, route] of routes()) {
      if (!['put', 'patch', 'delete', 'post'].includes(method) || !route.includes(':') || OUT_OF_SWEEP.test(route)) continue;
      await call(b, method, fillWith(route, A), { name: 'B overwrite', sku: `BX${++keyCounter}`, status: 'resolved', type: 'MAIN', is_locked: true, lock_reason: 'B', quantity: 0, counted_quantity: 0, notes: 'B' });
      const after = snapshot();
      for (const table of changed(before, after)) violations.push(`${method.toUpperCase()} ${route} → ${table}`);
      before = after;
    }
    expect(violations).toEqual([]);
  }, 180000);

  test('barcode resolution finds only own records, whichever code is scanned', async () => {
    const row = (table, column) => sqlite().prepare(`SELECT ${column} AS code FROM ${table} WHERE id = ?`).get(A[table]).code;
    const codes = ['FOREIGN-CODE-2', 'FOREIGN-GTIN-2', row('products', 'sku'), row('warehouse_locations', 'location_code'),
      row('handling_units', 'hu_code'), 'INB-FOREIGN-2', 'WAV-FOREIGN-2', row('inventory_lots', 'lot_number')];
    for (const barcode of codes) {
      // Kontrol: aynı kod A için gerçekten çözülür.
      expect([barcode, (await call(a, 'post', '/api/wms/barcode/resolve', { barcode })).body.matched]).toEqual([barcode, true]);
      expect([barcode, (await call(b, 'post', '/api/wms/barcode/resolve', { barcode })).body.matched]).toEqual([barcode, false]);
      expect([barcode, (await call(b, 'post', '/api/terminal/scan', { barcode })).status]).toEqual([barcode, 404]);
    }
  });

  test('stock ledger reads never carry the other tenant\'s rows', async () => {
    await ok(a, 'post', '/api/wms/ledger/transaction', { warehouse_id: A.warehouses, location_id: A.warehouse_locations, product_id: A.products, transaction_type: 'PUTAWAY', quantity: 7 });
    const query = `warehouse_id=${A.warehouses}&product_id=${A.products}`;
    expect((await call(a, 'get', `/api/wms/ledger?${query}`)).body.length).toBeGreaterThan(0);
    const foreign = await call(b, 'get', `/api/wms/ledger?${query}`);
    expect(foreign.status >= 400 || foreign.body.length === 0).toBe(true);
    expect((await call(b, 'get', `/api/wms/ledger/product/${A.products}`)).status).toBe(404);
  });

  test('the sweep was not cut short by a rate limit', () => {
    expect(rateLimited).toEqual([]);
  });

  test('a count baseline taken by the other tenant cannot be used', async () => {
    expect((await call(b, 'post', '/api/wms/cycle-count/preview', { baseline_token: A.baselineToken, counted_qty: 1 })).status).toBe(404);
  });

  // İstek bağlamı dışındaki çağrılarda sorgu yeniden yazımı devrede değildir (zamanlanmış iş, betik, yeni bir uç):
  // servisin kendisi firma kimliğini sorguya koymalıdır. B'nin kimliğiyle A'nın kayıtları görünmez ve değişmez.
  test('services filter by tenant themselves, outside any request scope', async () => {
    const location = require('../src/services/warehouseLocationService');
    const reservation = require('../src/services/inventoryReservationService');
    const packing = require('../src/services/wmsPackingService');
    const picking = require('../src/services/wmsPickingService');
    const inbound = require('../src/services/wmsInboundService');
    const slotting = require('../src/services/wmsSlottingService');
    const barcode = require('../src/services/barcodeResolutionService');
    const before = snapshot();
    expect(await location.toggleLockLocation(A.warehouse_locations, true, 'B', b.tenantId)).toBeFalsy();
    expect(await location.getLocationById(A.warehouse_locations, b.tenantId)).toBeNull();
    await expect(reservation.releaseReservation(A.inventory_reservations, b.tenantId)).rejects.toThrow();
    expect(await packing.getHandlingUnits(A.warehouses, b.tenantId)).toEqual([]);
    expect(await packing.getDockAppointments(A.warehouses, b.tenantId)).toEqual([]);
    await expect(packing.dispatchShipment({ tenant_id: b.tenantId, warehouse_id: A.warehouses, handling_unit_id: A.handling_units })).rejects.toThrow();
    await expect(picking.confirmPickItem({ tenant_id: b.tenantId, task_id: A.wms_pick_tasks, picked_qty: 1 })).rejects.toThrow();
    await expect(inbound.completePutaway({ tenant_id: b.tenantId, item_id: A.wms_inbound_items, actual_location_id: A.warehouse_locations, quantity: 1 })).rejects.toThrow();
    expect(JSON.stringify(await slotting.checkReplenishmentNeeds(A.warehouses, b.tenantId))).not.toContain(MARK);
    expect((await barcode.resolveBarcode('FOREIGN-CODE-2', null, b.tenantId)).matched).toBe(false);
    expect(changed(before, snapshot())).toEqual([]);

    // Kontrol: aynı çağrılar A'nın kimliğiyle kaydı bulur; yukarıdaki boş sonuçlar firma filtresinden gelir.
    expect((await location.getLocationById(A.warehouse_locations, a.tenantId)).id).toBe(A.warehouse_locations);
    expect((await packing.getHandlingUnits(A.warehouses, a.tenantId)).length).toBeGreaterThan(0);
    expect((await barcode.resolveBarcode('FOREIGN-CODE-2', null, a.tenantId)).matched).toBe(true);
  });

  test('deleting another tenant\'s user reports not found', async () => {
    expect((await call(b, 'delete', `/api/settings/users/${a.userId}`)).status).toBe(404);
  });

  test('terminal cannot heartbeat or take over the other tenant\'s device', async () => {
    const uid = sqlite().prepare('SELECT device_uid FROM warehouse_devices WHERE id = ?').get(A.warehouse_devices).device_uid;
    const before = snapshot();
    const beat = await call(b, 'post', '/api/terminal/heartbeat', { device_uid: uid, battery_level: 1, status: 'lost' });
    expect(beat.body.registered).not.toBe(true);
    await call(b, 'post', '/api/terminal/register', { device_uid: uid, battery_level: 1 });
    expect(changed(before, snapshot())).toEqual([]);
  });

  test('user management by id stays inside the tenant', async () => {
    const before = snapshot();
    const target = `/api/settings/users/${a.userId}`;
    expect((await call(b, 'put', target, { role: 'viewer', status: 'active', fullName: 'B', newPassword: 'NewPassword123!' })).status).toBeGreaterThanOrEqual(400);
    expect((await call(b, 'delete', target)).status).toBeGreaterThanOrEqual(400);
    expect(changed(before, snapshot())).toEqual([]);
  });
});
