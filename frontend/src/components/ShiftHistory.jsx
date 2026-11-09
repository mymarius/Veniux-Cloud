import { useState } from 'react';
import api from '../api/client';

const tl = c => c === null || c === undefined ? '—' : (c / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const when = v => v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// Geçmiş vardiyalar: kasa, açan/kapatan, beklenen ve sayılan nakit, fark ve sınır aşımı onayı.
export default function ShiftHistory() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); setError(''); try { setData((await api.get('/scanner/shifts/history')).data); } catch (e) { setError(e.response?.data?.error || 'Vardiya geçmişi alınamadı.'); } finally { setBusy(false); } };
  return <section className="space-y-3 mt-6 vx-insights">
    <style>{'.vx-insights th,.vx-insights td{padding:4px 8px}'}</style>
    <div className="flex items-center gap-3"><h2 className="font-semibold">Geçmiş vardiyalar (son 30 gün)</h2><button type="button" className="btn-secondary" disabled={busy} onClick={load}>Getir</button></div>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {data && <>
      <p className="text-sm">{data.totals.closed} kapanış · toplam fark {tl(data.totals.total_difference_cents)} · eksik {tl(data.totals.shortage_cents)} · sınırı aşan {data.totals.over_limit}</p>
      <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Kasa</th><th className="text-left">Açan</th><th className="text-left">Açılış</th><th className="text-left">Kapanış</th><th className="text-right">Beklenen</th><th className="text-right">Sayılan</th><th className="text-right">Fark</th><th className="text-left">Gerekçe / onay</th></tr></thead>
        <tbody>{data.shifts.map(s => <tr key={s.id}><td>{s.register_name}{s.warehouse_name ? ' · ' + s.warehouse_name : ''}</td><td>{s.opened_by}</td><td>{when(s.opened_at)}</td><td>{s.status === 'open' ? 'Açık' : when(s.closed_at)}</td><td className="text-right">{tl(s.expected_cash_cents)}</td><td className="text-right">{tl(s.counted_cash_cents)}</td><td className="text-right" style={{ color: s.difference_cents < 0 ? '#b91c1c' : undefined }}>{tl(s.difference_cents)}</td><td>{s.difference_reason || ''}{s.approved_by ? ` · sınır aşımı onayı: ${s.approved_by}` : ''}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
