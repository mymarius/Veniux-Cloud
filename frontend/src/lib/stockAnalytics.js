// Stok kayıtları ve hareketlerinden pano metrikleri üretir.
// Tüm tarih hesapları İstanbul saatine göre yapılır.

export const asList = data => (Array.isArray(data) ? data : data?.data || []);
export const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const hourOf = date => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(date));
const weekdayOf = date => (new Date(dayKey(date) + 'T12:00:00').getDay() + 6) % 7; // Pzt = 0

// Sunucu tarihleri UTC olarak "YYYY-MM-DD HH:MM:SS" biçiminde gelir.
export function parseDate(raw) {
  if (!raw) return null;
  const text = String(raw);
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? null : date;
}

export const MOVEMENT_LABELS = {
  inbound: 'Giriş', outbound: 'Çıkış', transfer: 'Transfer', TRANSFER_OUT: 'Transfer', transfer_in: 'Transfer', transfer_out: 'Transfer',
  adjustment: 'Düzeltme', count: 'Sayım', dispense: 'İlaç çıkışı', quarantine: 'Karantina', RETURN: 'İade', return: 'İade', sale: 'Satış'
};
export const movementLabel = row => MOVEMENT_LABELS[row.movement_type] || (Number(row.change_amount) >= 0 ? 'Giriş' : 'Çıkış');
const isTransfer = row => /transfer/i.test(String(row.movement_type || ''));

export function movementTimeline(movements, days) {
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - days + i + 1);
    return { key: dayKey(d), label: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }), inbound: 0, outbound: 0, count: 0 };
  });
  const index = new Map(buckets.map(b => [b.key, b]));
  movements.forEach(row => {
    const date = parseDate(row.created_at);
    const bucket = date && index.get(dayKey(date));
    if (!bucket || isTransfer(row)) { if (bucket) bucket.count++; return; }
    const qty = Number(row.change_amount || 0);
    bucket[qty >= 0 ? 'inbound' : 'outbound'] += Math.abs(qty);
    bucket.count++;
  });
  return buckets.map(b => ({ ...b, net: b.inbound - b.outbound }));
}

// Seçilen dönemi bir önceki eşit uzunluktaki dönemle karşılaştırır.
export function periodTotals(movements, days) {
  const now = Date.now(), span = days * 864e5;
  const sum = (from, to) => movements.reduce((acc, row) => {
    const date = parseDate(row.created_at);
    if (!date || date < from || date >= to || isTransfer(row)) return acc;
    const qty = Number(row.change_amount || 0);
    if (qty >= 0) acc.inbound += qty; else acc.outbound += -qty;
    acc.count++;
    return acc;
  }, { inbound: 0, outbound: 0, count: 0 });
  return { current: sum(new Date(now - span), new Date(now + 6e4)), previous: sum(new Date(now - 2 * span), new Date(now - span)) };
}

export const change = (current, previous) => (previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0);

export function movementTypes(movements) {
  const map = new Map();
  movements.forEach(row => map.set(movementLabel(row), (map.get(movementLabel(row)) || 0) + 1));
  return [...map].sort((a, b) => b[1] - a[1]);
}

export function topMovers(movements, limit = 7) {
  const map = new Map();
  movements.forEach(row => {
    const entry = map.get(row.product_id) || { name: row.product_name || `Ürün #${row.product_id}`, inbound: 0, outbound: 0 };
    const qty = Number(row.change_amount || 0);
    if (!isTransfer(row)) entry[qty >= 0 ? 'inbound' : 'outbound'] += Math.abs(qty);
    map.set(row.product_id, entry);
  });
  return [...map.values()].sort((a, b) => (b.inbound + b.outbound) - (a.inbound + a.outbound)).slice(0, limit);
}

// 7 gün x 24 saat yoğunluk matrisi (hareket adedi).
export function activityHeatmap(movements) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  movements.forEach(row => { const date = parseDate(row.created_at); if (date) grid[weekdayOf(date)][hourOf(date)]++; });
  return grid;
}

export function hourlyProfile(movements) {
  const hours = Array.from({ length: 24 }, () => ({ inbound: 0, outbound: 0 }));
  movements.forEach(row => {
    const date = parseDate(row.created_at);
    if (!date || isTransfer(row)) return;
    const qty = Number(row.change_amount || 0);
    hours[hourOf(date)][qty >= 0 ? 'inbound' : 'outbound'] += Math.abs(qty);
  });
  return hours;
}

// Stok kayıtlarını ürün bazında toplar ve sağlık durumunu sınıflandırır.
export function stockHealth(products, records) {
  const totals = new Map();
  records.forEach(row => totals.set(row.product_id, (totals.get(row.product_id) || 0) + Number(row.quantity || 0)));
  const groups = { healthy: [], critical: [], out: [], excess: [] };
  products.forEach(p => {
    const qty = totals.get(p.id) || 0;
    const min = Number(p.min_stock_level || 0), max = Number(p.max_stock_level || 0);
    const item = { ...p, qty };
    if (qty <= 0) groups.out.push(item);
    else if (min > 0 && qty <= min) groups.critical.push(item);
    else if (max > 0 && qty > max) groups.excess.push(item);
    else groups.healthy.push(item);
  });
  return { totals, groups };
}

export function sumBy(rows, keyFn, valueFn) {
  const map = new Map();
  rows.forEach(row => { const key = keyFn(row); map.set(key, (map.get(key) || 0) + valueFn(row)); });
  return [...map].sort((a, b) => b[1] - a[1]);
}

export const tl = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value || 0);
export const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
export const num = value => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(value || 0);
export const compact = value => new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
