// Hızlı nakit düğmeleri: ödenecek tutarı karşılayan en yakın banknot basamakları (örn. 63 ₺ için 100 ve 200).
export const quickCash = due => {
  const d = Math.max(0, Number(due) || 0);
  return [50, 100, 200, 500].filter(v => v >= d).slice(0, 3);
};
