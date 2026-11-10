// Çevrimdışı satışta tutar hesabı. Yalnız kayıtlı fiyat × miktar (kuruş, satır başına yarıdan yukarı yuvarlama).
// Kampanya, sadakat, indirim, veresiye ve fiyat değişikliği çevrimdışı desteklenmez; bunlar sunucuda doğrulanır.
export const cents = value => Math.round(Number(value) * 100);
export function lineCents(unitPrice, quantity) { return Math.round(cents(unitPrice) * Number(quantity)); }

export function supportedOffline({ payment, discount, loyaltyCard, items }) {
  if (!['cash', 'credit_card'].includes(payment)) return 'Çevrimdışıyken yalnız nakit ve kart satış yapılır.';
  if (Number(discount) > 0) return 'Çevrimdışıyken indirim yapılamaz.';
  if (loyaltyCard) return 'Çevrimdışıyken sadakat kartı kullanılamaz.';
  if (items.some(i => i.override !== undefined)) return 'Çevrimdışıyken fiyat değiştirilemez.';
  return null;
}

// items: [{barcode,count,quantity?,manual_quantity?,product:{...},unit_price}] → toplamlar
export function offlineTotals(items) {
  const lines = items.map(i => {
    const quantity = i.manual_quantity ? Number(i.quantity) : Number(i.count);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Miktar geçersiz.');
    return { barcode: i.barcode, name: i.product?.name || i.barcode, quantity, unit_price: Number(i.unit_price), total_cents: lineCents(i.unit_price, quantity) };
  });
  return { lines, total_cents: lines.reduce((sum, l) => sum + l.total_cents, 0) };
}
export function offlineChange(totalCents, cashReceived, payment) {
  if (payment !== 'cash') return { cash_cents: 0, card_cents: totalCents, change_cents: 0 };
  const received = cashReceived === '' || cashReceived === undefined ? totalCents : cents(cashReceived);
  if (!Number.isFinite(received) || received < totalCents) throw new Error('Alınan nakit tutardan az.');
  return { cash_cents: totalCents, card_cents: 0, change_cents: received - totalCents };
}
