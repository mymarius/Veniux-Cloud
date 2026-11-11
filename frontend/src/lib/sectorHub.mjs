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
export function cartAdd(cart, product, delta = 1) {
  const next = new Map(cart);
  const have = next.get(product.id);
  const quantity = Math.round(((have ? have.quantity : 0) + delta) * 1000) / 1000;
  if (quantity <= 0) next.delete(product.id);
  else next.set(product.id, { product_id: product.id, name: product.name, price: Number(product.price), quantity: Math.min(quantity, 100), note: have?.note || '' });
  return next;
}
export const cartNote = (cart, id, note) => { const next = new Map(cart); const l = next.get(id); if (l) next.set(id, { ...l, note: String(note || '').slice(0, 120) }); return next; };
export const cartTotal = cart => Math.round([...cart.values()].reduce((s, l) => s + l.quantity * l.price, 0) * 100) / 100;
export const cartCount = cart => [...cart.values()].reduce((s, l) => s + l.quantity, 0);
export const cartPayload = cart => [...cart.values()].map(l => ({ product_id: l.product_id, quantity: l.quantity, ...(l.note ? { note: l.note } : {}) }));

// ---------- Mutfak ----------
// Mutfak ekranında yeni kalem geldi mi (ötsün mü): kalem kimlikleri önceki yoklamada yoksa evet.
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
