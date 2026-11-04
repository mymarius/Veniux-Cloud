const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant } = require('./factories');

// Replays the exact request sequence the Virtual Terminal page sends.
let owner, warehouse, product, source, target;
const auth = () => ({ Authorization: 'Bearer ' + owner.token });
// The page sends a fresh idempotency key with every stock write.
const write = () => ({ ...auth(), 'Idempotency-Key': require('crypto').randomUUID() });
const device_uid = 'VTERM-FLOW-TEST';

beforeAll(async () => {
  owner = await createTenant();
  warehouse = (await db.query('SELECT * FROM warehouses WHERE tenant_id=$1 LIMIT 1', [owner.tenantId])).rows[0];
  product = (await db.query("INSERT INTO products(tenant_id,name,sku,barcode,category) VALUES($1,'Terminal ürünü','VT-SKU-'||$1,'869000'||$1,'Genel') RETURNING *", [owner.tenantId])).rows[0];
  const loc = code => db.query("INSERT INTO warehouse_locations(tenant_id,warehouse_id,location_code,zone_name,aisle_code,rack_number,shelf_tier,bin_position) VALUES($1,$2,$3,'A','A1',1,1,1) RETURNING *", [owner.tenantId, warehouse.id, code + owner.tenantId]);
  source = (await loc('VT-SRC-')).rows[0];
  target = (await loc('VT-DST-')).rows[0];
});

test('register and heartbeat', async () => {
  const reg = await request(app).post('/api/terminal/register').set(auth()).send({ device_uid, device_name: 'Virtual Terminal (Simulator)', device_type: 'VIRTUAL_PDA', manufacturer: 'Veniux Simulator', warehouse_id: warehouse.id, battery_level: 100 });
  expect(reg.status).toBe(200);
  const hb = await request(app).post('/api/terminal/heartbeat').set(auth()).send({ device_uid, battery_level: 99, status: 'active', current_mode: 'MENU' });
  expect(hb.status).toBe(200);
  expect(hb.body.registered).toBe(true);
});

test('scan resolves product and location', async () => {
  const p = await request(app).post('/api/terminal/scan').set(auth()).send({ barcode: product.barcode, warehouse_id: warehouse.id, device_uid });
  expect(p.status).toBe(200);
  expect(p.body.type).toBe('PRODUCT');
  expect(p.body.item.id).toBe(product.id);
  const l = await request(app).post('/api/terminal/scan').set(auth()).send({ barcode: source.location_code, warehouse_id: warehouse.id, device_uid });
  expect(l.status).toBe(200);
  expect(l.body.type).toBe('LOCATION');
  expect(l.body.item.id).toBe(source.id);
});

test('inbound, outbound, transfer and count', async () => {
  const base = { warehouse_id: warehouse.id, product_id: product.id, device_uid };
  const inbound = await request(app).post('/api/terminal/operations/inbound').set(write()).send({ ...base, location_id: source.id, quantity: 10 });
  expect([inbound.status, inbound.body]).toEqual([200, expect.objectContaining({ success: true })]);
  const outbound = await request(app).post('/api/terminal/operations/outbound').set(write()).send({ ...base, location_id: source.id, quantity: 3 });
  expect([outbound.status, outbound.body]).toEqual([200, expect.objectContaining({ success: true })]);
  const transfer = await request(app).post('/api/terminal/operations/relocate').set(write()).send({ ...base, source_location_id: source.id, target_location_id: target.id, quantity: 2 });
  expect([transfer.status, transfer.body]).toEqual([200, expect.objectContaining({ success: true })]);
  const count = await request(app).post('/api/terminal/operations/count').set(write()).send({ ...base, location_id: target.id, counted_quantity: 2 });
  expect([count.status, count.body]).toEqual([200, expect.objectContaining({ success: true, difference: 0 })]);
});

test('inbound without a scanned location still works', async () => {
  const r = await request(app).post('/api/terminal/operations/inbound').set(write()).send({ warehouse_id: warehouse.id, product_id: product.id, quantity: 1, device_uid });
  expect([r.status, r.body]).toEqual([200, expect.objectContaining({ success: true })]);
});
