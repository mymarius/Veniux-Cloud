import { useState } from 'react';
import api from '../../api/client';

const when = v => v ? new Date(String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z')).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// Kasa cihazları: ilk satışta kendiliğinden eklenir; paket cihaz sınırı içinde kalır. Kaldırılan cihaz satış yapamaz.
export default function PosDevices() {
  const [data, setData] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const load = async () => { try { setData((await api.get('/scanner/devices')).data); setMessage(''); } catch (e) { setMessage(e.response?.data?.error || 'Kasa cihazları alınamadı.'); } };
  const change = async (d, status) => {
    if (status === 'revoked' && !window.confirm(`${d.label} kaldırılsın mı? Bu cihaz yeniden eklenene kadar satış yapamaz.`)) return;
    setBusy(true);
    try { await api.put('/scanner/devices/' + d.id, { status }); await load(); setMessage(status === 'revoked' ? 'Cihaz kaldırıldı.' : 'Cihaz yeniden etkinleştirildi.'); }
    catch (e) { setMessage(e.response?.data?.error || 'Değiştirilemedi.'); } finally { setBusy(false); }
  };
  return <section className="veniux-card p-4 mt-4 space-y-3">
    <h2 className="font-semibold">Kasa cihazları</h2>
    <p className="text-sm">Bir kasa ekranı ilk satışını yaptığında burada görünür. Paketinizin cihaz sınırı aşılırsa yeni kasa satış yapamaz; kullanılmayan cihazı kaldırın.</p>
    <button type="button" className="btn-secondary" onClick={load}>Cihazları yükle</button>
    {data && <>
      <p className="text-sm">Etkin: {data.active}{data.limit ? ` / ${data.limit}` : ''}</p>
      {data.devices.length === 0 ? <p className="text-sm">Henüz satış yapan kasa cihazı yok.</p> :
        <table className="w-full text-sm"><thead><tr><th className="text-left">Cihaz</th><th className="text-left">Kasa</th><th className="text-left">Son görülme</th><th className="text-left">Durum</th><th /></tr></thead>
          <tbody>{data.devices.map(d => <tr key={d.id}><td>{d.label}</td><td>{d.register_name || '—'}</td><td>{when(d.last_seen_at)}</td><td>{d.status === 'active' ? 'Etkin' : 'Kaldırıldı'}</td>
            <td>{d.status === 'active' ? <button type="button" className="btn-soft" disabled={busy} onClick={() => change(d, 'revoked')}>Kaldır</button> : <button type="button" className="btn-soft" disabled={busy} onClick={() => change(d, 'active')}>Etkinleştir</button>}</td></tr>)}</tbody></table>}
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
