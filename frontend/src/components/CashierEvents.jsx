import { formatMoney } from '../../../shared/money.mjs';
import { useEffect, useState } from 'react';
import api from '../api/client';

// Kasiyer hareketleri: fişten silinen ürünler ve benzeri işlemler, kasiyer bazında özetle. Kasa kaybını erken görmek için.
const day = d => d.toISOString().slice(0, 10);

export default function CashierEvents() {
  const [from, setFrom] = useState(() => day(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => day(new Date()));
  const [type, setType] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setError('');
    api.get('/scanner/pos-events', { params: { from, to, type: type || undefined } })
      .then(r => { if (live) setData(r.data); })
      .catch(() => { if (live) setError('Kasiyer hareketleri alınamadı.'); });
    return () => { live = false; };
  }, [from, to, type]);
  const items = data?.items || [];
  return <section className="space-y-4" aria-label="Kasiyer hareketleri">
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-sm">Başlangıç<input type="date" className="block border rounded-lg p-2 mt-1" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="text-sm">Bitiş<input type="date" className="block border rounded-lg p-2 mt-1" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label className="text-sm">Tür<select className="block border rounded-lg p-2 mt-1" value={type} onChange={e => setType(e.target.value)}>
        <option value="">Hepsi</option>{Object.entries(data?.types || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {data && data.summary.length > 0 && <div className="overflow-auto"><table className="w-full text-sm" aria-label="Kasiyer özeti">
      <thead><tr><th className="p-2 text-left">Kasiyer</th><th className="p-2">Fişten silinen ürün</th><th className="p-2">Boşaltılan sepet</th><th className="p-2">Satışsız çıkış</th></tr></thead>
      <tbody>{data.summary.map(s => <tr key={s.user} className="border-t"><td className="p-2">{s.user}</td><td className="p-2 text-center">{s.line_removed}</td><td className="p-2 text-center">{s.cart_cleared}</td><td className="p-2 text-center">{s.no_sale_exit}</td></tr>)}</tbody></table></div>}
    {data && items.length === 0 && <p className="text-slate-500">Bu aralıkta kayıt yok.</p>}
    {items.length > 0 && <div className="overflow-auto"><table className="w-full text-sm" aria-label="Hareket listesi">
      <thead><tr><th className="p-2 text-left">Zaman</th><th className="p-2 text-left">Kasiyer</th><th className="p-2 text-left">İşlem</th><th className="p-2 text-left">Ürün</th><th className="p-2 text-right">Adet</th><th className="p-2 text-right">Tutar</th></tr></thead>
      <tbody>{items.map(i => <tr key={i.id} className="border-t"><td className="p-2">{String(i.at).slice(0, 16).replace('T', ' ')}</td><td className="p-2">{i.user}</td><td className="p-2">{i.label}</td><td className="p-2">{i.product || '—'}</td><td className="p-2 text-right">{i.quantity ?? '—'}</td><td className="p-2 text-right">{i.amount != null ? formatMoney(i.amount) : '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}
