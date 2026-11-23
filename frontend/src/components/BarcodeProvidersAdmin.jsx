import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import api from '../api/client';

// Platform yöneticisi: barkod sağlayıcılarının sırası, açık/kapalı durumu ve son 30 günlük kalıcı kullanımı.
// Anahtar değerleri hiçbir zaman görünmez; yalnız "tanımlı mı" bilgisi gelir. Ücretli sağlayıcı anahtarı sunucu ortamında tanımlanır (VENIUX_BARCODELOOKUP_KEY).
const num = v => Number(v || 0).toLocaleString('tr-TR');

export default function BarcodeProvidersAdmin() {
  const [rows, setRows] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/retail/lookup/providers'); setRows([...data.providers].sort((a, b) => (a.order || 999) - (b.order || 999))); setMessage(''); }
    catch (e) { setRows(null); setMessage(e.response?.data?.error || 'Sağlayıcı durumu alınamadı.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(next) {
    setBusy(true); setMessage('');
    try {
      const body = { providers: next.map((p, i) => ({ id: p.id, enabled: !!p.enabled, position: (i + 1) * 10 })) };
      const { data } = await api.put('/retail/lookup/providers', body);
      setRows([...data.providers].sort((a, b) => (a.order || 999) - (b.order || 999)));
      setMessage('Kaydedildi.');
    } catch (e) { setMessage(e.response?.data?.error || 'Kaydedilemedi.'); }
    finally { setBusy(false); }
  }
  const toggle = id => save(rows.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  const move = (index, delta) => {
    const next = [...rows], j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    save(next);
  };

  if (!rows) return <section className="veniux-card p-5"><h2 className="font-semibold">Barkod sağlayıcıları</h2><p className="text-sm text-slate-500 mt-2">{message || 'Yükleniyor…'}</p></section>;
  return (
    <section className="veniux-card p-5 space-y-3" aria-label="Barkod sağlayıcıları">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Barkod sağlayıcıları</h2>
        <button type="button" className="btn-soft" onClick={load} disabled={busy}><RefreshCw size={14} /> Yenile</button>
      </div>
      <p className="text-sm text-slate-500">Ürün önerisi sırayla bu sağlayıcılardan aranır; ilk bulan kazanır. Ücretli sağlayıcı yalnız sunucuda anahtar tanımlıysa çalışır.</p>
      {message && <p role="status" className="text-sm">{message}</p>}
      <ul className="space-y-2">
        {rows.map((p, i) => (
          <li key={p.id} className="border rounded-lg p-3 flex flex-wrap items-center gap-3 justify-between">
            <div className="min-w-0">
              <b>{i + 1}. {p.name}</b> <small className="text-slate-500">({p.id}{p.local ? ' · yerel' : p.free ? ' · ücretsiz' : ' · ücretli'})</small>
              <div className="text-xs text-slate-500">
                {p.needs_key && !p.configured ? 'Anahtar tanımlı değil: etkin olamaz. ' : ''}
                {p.usage_30d ? `Son 30 gün: ${num(p.usage_30d.requests)} istek, ${num(p.usage_30d.found)} bulundu, ${num(p.usage_30d.missing)} bulunamadı, ${num(p.usage_30d.errors)} hata, ${num(p.usage_30d.cache_hits)} önbellek (${num(p.usage_30d.tenants)} işletme)` : 'Son 30 günde kullanım yok.'}
                {p.stats?.last_error ? ` · Son hata: ${p.stats.last_error}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-soft" aria-label="Yukarı" onClick={() => move(i, -1)} disabled={busy || i === 0}><ArrowUp size={14} /></button>
              <button type="button" className="btn-soft" aria-label="Aşağı" onClick={() => move(i, 1)} disabled={busy || i === rows.length - 1}><ArrowDown size={14} /></button>
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!p.enabled} disabled={busy || (p.needs_key && !p.configured)} onChange={() => toggle(p.id)} /> Açık</label>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
