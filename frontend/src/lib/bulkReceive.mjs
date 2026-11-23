// Toplu mal kabul: okutulan kalemlerin listesi. Saf mantık; arayüzden bağımsız test edilir.
// Satır: { id, kind:'existing'|'new', barcode, name, quantity, product_id?, pack?, unit?, purchase_price?, sale_price?, source? }
export const MAX_LINES = 500;
export const UNITS = ['adet', 'paket', 'kutu', 'kg', 'litre', 'metre'];

const norm = code => String(code ?? '').trim();
// Baştaki sıfırlı/sıfırsız GTIN eşdeğeri aynı ürün sayılır (sunucudaki arama ile aynı kural).
const same = (a, b) => { const x = norm(a), y = norm(b); return !!x && (x === y || (/^\d+$/.test(x) && /^\d+$/.test(y) && x.replace(/^0+/, '') === y.replace(/^0+/, ''))); };

let seq = 0;
export const newId = () => 'r' + (++seq) + '-' + Math.random().toString(36).slice(2, 7);

// Aynı barkod listede varsa miktarı artırır, yoksa yeni satır ekler. Sonuç: { rows, status:'added'|'incremented', row }
export function addEntry(rows, entry, step = 1) {
  const add = Math.max(1, Math.floor(Number(step)) || 1);
  const i = rows.findIndex(r => same(r.barcode, entry.barcode) || (entry.product_id && r.product_id === entry.product_id && (r.pack?.unit ?? null) === (entry.pack?.unit ?? null)));
  if (i >= 0) {
    const row = { ...rows[i], quantity: rows[i].quantity + add };
    return { rows: rows.map((r, k) => (k === i ? row : r)), status: 'incremented', row };
  }
  const row = { id: newId(), quantity: add, ...entry };
  return { rows: [...rows, row], status: 'added', row };
}

export const setQuantity = (rows, id, value) => rows.map(r => (r.id === id ? { ...r, quantity: Math.min(1000000, Math.max(0, Math.floor(Number(value)) || 0)) } : r));
export const patchRow = (rows, id, patch) => rows.map(r => (r.id === id ? { ...r, ...patch } : r));
export const removeRow = (rows, id) => rows.filter(r => r.id !== id);

const cents = v => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && String(v).trim() !== '' ? n : NaN; };
const twoDecimals = n => Math.abs(n * 100 - Math.round(n * 100)) <= 0.00001;

// Satırın kayda hazır olması için eksikleri. Boş dizi = hazır.
export function rowIssues(row) {
  const out = [];
  if (!Number.isSafeInteger(row.quantity) || row.quantity < 1) out.push('Miktar 1 veya daha fazla olmalı.');
  if (row.kind === 'new') {
    if (!String(row.name || '').trim()) out.push('Ürün adı gerekli.');
    for (const [field, label] of [['purchase_price', 'Alış fiyatı'], ['sale_price', 'Satış fiyatı']]) {
      const n = cents(row[field]);
      if (!Number.isFinite(n) || n < 0 || n > 10000000 || !twoDecimals(n)) out.push(label + ' gerekli (en fazla iki ondalık).');
    }
    if (!UNITS.includes(row.unit)) out.push('Birim seçin.');
  }
  return out;
}

export const readiness = rows => {
  const problems = rows.map(r => ({ id: r.id, issues: rowIssues(r) })).filter(p => p.issues.length);
  return { ready: rows.length > 0 && problems.length === 0, problems, lines: rows.length, units: rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0), news: rows.filter(r => r.kind === 'new').length };
};

// Sunucu gövdesi. Koli/paket barkodu okutulduysa barkod gönderilir, sunucu temel birime çevirir.
export function toLines(rows) {
  return rows.map(r => (r.kind === 'new'
    ? { barcode: r.barcode || undefined, name: String(r.name).trim(), unit: r.unit, purchase_price: cents(r.purchase_price), sale_price: cents(r.sale_price), quantity: r.quantity }
    : { product_id: r.product_id, barcode: r.barcode || undefined, quantity: r.quantity }));
}

export function chunk(rows, size = MAX_LINES) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

// Taslak kaydı/okuması: bozuk ya da eski biçim sessizce yok sayılır.
export function parseDraft(text) {
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.rows)) return null;
    const rows = data.rows.filter(r => r && typeof r === 'object' && (r.kind === 'new' || r.kind === 'existing') && Number.isSafeInteger(r.quantity)).slice(0, 5000).map(r => ({ ...r, id: r.id || newId() }));
    return { rows, warehouse: data.warehouse ? String(data.warehouse) : '' };
  } catch { return null; }
}
export const serializeDraft = (rows, warehouse) => JSON.stringify({ v: 1, warehouse, rows });
