const pool = require('../config/database');
const crypto = require('crypto');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const quantity = (value, zero = false) => {
  if (value === '' || value == null || !Number.isSafeInteger(Number(value)) || Number(value) < (zero ? 0 : 1)) fail('Geçerli bir tam sayı miktarı girin.');
  return Number(value);
};
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const owned = async (client, table, id, tenant) => {
  const row = (await client.query(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`, [id, tenant])).rows[0];
  if (!row) fail('Kayıt bulunamadı.', 404);
  return row;
};
const stockDelta = async (client, tenant, product, warehouse, delta, type, note) => {
  const record = (await client.query('SELECT * FROM stock_records WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3', [tenant, product, warehouse])).rows[0];
  if (record) {
    const changed = await client.query('UPDATE stock_records SET quantity=quantity+$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3 AND quantity+$1>=0', [delta, record.id, tenant]);
    if (!changed.rowCount) fail('Depo stoğu yetersiz.');
  } else {
    if (delta < 0) fail('Depo stoğu yetersiz.');
    await client.query('INSERT INTO stock_records (tenant_id,product_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4)', [tenant, product, warehouse, delta]);
  }
  await client.query('INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tenant, product, warehouse, delta, type, 'pharmacy_depot', note]);
};
const operation = (name, handler) => async (req, res, next) => {
  try {
    const tenant = req.user.tenantId;
    const key = req.headers['idempotency-key'];
    if (key && (typeof key !== 'string' || key.length > 128)) fail('İşlem anahtarı geçersiz.');
    const hash = crypto.createHash('sha256').update(name + JSON.stringify(req.body)).digest('hex');
    const result = await pool.transaction(async client => {
      if (key) {
        const existing = (await client.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2', [tenant, key])).rows[0];
        if (existing) {
          if (existing.request_hash !== hash) fail('İşlem anahtarı farklı bir istek için kullanılmış.', 409);
          return JSON.parse(existing.result_json);
        }
      }
      const result = await handler(client, tenant, req.body);
      if (key) await client.query('INSERT INTO depot_operation_keys (tenant_id,operation_key,request_hash,result_json) VALUES ($1,$2,$3,$4)', [tenant,key,hash,JSON.stringify(result)]);
      return result;
    });
    res.json(result);
  } catch (error) { next(error); }
};
const read = handler => async (req, res, next) => { try { res.json(await handler(req.user.tenantId)); } catch (error) { next(error); } };
exports.getMedicines = read(async tenant => (await pool.query("SELECT * FROM products WHERE tenant_id=$1 AND module_type='PHARMACY'", [tenant])).rows);
exports.getLotsAndSerials = read(async tenant => ({
  lots: (await pool.query(`SELECT l.*, b.id AS balance_id, b.warehouse_id, b.quantity, p.name AS product_name, w.name AS warehouse_name FROM inventory_lots l JOIN pharmacy_depot_balances b ON b.lot_id=l.id AND b.tenant_id=l.tenant_id JOIN products p ON p.id=l.product_id JOIN warehouses w ON w.id=b.warehouse_id WHERE l.tenant_id=$1 ORDER BY l.expiry_date, l.id`, [tenant])).rows,
  serials: (await pool.query('SELECT * FROM inventory_serial_numbers WHERE tenant_id=$1 ORDER BY id DESC', [tenant])).rows
}));
exports.getDashboardStats = read(async tenant => ({
  totalProducts: (await pool.query("SELECT COUNT(*) AS c FROM products WHERE tenant_id=$1 AND module_type='PHARMACY'", [tenant])).rows[0].c,
  expiringLots: (await pool.query("SELECT COUNT(*) AS c FROM inventory_lots WHERE tenant_id=$1 AND expiry_date >= $2 AND expiry_date <= date('now', '+30 days')", [tenant,today()])).rows[0].c
}));
exports.getMovements = read(async tenant => (await pool.query("SELECT m.*, p.name AS product_name,w.name AS warehouse_name FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN warehouses w ON w.id=m.warehouse_id WHERE m.tenant_id=$1 AND m.source='pharmacy_depot' ORDER BY m.id DESC", [tenant])).rows);
exports.getReturnsAndQuarantine = read(async tenant => (await pool.query('SELECT q.*,p.name AS product_name,w.name AS warehouse_name FROM quarantine_stock q JOIN products p ON p.id=q.product_id JOIN warehouses w ON w.id=q.warehouse_id WHERE q.tenant_id=$1 ORDER BY q.id DESC', [tenant])).rows);
exports.inboundReceive = operation('inbound', async (client,tenant,data) => {
  const qty = quantity(data.quantity);
  const product = await owned(client,'products',data.product_id,tenant);
  if (product.module_type !== 'PHARMACY') fail('Eczane ürünü seçin.');
  await owned(client,'warehouses',data.warehouse_id,tenant);
  if (!String(data.lot_number || '').trim() || !date(data.expiry_date)) fail('Lot numarası ve geçerli SKT zorunludur.');
  if (data.expiry_date <= today()) fail('Son kullanma tarihi geçmiş ürün kabul edilemez.');
  if (data.serial_number && qty !== 1) fail('Seri numaralı kabul miktarı 1 olmalıdır.');
  if (data.location_id) {
    const location = await owned(client,'warehouse_locations',data.location_id,tenant);
    if (location.warehouse_id !== Number(data.warehouse_id) || location.is_locked) fail('Raf bu depoya ait değil veya kilitli.');
  }
  let lot = (await client.query('SELECT * FROM inventory_lots WHERE tenant_id=$1 AND product_id=$2 AND lot_number=$3', [tenant,product.id,data.lot_number.trim()])).rows[0];
  if (lot && lot.expiry_date !== data.expiry_date) fail('Bu lot için farklı bir SKT kayıtlı.');
  if (lot && (lot.status !== 'available' || lot.qa_status !== 'approved')) fail('Bu lot kullanıma kapalı.');
  if (!lot) lot = (await client.query('INSERT INTO inventory_lots (tenant_id,product_id,lot_number,expiry_date) VALUES ($1,$2,$3,$4) RETURNING *', [tenant,product.id,data.lot_number.trim(),data.expiry_date])).rows[0];
  if (data.serial_number) {
    if ((await client.query('SELECT id FROM inventory_serial_numbers WHERE serial_number=$1',[data.serial_number])).rows.length) fail('Seri numarası zaten kayıtlı.',409);
    await client.query('INSERT INTO inventory_serial_numbers (tenant_id,product_id,serial_number,lot_id,location_id) VALUES ($1,$2,$3,$4,$5)', [tenant,product.id,data.serial_number,lot.id,data.location_id || null]);
  }
  await client.query('INSERT INTO pharmacy_depot_balances (tenant_id,lot_id,warehouse_id,quantity) VALUES ($1,$2,$3,$4) ON CONFLICT(tenant_id,lot_id,warehouse_id) DO UPDATE SET quantity=quantity+EXCLUDED.quantity',[tenant,lot.id,data.warehouse_id,qty]);
  await stockDelta(client,tenant,product.id,data.warehouse_id,qty,'inbound',`Lot: ${lot.lot_number}`);
  return { message:'Mal kabul kaydedildi.', lot_id:lot.id, quantity:qty };
});
exports.dispenseFEFO = operation('dispense', async (client,tenant,data) => {
  const qty = quantity(data.quantity);
  const product = await owned(client,'products',data.product_id,tenant);
  await owned(client,'warehouses',data.warehouse_id,tenant);
  if (product.module_type !== 'PHARMACY') fail('Eczane ürünü seçin.');
  const lots = (await client.query("SELECT b.*,l.lot_number FROM pharmacy_depot_balances b JOIN inventory_lots l ON l.id=b.lot_id WHERE b.tenant_id=$1 AND b.warehouse_id=$2 AND l.product_id=$3 AND l.tenant_id=$1 AND l.expiry_date>$4 AND l.status='available' AND l.qa_status='approved' AND b.quantity>0 ORDER BY l.expiry_date,l.id",[tenant,data.warehouse_id,product.id,today()])).rows;
  if (lots.reduce((sum,row)=>sum+Number(row.quantity),0)<qty) fail('Kullanılabilir, tarihi geçmemiş lot stoğu yetersiz.');
  // Serial-tracked stock must be selected explicitly; do not silently consume arbitrary serials.
  const serials = (await client.query("SELECT id FROM inventory_serial_numbers WHERE tenant_id=$1 AND product_id=$2 AND status='available'",[tenant,product.id])).rows;
  if (serials.length) fail('Bu depoda seri numarası seçerek çıkış henüz desteklenmiyor; seri kayıtları korunmak için işlem durduruldu.');
  let remaining=qty;
  const allocations=[];
  for (const lot of lots) {
    if (!remaining) break;
    const take=Math.min(remaining,Number(lot.quantity));
    const changed=await client.query('UPDATE pharmacy_depot_balances SET quantity=quantity-$1 WHERE id=$2 AND tenant_id=$3 AND quantity >= $1',[take,lot.id,tenant]);
    if (!changed.rowCount) fail('Stok başka bir işlemde değişti; yeniden deneyin.',409);
    await stockDelta(client,tenant,product.id,data.warehouse_id,-take,'outbound',`FEFO lot: ${lot.lot_number}`);
    allocations.push({lot_id:lot.lot_id,quantity:take}); remaining-=take;
  }
  return {message:'FEFO çıkışı kaydedildi.',allocations};
});
exports.count = operation('count', async (client,tenant,data) => {
  const qty=quantity(data.quantity,true);
  const balance=await owned(client,'pharmacy_depot_balances',data.balance_id,tenant);
  const lot=await owned(client,'inventory_lots',balance.lot_id,tenant);
  const diff=qty-Number(balance.quantity);
  if (diff && (await client.query("SELECT id FROM inventory_serial_numbers WHERE tenant_id=$1 AND lot_id=$2 AND status='available'",[tenant,lot.id])).rows.length) fail('Seri takipli lotun sayımı seri numarası bazında yapılmalıdır; bu işlem henüz desteklenmiyor.');
  if (!String(data.reason || '').trim()) fail('Sayım açıklaması zorunludur.');
  if (diff) {
    await client.query('UPDATE pharmacy_depot_balances SET quantity=$1 WHERE id=$2 AND tenant_id=$3',[qty,balance.id,tenant]);
    await stockDelta(client,tenant,lot.product_id,balance.warehouse_id,diff,'adjustment',`Lot ${lot.lot_number}: ${data.reason}`);
  }
  return {message:'Sayım kaydedildi.',difference:diff};
});
exports.quarantine = operation('quarantine', async (client,tenant,data) => {
  const qty=quantity(data.quantity);
  const balance=await owned(client,'pharmacy_depot_balances',data.balance_id,tenant);
  const lot=await owned(client,'inventory_lots',balance.lot_id,tenant);
  if (!String(data.reason || '').trim()) fail('İade/karantina gerekçesi zorunludur.');
  if ((await client.query("SELECT id FROM inventory_serial_numbers WHERE tenant_id=$1 AND lot_id=$2 AND status='available'",[tenant,lot.id])).rows.length) fail('Seri takipli lotun karantinası seri numarası bazında yapılmalıdır; bu işlem henüz desteklenmiyor.');
  const changed=await client.query('UPDATE pharmacy_depot_balances SET quantity=quantity-$1 WHERE id=$2 AND tenant_id=$3 AND quantity >= $1',[qty,balance.id,tenant]);
  if (!changed.rowCount) fail('Lot stoğu yetersiz.');
  await client.query('INSERT INTO quarantine_stock (tenant_id,warehouse_id,product_id,lot_number,quantity,reason) VALUES ($1,$2,$3,$4,$5,$6)',[tenant,balance.warehouse_id,lot.product_id,lot.lot_number,qty,data.reason]);
  await stockDelta(client,tenant,lot.product_id,balance.warehouse_id,-qty,'quarantine',data.reason);
  return {message:'Ürün kullanılabilir stoktan çıkarılıp karantinaya alındı.'};
});
