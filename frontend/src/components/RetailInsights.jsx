import { useState } from 'react';
import api from '../api/client';
import RetailForecast from './RetailForecast';

const tl = c => (c / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const today = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

// En çok satanlar, kasiyer bazlı satış, saat bazlı yoğunluk ve ölü stok. Kâr/zarar için brüt kâr raporu kullanılır.
export default function RetailInsights() {
  const [from, setFrom] = useState(new Date(Date.now() + 3 * 3600000 - 29 * 86400000).toISOString().slice(0, 10)), [to, setTo] = useState(today());
  const [data, setData] = useState(null), [dead, setDead] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setError('');
    try {
      const [a, b] = await Promise.all([api.get('/scanner/pro/insights', { params: { from, to } }), api.get('/stock/dead-stock', { params: { days: 60 } })]);
      setData(a.data); setDead(b.data);
    } catch (e) { setError(e.response?.data?.error || 'Rapor alınamadı.'); } finally { setBusy(false); }
  };
  const peak = data ? Math.max(1, ...data.hours.map(h => h.receipts)) : 1;
  return <section className="space-y-4 mt-6 vx-insights">
    <style>{'.vx-insights th,.vx-insights td{padding:4px 8px}'}</style>
    <h2 className="font-semibold">Satış raporları</h2>
    <div className="flex flex-wrap gap-2 items-end">
      <label className="text-sm">Başlangıç<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="text-sm">Bitiş<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <button type="button" className="btn-secondary" disabled={busy} onClick={load}>Raporları getir</button>
    </div>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {data && <>
      <h3 className="font-semibold">En çok satanlar (ciro)</h3>
      <table className="w-full text-sm"><thead><tr><th className="text-left">Ürün</th><th className="text-right">Miktar</th><th className="text-right">Net satış</th></tr></thead><tbody>{data.top_by_revenue.map(p => <tr key={p.product_id}><td>{p.name}</td><td className="text-right">{p.quantity.toLocaleString('tr-TR')} {p.unit}</td><td className="text-right">{tl(p.net_cents)}</td></tr>)}</tbody></table>
      {data.registers?.length > 0 && <><h3 className="font-semibold">Kasa bazlı satış</h3><table className="w-full text-sm"><thead><tr><th className="text-left">Kasa</th><th className="text-right">Fiş</th><th className="text-right">Net satış</th><th className="text-right">İade</th><th className="text-right">Kapanan vardiya</th><th className="text-right">Kasa farkı</th><th className="text-right">İade/iptal adedi</th></tr></thead><tbody>{data.registers.map(r => <tr key={r.register_id ?? 'none'}><td>{r.name}</td><td className="text-right">{r.receipts}</td><td className="text-right">{tl(r.net_cents)}</td><td className="text-right">{tl(r.refunded_cents)}</td></tr>)}</tbody></table></>}
      <h3 className="font-semibold">Kasiyer bazlı satış</h3>
      <table className="w-full text-sm"><thead><tr><th className="text-left">Kasiyer</th><th className="text-right">Fiş</th><th className="text-right">Net satış</th><th className="text-right">Ortalama fiş</th><th className="text-right">İndirim</th><th className="text-right">İade</th></tr></thead><tbody>{data.cashiers.map(c => <tr key={c.user_id}><td>{c.name || c.email}</td><td className="text-right">{c.receipts}</td><td className="text-right">{tl(c.net_cents)}</td><td className="text-right">{tl(c.average_cents)}</td><td className="text-right">{tl(c.discount_cents)}</td><td className="text-right">{tl(c.refunded_cents)}</td><td className="text-right">{c.shifts_closed}</td><td className="text-right" style={c.difference_cents<0?{color:'#b42318',fontWeight:650}:undefined}>{c.shifts_closed?tl(c.difference_cents):'—'}</td><td className="text-right">{c.reversal_count}</td></tr>)}</tbody></table>
      <h3 className="font-semibold">Saat bazlı yoğunluk{data.busiest_hour !== null ? ` · en yoğun saat ${String(data.busiest_hour).padStart(2, '0')}:00` : ''}</h3>
      <div className="space-y-1">{data.hours.filter(h => h.receipts).map(h => <div key={h.hour} className="flex items-center gap-2 text-sm"><span className="w-14">{String(h.hour).padStart(2, '0')}:00</span><span aria-hidden="true" style={{ display: 'inline-block', height: 10, width: `${Math.round(h.receipts / peak * 60)}%`, background: 'currentColor', opacity: 0.4 }} /><span>{h.receipts} fiş · {tl(h.net_cents)}</span></div>)}</div>
    </>}
    {dead && <>
      <h3 className="font-semibold">Ölü stok (son {dead.days} günde çıkışı olmayan) · {dead.count} kalem · bağlı maliyet {tl(dead.total_value_cents)}</h3>
      <table className="w-full text-sm"><thead><tr><th className="text-left">Ürün</th><th className="text-left">Depo</th><th className="text-right">Miktar</th><th className="text-right">Maliyet</th><th className="text-left">Son çıkış</th></tr></thead><tbody>{dead.items.slice(0, 50).map(i => <tr key={i.product_id + '-' + i.warehouse_id}><td>{i.name}</td><td>{i.warehouse}</td><td className="text-right">{i.quantity}</td><td className="text-right">{tl(i.value_cents)}</td><td>{i.last_outbound_at ? String(i.last_outbound_at).slice(0, 10) : 'hiç'}</td></tr>)}</tbody></table>
    </>}
    <RetailForecast />
  </section>;
}
