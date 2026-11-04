const db = require('../config/database'),
  daily = require('./retailDailyService');
const fail = (s, status = 400) => {
  throw Object.assign(Error(s), {
    status
  });
};
const fields = ['sales_inc_vat_cents', 'sales_ex_vat_cents', 'discount_inc_vat_cents', 'discount_ex_vat_cents', 'returns_inc_vat_cents', 'returns_ex_vat_cents', 'net_inc_vat_cents', 'net_ex_vat_cents', 'cost_inc_vat_cents', 'cost_ex_vat_cents', 'blocked_return_cost_ex_vat_cents'];
const empty = () => ({
  ...Object.fromEntries(fields.map(k => [k, 0])),
  has_unknown_cost: false,
  has_unknown_vat: false,
  unknown_cost_quantity: 0
});
function date(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail('Geçerli rapor tarihi gerekli.');
  return s;
}
function finish(r) {
  for (const key of fields) if (!Number.isSafeInteger(r[key])) fail('Rapor tutarı sınırı aşıldı; tarih aralığını daraltın.');
  r.known_cost_ex_vat_cents = r.cost_ex_vat_cents;
  r.known_cost_inc_vat_cents = r.cost_inc_vat_cents;
  r.gross_profit_ex_vat_cents = r.has_unknown_cost || r.has_unknown_vat ? null : r.net_ex_vat_cents - r.cost_ex_vat_cents;
  r.gross_profit_inc_vat_cents = r.has_unknown_cost ? null : r.net_inc_vat_cents - r.cost_inc_vat_cents;
  if (r.has_unknown_cost) {
    r.cost_ex_vat_cents = null;
    r.cost_inc_vat_cents = null;
  }
  if (r.has_unknown_vat) for (const k of fields.filter(k => k.includes('ex_vat') && !k.includes('cost'))) r[k] = null;
  return r;
}
async function report(user, q = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Brüt kâr raporuna erişim yetkiniz yok.', 403);
  if (user.moduleType === 'PHARMACY') fail('Market raporu modülüne erişim yetkiniz yok.', 403);
  if (q.period && !['day', 'week', 'range'].includes(q.period)) fail('Geçersiz rapor dönemi.');
  for (const key of ['from', 'to', 'date']) if (q[key] !== undefined) date(q[key]);
  if (q.category !== undefined && (typeof q.category !== 'string' || q.category.length > 100)) fail('Geçersiz kategori filtresi.');
  const to = date(q.to || q.date || daily.businessDate()),
    from = date(q.from || (q.period === 'week' ? new Date(Date.parse(to) - 6 * 86400000).toISOString().slice(0, 10) : to));
  if (from > to) fail('Başlangıç tarihi bitiş tarihinden sonra olamaz.');
  for (const k of ['warehouse_id', 'product_id', 'cashier_id']) if (q[k] !== undefined && q[k] !== '' && (!/^\d+$/.test(String(q[k])) || Number(q[k]) < 1)) fail('Geçersiz rapor filtresi.');
  return db.transaction(async tx => {
    if (q.warehouse_id) await daily.warehouse(tx, user.tenantId, q.warehouse_id);
    const sales = (await tx.query('SELECT sale_id,user_id,business_date,warehouse_id,snapshot_json FROM retail_sales WHERE tenant_id=$1', [user.tenantId])).rows;
    const events = (await tx.query("SELECT sale_id,business_date,data_json FROM retail_reversals WHERE tenant_id=$1 AND kind='return' AND business_date>=$2 AND business_date<=$3", [user.tenantId, from, to])).rows;
    const rows = new Map(),
      options = {
        products: [],
        categories: [],
        cashiers: []
      },
      productMap = new Map(),
      cashierMap = new Map(),
      categorySet = new Set();
    let cancelledCount = 0;
    const include = (sale, line) => (!q.warehouse_id || Number(q.warehouse_id) === sale.warehouse_id) && (!q.cashier_id || Number(q.cashier_id) === sale.user_id) && (!q.product_id || Number(q.product_id) === line.product_id) && (!q.category || q.category === (line.category || 'Kaydedilmemiş'));
    const get = (sale, line, day) => {
      const key = JSON.stringify([day, line.product_id, line.barcode || '', line.category || 'Kaydedilmemiş', sale.user_id]);
      if (!rows.has(key)) rows.set(key, {
        date: day,
        product_id: line.product_id,
        product: line.name,
        barcode: String(line.barcode || ''),
        category: line.category || 'Kaydedilmemiş',
        cashier_id: sale.user_id,
        cashier: sale.snapshot.cashier,
        ...empty(),
        methods: []
      });
      return rows.get(key);
    };
    for (const s of sales) {
      s.snapshot = JSON.parse(s.snapshot_json);
      for (const l of s.snapshot.items) {
        productMap.set(l.product_id, l.name);
        categorySet.add(l.category || 'Kaydedilmemiş');
        cashierMap.set(s.user_id, s.snapshot.cashier);
      }
      if (s.snapshot.status === 'cancelled') {
        if (s.business_date >= from && s.business_date <= to && s.snapshot.items.some(l => include(s, l))) cancelledCount++;
        continue;
      }
      if (s.business_date < from || s.business_date > to) continue;
      for (const l of s.snapshot.items) {
        if (!include(s, l)) continue;
        const r = get(s, l, s.business_date);
        r.sales_inc_vat_cents += l.gross_cents;
        r.discount_inc_vat_cents += l.gross_cents - l.net_cents;
        r.net_inc_vat_cents += l.net_cents;
        if (l.net_ex_vat_cents == null) r.has_unknown_vat = true;else {
          r.sales_ex_vat_cents += l.gross_ex_vat_cents;
          r.discount_ex_vat_cents += l.discount_ex_vat_cents;
          r.net_ex_vat_cents += l.net_ex_vat_cents;
        }
        const parts = l.cost_snapshot?.parts;
        if (!parts?.length) {
          r.has_unknown_cost = true;
          r.unknown_cost_quantity += l.quantity;
        } else for (const p of parts) {
          if (!r.methods.includes(p.method)) r.methods.push(p.method);
          if (!p.known) {
            r.has_unknown_cost = true;
            r.unknown_cost_quantity += p.quantity;
          } else {
            r.cost_ex_vat_cents += p.cost_ex_vat_cents;
            r.cost_inc_vat_cents += p.cost_inc_vat_cents;
          }
        }
      }
    }
    for (const e of events) {
      const sale = sales.find(s => s.sale_id === e.sale_id);
      if (!sale || sale.snapshot.status === 'cancelled') continue;
      for (const i of JSON.parse(e.data_json).items) {
        const l = sale.snapshot.items.find(l => l.id === i.id);
        if (!l || !include(sale, l)) continue;
        const r = get(sale, l, e.business_date);
        r.returns_inc_vat_cents += i.amount_cents;
        r.net_inc_vat_cents -= i.amount_cents;
        if (i.refund_ex_vat_cents == null) r.has_unknown_vat = true;else {
          r.returns_ex_vat_cents += i.refund_ex_vat_cents;
          r.net_ex_vat_cents -= i.refund_ex_vat_cents;
        }
        if (!i.cost_version || !i.cost_parts?.length) {
          r.has_unknown_cost = true;
          r.unknown_cost_quantity -= i.disposition === 'saleable' ? i.quantity : 0;
          continue;
        }
        for (const p of i.cost_parts) {
          if (p.method && !r.methods.includes(p.method)) r.methods.push(p.method);
          if (!p.known) {
            r.has_unknown_cost = true;
            r.unknown_cost_quantity -= i.disposition === 'saleable' ? p.quantity : 0;
          } else if (i.disposition === 'saleable') {
            r.cost_ex_vat_cents -= p.cost_ex_vat_cents;
            r.cost_inc_vat_cents -= p.cost_inc_vat_cents;
          } else r.blocked_return_cost_ex_vat_cents += p.cost_ex_vat_cents;
        }
      }
    }
    const summary = empty();
    for (const r of rows.values()) {
      for (const f of fields) summary[f] += r[f];
      summary.has_unknown_cost ||= r.has_unknown_cost;
      summary.has_unknown_vat ||= r.has_unknown_vat;
      summary.unknown_cost_quantity += r.unknown_cost_quantity;
    }
    options.products = [...productMap].map(([id, name]) => ({
      id,
      name
    }));
    options.categories = [...categorySet];
    options.cashiers = [...cashierMap].map(([id, name]) => ({
      id,
      name
    }));
    const result = {
      from,
      to,
      access_scope:user.accessScope ? {mode:user.accessScope.mode,warehouse_ids:user.accessScope.warehouse_ids} : null,
      filters: {
        period: q.period || 'day',
        warehouse_id: q.warehouse_id ? String(q.warehouse_id) : '',
        product_id: q.product_id ? String(q.product_id) : '',
        category: q.category || '',
        cashier_id: q.cashier_id ? String(q.cashier_id) : ''
      },
      summary: finish(summary),
      cancelled_sales_excluded: cancelledCount,
      rows: [...rows.values()].map(finish).sort((a, b) => a.date.localeCompare(b.date) || a.product_id - b.product_id),
      options,
      method: 'Lot varsa kabul fiyatlarının lot içi miktar ağırlıklı ortalaması; lotsuz ürünlerde satış anındaki doğrulanmış ürün alış fiyatı. FEFO yalnızca lot seçimidir. Maliyet, KDV oranı ve kategori satış anında sabitlenir.',
      basis: 'Satış fiyatları KDV dahildir. Brüt kârın esas karşılaştırması KDV hariç net satış eksi KDV hariç maliyettir. KDV dahil fark ayrıca gösterilir.',
      scope: 'Brüt kâr net işletme kârı değildir. Kira, maaş ve diğer işletme giderleri kapsam dışıdır. Hasarlı/karantina iadelerinde maliyet otomatik geri kazanılmış sayılmaz; değerleme bekleyen tutar ayrı gösterilir. İadeler işlem tarihine, satışlar satış tarihine göre raporlanır. İptal edilmiş satışlar gelirden çıkarılır.'
    };
    result.fingerprint = require('crypto').createHash('sha256').update(JSON.stringify({from, to, filters: result.filters, access_scope:result.access_scope, rows: result.rows, summary: result.summary, cancelled: cancelledCount})).digest('hex');
    return result;
  });
}
function exportRows(data) {
  const headers = ['Tarih', 'Ürün', 'Barkod', 'Kategori', 'Kasiyer', 'Satış KDV dahil', 'Satış KDV hariç', 'İndirim KDV dahil', 'İndirim KDV hariç', 'İade KDV dahil', 'İade KDV hariç', 'Net satış KDV dahil', 'Net satış KDV hariç', 'Maliyet KDV dahil', 'Maliyet KDV hariç', 'Brüt kâr KDV hariç', 'KDV dahil fark', 'Hasarlı/karantina maliyeti KDV hariç', 'Bilinen maliyet alt toplamı KDV hariç', 'Eksik maliyet', 'Yöntem'];
  const metric = r => [r.sales_inc_vat_cents, r.sales_ex_vat_cents, r.discount_inc_vat_cents, r.discount_ex_vat_cents, r.returns_inc_vat_cents, r.returns_ex_vat_cents, r.net_inc_vat_cents, r.net_ex_vat_cents, r.cost_inc_vat_cents, r.cost_ex_vat_cents, r.gross_profit_ex_vat_cents, r.gross_profit_inc_vat_cents, r.blocked_return_cost_ex_vat_cents, r.known_cost_ex_vat_cents].map(v => v == null ? 'Bilinmiyor' : v / 100);
  const f = data.filters || {}, product = data.options.products.find(p => String(p.id) === f.product_id), cashier = data.options.cashiers.find(c => String(c.id) === f.cashier_id);
  return [headers, ...data.rows.map(r => [r.date, r.product, r.barcode, r.category, r.cashier, ...metric(r), r.has_unknown_cost ? 'Evet' : 'Hayır', r.methods.join(';')]), ['TOPLAM', '', '', '', '', ...metric(data.summary), data.summary.has_unknown_cost ? 'Evet' : 'Hayır', ''], [], ['Başlangıç tarihi', data.from], ['Bitiş tarihi', data.to], ['Dönem', f.period === 'range' ? 'Tarih aralığı' : f.period === 'week' ? 'Son 7 gün' : 'Günlük'], ['Depo kimliği', f.warehouse_id || (data.access_scope?.mode==='restricted'?'Yetkili depolar: '+data.access_scope.warehouse_ids.join(', '):'Tüm depolar')], ['Ürün filtresi', f.product_id ? `${f.product_id} · ${product?.name || 'Kayıt bulunamadı'}` : 'Tüm ürünler'], ['Kategori filtresi', f.category || 'Tüm kategoriler'], ['Kasiyer filtresi', f.cashier_id ? `${f.cashier_id} · ${cashier?.name || 'Kayıt bulunamadı'}` : 'Tüm kasiyerler'], ['Para birimi', 'TRY · Türk lirası'], ['Maliyet yöntemi', data.method], ['Hesaplama temeli', data.basis], ['Kapsam', data.scope], ['CSV açma', 'UTF-8, noktalı virgül ayırıcı, ondalık virgül. Barkod ve tarih sütunlarını metin olarak içe aktarın. Excel dosyasında bu sütunlar metin türündedir.']];
}
module.exports = {
  report,
  exportRows
};
