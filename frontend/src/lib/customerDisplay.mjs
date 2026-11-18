import { cartLineCents } from '../../../shared/retailMoney.mjs';

// Müşteri ekranı: kasa penceresi sepeti bu kanaldan ikinci pencereye yayınlar (aynı bilgisayar, sunucu gerekmez).
export const DISPLAY_CHANNEL = 'veniux-customer-display';
export const DISPLAY_STORE = 'veniux-customer-display-last';

export function displaySnapshot({ cart, total, discount = 0, cut = 0, status = 'cart', business = '' }) {
  const lines = (Array.isArray(cart) ? cart : []).map(i => ({
    name: String(i.product?.name || 'Ürün'),
    qty: Math.round(Number(i.quantity || 1) * Number(i.count || 1) * 1000) / 1000,
    unit: Number(i.unit_price ?? i.product?.sale_price ?? 0),
    total: cartLineCents(i) / 100,
  }));
  return { status, business, lines, total: Number(total) || 0, discount: Number(discount) || 0, cut: Number(cut) || 0, at: Date.now() };
}

export function publishDisplay(snapshot) {
  try { localStorage.setItem(DISPLAY_STORE, JSON.stringify(snapshot)); } catch { /* depolama kapalıysa kanal yeter */ }
  try { const ch = new BroadcastChannel(DISPLAY_CHANNEL); ch.postMessage(snapshot); ch.close(); } catch { /* eski tarayıcı */ }
}

export function readLastDisplay() {
  try { const v = JSON.parse(localStorage.getItem(DISPLAY_STORE) || 'null'); return v && Array.isArray(v.lines) ? v : null; } catch { return null; }
}
