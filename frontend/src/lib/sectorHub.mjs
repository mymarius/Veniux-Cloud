// Sektör paketleri (hırdavat, züccaciye, pide/restoran) için telefon tarafı saf mantık.

// ---------- Bildirim farkı ----------
// Aynı uyarı her yoklamada yeniden bildirilmez: daha önce görülmeyen kimlikler "yeni"dir.
export function newItems(seenIds, items, key = i => i.id) {
  const seen = new Set(seenIds || []);
  return (items || []).filter(i => !seen.has(key(i)));
}
export const idsOf = (items, key = i => i.id) => (items || []).map(key);

// Kritik stok: bir ürün biter durumuna geçince ("empty") ayrıca yeni sayılır.
export const criticalKey = i => i.id + (i.empty ? ':empty' : ':low');

// ---------- WhatsApp / toptancı mesajı ----------
export function wholesalerText(items) {
  const list = (items || []).slice(0, 12).map(i => '- ' + i.name + (i.empty ? ' (bitti)' : ' (' + i.stock + ' ' + (i.unit || 'adet') + ' kaldı)')).join('\n');
  return 'Merhaba, aşağıdaki ürünler azaldı/bitti, fiyat ve termin verir misiniz?\n' + list;
}
export function whatsappLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const normalized = digits.length === 10 ? '90' + digits : digits.length === 11 && digits.startsWith('0') ? '9' + digits : digits;
  const base = normalized.length >= 11 ? 'https://wa.me/' + normalized : 'https://wa.me/';
  return base + '?text=' + encodeURIComponent(text);
}

// ---------- Garson sepeti ----------
// Sepet satırı ürün + seçilen seçeneklerle ayrışır ("Kıymalı pide · Kaşarlı" ile sade pide ayrı satırdır).
export const lineKey = (productId, options = []) => productId + '|' + options.map(o => o.name).sort().join('+');
export function cartAdd(cart, product, delta = 1, options = []) {
  const next = new Map(cart), key = lineKey(product.id, options);
  const have = next.get(key);
  const quantity = Math.round(((have ? have.quantity : 0) + delta) * 1000) / 1000;
  const price = Math.round((Number(product.price) + options.reduce((s, o) => s + Number(o.price || 0), 0)) * 100) / 100;
  if (quantity <= 0) next.delete(key);
  else next.set(key, { key, product_id: product.id, name: product.name, options: have ? have.options : options.map(o => o.name), price, quantity: Math.min(quantity, 100), note: have?.note || '' });
  return next;
}
// Ürün kutusundaki eksi: o ürünün en son eklenen satırından bir azaltır.
export function cartRemoveOne(cart, productId) {
  const lines = [...cart.values()].filter(l => l.product_id === productId);
  if (!lines.length) return cart;
  const l = lines[lines.length - 1], next = new Map(cart);
  if (l.quantity <= 1) next.delete(l.key); else next.set(l.key, { ...l, quantity: Math.round((l.quantity - 1) * 1000) / 1000 });
  return next;
}
export const productQty = (cart, productId) => [...cart.values()].filter(l => l.product_id === productId).reduce((s, l) => s + l.quantity, 0);
export const cartNote = (cart, key, note) => { const next = new Map(cart); const l = next.get(key); if (l) next.set(key, { ...l, note: String(note || '').slice(0, 120) }); return next; };
export const cartTotal = cart => Math.round([...cart.values()].reduce((s, l) => s + l.quantity * l.price, 0) * 100) / 100;
export const cartCount = cart => [...cart.values()].reduce((s, l) => s + l.quantity, 0);
export const cartPayload = cart => [...cart.values()].map(l => ({ product_id: l.product_id, quantity: l.quantity, ...(l.options?.length ? { options: l.options } : {}), ...(l.note ? { note: l.note } : {}) }));
// Adisyon kalemi tutarı: adet x (birim + seçenekler).
export const itemAmount = i => Math.round(i.quantity * (i.price + (i.options || []).reduce((s, o) => s + o.price, 0)) * 100) / 100;
export const DELIVERY_LABELS = { waiting: 'Hazırlanıyor', on_way: 'Yolda', delivered: 'Teslim edildi' };
// Mutfak fişi (58 mm): masa/paket, saat, kalemler, seçenekler ve notlar. Fiyat yazmaz.
export function kitchenTicket(order, now = new Date()) {
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const head = order.table || TYPE_LABELS[order.type] || 'Sipariş';
  const time = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(now);
  const rows = (order.items || []).filter(i => i.status !== 'cancelled').map(i => `<div class="l"><b>${esc(i.quantity)}×</b> ${esc(i.name)}${(i.options || []).length ? `<div class="o">+ ${i.options.map(o => esc(o.name)).join(', ')}</div>` : ''}${i.note ? `<div class="n">Not: ${esc(i.note)}</div>` : ''}</div>`).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Mutfak fişi #${esc(order.id)}</title><style>@page{size:58mm auto;margin:2mm}body{font:14px/1.35 monospace;width:54mm;margin:0;color:#000}h1{font-size:20px;margin:0 0 2px}.m{font-size:12px;border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:4px}.l{padding:3px 0;border-bottom:1px dotted #999;font-size:15px}.o{font-size:13px;padding-left:12px}.n{font-size:13px;padding-left:12px;font-weight:bold}</style></head><body><h1>${esc(head)}</h1><div class="m">Sipariş #${esc(order.id)} · ${time}${order.note ? '<br>' + esc(order.note) : ''}</div>${rows}</body></html>`;
}
export function kitchenNew(prevItemIds, orders) {
  const ids = (orders || []).flatMap(o => o.items.map(i => i.id));
  const fresh = ids.filter(id => !(prevItemIds || []).includes(id));
  return { ids, fresh: fresh.length };
}
export const waitMinutes = (createdAt, now = Date.now()) => {
  const at = Date.parse(String(createdAt || '').includes('T') ? createdAt : String(createdAt || '').replace(' ', 'T') + 'Z');
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 60000)) : 0;
};
export const waitLevel = minutes => (minutes >= 20 ? 'late' : minutes >= 10 ? 'warn' : 'ok');

// ---------- Esnaf akışı ----------
export function feedMessage(items) {
  if (!items || !items.length) return '';
  const first = items[0], where = first.type === 'masa' ? (first.table || 'Masa') : first.type === 'motor' ? 'Motor' : 'Paket';
  return items.length === 1 ? 'Sipariş geldi: ' + where + ' · ' + first.text : items.length + ' yeni sipariş geldi (son: ' + where + ')';
}
export const TYPE_LABELS = { masa: 'Masa', paket: 'Paket', motor: 'Motor' };

// ---------- Etiket yazıcı seçimi ----------
export function pickPrinter(stations) {
  for (const s of stations || []) {
    const printer = (s.printers || []).find(p => p.is_default) || (s.printers || [])[0];
    if (printer) return { station_id: s.station_id, printer_name: printer.name };
  }
  return null;
}
