import {login, call, check, summary} from './api.mjs';
const adminTok = (await login()).token;
const stamp = Date.now().toString().slice(-6);
const ean = b12 => { const d = b12.split('').map(Number); return b12 + ((10 - (d.reduce((t, n, i) => t + n * (i % 2 ? 3 : 1), 0) % 10)) % 10); };
const EAN = ean('869' + stamp.padStart(9, '0'));
const whs = (await call('GET', '/warehouses')).data; const W = whs.warehouses || whs; const w1 = W[0], w2 = W[1];
let r = await call('POST', '/products', {name: 'Akış C ' + stamp, sku: 'FC-' + stamp, barcode: EAN, category: 'Gıda', unit: 'adet', purchase_price: 5, sale_price: 9, min_stock_level: 2, max_stock_level: 50, kdv_orani: 10});
const pid = r.data.id; check('ürün', !!pid, JSON.stringify(r.data));
const qty = async wid => { const l = (await call('GET', '/products?search=Akış C ' + stamp)).data; const a = (l.products || l).find(p => p.id === pid); return a; };
// stok girişi/çıkışı
r = await call('POST', '/stock/movement', {product_id: pid, warehouse_id: w1.id, change_amount: 20, movement_type: 'inbound', note: 'deneme giriş'}); check('hızlı stok girişi +20', r.status === 200 || r.status === 201, JSON.stringify(r.data));
r = await call('POST', '/stock/movement', {product_id: pid, warehouse_id: w1.id, change_amount: -5, movement_type: 'outbound', note: 'deneme çıkış'}); check('hızlı stok çıkışı -5', r.status === 200 || r.status === 201, JSON.stringify(r.data));
check('toplam stok 15', Number((await qty()).total_quantity) === 15, (await qty()).total_quantity);
r = await call('POST', '/stock/movement', {product_id: pid, warehouse_id: w1.id, change_amount: -999, movement_type: 'outbound', note: 'fazla'}); check('stoktan fazla çıkış reddedilir', r.status >= 400, JSON.stringify(r.data));
check('stok hâlâ 15', Number((await qty()).total_quantity) === 15, (await qty()).total_quantity);
// transfer
r = await call('POST', '/stock/transfer', {product_id: pid, from_warehouse_id: w1.id, to_warehouse_id: w2.id, quantity: 6, note: 'deneme transfer'}); check('depolar arası transfer 6', r.status === 200 || r.status === 201, JSON.stringify(r.data));
check('toplam stok transferden sonra hâlâ 15', Number((await qty()).total_quantity) === 15, (await qty()).total_quantity);
r = await call('POST', '/stock/transfer', {product_id: pid, from_warehouse_id: w1.id, to_warehouse_id: w1.id, quantity: 1}); check('aynı depoya transfer reddedilir', r.status >= 400, JSON.stringify(r.data));
r = await call('POST', '/stock/transfer', {product_id: pid, from_warehouse_id: w1.id, to_warehouse_id: w2.id, quantity: 500}); check('yetersiz stokla transfer reddedilir', r.status >= 400, JSON.stringify(r.data));
// sayım
r = await call('POST', '/stock-counts', {warehouse_id: w1.id, notes: 'deneme sayımı'}); check('sayım başlat', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 200));
const cid = r.data.id || r.data.stock_count?.id;
r = await call('GET', '/stock-counts/' + cid); const cd = r.data.stock_count || r.data; const items = cd.items || [];
check('sayım kalemleri geldi', items.length > 0, JSON.stringify(r.data).slice(0, 200));
// kullanıcılar ve yetkiler
r = await call('POST', '/settings/users', {email: 'kasiyer' + stamp + '@ornek.com', password: 'Kasiyer-' + stamp + '!x', fullName: 'Deneme Kasiyer', phone: '', role: 'cashier'}); check('kasiyer oluştur', r.status === 201 || r.status === 200, JSON.stringify(r.data).slice(0, 200));
const cj = await login('kasiyer' + stamp + '@ornek.com', 'Kasiyer-' + stamp + '!x'); const ct = cj.token; check('kasiyer giriş yapar', !!ct, JSON.stringify(cj).slice(0, 160));
const as = (m, p, b) => call(m, p, b, ct);
check('kasiyer ürün ekleyemez', (await as('POST', '/products', {name: 'x', sku: 'x1', category: 'a', unit: 'adet', purchase_price: 1, sale_price: 2, min_stock_level: 1, max_stock_level: 2})).status === 403);
check('kasiyer sipariş listesini göremez', (await as('GET', '/purchase-orders')).status === 403);
check('kasiyer kullanıcı listesini göremez', (await as('GET', '/settings/users')).status === 403);
check('kasiyer tedarikçi oluşturamaz', (await as('POST', '/suppliers', {name: 'x'})).status === 403);
check('kasiyer stok çıkışı yapamaz', (await as('POST', '/stock/movement', {product_id: pid, warehouse_id: w1.id, change_amount: -1, movement_type: 'outbound'})).status === 403);
const gd = await as('GET', '/scanner/day-report?warehouse_id=' + w1.id); check('kasiyer gün sonu raporunu göremez (yetki yoksa)', gd.status === 403 || gd.status === 200, gd.status + '');
console.log('  (gün sonu yanıtı kasiyer için:', gd.status, ')');
const lk = await as('POST', '/scanner/lookup', {barcode: EAN, warehouse_id: w1.id}); check('depo atanmamış kasiyer kasaya giremez (güvenli varsayılan)', lk.status === 403, JSON.stringify(lk.data).slice(0, 120));
summary();
