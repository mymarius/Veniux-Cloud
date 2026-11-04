// Stok değiştiren her yol deftere de yazar: işlemden sonra depo stoğu = defter toplamı.
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const assistant = require('../src/services/assistantMonitor');
const { DRIFT_SQL, BACKFILL_SQL } = require('../src/database/migrations/034_ledger_opening_balance');
const { createTenant, createWarehouse, createProduct, openTestShift } = require('./factories');

let owner, north, south, product;
const send = (method, url, body) => request(app)[method](url).set('Authorization', `Bearer ${owner.token}`).set('Idempotency-Key', crypto.randomUUID()).send(body);
const ok = (res, status) => { expect({ status: res.status, body: res.status === status ? null : res.body }).toEqual({ status, body: null }); return res.body; };
const one = async (sql, args) => Number((await db.query(sql, args)).rows[0].q);
const stockOf = (warehouseId, productId = product.id) => one('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3', [owner.tenantId, warehouseId, productId]);
const ledgerOf = (warehouseId, productId = product.id) => one('SELECT COALESCE(SUM(quantity),0) AS q FROM inventory_transactions WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3', [owner.tenantId, warehouseId, productId]);
const expectBoth = async (warehouseId, quantity, productId) => {
  expect({ stock: await stockOf(warehouseId, productId), ledger: await ledgerOf(warehouseId, productId) }).toEqual({ stock: quantity, ledger: quantity });
};

beforeEach(async () => {
  owner = owner || await createTenant();
  north = await createWarehouse(owner.tenantId);
  south = await createWarehouse(owner.tenantId);
  product = await createProduct(owner.tenantId);
});

test('manual movement in and out, with before and after quantities', async () => {
  ok(await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: 50, movement_type: 'inbound' }), 201);
  await expectBoth(north.id, 50);
  ok(await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: -20, movement_type: 'outbound' }), 201);
  await expectBoth(north.id, 30);
  const last = (await db.query('SELECT * FROM inventory_transactions WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 ORDER BY id DESC LIMIT 1', [owner.tenantId, north.id, product.id])).rows[0];
  expect(last).toMatchObject({ transaction_type: 'SHIP', quantity: -20, before_quantity: 50, after_quantity: 30, user_id: owner.userId });
});

test('a refused movement leaves stock and ledger untouched', async () => {
  ok(await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: 5, movement_type: 'inbound' }), 201);
  expect((await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: -6, movement_type: 'outbound' })).status).toBe(400);
  await expectBoth(north.id, 5);
});

test('transfer writes both sides', async () => {
  ok(await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: 40, movement_type: 'inbound' }), 201);
  ok(await send('post', '/api/stock/transfer', { product_id: product.id, from_warehouse_id: north.id, to_warehouse_id: south.id, quantity: 15 }), 200);
  await expectBoth(north.id, 25);
  await expectBoth(south.id, 15);
});

test('direct adjustment records the applied difference', async () => {
  ok(await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: 10, movement_type: 'inbound' }), 201);
  ok(await send('post', '/api/stock/adjust', { product_id: product.id, warehouse_id: north.id, new_quantity: 7, reason: 'Sayim' }), 200);
  await expectBoth(north.id, 7);
  ok(await send('post', '/api/stock/adjust', { product_id: product.id, warehouse_id: north.id, new_quantity: 7 }), 200);
  await expectBoth(north.id, 7);
});

test('stock count finalize uses the real difference when stock moved after the count started', async () => {
  ok(await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: 100, movement_type: 'inbound' }), 201);
  const count = await send('post', '/api/stock-counts', { warehouse_id: north.id, notes: 'Defter testi' });
  expect(count.status).toBeLessThan(300);
  const id = count.body.stock_count.id;
  const item = (await db.query('SELECT id FROM stock_count_items WHERE count_id=$1 AND product_id=$2', [id, product.id])).rows[0];
  ok(await send('put', `/api/stock-counts/${id}/items/${item.id}`, { counted_quantity: 90 }), 200);
  ok(await send('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: 5, movement_type: 'inbound' }), 201);
  ok(await send('post', `/api/stock-counts/${id}/finalize`, {}), 200);
  await expectBoth(north.id, 90);
  const movement = (await db.query("SELECT change_amount FROM stock_movements WHERE tenant_id=$1 AND product_id=$2 AND source='stocktake'", [owner.tenantId, product.id])).rows[0];
  expect(movement.change_amount).toBe(-15);
});

