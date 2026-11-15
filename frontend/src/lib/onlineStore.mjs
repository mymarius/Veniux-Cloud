// Online mağaza ortak yardımcıları (yönetici paneli ve vitrin). Saf fonksiyonlar; testleri onlineStore.test.mjs içinde.
export const STATUS_LABELS = { new: 'Yeni', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', ready: 'Hazır', delivered: 'Teslim edildi', cancelled: 'İptal' };
export const statusLabel = status => STATUS_LABELS[status] || status;
export const STATUS_FLOW = 'Yeni → Onaylandı → Hazırlanıyor → Hazır → Teslim edildi. İptal edilen siparişin stoğu geri gelir.';

// Sunucudaki durum makinesiyle aynı: hangi duruma geçilebilir (birincil işlem ilk sırada).
const NEXT = { new: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready', 'confirmed', 'cancelled'], ready: ['delivered', 'preparing', 'cancelled'], delivered: [], cancelled: [] };
const ACTION_LABELS = { confirmed: 'Siparişi onayla', preparing: 'Hazırlanıyor', ready: 'Hazır', delivered: 'Teslim edildi', cancelled: 'Siparişi iptal et' };
export function orderActions(status) {
  const next = NEXT[status] || [];
  const forward = next.filter(s => s !== 'cancelled' && !(status === 'preparing' && s === 'confirmed') && !(status === 'ready' && s === 'preparing'));
  const back = next.filter(s => (status === 'preparing' && s === 'confirmed') || (status === 'ready' && s === 'preparing'));
  return [...forward.map((s, i) => ({ status: s, label: ACTION_LABELS[s], primary: i === 0 })), ...back.map(s => ({ status: s, label: 'Geri al: ' + statusLabel(s), primary: false })), ...next.filter(s => s === 'cancelled').map(s => ({ status: s, label: ACTION_LABELS[s], primary: false }))];
}

// Görseli en uzun kenar `max` olacak şekilde, oranı koruyarak ve büyütmeden küçültür.
export function fitSize(width, height, max = 1200) {
  const w = Math.max(1, Math.round(Number(width) || 1)), h = Math.max(1, Math.round(Number(height) || 1));
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
export const shopUrl = (origin, slug) => `${String(origin).replace(/\/$/, '')}/magaza/${slug}`;

// ---------- Sepet (vitrin) ----------
// Sepet { [productId]: { id, name, price, quantity, max } } biçimindedir. Fiyat ve ad yalnız gösterim içindir; sunucu yeniden hesaplar.
export const MAX_LINE = 50;
export function cartAdd(cart, product, quantity = 1) {
  const limit = Math.min(MAX_LINE, product.max_per_order || MAX_LINE);
  const current = cart[product.id] ? cart[product.id].quantity : 0;
  const next = Math.min(limit, current + quantity);
  if (next <= 0) { const { [product.id]: _removed, ...rest } = cart; return rest; }
  return { ...cart, [product.id]: { id: product.id, name: product.name, price: product.price, quantity: next, max: limit, image: (product.images && product.images[0] && product.images[0].url) || '' } };
}
export function cartSet(cart, id, quantity) {
  const line = cart[id]; if (!line) return cart;
  const q = Math.floor(Number(quantity));
  if (!Number.isFinite(q) || q <= 0) { const { [id]: _removed, ...rest } = cart; return rest; }
  return { ...cart, [id]: { ...line, quantity: Math.min(q, line.max || MAX_LINE) } };
}
export const cartCount = cart => Object.values(cart).reduce((s, l) => s + l.quantity, 0);
export const cartSubtotal = cart => Math.round(Object.values(cart).reduce((s, l) => s + Math.round(l.price * 100) * l.quantity, 0)) / 100;
// Teslimat ücreti ve toplam; sunucudaki kuralın aynısı (ücretsiz eşiği, mağazadan teslimde 0).
export function cartTotals(cart, store, delivery) {
  const sub = Math.round(cartSubtotal(cart) * 100);
  const free = store.free_delivery_over == null ? null : Math.round(store.free_delivery_over * 100);
  const fee = delivery === 'pickup' || (free != null && sub >= free) ? 0 : Math.round((store.delivery_fee || 0) * 100);
  const min = Math.round((store.min_order || 0) * 100);
  return { subtotal: sub / 100, fee: fee / 100, total: (sub + fee) / 100, belowMin: sub < min, missing: Math.max(0, min - sub) / 100 };
}
export const cartPayload = cart => Object.values(cart).map(l => ({ product_id: l.id, quantity: l.quantity, expected_price: l.price }));
export function cartKey(slug) { return 'veniux-shop-cart:' + slug; }
export function loadCart(storage, slug) {
  try { const parsed = JSON.parse(storage.getItem(cartKey(slug)) || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}
// Tek bir sipariş denemesi için kararlı istek anahtarı: aynı sepet tekrar gönderilirse aynı sipariş döner.
export function newIdempotencyKey(random = () => Math.random().toString(36).slice(2) + Date.now().toString(36)) { return 'shop-' + random() + random(); }
