// Uçtan uca mutabakat: kabul → raf → depo transferi → toplama → sevkiyat → iade.
// Her adımdan sonra depo toplamı = raflar toplamı = defter toplamı olmalı; yalnızca API üzerinden yürür.
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse, createProduct } = require('./factories');

let owner, north, south, product, bins = {}, keys = 0;
const api = (method, url, body) => {
  const req = request(app)[method](url).set('Authorization', `Bearer ${owner.token}`).set('Idempotency-Key', `reconcile-${++keys}`);
  return method === 'get' ? req : req.send(body);
};
const ok = (res, status = 200) => { expect({ status: res.status, body: res.status === status ? null : res.body }).toEqual({ status, body: null }); return res.body; };

const totals = async warehouseId => {
  const one = async (sql, params) => Number((await db.query(sql, params)).rows[0].q);
  const args = [product.id, warehouseId, owner.tenantId];
  return {
    stock: await one('SELECT COALESCE(SUM(quantity),0) AS q FROM stock_records WHERE product_id=$1 AND warehouse_id=$2 AND tenant_id=$3', args),
    bins: await one(`SELECT COALESCE(SUM(pbr.quantity),0) AS q FROM product_bin_records pbr JOIN warehouse_locations l ON l.id=pbr.location_id
      WHERE pbr.product_id=$1 AND l.warehouse_id=$2 AND pbr.tenant_id=$3`, args),
    ledger: await one('SELECT COALESCE(SUM(quantity),0) AS q FROM inventory_transactions WHERE product_id=$1 AND warehouse_id=$2 AND tenant_id=$3', args)
  };
};
const expectBalanced = async (northQty, southQty) => {
  expect(await totals(north.id)).toEqual({ stock: northQty, bins: northQty, ledger: northQty });
  expect(await totals(south.id)).toEqual({ stock: southQty, bins: southQty, ledger: southQty });
};
const location = async (warehouseId, code) => (await db.query(
  "INSERT INTO warehouse_locations (tenant_id,warehouse_id,location_code,zone_name,aisle_code,rack_number,shelf_tier,bin_position,location_type) VALUES ($1,$2,$3,'Z','A',1,1,1,'storage') RETURNING id",
  [owner.tenantId, warehouseId, `${code}-${Date.now()}`]
)).rows[0].id;

beforeAll(async () => {
  owner = await createTenant();
  north = await createWarehouse(owner.tenantId);
  south = await createWarehouse(owner.tenantId);
  product = await createProduct(owner.tenantId);
  bins.n1 = await location(north.id, 'N1');
  bins.n2 = await location(north.id, 'N2');
  bins.s1 = await location(south.id, 'S1');
});

