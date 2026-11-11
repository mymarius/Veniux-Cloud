import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

// Platform yöneticisi: müşterilere Hırdavat, Züccaciye ve Pide/Restoran paketlerini verir ya da geri alır.
// Sözleşmesi (paket kataloğundan onaylı) olan işletmelerde paket sözleşmenin modüllerinden gelir; burada verilen kayıt yalnız sözleşmesiz işletmelerde geçerlidir.
export default function SectorPackAdmin() {
  const [data, setData] = useState(null), [draft, setDraft] = useState({}), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(0), [query, setQuery] = useState('');
  const load = async () => {
    try {
      const response = await api.get('/sector/packs/admin');
      setData(response.data);
      setDraft(Object.fromEntries(response.data.tenants.map(t => [t.id, [...t.packs]])));
      setError('');
    } catch (e) { setError(e.response?.data?.error || 'Sektör paketleri yüklenemedi.'); }
  };
  useEffect(() => { load(); }, []);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    return (data?.tenants || []).filter(t => !needle || String(t.company_name).toLocaleLowerCase('tr').includes(needle) || String(t.id) === needle);
  }, [data, query]);
  const toggle = (id, pack) => setDraft(d => ({ ...d, [id]: d[id].includes(pack) ? d[id].filter(p => p !== pack) : [...d[id], pack] }));
  const dirty = t => [...(draft[t.id] || [])].sort().join() !== [...t.packs].sort().join();
  const save = async t => {
    setBusy(t.id); setNotice(''); setError('');
    try {
      await api.put('/sector/packs/admin/' + t.id, { packs: draft[t.id] });
      setNotice((t.company_name || 'İşletme #' + t.id) + ' için sektör paketleri kaydedildi.');
      await load();
    } catch (e) { setError(e.response?.data?.error || 'Kayıt tamamlanamadı.'); } finally { setBusy(0); }
  };
  if (!data && !error) return <section className="veniux-card p-5" aria-busy="true"><p role="status">Sektör paketleri yükleniyor…</p></section>;
  return <section className="veniux-card p-5 space-y-4" aria-labelledby="sector-pack-admin">
    <header>
      <h2 id="sector-pack-admin" className="text-xl font-semibold">Sektör paketlerini müşterilere ver</h2>
      <p className="text-sm text-slate-600">Her paket ayrı satılır. Seçip kaydettiğiniz işletme, paketin ekranlarını (telefonda ve masaüstünde) hemen görür. Sözleşmesi olan işletmelerde paket sözleşmeden gelir.</p>
    </header>
    {error && <p role="alert" className="text-sm font-semibold" style={{ color: '#b92c1c' }}>{error}</p>}
    {notice && <p role="status" className="text-sm font-semibold" style={{ color: '#0d7a57' }}>{notice}</p>}
    <label className="block max-w-md"><span className="sr-only">İşletme ara</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="İşletme adı ya da numarası ara…" aria-label="İşletme ara" /></label>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left"><th scope="col" className="py-2 pr-3">İşletme</th>{(data?.packs || []).map(p => <th key={p} scope="col" className="py-2 pr-3">{(data.labels[p] || p).replace(' paketi', '')}</th>)}<th scope="col" className="py-2"><span className="sr-only">Kaydet</span></th></tr></thead>
      <tbody>{rows.map(t => <tr key={t.id} className="border-t">
        <th scope="row" className="py-2 pr-3 text-left font-semibold">{t.company_name || 'İşletme'} <span className="font-normal text-slate-500">#{t.id}</span></th>
        {data.packs.map(p => <td key={p} className="py-2 pr-3"><input type="checkbox" aria-label={(t.company_name || 'İşletme #' + t.id) + ' · ' + (data.labels[p] || p)} checked={(draft[t.id] || []).includes(p)} onChange={() => toggle(t.id, p)} style={{ width: 20, height: 20, minHeight: 0 }} /></td>)}
        <td className="py-2 text-right"><button type="button" className="button" disabled={!dirty(t) || busy === t.id} onClick={() => save(t)}>{busy === t.id ? 'Kaydediliyor…' : 'Kaydet'}</button></td>
      </tr>)}
      {rows.length === 0 && <tr><td colSpan={(data?.packs.length || 3) + 2} className="py-4 text-slate-500">Eşleşen işletme yok.</td></tr>}</tbody>
    </table></div>
  </section>;
}
