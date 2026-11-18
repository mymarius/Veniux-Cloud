// Stok hareketleri: tür adları ve dönem filtresi. Saf mantık; arayüzden bağımsız test edilir.
const LABELS = {
  in: 'Giriş', inbound: 'Giriş', receipt: 'Giriş',
  out: 'Çıkış', outbound: 'Çıkış',
  sale: 'Satış', return: 'İade', refund: 'İade',
  transfer: 'Transfer',
  adjustment: 'Düzeltme', count_adjustment: 'Sayım düzeltmesi'
};
// Demo ve eski kayıtlarda tür büyük harf ya da kısa yazılmış olabilir ("IN"); hepsi Türkçe gösterilir.
export const movementLabel = type => LABELS[String(type || '').toLowerCase()] || String(type || '—');

export const PERIODS = [['today', 'Bugün'], ['week', 'Son 7 gün'], ['month', 'Son 30 gün'], ['all', 'Tümü']];

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const stamp = value => {
  if (!value) return NaN;
  const text = String(value);
  return new Date(text.length <= 10 ? `${text}T00:00:00` : text.replace(' ', 'T')).getTime();
};

export function inPeriod(movement, period, now = new Date()) {
  if (period === 'all') return true;
  const time = stamp(movement?.created_at);
  if (Number.isNaN(time)) return false;
  const today = startOfDay(now).getTime();
  if (period === 'today') return time >= today;
  const days = period === 'week' ? 6 : period === 'month' ? 29 : null;
  if (days === null) return true;
  return time >= today - days * 86400000;
}

export function countPeriods(movements = [], now = new Date()) {
  const counts = Object.fromEntries(PERIODS.map(([key]) => [key, 0]));
  for (const movement of movements) for (const [key] of PERIODS) if (inPeriod(movement, key, now)) counts[key] += 1;
  return counts;
}

// Miktar birimiyle gösterilir (kg, adet, metre); küsurat Türkçe biçimlenir, gereksiz sıfır yazılmaz.
export function quantityText(amount, unit) {
  const value = Number(amount || 0);
  const text = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${text}${unit ? ' ' + unit : ''}`;
}
