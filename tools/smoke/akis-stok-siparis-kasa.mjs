import {login, call, check, summary} from './api.mjs';
await login();
const stamp = Date.now().toString().slice(-6);
const ean = b12 => { const d = b12.split('').map(Number); return b12 + ((10 - (d.reduce((t, n, i) => t + n * (i % 2 ? 3 : 1), 0) % 10)) % 10); };
const EAN = ean('869' + stamp.padStart(9, '0'));
// 1) ürün
let r = await call('POST', '/products', {name: 'Test Makarna ' + stamp, sku: 'TST-' + stamp, barcode: EAN, category: 'Gıda', unit: 'adet', purchase_price: 10, sale_price: 18, min_stock_level: 5, max_stock_level: 100, kdv_orani: 10});
check('ürün oluştur', r.status === 201 || r.status === 200, JSON.stringify(r.data));
const pid = r.data?.id || r.data?.product?.id;
r = await call('GET', '/products?search=Test Makarna ' + stamp);
const list = r.data.products || r.data;
check('ürün aramada bulunur', Array.isArray(list) && list.some(p => p.id === pid), JSON.stringify(r.data).slice(0, 120));
r = await call('PUT', '/products/' + pid, {name: 'Test Makarna ' + stamp, sku: 'TST-' + stamp, barcode: EAN, sale_price: 20, purchase_price: 10, category: 'Gıda', unit: 'adet', min_stock_level: 5, max_stock_level: 100, kdv_orani: 10});
check('ürün fiyat güncelle', r.status === 200, JSON.stringify(r.data));
r = await call('GET', '/products/' + pid);
check('güncel fiyat 20', Number((r.data.product || r.data).sale_price) === 20, JSON.stringify(r.data).slice(0, 150));
// 2) tedarikçi
r = await call('POST', '/suppliers', {name: 'Test Toptan ' + stamp, contact_name: 'Ali', phone: '05550000000', email: 'ali' + stamp + '@ornek.com', lead_time_days: 2});
check('tedarikçi oluştur', r.status === 201 || r.status === 200, JSON.stringify(r.data));
const sid = r.data?.id || r.data?.supplier?.id;
// 3) depo
r = await call('GET', '/warehouses'); const wh = (r.data.warehouses || r.data)[0];
check('depo listesi', !!wh?.id, JSON.stringify(r.data).slice(0, 100));
// 4) satın alma siparişi
r = await call('POST', '/purchase-orders', {supplier_id: sid, target_warehouse_id: wh.id, items: [{product_id: pid, quantity: 24, unit_price: 10}], notes: 'test'});
check('sipariş oluştur', r.status === 201 || r.status === 200, JSON.stringify(r.data));
const oid = r.data?.id || r.data?.order?.id;
r = await call('POST', '/purchase-orders/' + oid + '/status', {action: 'submit'}); check('sipariş gönder', r.status === 200, JSON.stringify(r.data));
r = await call('POST', '/purchase-orders/' + oid + '/status', {action: 'approve'}); check('sipariş onayla', r.status === 200, JSON.stringify(r.data));
r = await call('GET', '/purchase-orders/' + oid); const order = r.data.order || r.data; const item = (order.items || [])[0];
check('sipariş kalemi görünür', !!item?.id, JSON.stringify(r.data).slice(0, 200));
r = await call('GET', '/wms/locations?warehouse_id=' + wh.id); const locs = Array.isArray(r.data) ? r.data : (r.data.locations || []);

r = await call('POST', '/purchase-orders/' + oid + '/receive', {delivery_reference: 'IRS-' + stamp, items: [{order_item_id: item.id, quantity: 24}]});
check('siparişi rafsız teslim al (24 adet)', r.status === 200, JSON.stringify(r.data));
r = await call('GET', '/purchase-orders/' + oid); check('sipariş durumu tamamlandı', ['received', 'completed'].includes((r.data.order || r.data).status), (r.data.order || r.data).status);
// --- kasa
const qty = async () => { const l = (await call('GET', '/products?search=Test Makarna ' + stamp)).data; const arr = l.products || l; return Number((arr.find(p => p.id === pid) || {}).total_quantity || 0); };
check('rafsız teslim sonrası stok 24', await qty() === 24, await qty());
let r2 = await call('GET', '/scanner/shifts/context?warehouse_id=' + wh.id); let ctx = r2.data; const reg = ctx.register?.id;
if (!ctx.active_shift) { r2 = await call('POST', '/scanner/shifts/open', {warehouse_id: wh.id, register_id: reg, opening_cash: 100}); check('vardiya aç', r2.status === 201 || r2.status === 200, JSON.stringify(r2.data).slice(0, 200)); ctx = (await call('GET', '/scanner/shifts/context?warehouse_id=' + wh.id)).data; }
const shiftId = ctx.active_shift?.shift_id; check('açık vardiya var', !!shiftId, JSON.stringify(ctx).slice(0, 120));
const barcode = EAN;
r = await call('POST', '/scanner/sale', {register_id: reg, shift_id: shiftId, warehouse_id: wh.id, discount_amount: 0, payments: [{method: 'cash', amount: 60}], cash_received: 100, items: [{barcode, count: 3}]});
check('3 adet nakit satış', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 240));
const sale = r.data; const saleId = sale?.sale_id || sale?.sale?.sale_id;
console.log('satış yanıtı:', JSON.stringify({total: sale?.total, change: sale?.change, receipt_no: sale?.receipt_no, status: sale?.status}));
check('satıştan sonra stok 21', await qty() === 21, await qty());
r = await call('GET', '/scanner/sales/' + saleId); const sd = r.data.sale || r.data; const sitem = (sd.snapshot?.items || sd.items || [])[0];
check('satış detayı görünür', !!sitem, JSON.stringify(r.data).slice(0, 200));
r = await call('POST', '/scanner/sales/' + saleId + '/return', {reason: 'Test iadesi', items: [{id: sitem?.id, quantity: 1}], refund_method: 'cash'});
check('1 adet iade', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 240));
check('iade sonrası stok 22', await qty() === 22, await qty());
r = await call('GET', '/scanner/day-report?warehouse_id=' + wh.id);
console.log('gün sonu:', JSON.stringify({sale_count: r.data.sale_count, net: r.data.net_cents, cash_net: r.data.cash_net_cents, return: r.data.return_cents}));
check('gün sonu: satış sayılmış', r.data.sale_count >= 1 && r.data.net_cents >= 4000, JSON.stringify(r.data).slice(0, 160));
summary();
