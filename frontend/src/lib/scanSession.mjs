// Tarama oturumunun cihazdaki kaydı. Stok veya fiyat değiştirmez; gün değişince sayaçlar sıfırlanır.
const MAX_ROWS = 500;

export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function emptySession(day = dayKey()) {
  return { day, checks: [], list: [] };
}

export function parseSession(raw, day = dayKey()) {
  try {
    const value = JSON.parse(raw);
    if (value?.day !== day || !Array.isArray(value.checks) || !Array.isArray(value.list)) return emptySession(day);
    return { day, checks: value.checks.slice(0, MAX_ROWS), list: value.list.slice(0, MAX_ROWS) };
  } catch {
    return emptySession(day);
  }
}

function rowOf(result, code) {
  const product = result?.product;
  return { barcode: String(result?.barcode || code), id: product?.id ?? null, name: product?.name || 'Kayıtlı olmayan barkod', price: product ? Number(product.sale_price || 0) : null };
}

// Aynı barkod yeniden kontrol edilirse son karar geçerli olur, sayaç şişmez.
export function recordCheck(session, result, code, ok, at = new Date().toISOString()) {
  const row = { ...rowOf(result, code), ok: Boolean(ok), at };
  return { ...session, checks: [row, ...session.checks.filter(item => item.barcode !== row.barcode)].slice(0, MAX_ROWS) };
}

export function addToList(session, result, code) {
  const row = rowOf(result, code);
  if (session.list.some(item => item.barcode === row.barcode)) return session;
  return { ...session, list: [row, ...session.list].slice(0, MAX_ROWS) };
}

export function removeFromList(session, barcode) {
  return { ...session, list: session.list.filter(item => item.barcode !== barcode) };
}

export function checkTotals(session) {
  const right = session.checks.filter(item => item.ok).length;
  return { total: session.checks.length, right, wrong: session.checks.length - right };
}
