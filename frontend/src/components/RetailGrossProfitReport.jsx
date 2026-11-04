import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { validateReportDownload } from '../utils/grossProfitDownload';
const today = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Istanbul'
}).format(new Date());
const money = v => v == null ? 'Bilinmiyor' : (v / 100).toLocaleString('tr-TR', {
  style: 'currency',
  currency: 'TRY'
});
export default function RetailGrossProfitReport({
  warehouse
}) {
  const [period, setPeriod] = useState('day'),
    [date, setDate] = useState(today),
    [start, setStart] = useState(today),
    [product, setProduct] = useState(''),
    [category, setCategory] = useState(''),
    [cashier, setCashier] = useState(''),
    [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [downloading, setDownloading] = useState(false),
    [error, setError] = useState('');
  const request = useRef(0);
  const downloadLock = useRef(false), loadedParams = useRef('');
  const params = {
    warehouse_id: warehouse,
    period,
    from: period === 'range' ? start : period === 'week' && Number.isFinite(Date.parse(date)) ? new Date(Date.parse(date) - 6 * 86400000).toISOString().slice(0, 10) : date,
    to: date,
    ...(product ? {
      product_id: product
    } : {}),
    ...(category ? {
      category
    } : {}),
    ...(cashier ? {
      cashier_id: cashier
    } : {})
  };
  async function load() {
    if (!warehouse) return;
    const revision = ++request.current;
    setBusy(true);
    setError('');
    try {
      const res = await api.get('/scanner/gross-profit', {
        params
      });
      if (revision === request.current) {
        loadedParams.current = JSON.stringify(params);
        setData(res.data);
      }
    } catch (e) {
      if (revision === request.current) {
        setData(null);
        setError(e.response?.data?.error || 'Brüt kâr raporu alınamadı.');
      }
    } finally {
      if (revision === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      request.current++;
    };
  }, [warehouse, period, date, start, product, category, cashier]);
  async function download(format) {
    if (downloadLock.current || busy || !data) return;
    if (loadedParams.current !== JSON.stringify(params)) {
      setError('Filtreler değişti. Raporun hazırlanmasını bekleyip tekrar indirin.');
      return;
    }
    downloadLock.current = true;
    const exportRevision = request.current;
    setDownloading(true);
    setError('');
    try {
      const r = await api.get('/scanner/gross-profit', {
          params: {
            ...params,
            format,
            report_fingerprint: data.fingerprint
          },
          responseType: 'blob'
        });
      const file = await validateReportDownload(r, format, data);
      if (exportRevision !== request.current) throw new Error('Filtreler değişti. Raporu yenileyip tekrar indirin.');
      const url = URL.createObjectURL(file.blob),
        a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e.response?.status === 409 ? 'Rapor değişti. Raporu yenileyip tekrar indirin.' : !e.response && /^(Rapor değişti|İndirilen dosya|Filtreler değişti)/.test(e.message || '') ? e.message : 'Dosya indirilemedi. Bağlantıyı kontrol edip yeniden deneyin.');
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  }
  const s = data?.summary;
  return <section className="veniux-card p-4 space-y-3"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Brüt kâr · seçili depo</h2><div className="flex gap-2"><button className="btn-secondary" disabled={busy || downloading || !data} onClick={() => download('csv')}>CSV indir</button><button className="btn-secondary" disabled={busy || downloading || !data} onClick={() => download('xlsx')}>Excel indir</button><button className="btn-secondary" disabled={busy || downloading} onClick={load}>Raporu yenile</button></div></div>
 <div className="flex flex-wrap gap-3"><label className="text-sm">Dönem<select aria-label="Brüt kâr dönemi" className="border rounded p-2 block" value={period} onChange={e => setPeriod(e.target.value)}><option value="day">Günlük</option><option value="week">Haftalık · son 7 gün</option><option value="range">Tarih aralığı</option></select></label>{period === 'range' && <label className="text-sm">Başlangıç<input type="date" aria-label="Brüt kâr başlangıç tarihi" className="border rounded p-2 block" value={start} onChange={e => setStart(e.target.value)} /></label>}<label className="text-sm">{period === 'day' ? 'Tarih' : 'Bitiş'}<input type="date" aria-label="Brüt kâr bitiş tarihi" className="border rounded p-2 block" value={date} onChange={e => setDate(e.target.value)} /></label>
 <label className="text-sm">Ürün<select aria-label="Brüt kâr ürün filtresi" className="border rounded p-2 block" value={product} onChange={e => setProduct(e.target.value)}><option value="">Tüm ürünler</option>{data?.options.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="text-sm">Kategori<select aria-label="Brüt kâr kategori filtresi" className="border rounded p-2 block" value={category} onChange={e => setCategory(e.target.value)}><option value="">Tüm kategoriler</option>{data?.options.categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="text-sm">Kasiyer<select aria-label="Brüt kâr kasiyer filtresi" className="border rounded p-2 block" value={cashier} onChange={e => setCashier(e.target.value)}><option value="">Tüm kasiyerler</option>{data?.options.cashiers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
 {busy && <p role="status" className="text-sm">Rapor hazırlanıyor…</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{s && <><p className="text-xs text-slate-500">{data.from} – {data.to} · İptal edilmiş {data.cancelled_sales_excluded} satış gelirden çıkarıldı. Tutarlar TRY/kuruş temelindedir.</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[['Satış · indirim öncesi', 'sales'], ['İndirim', 'discount'], ['İade', 'returns'], ['Net satış', 'net'], ['Satılan ürün maliyeti', 'cost']].map(([label, key]) => <div key={key} className="bg-slate-50 p-3 rounded"><p className="text-xs text-slate-500">{label}</p><b>{money(s[key + '_ex_vat_cents'])}</b><p className="text-xs">KDV hariç</p><p className="text-xs mt-1">KDV dahil: {money(s[key + '_inc_vat_cents'])}</p></div>)}<div className="bg-slate-50 p-3 rounded"><p className="text-xs text-slate-500">Brüt kâr · KDV hariç</p><b>{money(s.gross_profit_ex_vat_cents)}</b><p className="text-xs mt-1">KDV dahil tutar farkı: {money(s.gross_profit_inc_vat_cents)}</p></div></div>
 {(s.has_unknown_cost || s.has_unknown_vat) && <p role="status" className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">{s.has_unknown_cost ? 'Maliyeti veya alış KDV temeli bilinmeyen kayıtlar var. Toplam maliyet ve brüt kâr tamamlanmış bir tutar olarak gösterilmez. Bilinen KDV hariç maliyet alt toplamı: ' + money(s.known_cost_ex_vat_cents) + '. ' : ''}{s.has_unknown_vat ? 'Satış anındaki KDV kaydı eksik; KDV hariç toplam hesaplanamadı.' : ''}</p>}
 <p className="text-sm">Hasarlı/karantina iadelerinde değerlemesi bekleyen maliyet (KDV hariç): {money(s.blocked_return_cost_ex_vat_cents)}. Bu ürünler satılabilir stok olarak değerlendirilmez.</p><p className="text-xs text-slate-500">{data.method}</p><p className="text-xs text-slate-500">{data.basis}</p><p className="text-xs text-slate-500">{data.scope}</p>
 <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Tarih', 'Ürün / kategori', 'Kasiyer', 'Net satış KDV dahil', 'Net satış KDV hariç', 'Maliyet KDV hariç', 'Brüt kâr KDV hariç', 'Maliyet durumu'].map(h => <th key={h} className="text-left p-2 border-b">{h}</th>)}</tr></thead><tbody>{data.rows.map((r, i) => <tr key={i}><td className="p-2 border-b">{r.date}</td><td className="p-2 border-b">{r.product}<small className="block">{r.category}</small></td><td className="p-2 border-b">{r.cashier}</td>{[r.net_inc_vat_cents, r.net_ex_vat_cents, r.cost_ex_vat_cents, r.gross_profit_ex_vat_cents].map((v, j) => <td key={j} className="p-2 border-b whitespace-nowrap">{money(v)}</td>)}<td className="p-2 border-b">{r.has_unknown_cost ? 'Eksik maliyet' : r.methods.includes('lot_receipt_weighted_average') ? 'Lot kabul maliyeti' : 'Satış anındaki kayıt'}</td></tr>)}{!data.rows.length && <tr><td colSpan="8" className="p-3 text-slate-500">Seçilen filtrelerde satış/iade kaydı yok.</td></tr>}</tbody></table></div></>}
 </section>;
}
