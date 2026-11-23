const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database');
const { createTenant, createWarehouse, openTestShift } = require('./factories');

async function shop() {
  const owner = await createTenant();
  const warehouse = await createWarehouse(owner.tenantId);
  const product = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES ($1,$2,'Para Birimi Testi','000-CUR','adet',10,'NORMAL') RETURNING *", [owner.tenantId, 'CUR-' + Math.random().toString(36).slice(2)])).rows[0];
  await db.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,50)', [owner.tenantId, warehouse.id, product.id]);
  await openTestShift(owner, warehouse.id, 100);
  const sell = key => request(app).post('/api/scanner/sale').set('Authorization', 'Bearer ' + owner.token).set('Idempotency-Key', key)
    .send({ warehouse_id: warehouse.id, payment_method: 'cash', items: [{ barcode: '000-CUR', count: 1 }] });
  const currencyOf = async id => (await db.query('SELECT currency FROM pos_sales WHERE id=$1 AND tenant_id=$2', [id, owner.tenantId])).rows[0].currency;
  const put = body => request(app).put('/api/settings/company').set('Authorization', 'Bearer ' + owner.token).send(body);
  return { owner, sell, currencyOf, put };
}

test('satış kaydı işletmenin para birimiyle saklanır; sonradan değişse bile eski satış değişmez', async () => {
  const s = await shop();
  const first = await s.sell('cur-1');
  expect(first.status).toBe(201);
  expect(await s.currencyOf(first.body.sale_id)).toBe('TRY');

  // İşletme AZN'e alınır (satış yokken ayar yoluyla yapılamaz, bu yüzden doğrudan veri güncellemesi): yeni satış AZN, eski satış TRY kalır.
  await db.query("UPDATE tenants SET currency='AZN' WHERE id=$1", [s.owner.tenantId]);
  const second = await s.sell('cur-2');
  expect(second.status).toBe(201);
  expect(await s.currencyOf(second.body.sale_id)).toBe('AZN');
  expect(await s.currencyOf(first.body.sale_id)).toBe('TRY');
});

test('geçersiz para birimi kayıt altına alınmaz: tanımsız değer TRY sayılır', async () => {
  const s = await shop();
  await db.query("UPDATE tenants SET currency='XXX' WHERE id=$1", [s.owner.tenantId]);
  const sale = await s.sell('cur-bad');
  expect(sale.status).toBe(201);
  expect(await s.currencyOf(sale.body.sale_id)).toBe('TRY');
});

test('para birimi ayarı: ilk satıştan önce değişir, sonra 409; desteklenmeyen değer 400', async () => {
  const s = await shop();
  expect((await s.put({ currency: 'XYZ' })).status).toBe(400);
  expect((await s.put({ currency: 'AZN' })).status).toBe(200);
  expect((await db.query('SELECT currency FROM tenants WHERE id=$1', [s.owner.tenantId])).rows[0].currency).toBe('AZN');
  const sale = await s.sell('cur-set');
  expect(sale.status).toBe(201);
  expect(await s.currencyOf(sale.body.sale_id)).toBe('AZN');
  const blocked = await s.put({ currency: 'TRY' });
  expect(blocked.status).toBe(409);
  expect((await db.query('SELECT currency FROM tenants WHERE id=$1', [s.owner.tenantId])).rows[0].currency).toBe('AZN');
  // Aynı para birimini yeniden göndermek (arayüz her kayıtta gönderir) engellenmez.
  expect((await s.put({ currency: 'AZN', phone: '555' })).status).toBe(200);
});