describe('receive → putaway → transfer → pick → ship → return', () => {
  let lotId;

  test('receipt alone changes no stock; putaway does', async () => {
    const receipt = ok(await api('post', '/api/wms/inbound/receipts', { warehouse_id: north.id, items: [{ product_id: product.id, lot_number: 'LOT-E2E', expiry_date: '2090-01-01', expected_qty: 100 }] }), 201);
    await expectBalanced(0, 0);
    ok(await api('post', '/api/wms/inbound/putaway', { receipt_id: receipt.id, item_id: receipt.items[0].id, actual_location_id: bins.n1, quantity: 100 }));
    await expectBalanced(100, 0);
    // Aynı kalem ikinci kez yerleştirilemez.
    expect((await api('post', '/api/wms/inbound/putaway', { receipt_id: receipt.id, item_id: receipt.items[0].id, actual_location_id: bins.n1, quantity: 100 })).status).toBe(400);
    await expectBalanced(100, 0);
    lotId = (await db.query('SELECT id FROM inventory_lots WHERE product_id=$1', [product.id])).rows[0].id;
  });

  test('bin-to-bin move keeps the warehouse total', async () => {
    ok(await api('post', '/api/wms/locations/relocate', { warehouse_id: north.id, source_location_id: bins.n1, target_location_id: bins.n2, product_id: product.id, lot_id: lotId, quantity: 30 }));
    await expectBalanced(100, 0);
  });

  test('warehouse transfer moves bins, totals and ledger together', async () => {
    // Lotlu stok, lot tarihlerini koruyan WMS transferiyle taşınır; /api/stock/transfer bunu reddeder.
    expect((await api('post', '/api/stock/transfer', { product_id: product.id, from_warehouse_id: north.id, to_warehouse_id: south.id, quantity: 20 })).status).toBe(409);
    await expectBalanced(100, 0);
    ok(await api('post', '/api/wms/locations/relocate', { warehouse_id: north.id, target_warehouse_id: south.id, source_location_id: bins.n2, target_location_id: bins.s1, product_id: product.id, lot_id: lotId, quantity: 20 }));
    await expectBalanced(80, 20);
  });

  test('picking takes stock out once; shipping closes the unit without a second deduction', async () => {
    const wave = ok(await api('post', '/api/wms/picking/waves', { warehouse_id: north.id, items: [{ product_id: product.id, requested_qty: 75 }] }), 201);
    await expectBalanced(80, 20); // dalga stok düşmez
    const hu = ok(await api('post', '/api/wms/packing/handling-units', { warehouse_id: north.id, hu_type: 'PALLET' }), 201);
    for (const task of wave.tasks) ok(await api('post', '/api/wms/picking/confirm-item', { task_id: task.id, picked_qty: Number(task.requested_qty), target_handling_unit_id: hu.id }));
    await expectBalanced(5, 20);
    expect((await api('post', '/api/wms/picking/confirm-item', { task_id: wave.tasks[0].id, picked_qty: 1 })).status).toBe(400);
    await expectBalanced(5, 20);
    ok(await api('post', '/api/wms/packing/dispatch', { warehouse_id: north.id, handling_unit_id: hu.id, actual_weight_kg: 10 }));
    await expectBalanced(5, 20);
    expect((await api('post', '/api/wms/packing/dispatch', { warehouse_id: north.id, handling_unit_id: hu.id })).status).toBeGreaterThanOrEqual(400);
    await expectBalanced(5, 20);
  });

  test('customer return comes back into a bin; cycle count correction stays balanced', async () => {
    ok(await api('post', '/api/wms/ledger/transaction', { warehouse_id: north.id, location_id: bins.n1, product_id: product.id, lot_id: lotId, transaction_type: 'RETURN', quantity: 10, reason_code: 'CUSTOMER_RETURN' }), 201);
    await expectBalanced(15, 20);
    const baseline = ok(await api('post', '/api/wms/cycle-count/baseline', { warehouse_id: south.id, location_id: bins.s1, product_id: product.id, lot_id: lotId }));
    const review = ok(await api('post', '/api/wms/cycle-count/preview', { baseline_token: baseline.baseline_token, counted_qty: 19 }));
    await expectBalanced(15, 20); // önizleme stok değiştirmez
    ok(await api('post', '/api/wms/cycle-count/adjust', { review_id: review.id, reason: 'Fiziki sayim farki' }), 201);
    await expectBalanced(15, 19);
  });

  test('overdraw attempts are refused and leave no trace', async () => {
    const count = async () => (await db.query('SELECT COUNT(*) AS n FROM inventory_transactions WHERE product_id=$1', [product.id])).rows[0].n;
    const before = await count();
    expect((await api('post', '/api/wms/ledger/transaction', { warehouse_id: north.id, location_id: bins.n1, product_id: product.id, lot_id: lotId, transaction_type: 'PICK', quantity: -1000 })).status).toBeGreaterThanOrEqual(400);
    expect((await api('post', '/api/stock/movement', { product_id: product.id, warehouse_id: north.id, change_amount: -1000, movement_type: 'outbound' })).status).toBeGreaterThanOrEqual(400);
    expect(await count()).toBe(before);
    await expectBalanced(15, 19);
  });

  test('final totals equal received − shipped + returned ± count across all warehouses', async () => {
    const n = await totals(north.id), s = await totals(south.id);
    expect(n.stock + s.stock).toBe(100 - 75 + 10 - 1);
    expect(n.ledger + s.ledger).toBe(100 - 75 + 10 - 1);
  });
});
