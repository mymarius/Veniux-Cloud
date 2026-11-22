// Kâr analizi: mevcut brüt kâr raporunun (retailProfitService) satırlarını ürün / grup / dönem bazında toplar,
// kâr marjını ve en kârlı / zararlı ürünleri çıkarır. Maliyet ve KDV hesabı yeniden yapılmaz; yalnız toplanır.
// Maliyeti veya KDV temeli bilinmeyen satırlar kâra katılmaz (sıfır sanılmasın diye) ve ayrıca sayılır.
const profit = require('./retailProfitService');
const daily = require('./retailDailyService');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

const GROUPS = ['product', 'category', 'day', 'week', 'month'];
const MAX_DAYS = 366;
const dayMs = 86400000;

const isoDate = ms => new Date(ms).toISOString().slice(0, 10);
const addDays = (date, n) => isoDate(Date.parse(date) + n * dayMs);
// Haftanın pazartesisi (hafta anahtarı).
const weekStart = date => { const d = new Date(date + 'T00:00:00Z'); return addDays(date, -((d.getUTCDay() + 6) % 7)); };
const pct = (profitCents, netCents) => (netCents > 0 ? Math.round((profitCents / netCents) * 10000) / 100 : null);

function groupOf(row, by) {
  if (by === 'product') return { key: String(row.product_id) + '|' + row.barcode, label: row.product, extra: { product_id: row.product_id, barcode: row.barcode, category: row.category } };
  if (by === 'category') return { key: row.category, label: row.category };
  if (by === 'month') return { key: row.date.slice(0, 7), label: row.date.slice(0, 7) };
  if (by === 'week') { const s = weekStart(row.date); return { key: s, label: s + ' haftası' }; }
  return { key: row.date, label: row.date };
}

function add(target, row) {
  target.rows++;
  // Bilinmeyen KDV/maliyet: net ve kâr hesabına katma, ayrı say.
  if (row.gross_profit_ex_vat_cents === null || row.net_ex_vat_cents === null || row.cost_ex_vat_cents === null) {
    target.incomplete_rows++;
    target.excluded_net_inc_vat_cents += row.net_inc_vat_cents || 0;
    return;
  }
  target.net_ex_vat_cents += row.net_ex_vat_cents;
  target.cost_ex_vat_cents += row.cost_ex_vat_cents;
  target.gross_profit_ex_vat_cents += row.gross_profit_ex_vat_cents;
}
const blank = () => ({ rows: 0, incomplete_rows: 0, excluded_net_inc_vat_cents: 0, net_ex_vat_cents: 0, cost_ex_vat_cents: 0, gross_profit_ex_vat_cents: 0 });
const finish = g => ({ ...g, margin_percent: pct(g.gross_profit_ex_vat_cents, g.net_ex_vat_cents) });

function range(q) {
  const to = q.to || daily.businessDate();
  const from = q.from || addDays(to, -29);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) fail('Geçerli tarih aralığı gerekli.');
  if (from > to) fail('Başlangıç tarihi bitiş tarihinden sonra olamaz.');
  if ((Date.parse(to) - Date.parse(from)) / dayMs >= MAX_DAYS) fail('Tarih aralığı en fazla 1 yıl olabilir.');
  return { from, to };
}

async function analyze(user, q = {}) {
  const by = q.group_by || 'product';
  if (!GROUPS.includes(by)) fail('Gruplama ürün, kategori, gün, hafta veya ay olmalıdır.');
  const { from, to } = range(q);
  const limit = Math.min(50, Math.max(1, Number(q.limit) || 10));
  const filters = { period: 'range', from, to };
  for (const k of ['warehouse_id', 'category', 'product_id']) if (q[k] !== undefined && q[k] !== '') filters[k] = q[k];
  const data = await profit.report(user, filters); // admin/manager ve modül yetkisi burada denetlenir

  const total = blank(), groups = new Map(), products = new Map();
  for (const row of data.rows) {
    add(total, row);
    const g = groupOf(row, by);
    if (!groups.has(g.key)) groups.set(g.key, { key: g.key, label: g.label, ...(g.extra || {}), ...blank() });
    add(groups.get(g.key), row);
    const p = groupOf(row, 'product');
    if (!products.has(p.key)) products.set(p.key, { key: p.key, label: p.label, ...p.extra, ...blank() });
    add(products.get(p.key), row);
  }
  const list = [...groups.values()].map(finish);
  if (by === 'product' || by === 'category') list.sort((a, b) => b.gross_profit_ex_vat_cents - a.gross_profit_ex_vat_cents || a.label.localeCompare(b.label, 'tr'));
  else list.sort((a, b) => a.key.localeCompare(b.key));
  const ranked = [...products.values()].map(finish).filter(p => p.rows > p.incomplete_rows);
  const top_profitable = ranked.filter(p => p.gross_profit_ex_vat_cents > 0).sort((a, b) => b.gross_profit_ex_vat_cents - a.gross_profit_ex_vat_cents).slice(0, limit);
  const top_loss = ranked.filter(p => p.gross_profit_ex_vat_cents < 0).sort((a, b) => a.gross_profit_ex_vat_cents - b.gross_profit_ex_vat_cents).slice(0, limit);
  const unknown_cost_products = [...products.values()].filter(p => p.incomplete_rows > 0).map(p => ({ product_id: p.product_id, product: p.label, barcode: p.barcode })).slice(0, 50);
  return {
    from, to, group_by: by,
    summary: finish(total),
    groups: list,
    top_profitable, top_loss, unknown_cost_products,
    cancelled_sales_excluded: data.cancelled_sales_excluded,
    note: 'Brüt kâr KDV hariç net satış eksi KDV hariç maliyettir; kira, maaş ve diğer giderler dahil değildir. Maliyeti bilinmeyen satırlar kâra ve marja katılmaz, ayrıca sayılır.'
  };
}

const LABELS = { product: 'Ürün', category: 'Kategori', day: 'Gün', week: 'Hafta', month: 'Ay' };
const tl = cents => Math.round(cents) / 100;

function exportRows(data) {
  const head = [LABELS[data.group_by], 'Net satış KDV hariç', 'Maliyet KDV hariç', 'Brüt kâr KDV hariç', 'Kâr marjı %', 'Maliyeti bilinmeyen kayıt'];
  const line = g => [g.label, tl(g.net_ex_vat_cents), tl(g.cost_ex_vat_cents), tl(g.gross_profit_ex_vat_cents), g.margin_percent === null ? '' : g.margin_percent, g.incomplete_rows];
  return [head, ...data.groups.map(line), line({ ...data.summary, label: 'TOPLAM' }), [], ['Başlangıç tarihi', data.from], ['Bitiş tarihi', data.to], ['Not', data.note]];
}

module.exports = { analyze, exportRows, GROUPS };
