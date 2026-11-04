// Genel taramanın gerçek veriyle yürütemediği uçlar: kasa, etiket, işletme portalı ve stok kırılımı.
// A'nın kayıtları gerçekten oluşturulur; B kendi oturumuyla A'nın kimliklerini gönderir.
jest.mock('express-rate-limit', () => () => (req, res, next) => next()); // sınırlar başka testlerde denenir
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-cross-test-'));
process.env.VENIUX_DATA_DIR = temp; // etiket işleri firma klasörlerine yazılır
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse, createUser, openTestShift } = require('./factories');

let a, b, warehouse, product, barcode;
const send = (who, method, url, body) => {
  const r = request(app)[method](url).set('Authorization', `Bearer ${who.token}`).set('Idempotency-Key', crypto.randomUUID());
  return body ? r.send(body) : r;
};
const refused = res => {
  expect({ status: res.status, leaked: JSON.stringify(res.body || {}).includes('CROSS-A') || (res.text || '').includes('CROSS-A') }).toEqual({ status: expect.any(Number), leaked: false });
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
};
afterAll(() => fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
const row = async (table, id) => (await db.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];

beforeAll(async () => {
  a = await createTenant();
  b = await createTenant();
  warehouse = await createWarehouse(a.tenantId);
  barcode = 'CROSS-A-' + crypto.randomUUID();
  product = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES ($1,$2,'CROSS-A urun',$2,'adet',10,'NORMAL') RETURNING *", [a.tenantId, barcode])).rows[0];
  await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,20)', [a.tenantId, warehouse.id, product.id]);
  await openTestShift(a, warehouse.id);
});

