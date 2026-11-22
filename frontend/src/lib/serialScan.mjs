// Seri okutma: sayım, mal kabul ve alış ekranlarında barkod arka arkaya okutulur; her okutma satır ekler ya da adedi artırır.
// Saf mantık (arayüzden bağımsız test edilir). Ses/titreşim kararı burada, çalma işi bileşende.
import { findProduct } from './inboundEntry.mjs';

// Okuyucu ön/son ekini ve satır sonu/sekme karakterlerini temizler. cfg: { prefix, suffix } (Okuyucu ayarları).
export function normalizeScan(raw, cfg = {}) {
  const { prefix = '', suffix = '' } = cfg;
  let code = String(raw ?? '').replace(/[\r\n\t]+$/, '');
  if (suffix && code.endsWith(suffix)) code = code.slice(0, -suffix.length);
  if (prefix && code.startsWith(prefix)) code = code.slice(prefix.length);
  return code.replace(/[\x00-\x1f]/g, '').trim();
}

// EAN-8 / UPC-A / EAN-13 kontrol hanesi. Yanlış okunmuş etiketi ürün bulunamadığında ayırt etmek için kullanılır.
export function validCheckDigit(code) {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  let sum = 0;
  for (let i = code.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(code[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(code.at(-1));
}

// Okutulan kodu satırlara işler. opts.qtyKey: miktar alanı; opts.make(product, qty): yeni satır.
// Sonuç: { lines, status: 'added' | 'incremented' | 'notfound' | 'empty', product, quantity, code, hint }
export function scanIntoLines(lines, products, raw, opts = {}) {
  const { qtyKey = 'quantity', make, cfg, amount = 1 } = opts;
  const code = normalizeScan(raw, cfg);
  if (!code) return { lines, status: 'empty', product: null, quantity: 0, code };
  const product = findProduct(products, code);
  if (!product) {
    const numeric = /^\d{8}$|^\d{12,13}$/.test(code);
    return { lines, status: 'notfound', product: null, quantity: 0, code, hint: numeric && !validCheckDigit(code) ? 'checksum' : 'unknown' };
  }
  const qty = Math.max(1, Number(amount) || 1);
  const index = lines.findIndex(line => String(line.product_id) === String(product.id));
  if (index >= 0) {
    const quantity = Number(lines[index][qtyKey] || 0) + qty;
    return { lines: lines.map((line, i) => (i === index ? { ...line, [qtyKey]: quantity } : line)), status: 'incremented', product, quantity, code };
  }
  const row = make ? make(product, qty) : { product_id: product.id, [qtyKey]: qty };
  const blank = lines.findIndex(line => !line.product_id);
  const next = blank >= 0 && lines.length === 1 ? [row] : blank >= 0 ? lines.map((line, i) => (i === blank ? row : line)) : [...lines, row];
  return { lines: next, status: 'added', product, quantity: qty, code };
}

// Ekran/ses geri bildirimi: ton, ekran metni, ses türü ve titreşim kalıbı.
export function feedbackFor(result, label = '') {
  const name = result.product?.name || result.code || '';
  if (result.status === 'added') return { tone: 'ok', beep: 'success', vibrate: [40], text: `${name} eklendi (${result.quantity})` };
  if (result.status === 'incremented') return { tone: 'ok', beep: 'success', vibrate: [40], text: `${name} → ${result.quantity}` };
  if (result.status === 'notfound') {
    const why = result.hint === 'checksum' ? 'Barkod yanlış okunmuş olabilir (kontrol hanesi tutmuyor). Yeniden okutun.' : 'Bu barkod kayıtlı bir ürüne ait değil.';
    return { tone: 'error', beep: 'error', vibrate: [120, 60, 120], text: `${result.code}: ${why}${label ? ' ' + label : ''}`.trim() };
  }
  if (result.status === 'error') return { tone: 'error', beep: 'error', vibrate: [120, 60, 120], text: result.error || 'Okutma işlenemedi.' };
  if (result.status === 'shelf') return { tone: 'ok', beep: 'success', vibrate: [40], text: result.text || 'Raf seçildi.' };
  return { tone: 'error', beep: 'error', vibrate: [120], text: 'Okunan kod boş.' };
}

// Sayım ekranı (shared/countScan.mjs applyScan sonucu) için aynı geri bildirim biçimi.
export function feedbackForCount(result) {
  if (result.error) return { tone: 'error', beep: 'error', vibrate: [120, 60, 120], text: result.error };
  if (result.shelf) return { tone: 'ok', beep: 'success', vibrate: [40], text: 'Raf seçildi: ' + result.shelf };
  return { tone: 'ok', beep: 'success', vibrate: [40], text: result.row.product_name + ': ' + result.quantity };
}

// Oturum sayacı: son okutmalar ve toplamlar. Değişmez kullanılır (React durumu için).
export function tally(previous, result, now = Date.now()) {
  const base = previous || { total: 0, added: 0, incremented: 0, notfound: 0, recent: [] };
  if (result.status === 'empty') return base;
  const key = result.status === 'added' || result.status === 'incremented' || result.status === 'notfound' ? result.status : null;
  return {
    total: base.total + 1,
    added: base.added + (key === 'added' ? 1 : 0),
    incremented: base.incremented + (key === 'incremented' ? 1 : 0),
    notfound: base.notfound + (key === 'notfound' ? 1 : 0),
    recent: [{ code: result.code, status: result.status, name: result.product?.name || '', at: now }, ...base.recent].slice(0, 5)
  };
}
