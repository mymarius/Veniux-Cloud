const db = require('../config/database'),
  crypto = require('crypto'),
  inbound = require('./wmsInboundService'),
  inventory = require('./inventoryTransactionService');
const fail = (message, status = 400, extra = {}) => {
  throw Object.assign(new Error(message), {
    status,
    ...extra
  });
};
const roles = user => {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
};
const number = (v, name, zero = false) => {
  const n = Number(v);
  if (!['number', 'string'].includes(typeof v) || String(v).trim() === '' || !Number.isFinite(n) || n < (zero ? 0 : 0.000001) || n > 1000000 || Math.abs(n * 1e6 - Math.round(n * 1e6)) > 0.001) fail(name + ' geçersiz; en fazla 6 ondalık basamak kullanın.');
  return n;
};
const money = v => {
  const n = number(v, 'Alış fiyatı', true);
  if (Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) fail('Alış fiyatı en fazla iki ondalık basamak olabilir.');
  return Math.round(n * 100) / 100;
};
const round = v => Number(v.toFixed(6));
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
async function audit(tx, u, action, id, details) {
  await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [u.tenantId, u.email, action, 'procurement', String(id), JSON.stringify({
    user_id: u.userId,
    ...details
  })]);
}
async function keyed(u, scope, key, body, work) {
  roles(u);
  if (typeof key !== 'string' || !key.trim() || key.length > 120 || /[\x00-\x1f]/.test(key)) fail('Tekrar göndermeyi önleyen işlem anahtarı gerekli.');
  const op = 'procurement:' + scope + ':' + key,
    hash = crypto.createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
  return db.transaction(async tx => {
    const old = (await tx.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2', [u.tenantId, op])).rows[0];
    if (old) {
      if (old.request_hash !== hash) fail('İşlem anahtarı farklı bilgilerle kullanılmış.', 409);
      return JSON.parse(old.result_json);
    }
    const result = await work(tx);
    await tx.query('INSERT INTO depot_operation_keys (tenant_id,operation_key,request_hash,result_json) VALUES ($1,$2,$3,$4)', [u.tenantId, op, hash, JSON.stringify(result)]);
    return result;
  });
}
async function owned(tx, table, id, u) {
  const row = (await tx.query(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2`, [id, u.tenantId])).rows[0];
  if (!row) fail('Kayıt bulunamadı.', 404);
  return row;
}
async function create(u, body, key) {
  return keyed(u, 'create', key, body, async tx => {
    await owned(tx, 'suppliers', body.supplier_id, u);
    const wh = await owned(tx, 'warehouses', body.target_warehouse_id, u);
    if (u.moduleType !== 'BOTH' && wh.warehouse_type !== u.moduleType) fail('Depo modülüne erişiminiz yok.', 403);
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500) fail('1–500 sipariş kalemi gerekli.');
    const seen = new Set(),
      items = [];
    let cents = 0;
    for (const line of body.items) {
      const p = await owned(tx, 'products', line.product_id, u);
      if (seen.has(p.id)) fail('Aynı ürünü tek sipariş satırında birleştirin.');
      seen.add(p.id);
      if (p.module_type !== wh.warehouse_type) fail('Ürün ile depo modülü eşleşmiyor.');
      const q = number(line.quantity, 'Miktar'),
        price = money(line.unit_price);
      items.push({
        product_id: p.id,
        quantity: q,
        unit_price: price
      });
      cents += Math.round(q * price * 100);
    }
    if (!Number.isSafeInteger(cents)) fail('Sipariş tutarı sınırı aşıldı.');
    const order = (await tx.query("INSERT INTO purchase_orders (tenant_id,order_no,supplier_id,target_warehouse_id,status,total_amount,notes,created_by,updated_at) VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,CURRENT_TIMESTAMP) RETURNING *", [u.tenantId, 'PO-' + crypto.randomUUID(), body.supplier_id, wh.id, cents / 100, String(body.notes || '').slice(0, 2000), u.userId])).rows[0];
    for (const i of items) await tx.query('INSERT INTO purchase_order_items (tenant_id,order_id,product_id,quantity,unit_price) VALUES ($1,$2,$3,$4,$5)', [u.tenantId, order.id, i.product_id, i.quantity, i.unit_price]);
    await audit(tx, u, 'purchase.create', order.id, {
      items,
      status: 'draft'
    });
    return {
      message: 'Taslak satın alma siparişi oluşturuldu. Stok değişmedi.',
      order
    };
  });
}
async function transition(u, id, body) {
  roles(u);
  return db.transaction(async tx => {
    const order = await owned(tx, 'purchase_orders', id, u),
      action = body.action,
      target = {
        submit: 'pending',
        approve: 'approved',
        cancel: 'cancelled'
      }[action];
    const wh=await owned(tx,'warehouses',order.target_warehouse_id,u);
    if(u.moduleType!=='BOTH'&&wh.warehouse_type!==u.moduleType)fail('Depo modülüne erişiminiz yok.',403);
    if (!target) fail('Geçersiz sipariş işlemi.');
    if (order.status === target) return {
      message: 'Sipariş zaten bu durumda.',
      status: target
    };
    if (action === 'submit' && order.status !== 'draft' || action === 'approve' && order.status !== 'pending' || action === 'cancel' && !['draft', 'pending', 'approved', 'partially_received'].includes(order.status)) fail('Sipariş durumu bu işleme uygun değil.', 409);
    if (action === 'cancel' && (typeof body.reason !== 'string' || body.reason.trim().length < 3)) fail('İptal gerekçesi gerekli.');
    if (action === 'cancel') await tx.query('UPDATE purchase_order_items SET cancelled_quantity=MAX(0,quantity-received_quantity) WHERE order_id=$1 AND tenant_id=$2', [id, u.tenantId]);
    await tx.query('UPDATE purchase_orders SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [target, id, u.tenantId]);
    if (action === 'approve') await tx.query('UPDATE purchase_orders SET approved_by=$1,approved_at=CURRENT_TIMESTAMP WHERE id=$2', [u.userId, id]);
    if (action === 'cancel') await tx.query('UPDATE purchase_orders SET cancelled_by=$1,cancel_reason=$2,cancelled_at=CURRENT_TIMESTAMP WHERE id=$3', [u.userId, body.reason.trim(), id]);
    await audit(tx, u, 'purchase.' + action, id, {
      before_status: order.status,
      after_status: target,
      reason: body.reason || null
    });
    return {
      message: 'Sipariş durumu güncellendi. Stok değişmedi.',
      status: target
    };
  });
}
async function receive(u, id, body, key) {
  return keyed(u, 'receive:' + id, key, body, async tx => {
    const order = await owned(tx, 'purchase_orders', id, u);
    const wh = await owned(tx, 'warehouses', order.target_warehouse_id, u);
    if (u.moduleType !== 'BOTH' && wh.warehouse_type !== u.moduleType) fail('Depo modülüne erişiminiz yok.', 403);
    if (!['approved', 'partially_received'].includes(order.status)) fail('Mal kabul için sipariş onaylanmış ve açık olmalıdır.', 409);
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500) fail('Teslim alınacak kalemleri girin.');
    if (typeof body.delivery_reference !== 'string' || !body.delivery_reference.trim() || body.delivery_reference.length > 160) fail('Teslimat/irsaliye numarası gerekli.');
    if ((await tx.query('SELECT id FROM wms_inbound_receipts WHERE tenant_id=$1 AND supplier_id=$2 AND waybill_no=$3', [u.tenantId, order.supplier_id, body.delivery_reference.trim()])).rows.length) fail('Bu teslimat numarası zaten kabul edildi; geçmişi kontrol edin.', 409);
    const lines = [],
      totals = new Map();
    for (const line of body.items) {
      const item = await owned(tx, 'purchase_order_items', line.order_item_id, u);
      if (item.order_id !== order.id) fail('Kalem bu siparişe ait değil.');
      const quantity = number(line.quantity, 'Teslim miktarı'),
        price = money(line.unit_price ?? item.unit_price),
        loc = await owned(tx, 'warehouse_locations', line.location_id, u);
      if (loc.warehouse_id !== order.target_warehouse_id || loc.is_locked) fail('Raf yanlış depoda veya kilitli.');
      const lot = line.lot_number == null ? '' : String(line.lot_number).trim();
      if (lot.length > 120 || /[\x00-\x1f]/.test(lot)) fail('Lot numarası geçersiz.');
      if (line.expiry_date && (!lot || typeof line.expiry_date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(line.expiry_date) || !Number.isFinite(require('./stockHealthService').daysUntil(line.expiry_date)))) fail('Geçerli tarih ve lot numarası gerekli.');
      totals.set(item.id, round((totals.get(item.id) || 0) + quantity));
      lines.push({
        item,
        quantity,
        price,
        location_id: loc.id,
        lot_number: lot,
        expiry_date: line.expiry_date || null
      });
    }
    const excess = [...totals].map(([item_id, q]) => {
      const i = lines.find(l => l.item.id === item_id).item;
      return {
        item_id,
        ordered: Number(i.quantity),
        received: Number(i.received_quantity),
        incoming: q,
        excess: round(Math.max(0, Number(i.received_quantity) + q - Number(i.quantity)))
      };
    }).filter(l => l.excess > 0);
    if (excess.length) {
      if (u.role !== 'admin') fail('Fazla teslimat için yönetici onayı gerekir.', 403, {
        excess
      });
      if (body.approve_excess !== true || typeof body.excess_reason !== 'string' || body.excess_reason.trim().length < 3) fail('Fazla teslimat var. Miktarları inceleyip açık yönetici onayı ve gerekçe girin.', 409, {
        excess
      });
    }
    const receipt = await inbound.createReceipt({
      tenant_id: u.tenantId,
      warehouse_id: order.target_warehouse_id,
      supplier_id: order.supplier_id,
      waybill_no: body.delivery_reference.trim(),
      purchase_order_id: order.id,
      received_by: u.userId,
      items: lines.map(l => ({
        product_id: l.item.product_id,
        expected_qty: l.quantity,
        unit_purchase_price: l.price,
        lot_number: l.lot_number,
        expiry_date: l.expiry_date
      }))
    }, tx);
    for (let n = 0; n < lines.length; n++) {
      const l = lines[n],
        ri = receipt.items[n];
      await tx.query('UPDATE wms_inbound_items SET purchase_order_item_id=$1,unit_purchase_price=$2 WHERE id=$3', [l.item.id, l.price, ri.id]);
      await inbound.completePutaway({
        tenant_id: u.tenantId,
        receipt_id: receipt.id,
        item_id: ri.id,
        actual_location_id: l.location_id,
        quantity: l.quantity,
        user_id: u.userId
      }, tx);
      await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'inbound','purchase_order',$5)", [u.tenantId, l.item.product_id, order.target_warehouse_id, l.quantity, order.order_no + ' · ' + body.delivery_reference.trim()]);
    }
    for (const [item_id, q] of totals) await tx.query('UPDATE purchase_order_items SET received_quantity=ROUND(received_quantity+$1,6) WHERE id=$2', [q, item_id]);
    const unfinished = (await tx.query('SELECT id FROM purchase_order_items WHERE order_id=$1 AND tenant_id=$2 AND received_quantity<quantity', [id, u.tenantId])).rows.length,
      status = unfinished ? 'partially_received' : 'completed';
    await tx.query('UPDATE purchase_orders SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [status, id]);
    await audit(tx, u, 'purchase.receive', id, {
      receipt_id: receipt.id,
      delivery_reference: body.delivery_reference,
      items: lines.map(l => ({
        order_item_id: l.item.id,
        quantity: l.quantity,
        lot_number: l.lot_number,
        expiry_date: l.expiry_date,
        location_id: l.location_id,
        unit_price: l.price
      })),
      excess,
      excess_approved_by: excess.length ? u.userId : null,
      reason: excess.length ? body.excess_reason : null
    });
    return {
      message: 'Teslimat başarıyla mal kabul ve stok defterine işlendi.',
      receipt_id: receipt.id,
      status
    };
  });
}
async function supplierReturn(u, supplierId, orderId, body, key) {
  return keyed(u, 'return:' + supplierId + ':' + (orderId || 'all'), key, body, async tx => {
    await owned(tx, 'suppliers', supplierId, u);
    if (orderId) {
      const order = await owned(tx, 'purchase_orders', orderId, u);
      if (order.supplier_id !== Number(supplierId)) fail('Tedarikçi eşleşmiyor.');
    }
    if (typeof body.reason !== 'string' || body.reason.trim().length < 3) fail('Hasar/yanlış ürün iade gerekçesi gerekli.');
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500) fail('İade kalemleri gerekli.');
    const returnId = crypto.randomUUID(),
      seen = new Set();
    await tx.query('INSERT INTO supplier_return_documents (id,tenant_id,supplier_id,purchase_order_id,reason,created_by) VALUES ($1,$2,$3,$4,$5,$6)', [returnId, u.tenantId, supplierId, orderId || null, body.reason.trim().slice(0, 2000), u.userId]);
    const changes = [];
    for (const line of body.items) {
      const i = await owned(tx, 'wms_inbound_items', line.receipt_item_id, u),
        r = await owned(tx, 'wms_inbound_receipts', i.receipt_id, u);
      if (seen.has(i.id)) fail('Aynı kabul satırı bir kez seçilmelidir.');
      seen.add(i.id);
      if (r.supplier_id !== Number(supplierId) || orderId && r.purchase_order_id !== Number(orderId)) fail('Kabul satırı bu tedarikçi/siparişe ait değil.');
      if (i.status !== 'completed') fail('Yalnızca teslim alınmış ürün iade edilebilir.');
      const q = number(line.quantity, 'İade miktarı');
      if (q > round(Number(i.received_qty) - Number(i.returned_qty))) fail('Teslim alınan miktardan fazla iade yapılamaz.', 409);
      if (u.moduleType !== 'BOTH' && (await owned(tx, 'warehouses', r.warehouse_id, u)).warehouse_type !== u.moduleType) fail('Depo modülüne erişiminiz yok.', 403);
      const holds = (await tx.query('SELECT * FROM inventory_return_holds WHERE tenant_id=$1 AND product_id=$2 AND warehouse_id=$3 AND (location_id=$4 OR (location_id IS NULL AND $4 IS NULL)) AND (lot_id=$5 OR (lot_id IS NULL AND $5 IS NULL)) ORDER BY created_at,id', [u.tenantId, i.product_id, r.warehouse_id, i.actual_location_id, i.lot_id])).rows;
      let left = q;
      const released = [];
      for (const h of holds) {
        const take = Math.min(left, Number(h.quantity));
        if (take <= 0) break;
        released.push({
          id: h.id,
          quantity: take,
          disposition: h.disposition
        });
        if (take === Number(h.quantity)) await tx.query('DELETE FROM inventory_return_holds WHERE id=$1', [h.id]);else await tx.query('UPDATE inventory_return_holds SET quantity=ROUND(quantity-$1,6) WHERE id=$2', [take, h.id]);
        left = round(left - take);
      }
      const movement = await inventory.recordTransaction({
        tenant_id: u.tenantId,
        warehouse_id: r.warehouse_id,
        product_id: i.product_id,
        location_id: i.actual_location_id,
        lot_id: i.lot_id,
        transaction_type: 'SUPPLIER_RETURN',
        quantity: -q,
        user_id: u.userId,
        reference_type: 'SUPPLIER_RETURN',
        reference_id: returnId,
        notes: body.reason.trim()
      }, tx);
      await tx.query('UPDATE wms_inbound_items SET returned_qty=ROUND(returned_qty+$1,6) WHERE id=$2', [q, i.id]);
      await tx.query('INSERT INTO supplier_return_items (tenant_id,return_id,receipt_item_id,quantity,transaction_id,released_holds_json) VALUES ($1,$2,$3,$4,$5,$6)', [u.tenantId, returnId, i.id, q, movement.id, JSON.stringify(released)]);
      await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'outbound','supplier_return',$5)", [u.tenantId, i.product_id, r.warehouse_id, -q, body.reason.trim()]);
      changes.push({
        receipt_item_id: i.id,
        quantity: q,
        lot_id: i.lot_id,
        location_id: i.actual_location_id,
        transaction_id: movement.id,
        released_holds: released
      });
    }
    await audit(tx, u, 'supplier.return', returnId, {
      supplier_id: supplierId,
      order_id: orderId || null,
      reason: body.reason.trim(),
      items: changes
    });
    return {
      message: 'Tedarikçiye iade stok defterine işlendi. Dış sisteme gönderim yapılmadı.',
      return_id: returnId,
      items: changes
    };
  });
}
async function deliveries(u, supplierId, orderId, tx = db) {
  const rows = (await tx.query(`SELECT i.*,r.receipt_no,r.waybill_no,r.warehouse_id,r.purchase_order_id,r.received_at,p.name AS product_name,p.barcode,p.unit,p.module_type,l.location_code FROM wms_inbound_items i JOIN wms_inbound_receipts r ON r.id=i.receipt_id AND r.tenant_id=i.tenant_id JOIN products p ON p.id=i.product_id AND p.tenant_id=i.tenant_id LEFT JOIN warehouse_locations l ON l.id=i.actual_location_id WHERE r.tenant_id=$1 AND r.supplier_id=$2 ${orderId ? 'AND r.purchase_order_id=$3' : ''} ORDER BY r.id DESC,i.id`, orderId ? [u.tenantId, supplierId, orderId] : [u.tenantId, supplierId])).rows.filter(r=>u.moduleType==='BOTH'||r.module_type===u.moduleType);
  return rows.map(r => ({
    ...r,
    returnable_quantity: round(Math.max(0, Number(r.received_qty) - Number(r.returned_qty)))
  }));
}
async function list(u, status) {
  return (await db.query(`SELECT po.*,s.name AS supplier_name,w.name AS target_warehouse_name,w.warehouse_type,COUNT(i.id) AS item_count,COALESCE(SUM(i.quantity),0) AS total_quantity,COALESCE(SUM(i.received_quantity),0) AS received_quantity,COALESCE(SUM(MAX(0,i.quantity-i.received_quantity-i.cancelled_quantity)),0) AS remaining_quantity FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id JOIN warehouses w ON w.id=po.target_warehouse_id LEFT JOIN purchase_order_items i ON i.order_id=po.id WHERE po.tenant_id=$1 ${status ? 'AND po.status=$2' : ''} GROUP BY po.id ORDER BY po.id DESC`, status ? [u.tenantId, status] : [u.tenantId])).rows.filter(r=>u.moduleType==='BOTH'||r.warehouse_type===u.moduleType);
}
async function detail(u, id) {
  return db.transaction(async tx => {
    const order = await owned(tx, 'purchase_orders', id, u),
      s = await owned(tx, 'suppliers', order.supplier_id, u),
      w = await owned(tx, 'warehouses', order.target_warehouse_id, u),
      items = (await tx.query('SELECT i.*,p.name AS product_name,p.sku,p.unit,p.barcode,(SELECT COALESCE(SUM(sr.quantity),0) FROM stock_records sr WHERE sr.tenant_id=i.tenant_id AND sr.product_id=i.product_id AND sr.warehouse_id=$3) AS warehouse_stock_quantity FROM purchase_order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=$1 AND i.tenant_id=$2 ORDER BY i.id', [id, u.tenantId, order.target_warehouse_id])).rows.map(i => ({
        ...i,
        remaining_quantity: round(Math.max(0, i.quantity - i.received_quantity - i.cancelled_quantity))
      }));
    if(u.moduleType!=='BOTH'&&w.warehouse_type!==u.moduleType)fail('Depo modülüne erişiminiz yok.',403);
    return {
      ...order,
      supplier_name: s.name,
      supplier_email: s.email,
      supplier_phone: s.phone,
      target_warehouse_name: w.name,
      items,
      deliveries: await deliveries(u, order.supplier_id, id, tx),
      returns: (await tx.query('SELECT * FROM supplier_return_documents WHERE tenant_id=$1 AND purchase_order_id=$2 ORDER BY created_at DESC', [u.tenantId, id])).rows
    };
  });
}
module.exports = {
  create,
  transition,
  receive,
  supplierReturn,
  deliveries,
  list,
  detail,
  audit
};
