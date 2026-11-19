import { useEffect, useState } from 'react';
import api from '../api/client';

const money = cents => (Number(cents || 0) / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

// Birlikte satılan ürünler: bir ürün seçin, aynı fişte en çok hangi ürünlerin satıldığını görün (raf ve kampanya kararı için).
export default function TogetherReport() {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [picked, setPicked] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) { setFound([]); return undefined; }
    let live = true;
    const t = setTimeout(() => api.get('/scanner/search', { params: { q: query } }).then(r => { if (live) setFound(r.data); }).catch(() => { if (live) setFound([]); }), 250);
    return () => { live = false; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    if (!picked) return undefined;
    let live = true;
    setError(''); setData(null);
    api.get('/scanner/pro/together', { params: { product_id: picked.id } })
      .then(r => { if (live) setData(r.data); })
      .catch(e => { if (live) setError(e.response?.data?.error || 'Rapor alınamadı.'); });
    return () => { live = false; };
  }, [picked]);

  return <section className="space-y-4" aria-label="Birlikte satılan ürünler">
    <label className="text-sm block max-w-md">Ürün adı veya barkod
      <input className="block w-full border rounded-lg p-2 mt-1" value={query} onChange={e => { setQuery(e.target.value); setPicked(null); }} placeholder="Örn. Simit" autoComplete="off" />
    </label>
    {!picked && found.length > 0 && <div className="flex flex-wrap gap-2">{found.map(p => <button key={p.id} type="button" className="btn-secondary" onClick={() => { setPicked(p); setQuery(p.name); setFound([]); }}>{p.name}</button>)}</div>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {data && <>
      <p className="text-sm text-slate-600"><b>{data.product_name || picked?.name}</b> son 30 günde <b>{data.receipts}</b> fişte satıldı.</p>
      {data.items.length === 0 ? <p className="text-slate-500">Bu ürünle birlikte satılan başka ürün yok.</p> :
        <div className="overflow-auto"><table className="w-full text-sm" aria-label="Birlikte satılanlar">
          <thead><tr><th className="p-2 text-left">Ürün</th><th className="p-2 text-right">Birlikte fiş</th><th className="p-2 text-right">Oran</th><th className="p-2 text-right">Adet</th><th className="p-2 text-right">Tutar</th></tr></thead>
          <tbody>{data.items.map(i => <tr key={i.product_id} className="border-t"><td className="p-2">{i.name}</td><td className="p-2 text-right">{i.receipts}</td><td className="p-2 text-right">%{i.share_percent}</td><td className="p-2 text-right">{i.quantity}</td><td className="p-2 text-right">{money(i.net_cents)}</td></tr>)}</tbody></table></div>}
    </>}
  </section>;
}
