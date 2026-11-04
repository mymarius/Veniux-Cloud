const request = require('supertest'),
  crypto = require('crypto'),
  app = require('../src/index'),
  db = require('../src/config/database');
const {
  createTenant,
  createUser
} = require('./factories');
let owner, other, manager, viewer, wh, supplier, product, bin, order, line;
const get = (url, u = owner) => request(app).get('/api/' + url).set('Authorization', 'Bearer ' + u.token);
const post = (url, body, u = owner, key = crypto.randomUUID()) => request(app).post('/api/' + url).set('Authorization', 'Bearer ' + u.token).set('Idempotency-Key', key).send(body);
const stock = async () => Number((await db.query('SELECT COALESCE(SUM(quantity),0) q FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3', [owner.tenantId, product.id, wh.id])).rows[0].q);
const detail = async () => (await get('purchase-orders/' + order.id)).body;
const payload = (q, ref = crypto.randomUUID(), extra = {}) => ({
  delivery_reference: ref,
  items: [{
    order_item_id: line.id,
    quantity: q,
    location_id: bin.id,
    lot_number: '000-LOT',
    expiry_date: '2099-01-01',
    unit_price: 4.25
  }],
  ...extra
});
const receive = (q, ref, extra = {}, key = crypto.randomUUID(), u = owner) => post('purchase-orders/' + order.id + '/receive', payload(q, ref, extra), u, key);
const approve = async () => {
  expect((await post('purchase-orders/' + order.id + '/status', {
    action: 'submit'
  })).status).toBe(200);
  expect((await post('purchase-orders/' + order.id + '/status', {
    action: 'approve'
  })).status).toBe(200);
};
beforeAll(async () => {
  owner = await createTenant();
  other = await createTenant();
  for (const role of ['manager', 'viewer']) {
    const user = await createUser(owner.tenantId, role),
      login = await post('auth/login', {
        email: user.email,
        password: 'password123'
      });
    if (role === 'manager') manager = {
      ...user,
      token: login.body.token
    };else viewer = {
      ...user,
      token: login.body.token
    };
  }
  wh = (await db.query('SELECT * FROM warehouses WHERE tenant_id=$1 LIMIT 1', [owner.tenantId])).rows[0];
  supplier = (await db.query('SELECT * FROM suppliers WHERE tenant_id=$1 LIMIT 1', [owner.tenantId])).rows[0];
  await require('./factories').openTestShift(owner,wh.id);
});
beforeEach(async () => {
  product = (await db.query("INSERT INTO products (tenant_id,sku,name,barcode,unit,purchase_price,sale_price,module_type) VALUES ($1,$2,'Kabul test ürünü',$3,'adet',3,10,'NORMAL') RETURNING *", [owner.tenantId, crypto.randomUUID(), '000' + crypto.randomUUID()])).rows[0];
  bin = (await db.query("INSERT INTO warehouse_locations (tenant_id,warehouse_id,location_code,aisle_code,rack_number,shelf_tier,bin_position) VALUES ($1,$2,$3,1,1,1,1) RETURNING *", [owner.tenantId, wh.id, crypto.randomUUID()])).rows[0];
  const r = await post('purchase-orders', {
    supplier_id: supplier.id,
    target_warehouse_id: wh.id,
    items: [{
      product_id: product.id,
      quantity: 10,
      unit_price: 4.25
    }]
  });
  expect(r.status).toBe(201);
  order = r.body.order;
  line = (await detail()).items[0];
});
test('taslak ve onay stok oluşturmaz; izlenen altı durum geçerli geçişlerle ilerler', async () => {
  expect(order.status).toBe('draft');
  expect(await stock()).toBe(0);
  expect((await receive(1)).status).toBe(409);
  await approve();
  expect((await detail()).status).toBe('approved');
  expect(await stock()).toBe(0);
  expect((await receive(3)).body.status).toBe('partially_received');
  expect((await receive(7)).body.status).toBe('completed');
  expect(await stock()).toBe(10);
});
test('iki teslimat farklı lot tarih ve rafları korur; kalan miktar ve fiyat kayıtları gerçek kabulden gelir', async () => {
  await approve();
  await receive(4);
  const b = (await db.query('INSERT INTO warehouse_locations (tenant_id,warehouse_id,location_code,aisle_code,rack_number,shelf_tier,bin_position) VALUES ($1,$2,$3,1,1,1,1) RETURNING *', [owner.tenantId, wh.id, crypto.randomUUID()])).rows[0];
  const body = payload(6);
  body.items[0] = {
    ...body.items[0],
    location_id: b.id,
    lot_number: 'SECOND',
    expiry_date: '2098-06-01',
    unit_price: 5.5
  };
  expect((await post('purchase-orders/' + order.id + '/receive', body)).status).toBe(200);
  const d = await detail();
  expect(d.items[0].received_quantity).toBe(10);
  expect(d.items[0].remaining_quantity).toBe(0);
  expect(d.deliveries).toHaveLength(2);
  expect(d.deliveries.map(i => i.unit_purchase_price).sort()).toEqual([4.25, 5.5]);
  expect(new Set(d.deliveries.map(i => i.lot_id)).size).toBe(2);
  expect((await db.query('SELECT purchase_price FROM products WHERE id=$1', [product.id])).rows[0].purchase_price).toBe(5.5);
  expect(await stock()).toBe(10);
});
test('eşzamanlı mükerrer kabul aynı belgeyi döndürür; aynı anahtarlı değişmiş içerik ve farklı anahtarlı aynı irsaliye reddedilir', async () => {
  await approve();
  const key = crypto.randomUUID(),
    body = payload(4, 'DEL-' + crypto.randomUUID());
  const rs = await Promise.all([post('purchase-orders/' + order.id + '/receive', body, owner, key), post('purchase-orders/' + order.id + '/receive', body, owner, key)]);
  expect(rs.map(r => r.status)).toEqual([200, 200]);
  expect(rs[0].body.receipt_id).toBe(rs[1].body.receipt_id);
  expect((await post('purchase-orders/' + order.id + '/receive', body, owner, key)).status).toBe(200);
  expect(await stock()).toBe(4);
  expect((await post('purchase-orders/' + order.id + '/receive', {
    ...body,
    items: [{
      ...body.items[0],
      quantity: 5
    }]
  }, owner, key)).status).toBe(409);
  expect((await post('purchase-orders/' + order.id + '/receive', body)).status).toBe(409);
  expect((await detail()).deliveries).toHaveLength(1);
});
test('iki farklı teslimat kalan miktarı aynı anda aşarsa ikincisi onaysız stoğa geçmez', async () => {
  await approve();
  const rs = await Promise.all([receive(6), receive(6)]);
  expect(rs.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await stock()).toBe(6);
  expect((await detail()).items[0].remaining_quantity).toBe(4);
});
test('fazla teslimat miktarı gösterilir ve yalnızca açık yönetici onayı ile işlenir', async () => {
  await approve();
  const body = payload(12);
  const r = await post('purchase-orders/' + order.id + '/receive', body);
  expect(r.status).toBe(409);
  expect(r.body.excess[0].excess).toBe(2);
  expect(await stock()).toBe(0);
  expect((await post('purchase-orders/' + order.id + '/receive', {
    ...body,
    approve_excess: true,
    excess_reason: 'Fazla koli kabulü'
  }, manager)).status).toBe(403);
  expect((await post('purchase-orders/' + order.id + '/receive', {
    ...body,
    approve_excess: true,
    excess_reason: 'Fazla koli kabulü'
  })).status).toBe(200);
  expect(await stock()).toBe(12);
  const audit = (await db.query("SELECT details FROM audit_logs WHERE tenant_id=$1 AND action='purchase.receive' AND entity_id=$2", [owner.tenantId, String(order.id)])).rows[0];
  expect(JSON.parse(audit.details).excess_approved_by).toBe(owner.userId);
});
test('kısmi teslimatı iptal etmek alınan stoğu korur ve yalnızca kalanı kapatır', async () => {
  await approve();
  await receive(4);
  const cancel = await post('purchase-orders/' + order.id + '/status', {
    action: 'cancel',
    reason: 'Kalan sevkiyat iptal'
  });
  expect(cancel.status).toBe(200);
  const d = await detail();
  expect(d.status).toBe('cancelled');
  expect(d.items[0]).toMatchObject({
    received_quantity: 4,
    cancelled_quantity: 6,
    remaining_quantity: 0,
    warehouse_stock_quantity: 4
  });
  expect(await stock()).toBe(4);
  expect((await receive(1)).status).toBe(409);
  expect((await post('purchase-orders/' + order.id + '/status', {
    action: 'cancel',
    reason: 'Kalan sevkiyat iptal'
  })).status).toBe(200);
  expect((await db.query("SELECT COUNT(*) n FROM audit_logs WHERE tenant_id=$1 AND entity_id=$2 AND action='purchase.cancel'",[owner.tenantId,String(order.id)])).rows[0].n).toBe(1);
});
test('tedarikçiye iade lot ve rafı korur; tekrar gönderim stok azaltmaz ve alınan miktarı aşamaz', async () => {
  await approve();
  await receive(4);
  const d = await detail(),
    item = d.deliveries[0],
    body = {
      reason: 'Hasarlı ambalaj',
      items: [{
        receipt_item_id: item.id,
        quantity: 2
      }]
    },
    key = crypto.randomUUID();
  const r = await post('purchase-orders/' + order.id + '/returns', body, owner, key);
  expect(r.status).toBe(200);
  expect((await post('purchase-orders/' + order.id + '/returns', body, owner, key)).body.return_id).toBe(r.body.return_id);
  expect(await stock()).toBe(2);
  expect((await post('purchase-orders/' + order.id + '/returns', {
    ...body,
    items: [{
      receipt_item_id: item.id,
      quantity: 3
    }]
  })).status).toBe(409);
  const ledger = (await db.query("SELECT * FROM inventory_transactions WHERE reference_id=$1 AND transaction_type='SUPPLIER_RETURN'", [r.body.return_id])).rows[0];
  expect(ledger).toMatchObject({
    lot_id: item.lot_id,
    location_id: bin.id,
    quantity: -2,
    user_id: owner.userId
  });
  expect((await detail()).items[0].received_quantity).toBe(4);
});
test('iptal edilmiş kısmi siparişin alınmış ürünü yine iade edilebilir; kalan sipariş açılmaz', async () => {
  await approve();
  await receive(4);
  await post('purchase-orders/' + order.id + '/status', {
    action: 'cancel',
    reason: 'Kalan iptal edildi'
  });
  const d = await detail();
  expect((await post('purchase-orders/' + order.id + '/returns', {
    reason: 'Yanlış gelen ürün',
    items: [{
      receipt_item_id: d.deliveries[0].id,
      quantity: 1
    }]
  })).status).toBe(200);
  expect((await detail()).status).toBe('cancelled');
  expect(await stock()).toBe(3);
});
test('satılmış veya rezerve stok tedarikçiye tekrar çıkarılamaz; başarısız iade atomik geri alınır', async () => {
  await approve();
  await receive(4);
  const d = await detail();
  await db.query('UPDATE product_bin_records SET reserved_qty=3 WHERE product_id=$1 AND location_id=$2', [product.id, bin.id]);
  const r = await post('purchase-orders/' + order.id + '/returns', {
    reason: 'Rezerveli ürün iadesi',
    items: [{
      receipt_item_id: d.deliveries[0].id,
      quantity: 2
    }]
  });
  expect(r.status).toBe(400);
  expect(await stock()).toBe(4);
  expect((await detail()).deliveries[0].returned_qty).toBe(0);
  expect((await db.query('SELECT id FROM supplier_return_documents WHERE purchase_order_id=$1', [order.id])).rows).toHaveLength(0);
});
test('hasarlı/karantina bekletilen miktar aynı lot raftan iade edildiğinde bekletme de azalır', async () => {
  await approve();
  await receive(4);
  const item = (await detail()).deliveries[0];
  await db.query('INSERT INTO inventory_return_holds (id,tenant_id,product_id,warehouse_id,location_id,lot_id,quantity,disposition,user_id) VALUES ($1,$2,$3,$4,$5,$6,3,$7,$8)', [crypto.randomUUID(), owner.tenantId, product.id, wh.id, bin.id, item.lot_id, 'damaged', owner.userId]);
  expect((await post('purchase-orders/' + order.id + '/returns', {
    reason: 'Hasarlı koli geri gönderim',
    items: [{
      receipt_item_id: item.id,
      quantity: 2
    }]
  })).status).toBe(200);
  expect(await stock()).toBe(2);
  expect((await db.query('SELECT SUM(quantity) q FROM inventory_return_holds WHERE product_id=$1', [product.id])).rows[0].q).toBe(1);
});
test('geç aşamada lot tarihi çakışması tüm teslimatı geri alır: stok, raf, belge ve fiyat değişmez', async () => {
  await approve();
  const body = payload(2);
  body.items.push({
    ...body.items[0],
    expiry_date: '2099-02-01'
  });
  expect((await post('purchase-orders/' + order.id + '/receive', body)).status).toBe(400);
  expect(await stock()).toBe(0);
  expect((await detail()).deliveries).toHaveLength(0);
  expect((await db.query('SELECT id FROM inventory_lots WHERE product_id=$1', [product.id])).rows).toHaveLength(0);
  expect((await db.query('SELECT purchase_price FROM products WHERE id=$1', [product.id])).rows[0].purchase_price).toBe(3);
});
test('tedarikçi kartı iletişim, sipariş ürünleri ve teslimat/iade geçmişini verir; firmalar ayrıdır', async () => {
  await approve();
  await receive(2);
  const r = await get('suppliers/' + supplier.id);
  expect(r.status).toBe(200);
  expect(r.body.products.some(p => p.id === product.id)).toBe(true);
  expect(r.body.orders.some(p => p.id === order.id)).toBe(true);
  expect(r.body.deliveries.some(p => p.purchase_order_id === order.id)).toBe(true);
  expect((await get('suppliers/' + supplier.id, other)).status).toBe(404);
  const all = await get('suppliers', other);
  expect(all.body.some(s => s.id === supplier.id)).toBe(false);
  expect((await get('purchase-orders/' + order.id, other)).status).toBe(404);
});
test('oluşturma, durum, kabul ve iade yetkileri sunucuda uygulanır; yabancı firma ürünü reddedilir', async () => {
  for (const action of ['status', 'receive', 'returns']) expect((await post('purchase-orders/' + order.id + '/' + action, {}, viewer)).status).toBe(403);
  expect((await post('purchase-orders', {}, viewer)).status).toBe(403);
  const foreign = (await db.query('SELECT id FROM products WHERE tenant_id=$1 LIMIT 1', [other.tenantId])).rows[0];
  expect((await post('purchase-orders', {
    supplier_id: supplier.id,
    target_warehouse_id: wh.id,
    items: [{
      product_id: foreign.id,
      quantity: 1,
      unit_price: 1
    }]
  })).status).toBe(404);
});
test('siparişsiz mevcut WMS kabulündeki yanlış ürün tedarikçi kartından iade edilir', async () => {
  const r = await post('wms/inbound/receipts', {
    warehouse_id: wh.id,
    supplier_id: supplier.id,
    items: [{
      product_id: product.id,
      expected_qty: 2,
      lot_number: 'WRONG',
      expiry_date: '2099-01-01'
    }]
  });
  expect(r.status).toBe(201);
  expect((await post('wms/inbound/putaway', {
    receipt_id: r.body.id,
    item_id: r.body.items[0].id,
    actual_location_id: bin.id,
    quantity: 2
  })).status).toBe(200);
  expect((await post('suppliers/' + supplier.id + '/returns', {
    reason: 'Siparişsiz yanlış ürün',
    items: [{
      receipt_item_id: r.body.items[0].id,
      quantity: 2
    }]
  })).status).toBe(200);
  expect(await stock()).toBe(0);
});
test('tarihi geçmiş lot kabulde saklanır fakat satışa açılmaz; tedarikçiye iade edilebilir', async () => {
  await approve();
  const body = payload(2);
  body.items[0].expiry_date = '2020-01-01';
  expect((await post('purchase-orders/' + order.id + '/receive', body)).status).toBe(200);
  const health = await require('../src/services/stockHealthService').lotAvailability(owner.tenantId, product.id, wh.id);
  expect(health[0].days_remaining).toBeLessThan(0);
  const sale = await post('scanner/sale', {
    warehouse_id: wh.id,
    items: [{
      barcode: product.barcode,
      count: 1
    }],
    payment_method: 'cash',
    cash_received: 10
  });
  expect(sale.status).toBe(409);
  expect((await post('purchase-orders/' + order.id + '/returns', {
    reason: 'Tarihi geçmiş teslimat',
    items: [{
      receipt_item_id: (await detail()).deliveries[0].id,
      quantity: 2
    }]
  })).status).toBe(200);
  expect(await stock()).toBe(0);
});
test('sipariş oluşturma anahtarı tekrar kullanıldığında tek taslak oluşur; tutar kuruşta yuvarlanır', async () => {
  const key = crypto.randomUUID(),
    body = {
      supplier_id: supplier.id,
      target_warehouse_id: wh.id,
      items: [{
        product_id: product.id,
        quantity: 1.5,
        unit_price: 1.99
      }]
    };
  const a = await post('purchase-orders', body, owner, key),
    b = await post('purchase-orders', body, owner, key);
  expect(a.status).toBe(201);
  expect(a.body.order.id).toBe(b.body.order.id);
  expect(a.body.order.total_amount).toBe(2.99);
  expect(await stock()).toBe(0);
  expect((await post('purchase-orders', {
    ...body,
    notes: 'Farklı talep'
  }, owner, key)).status).toBe(409);
});
test('satış sonrası mevcut stoktan fazla tedarikçi iadesi yapılamaz', async () => {
  await approve();
  await receive(4);
  const item = (await detail()).deliveries[0];
  const sale = await post('scanner/sale', {
    warehouse_id: wh.id,
    items: [{
      barcode: product.barcode,
      count: 3
    }],
    payment_method: 'cash',
    cash_received: 30
  });
  expect(sale.status).toBe(201);
  expect(await stock()).toBe(1);
  const r = await post('purchase-orders/' + order.id + '/returns', {
    reason: 'Satılmış ürün geri gönderilemez',
    items: [{
      receipt_item_id: item.id,
      quantity: 2
    }]
  });
  expect(r.status).toBe(400);
  expect(await stock()).toBe(1);
  expect((await detail()).deliveries[0].returned_qty).toBe(0);
});
test('eşzamanlı farklı iade talepleri alınan miktarı aşamaz', async () => {
  await approve();
  await receive(4);
  const item = (await detail()).deliveries[0],
    body = {
      reason: 'İki iade çakışması',
      items: [{
        receipt_item_id: item.id,
        quantity: 3
      }]
    };
  const rs = await Promise.all([post('purchase-orders/' + order.id + '/returns', body), post('purchase-orders/' + order.id + '/returns', body)]);
  expect(rs.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await stock()).toBe(1);
  expect((await detail()).deliveries[0].returned_qty).toBe(3);
});
test('satın alma geçmişi bulunan ürün/tedarikçi silinerek kabul ve iade bağlantıları koparılamaz', async () => {
  for (const [table, id] of [['products', product.id], ['suppliers', supplier.id]]) {
    const r = await request(app).delete('/api/' + table + '/' + id).set('Authorization', 'Bearer ' + owner.token);
    expect(r.status).toBe(409);
  }
  expect((await detail()).items[0].product_id).toBe(product.id);
});
test('geçersiz miktar/fiyat, yanlış raf ve başka sipariş kalemi stok yazmaz', async () => {
  await approve();
  for (const changes of [{
    quantity: -1
  }, {
    quantity: 0
  }, {
    unit_price: 1.999
  }, {
    location_id: 999999999
  }]) {
    const body = payload(2);
    Object.assign(body.items[0], changes);
    expect((await post('purchase-orders/' + order.id + '/receive', body)).status).toBeGreaterThanOrEqual(400);
  }
  expect(await stock()).toBe(0);
  expect((await detail()).deliveries).toHaveLength(0);
});
test('düşük stok önerileri yalnızca okunur; seçilen ürün kullanıcı kaydıyla taslağa alınır', async () => {
  await db.query('UPDATE products SET min_stock_level=4,max_stock_level=12 WHERE id=$1', [product.id]);
  const before = (await get('purchase-orders')).body.length,
    suggestions = (await get('normal-depo/stock-health')).body.suggestions,
    p = suggestions.find(p => p.id === product.id);
  expect(p.suggested_quantity).toBe(12);
  expect((await get('purchase-orders')).body.length).toBe(before);
  const saved = await post('purchase-orders', {
    supplier_id: supplier.id,
    target_warehouse_id: wh.id,
    items: [{
      product_id: p.id,
      quantity: p.suggested_quantity,
      unit_price: 3
    }]
  });
  expect(saved.body.order.status).toBe('draft');
  expect(await stock()).toBe(0);
});
test('mevcut WMS mal kabulünde belge ve raf yerleştirme tekrarları tek stok hareketi bırakır',async()=>{const body={warehouse_id:wh.id,supplier_id:supplier.id,waybill_no:'DIRECT-'+crypto.randomUUID(),items:[{product_id:product.id,expected_qty:2,lot_number:'DIRECT-LOT',expiry_date:'2099-01-01',unit_purchase_price:6.25}]},key=crypto.randomUUID(),a=await post('wms/inbound/receipts',body,owner,key),b=await post('wms/inbound/receipts',body,owner,key);expect(a.status).toBe(201);expect(b.body.id).toBe(a.body.id);expect((await post('wms/inbound/receipts',body)).status).toBe(409);const place={receipt_id:a.body.id,item_id:a.body.items[0].id,actual_location_id:bin.id,quantity:2},pkey=crypto.randomUUID();expect((await post('wms/inbound/putaway',place,owner,pkey)).status).toBe(200);expect((await post('wms/inbound/putaway',place,owner,pkey)).status).toBe(200);expect(await stock()).toBe(2);expect((await db.query('SELECT purchase_price FROM products WHERE id=$1',[product.id])).rows[0].purchase_price).toBe(6.25);expect((await get('suppliers/'+supplier.id)).body.products.some(p=>p.id===product.id)).toBe(true);expect((await db.query("SELECT COUNT(*) n FROM audit_logs WHERE tenant_id=$1 AND entity_id=$2 AND action='wms.inbound.putaway'",[owner.tenantId,String(a.body.id)])).rows[0].n).toBe(1);});
test('modül yetkisi değişse bile başka modülün sipariş kabulü ve onayı sunucuda kapalıdır',async()=>{const service=require('../src/services/procurementService'),u={tenantId:owner.tenantId,userId:owner.userId,email:owner.email,role:'admin',moduleType:'PHARMACY'};await expect(service.detail(u,order.id)).rejects.toMatchObject({status:403});await expect(service.transition(u,order.id,{action:'submit'})).rejects.toMatchObject({status:403});await expect(service.receive(u,order.id,payload(2),crypto.randomUUID())).rejects.toMatchObject({status:403});expect(await stock()).toBe(0);expect((await service.list(u)).some(o=>o.id===order.id)).toBe(false);});