test('normal depot inbound and transfer', async () => {
  ok(await send('post', '/api/normal-depo/inbound-receive', { productId: product.id, warehouseId: north.id, quantity: 12 }), 201);
  await expectBoth(north.id, 12);
  ok(await send('post', '/api/normal-depo/transfer', { productId: product.id, sourceWarehouseId: north.id, targetWarehouseId: south.id, quantity: 2 }), 200);
  await expectBoth(north.id, 10);
  await expectBoth(south.id, 2);
});

test('quick retail receive', async () => {
  const barcode = 'LEDGER-' + crypto.randomUUID();
  const received = ok(await send('post', '/api/retail/receive', { warehouse_id: north.id, barcode, quantity: 9, name: 'Hizli kabul', unit: 'adet', purchase_price: 5, sale_price: 10 }), 201);
  await expectBoth(north.id, 9, received.product.id);
});

test('retail sale, partial return and cancel on stock without lots', async () => {
  const barcode = 'LEDGER-' + crypto.randomUUID();
  const item = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES ($1,$2,'Kasa',$2,'adet',10,'NORMAL') RETURNING *", [owner.tenantId, barcode])).rows[0];
  ok(await send('post', '/api/stock/movement', { product_id: item.id, warehouse_id: north.id, change_amount: 10, movement_type: 'inbound' }), 201);
  await openTestShift(owner, north.id);
  const sale = ok(await send('post', '/api/scanner/sale', { warehouse_id: north.id, payment_method: 'cash', items: [{ barcode, count: 3 }] }), 201);
  await expectBoth(north.id, 7, item.id);
  ok(await send('post', `/api/scanner/sales/${sale.sale_id}/return`, { reason: 'Kismi iade testi', items: [{ id: 1, quantity: 1 }] }), 200);
  await expectBoth(north.id, 8, item.id);
  const other = ok(await send('post', '/api/scanner/sale', { warehouse_id: north.id, payment_method: 'cash', items: [{ barcode, count: 2 }] }), 201);
  await expectBoth(north.id, 6, item.id);
  ok(await send('post', `/api/scanner/sales/${other.sale_id}/cancel`, { reason: 'Iptal testi yapildi' }), 200);
  await expectBoth(north.id, 8, item.id);
});

test('assistant approved stock change', async () => {
  const actor = { userId: owner.userId, tenantId: owner.tenantId, role: 'admin', moduleType: 'BOTH', email: owner.email };
  const warehouseName = `Asistan Depo ${north.id}`;
  await db.query('UPDATE warehouses SET name=$1 WHERE id=$2', [warehouseName, north.id]);
  const sku = (await db.query('SELECT sku FROM products WHERE id=$1', [product.id])).rows[0].sku;
  const prepared = await assistant.prepare(actor, { kind: 'stock_adjust', args: { sku, warehouse_name: warehouseName, amount: 6, note: 'Asistan girisi' } });
  await assistant.execute(actor, { id: prepared.id, confirmed: true });
  await expectBoth(north.id, 6);
});

test('opening balance closes old drift once, leaves stock and lot totals alone', async () => {
  const lot = (await db.query("INSERT INTO inventory_lots (tenant_id,product_id,lot_number,status,qa_status) VALUES ($1,$2,'LOT-OPEN','available','approved') RETURNING id", [owner.tenantId, product.id])).rows[0].id;
  await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,70)', [owner.tenantId, north.id, product.id]);
  await db.query("INSERT INTO inventory_transactions (tenant_id,warehouse_id,product_id,lot_id,transaction_type,quantity) VALUES ($1,$2,$3,$4,'RECEIVE',20)", [owner.tenantId, north.id, product.id, lot]);
  await db.query("INSERT INTO inventory_transactions (tenant_id,warehouse_id,product_id,transaction_type,quantity) VALUES ($1,$2,$3,'SHIP',5)", [owner.tenantId, south.id, product.id]);
  const drift = async () => (await db.query(DRIFT_SQL)).rows.filter(row => Number(row.tenant_id) === owner.tenantId);
  expect((await drift()).filter(row => row.product_id === product.id)).toHaveLength(2);

  await db.query(BACKFILL_SQL);
  expect(await drift()).toEqual([]);
  await expectBoth(north.id, 70);
  await expectBoth(south.id, 0);
  const lots = await require('../src/services/stockHealthService').lotAvailability(owner.tenantId, product.id, north.id);
  expect(lots.map(row => row.quantity)).toEqual([20]);

  const count = () => one('SELECT COUNT(*) AS q FROM inventory_transactions WHERE tenant_id=$1', [owner.tenantId]);
  const before = await count();
  await db.query(BACKFILL_SQL);
  expect(await count()).toBe(before);
});
