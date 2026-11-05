const http = require('http');
const db = require('../../src/config/database');
const service = require('../../src/services/marketplaceService');
const { createTenant } = require('../factories');

test('Trendyol paketi MySQL üzerinde bir kez düşülür, iptalde geri eklenir, stok ondalıksız gönderilir', async () => {
  await db.ready;
  const sent = [];
  let packages = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.includes('/v2/orders')) return res.end(JSON.stringify({ totalPages: 1, content: packages }));
      if (req.url.includes('/price-and-inventory')) { sent.push(JSON.parse(raw)); return res.end(JSON.stringify({ batchRequestId: 'b' })); }
      res.end(JSON.stringify({ status: 'COMPLETED', failedItemCount: 0 }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.TRENDYOL_TEST_BASE_URL = 'http://127.0.0.1:' + server.address().port;
  try {
    const owner = await createTenant();
    const user = { tenantId: owner.tenantId };
    const warehouse = (await db.query('INSERT INTO warehouses (tenant_id,name,type,warehouse_type,capacity) VALUES ($1,$2,$3,$4,$5) RETURNING *', [owner.tenantId, 'T', 'main', 'NORMAL', 100])).rows[0];
    const barcode = 'TY' + owner.tenantId;
    const product = (await db.query('INSERT INTO products (tenant_id,sku,name,barcode,category,unit,purchase_price,sale_price,module_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [owner.tenantId, barcode, 'T', barcode, 'A', 'adet', 1, 2, 'NORMAL'])).rows[0];
    await db.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,10)', [owner.tenantId, product.id, warehouse.id]);
    await service.save(user, { seller_id: '1', api_key: 'k', api_secret: 's', environment: 'test', warehouse_id: warehouse.id });
    const stock = async () => Number((await db.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND product_id=$2', [owner.tenantId, product.id])).rows[0].quantity);
    packages = [{ shipmentPackageId: 7, shipmentPackageStatus: 'Created', lines: [{ barcode, quantity: 4 }] }];
    await service.sync(user);await service.sync(user);
    expect(await stock()).toBe(6);
    expect(sent).toEqual([{ items: [{ barcode, quantity: 6 }] }]);
    packages = [{ shipmentPackageId: 7, shipmentPackageStatus: 'Cancelled', lines: [{ barcode, quantity: 4 }] }];
    await service.sync(user);await service.sync(user);
    expect(await stock()).toBe(10);
    expect(sent.at(-1)).toEqual({ items: [{ barcode, quantity: 10 }] });
    expect((await service.status(user)).orders[0].stock_state).toBe('restored');
  } finally {
    delete process.env.TRENDYOL_TEST_BASE_URL;
    await new Promise(r => server.close(r));
  }
});
