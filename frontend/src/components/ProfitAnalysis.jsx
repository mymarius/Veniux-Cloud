import { formatMoney } from '../../../shared/money.mjs';
import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const daysAgo = n => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - n * 86400000));
const tl = cents => formatMoney((cents / 100));
const margin = v => (v === null || v === undefined ? '—' : (v < 0 ? '-%' : '%') + Math.abs(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 }));
const GROUPS = [['product', 'Ürün'], ['category', 'Kategori'], ['day', 'Gün'], ['week', 'Hafta'], ['month', 'Ay']];

// Kâr analizi: ürün/kategori/dönem bazında brüt kâr ve marj, en kârlı/zararlı ürünler, CSV. Yalnız yönetici/müdür (sunucu denetler).
export default function ProfitAnalysis({ warehouse }) {
  const [from, setFrom] = useState(() => daysAgo(29));
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState('product');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const params = { from, to, group_by: group, ...(warehouse ? { warehouse_id: warehouse } : {}) };
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setData((await api.get('/scanner/profit-analysis', { params: { from, to, group_by: group, ...(warehouse ? { warehouse_id: warehouse } : {}) } })).data); }
    catch (e) { setData(null); setError(e.response?.data?.error || 'Kâr analizi alınamadı.'); }
    finally { setBusy(false); }
  }, [from, to, group, warehouse]);
  useEffect(() => { load(); }, [load]);

  async function download() {
    try {
      const r = await api.get('/scanner/profit-analysis', { params: { ...params, format: 'csv' }, responseType: 'blob' });
      const url = URL.createObjectURL(r.data), a = document.createElement('a');
      a.href = url; a.download = `kar-analizi_${group}_${from}_${to}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError('Dosya indirilemedi. Bağlantıyı kontrol edip yeniden deneyin.'); }
  }

  const s = data?.summary;
  const cls = v => (v < 0 ? 'text-red-700' : v > 0 ? 'text-emerald-700' : '');
  const Rank = ({ title, rows, empty }) => (
    <div className="veniux-card p-3">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : (
        <ol className="space-y-1 text-sm">{rows.map(p => <li key={p.key} className="flex justify-between gap-3"><span className="truncate">{p.label}</span><span className={'font-semibold whitespace-nowrap ' + cls(p.gross_profit_ex_vat_cents)}>{tl(p.gross_profit_ex_vat_cents)} · {margin(p.margin_percent)}</span></li>)}</ol>
      )}
    </div>
  );

  return (
    <section className="veniux-card p-4 space-y-3" data-testid="profit-analysis">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-semibold">Kâr analizi</h2>
        <button type="button" className="btn-secondary" disabled={busy || !data} onClick={download}>CSV indir</button>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Başlangıç<input type="date" className="border rounded p-2 block" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
        <label className="text-sm">Bitiş<input type="date" className="border rounded p-2 block" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        <label className="text-sm">Grupla<select aria-label="Kâr analizi gruplaması" className="border rounded p-2 block" value={group} onChange={e => setGroup(e.target.value)}>{GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      {busy && <p role="status" className="text-sm">Analiz hazırlanıyor…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {s && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="veniux-card p-3"><div className="text-slate-500">Net satış (KDV hariç)</div><div className="text-xl font-bold">{tl(s.net_ex_vat_cents)}</div></div>
          <div className="veniux-card p-3"><div className="text-slate-500">Maliyet (KDV hariç)</div><div className="text-xl font-bold">{tl(s.cost_ex_vat_cents)}</div></div>
          <div className="veniux-card p-3"><div className="text-slate-500">Brüt kâr</div><div className={'text-xl font-bold ' + cls(s.gross_profit_ex_vat_cents)}>{tl(s.gross_profit_ex_vat_cents)}</div></div>
          <div className="veniux-card p-3"><div className="text-slate-500">Kâr marjı</div><div className={'text-xl font-bold ' + cls(s.gross_profit_ex_vat_cents)}>{margin(s.margin_percent)}</div></div>
        </div>
        {s.incomplete_rows > 0 && <p role="status" className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">{s.incomplete_rows} kayıtta maliyet veya alış KDV temeli bilinmiyor; bunlar kâra ve marja katılmadı (net satışları {tl(s.excluded_net_inc_vat_cents)} KDV dahil). Ürün kartında alış fiyatını girin.</p>}
        <div className="grid md:grid-cols-2 gap-3">
          <Rank title="En kârlı ürünler" rows={data.top_profitable} empty="Kârlı ürün yok." />
          <Rank title="Zarar eden ürünler" rows={data.top_loss} empty="Zarar eden ürün yok." />
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{[GROUPS.find(g => g[0] === data.group_by)[1], 'Net satış KDV hariç', 'Maliyet KDV hariç', 'Brüt kâr', 'Marj', 'Eksik maliyet'].map(h => <th key={h} className="text-left p-2 border-b">{h}</th>)}</tr></thead>
          <tbody>{data.groups.map(g => <tr key={g.key}><td className="p-2 border-b">{g.label}</td><td className="p-2 border-b">{tl(g.net_ex_vat_cents)}</td><td className="p-2 border-b">{tl(g.cost_ex_vat_cents)}</td><td className={'p-2 border-b font-semibold ' + cls(g.gross_profit_ex_vat_cents)}>{tl(g.gross_profit_ex_vat_cents)}</td><td className="p-2 border-b">{margin(g.margin_percent)}</td><td className="p-2 border-b">{g.incomplete_rows || ''}</td></tr>)}
            {data.groups.length === 0 && <tr><td className="p-3 text-slate-500" colSpan={6}>Bu tarih aralığında satış yok.</td></tr>}</tbody></table></div>
        <p className="text-xs text-slate-500">{data.note}</p>
      </>)}
    </section>
  );
}
