import { useEffect, useState } from 'react';
import api from '../../api/client';

// Kasa kuralları: vardiya kapanışında izin verilen en büyük nakit farkı. Aşan farkı yalnız müdür/yönetici kapatır.
export default function PosPolicySettings() {
  const [limit, setLimit] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/scanner/pos-policy').then(r => setLimit(String(r.data.shiftDifferenceLimitCents / 100))).catch(() => setMessage('Kasa kuralları yüklenemedi.')); }, []);
  const save = async e => { e.preventDefault(); setBusy(true); try { const r = await api.put('/scanner/pos-policy', { shift_difference_limit: limit }); setLimit(String(r.data.shiftDifferenceLimitCents / 100)); setMessage('Kasa kuralı kaydedildi.'); } catch (err) { setMessage(err.response?.data?.error || 'Kaydedilemedi.'); } finally { setBusy(false); } };
  return <form onSubmit={save} className="veniux-card p-4 mt-4 space-y-3">
    <h2 className="font-semibold">Kasa kuralları</h2>
    <label className="block text-sm">Vardiya kapanışında izin verilen en büyük nakit farkı (TL)
      <input className="block border rounded-lg p-2 mt-1" inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value)} />
    </label>
    <p className="text-xs text-gray-500">Fark bu tutarı aşarsa kasiyer vardiyayı kapatamaz; müdür veya yönetici kapatır ve onaylayan kişi kayda geçer. 0 yazarsanız her farkı yönetici kapatır.</p>
    <button className="btn-primary" disabled={busy}>Kaydet</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
