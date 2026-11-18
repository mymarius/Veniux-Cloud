import {login, call, check, summary} from './api.mjs';
await login();
const stamp = Date.now().toString().slice(-6);
const ean = b12 => { const d = b12.split('').map(Number); return b12 + ((10 - (d.reduce((t, n, i) => t + n * (i % 2 ? 3 : 1), 0) % 10)) % 10); };
const W = (await call('GET', '/warehouses')).data; const w1 = (W.warehouses || W)[0];
const mk = async (name, price, cat) => { const e = ean('869' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')); const r = await call('POST', '/products', {name: name + ' ' + stamp, sku: 'FE-' + stamp + '-' + Math.floor(Math.random() * 1e4), barcode: e, category: cat, unit: 'adet', purchase_price: price / 2, sale_price: price, min_stock_level: 1, max_stock_level: 100, kdv_orani: 10}); await call('POST', '/stock/movement', {product_id: r.data.id, warehouse_id: w1.id, change_amount: 50, movement_type: 'inbound', note: 'açılış'}); return r.data; };
const price = async id => Number(((await call('GET', '/products/' + id)).data.product || (await call('GET', '/products/' + id)).data).sale_price);
// hırdavat: toplu fiyat
const cat = 'ZamDeneme' + stamp; const a = await mk('Vida', 100, cat), b = await mk('Somun', 40, cat), other = await mk('Başka', 100, 'Gıda');
let r = await call('POST', '/sector/hardware/prices/bulk', {percent: 10, category: cat, target: 'sale', rounding: 0.01});
check('toplu fiyat önizleme: 2 ürün değişecek, henüz uygulanmadı', r.data.preview === true && r.data.changed === 2 && await price(a.id) === 100, JSON.stringify(r.data).slice(0, 200));
r = await call('POST', '/sector/hardware/prices/bulk', {percent: 10, category: cat, target: 'sale', rounding: 0.01, apply: true, expected_count: 2});
check('toplu fiyat uygulandı', r.status === 200 && r.data.preview === false, JSON.stringify(r.data).slice(0, 200));
check('Vida 100 → 110', await price(a.id) === 110, await price(a.id)); check('Somun 40 → 44', await price(b.id) === 44, await price(b.id));
check('başka kategori etkilenmedi', await price(other.id) === 100, await price(other.id));
r = await call('POST', '/sector/hardware/prices/bulk', {percent: 0, category: cat}); check('%0 zam reddedilir', r.status === 400, JSON.stringify(r.data).slice(0, 100));
r = await call('POST', '/sector/hardware/prices/bulk', {percent: 10, amount: 5, category: cat}); check('hem yüzde hem tutar reddedilir', r.status === 400, JSON.stringify(r.data).slice(0, 100));
// züccaciye: kırık/fire
const before = async id => { const l = (await call('GET', '/products?search=' + encodeURIComponent((id === a.id ? 'Vida ' : 'Somun ') + stamp))).data; return Number(((l.products || l).find(p => p.id === id) || {}).total_quantity); };
const q0 = await before(a.id);
r = await call('POST', '/sector/tableware/breakage', {product_id: a.id, warehouse_id: w1.id, quantity: 3, reason: 'kirik', note: 'taşırken düştü'});
check('kırık/fire kaydı (3 adet)', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 220));
check('kırıktan sonra stok 3 azaldı', q0 - await before(a.id) === 3, q0 + ' → ' + await before(a.id));
r = await call('POST', '/sector/tableware/breakage', {product_id: a.id, warehouse_id: w1.id, quantity: 9999, reason: 'kirik'}); check('stoktan fazla kırık reddedilir', r.status >= 400, JSON.stringify(r.data).slice(0, 100));
r = await call('POST', '/sector/tableware/breakage', {product_id: a.id, warehouse_id: w1.id, quantity: 1, reason: 'uydurma'}); check('geçersiz sebep reddedilir', r.status === 400, JSON.stringify(r.data).slice(0, 100));
// çeyiz listesi + takım
r = await call('POST', '/sector/tableware/registries', {title: 'Deneme Çeyiz ' + stamp}); check('çeyiz listesi oluştur', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 160));
const rid = r.data.id || r.data.registry?.id;
r = await call('POST', `/sector/tableware/registries/${rid}/items`, {product_id: a.id, quantity: 4}); check('listeye ürün ekle', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 160));
r = await call('POST', '/sector/tableware/sets', {name: 'Yemek Takımı ' + stamp, items: [{product_id: a.id, quantity: 6}, {product_id: b.id, quantity: 6}]}); check('takım oluştur', r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 200));
summary();
