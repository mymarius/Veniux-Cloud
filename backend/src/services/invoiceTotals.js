function invalid(message) { throw Object.assign(new Error(message), {status:400}); }
function calculate(items) {
  if (!Array.isArray(items) || !items.length || items.length > 500) invalid('1–500 fatura kalemi gereklidir.');
  let net = 0, tax = 0;
  const breakdown = {};
  const processedItems = items.map(item => {
    if (!item || typeof item !== 'object') invalid('Fatura kalemi geçersiz.');
    const values = [item.quantity, item.unit_price, item.kdv_rate];
    if (values.some(v => v === null || v === undefined || v === '' || !['number','string'].includes(typeof v))) invalid('Miktar, fiyat ve KDV oranını belirtin.');
    const [quantity, unit_price, kdv_rate] = values.map(Number);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || !Number.isFinite(unit_price) || unit_price < 0 || unit_price > 10000000 || !Number.isFinite(kdv_rate) || kdv_rate < 0 || kdv_rate > 100) invalid('Miktar, fiyat veya KDV oranı geçersiz.');
    const cents = Math.round((quantity * unit_price + Number.EPSILON) * 100);
    const taxCents = Math.round(cents * kdv_rate / 100);
    net += cents; tax += taxCents;
    if (!Number.isSafeInteger(net + tax)) invalid('Fatura tutarı izin verilen sınırı aşıyor.');
    breakdown[kdv_rate] = (breakdown[kdv_rate] || 0) + taxCents;
    return {product_id:item.product_id || null, description:item.description || 'Ürün',quantity,unit_price,kdv_rate,itemTotal:cents/100,itemKdvAmount:taxCents/100,totalPrice:(cents+taxCents)/100};
  });
  return {processedItems,subtotal:net/100,kdv_total:tax/100,grand_total:(net+tax)/100,kdvBreakdown:Object.fromEntries(Object.entries(breakdown).map(([k,v])=>[k,v/100]))};
}
module.exports = {calculate};