describe('register', () => {
  let sale, shiftId;
  const stock = async () => Number((await db.query('SELECT quantity FROM stock_records WHERE product_id=$1', [product.id])).rows[0].quantity);
  beforeAll(async () => {
    sale = (await send(a, 'post', '/api/scanner/sale', { warehouse_id: warehouse.id, payment_method: 'cash', items: [{ barcode, count: 2 }] })).body;
    shiftId = sale.shift_id;
    expect(sale.sale_id).toBeTruthy();
  });

  test('another company cannot read, return or cancel a sale', async () => {
    const before = (await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1', [sale.sale_id])).rows[0].snapshot_json;
    refused(await send(b, 'get', `/api/scanner/sales/${sale.sale_id}`));
    refused(await send(b, 'get', `/api/scanner/sales/${sale.sale_id}/receipt`));
    refused(await send(b, 'get', `/api/scanner/pro/sales/${sale.sale_id}/invoice-draft`));
    refused(await send(b, 'post', `/api/scanner/sales/${sale.sale_id}/return`, { reason: 'Baska firma iadesi', items: [{ id: 1, quantity: 1 }] }));
    refused(await send(b, 'post', `/api/scanner/sales/${sale.sale_id}/cancel`, { reason: 'Baska firma iptali' }));
    expect(await stock()).toBe(18);
    expect((await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1', [sale.sale_id])).rows[0].snapshot_json).toBe(before);
  });

  test('another company cannot read, move cash in or close a shift', async () => {
    const before = await row('retail_shifts', shiftId);
    refused(await send(b, 'get', `/api/scanner/shifts/${shiftId}`));
    refused(await send(b, 'get', `/api/scanner/shifts/${shiftId}/receipt`));
    const cash = { direction: 'out', amount: 1, reason: 'Kasadan guvenli aktarim' };
    refused(await send(b, 'post', `/api/scanner/shifts/${shiftId}/cash`, cash));
    refused(await send(b, 'post', `/api/scanner/shifts/${shiftId}/close`, { counted_cash: 0 }));
    expect(await row('retail_shifts', shiftId)).toEqual(before);
    // Aynı istek sahibinde geçer; ret doğrulamadan gelmiyor.
    expect((await send(a, 'post', `/api/scanner/shifts/${shiftId}/cash`, cash)).status).toBe(201);
  });

  test("another company cannot change a cashier's rights or a product image", async () => {
    const cashier = await createUser(a.tenantId, 'cashier');
    const grants = { discount: true, price_override: true, return: true, cancel: true, day_close: true };
    refused(await send(b, 'put', `/api/scanner/cashiers/${cashier.id}/permissions`, grants));
    const seen = await send(a, 'get', '/api/scanner/cashiers');
    expect(JSON.stringify(seen.body)).not.toContain('"discount":true,"price_override":true,"return":true,"cancel":true,"day_close":true');
    expect((await send(a, 'put', `/api/scanner/cashiers/${cashier.id}/permissions`, grants)).status).toBe(200);
    refused(await send(b, 'get', `/api/scanner/pro/products/${product.id}/image`));
    refused(await send(b, 'put', `/api/scanner/pro/products/${product.id}/media`, { image_data: null, brand: 'CROSS-B' }));
    expect((await db.query('SELECT * FROM products WHERE id=$1', [product.id])).rows[0].brand || '').not.toBe('CROSS-B');
  });
});

describe('labels', () => {
  let labelProduct;
  const station = crypto.randomBytes(16).toString('hex'), key = crypto.randomBytes(32).toString('hex');
  const labels = (who, method, url, body) => send(who, method, '/api/labels' + url, body);
  const input = () => ({ station_id: station, printer_name: 'Test printer', options: { profile: 'raf-100x40', design: 'signature' }, lines: [{ product_id: labelProduct.id, quantity: 1, expected_price: 10 }] });
  let job;
  beforeAll(async () => {
    labelProduct = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,sale_price,module_type) VALUES($1,$2,'CROSS-A etiket','8691234567891',10,'NORMAL') RETURNING *", [a.tenantId, 'CROSS-LBL-' + Date.now()])).rows[0];
    expect((await labels(a, 'post', '/stations/register', { station_id: station, station_key: key, name: 'A PC', printers: [{ name: 'Test printer' }] })).status).toBe(200);
    const queued = await labels(a, 'post', '/jobs', input());
    expect(queued.status).toBeLessThan(300);
    job = queued.body;
    expect(job.id).toBeTruthy();
  });

  test("another company cannot resolve a product or queue a job on it", async () => {
    expect((await labels(a, 'post', '/resolve', { product_id: labelProduct.id })).status).toBe(200);
    refused(await labels(b, 'post', '/resolve', { product_id: labelProduct.id }));
    const before = (await labels(b, 'get', '/jobs')).body;
    refused(await labels(b, 'post', '/jobs', input()));
    expect((await labels(b, 'get', '/jobs')).body).toEqual(before);
  });

  test("another company cannot claim or finish a job, even with the station's key", async () => {
    const stateOfA = async () => (await labels(a, 'get', '/jobs')).body;
    const before = await stateOfA();
    const claim = await labels(b, 'post', '/claim', { station_id: station, station_key: key });
    expect(JSON.stringify(claim.body || {})).not.toContain('CROSS-A');
    refused(await labels(b, 'post', `/jobs/${job.id}/verify`, { station_id: station, station_key: key, claim_token: 'guess' }));
    refused(await labels(b, 'post', `/jobs/${job.id}/complete`, { station_id: station, station_key: key, claim_token: 'guess', status: 'submitted' }));
    expect(await stateOfA()).toEqual(before);
    expect(JSON.stringify((await labels(b, 'get', '/jobs')).body)).not.toContain(job.id);
    expect(JSON.stringify((await labels(b, 'get', '/stations')).body)).not.toContain(station);
  });
});

describe('business portal', () => {
  let partner, member;
  const business = (who, method, url, body) => send(who, method, '/api/business' + url, body);
  beforeAll(async () => {
    for (const tenant of [a, b]) await db.query('INSERT INTO business_portal_settings(tenant_id,enabled) VALUES($1,1)', [tenant.tenantId]);
    partner = (await business(a, 'post', '/partners', { name: 'CROSS-A bayi' })).body.id;
    expect(partner).toBeTruthy();
    member = await createUser(a.tenantId, 'viewer');
    await db.query("INSERT INTO business_members(user_id,tenant_id,portal_role,partner_id) VALUES($1,$2,'dealer',$3)", [member.id, a.tenantId, partner]);
  });

  test("another company's lists stay clean and a member cannot be revoked", async () => {
    expect((await business(b, 'get', '/partners')).status).toBe(200);
    expect(JSON.stringify((await business(b, 'get', '/partners')).body)).not.toContain('CROSS-A');
    const version = async () => (await db.query('SELECT session_version FROM users WHERE id=$1', [member.id])).rows[0].session_version;
    const before = await version();
    await business(b, 'post', `/members/${member.id}/revoke`, {});
    expect(await version()).toBe(before);
    expect((await db.query('SELECT active FROM business_members WHERE user_id=$1', [member.id])).rows[0].active).toBe(1);
  });

  test("another company cannot review an order", async () => {
    const order = (await db.query("INSERT INTO business_orders (tenant_id,partner_id,created_by,status,lines_json,total_cents,note,request_key,request_hash,revision) VALUES ($1,$2,$3,'submitted','[]',1000,'',$4,'x',1) RETURNING *", [a.tenantId, partner, a.userId, 'cross-' + Date.now()])).rows[0];
    const res = await business(b, 'post', `/orders/${order.id}/review`, { status: 'approved', revision: 1 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await row('business_orders', order.id)).status).toBe('submitted');
    expect((await business(a, 'post', `/orders/${order.id}/review`, { status: 'approved', revision: 1 })).status).toBeLessThan(300);
  });
});

describe('stock breakdown and locations', () => {
  test('services return nothing for another company even outside the request scope', async () => {
    const location = (await db.query("INSERT INTO warehouse_locations (tenant_id,warehouse_id,location_code,zone_name,aisle_code,rack_number,shelf_tier,bin_position,location_type) VALUES ($1,$2,'CROSS-A-BIN','Z','A',1,1,1,'storage') RETURNING id", [a.tenantId, warehouse.id])).rows[0].id;
    await db.query('INSERT INTO product_bin_records (tenant_id,location_id,product_id,quantity,reserved_qty) VALUES ($1,$2,$3,4,0)', [a.tenantId, location, product.id]);
    const breakdown = require('../src/services/inventoryTransactionService').getProductStockBreakdown.bind(require('../src/services/inventoryTransactionService'));
    const locations = require('../src/services/warehouseLocationService').getLocations.bind(require('../src/services/warehouseLocationService'));
    expect((await breakdown(product.id, a.tenantId)).on_hand).toBe(4);
    expect((await breakdown(product.id, a.tenantId, warehouse.id)).on_hand).toBe(4);
    expect((await breakdown(product.id, b.tenantId)).on_hand).toBe(0);
    expect((await breakdown(product.id, b.tenantId, warehouse.id)).locations).toEqual([]);
    expect((await locations(warehouse.id, a.tenantId)).length).toBe(1);
    expect(await locations(warehouse.id, b.tenantId)).toEqual([]);
  });

  test('over HTTP the same ids are refused or empty', async () => {
    const res = await send(b, 'get', `/api/wms/ledger/product/${product.id}/breakdown?warehouse_id=${warehouse.id}`);
    if (res.status === 200) expect(res.body.on_hand).toBe(0);
    else refused(res);
    const list = await send(b, 'get', `/api/wms/locations?warehouse_id=${warehouse.id}`);
    if (list.status === 200) expect(list.body).toEqual([]);
    else refused(list);
  });
});
