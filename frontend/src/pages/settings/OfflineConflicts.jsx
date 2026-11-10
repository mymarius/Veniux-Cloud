import { useState } from 'react';
import api from '../../api/client';

const when = v => v ? new Date(String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z')).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const number = v => Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 3 });

// Çevrimdışı satışlarda oluşan stok açıkları. Satış kayıtlıdır, stok eksiye düşmedi; fark stok düzeltmesiyle kapatıldı.
// Yönetici sayım yapıp doğrular ve "çözüldü" diye işaretler. Bu ekran stoğu değiştirmez; stok düzeltmesi stok ekranlarından yapılır.
export default function OfflineConflicts() {
  const [items, setItems] = useState(null), [status, setStatus] = useState('open'), [notes, setNotes] = useState({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const load = async (next = status) => {
    setBusy(true); setMessage('');
    try { setItems((await api.get('/scanner/offline-conflicts', { params: { status: next } })).data.items); setStatus(next); }
    catch (e) { setMessage(e.response?.data?.error || 'Uyuşmazlıklar alınamadı.'); }
    finally { setBusy(false); }
  };
  const resolve = async item => {
    setBusy(true); setMessage('');
    try { await api.put('/scanner/offline-conflicts/' + item.id + '/resolve', { note: notes[item.id] || '' }); await load(); setMessage('Uyuşmazlık kapatıldı.'); }
    catch (e) { setMessage(e.response?.data?.error || 'Kapatılamadı.'); setBusy(false); }
  };
  return <section className="veniux-card p-4 mt-4 space-y-3">
    <h2 className="font-semibold">Çevrimdışı uyuşmazlıklar</h2>
    <p className="text-sm">İnternet yokken yapılan satış, sunucuda stoktan fazla çıkarsa satış yine kaydedilir ve stok eksiye düşmez; fark burada görünür. Raftaki malı sayın, stoğu gerekiyorsa düzeltin, sonra "Çözüldü" deyin. Satış yapıldığı vardiya kapanmışsa satış açık vardiyaya alınır; bu da burada "—" açıkla ve açıklamayla görünür, ilgili vardiyanın nakit sayımını kontrol edin.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => load('open')}>Açık olanları yükle</button>
      <button type="button" className="btn-soft" disabled={busy} onClick={() => load('all')}>Tümünü göster</button>
    </div>
    {items && (items.length === 0 ? <p className="text-sm">Uyuşmazlık yok.</p> :
      <table className="w-full text-sm"><thead><tr><th className="text-left">Ürün</th><th className="text-right">Açık</th><th className="text-left">Fiş</th><th className="text-left">Geçici fiş</th><th className="text-left">Tarih</th><th className="text-left">Durum</th></tr></thead>
        <tbody>{items.map(i => <tr key={i.id}>
          <td>{i.product_name || 'Ürün #' + i.product_id}</td><td className="text-right">{i.kind === 'shift_moved' ? '—' : <b>{number(i.shortfall_quantity)}</b>}</td><td>{i.local_receipt_no || '—'}</td><td>{i.emergency_receipt_no || '—'}</td><td>{when(i.created_at)}</td>
          <td>{i.status === 'open'
            ? <span className="flex flex-wrap gap-2 items-center">{i.kind === 'shift_moved' && <span className="text-xs w-full">{i.note}</span>}<input aria-label={'Açıklama: ' + (i.product_name || i.product_id)} maxLength={500} placeholder="Ne yapıldı? (en az 5 karakter)" className="border rounded p-1" value={notes[i.id] || ''} onChange={e => setNotes({ ...notes, [i.id]: e.target.value })} /><button type="button" className="btn-soft" disabled={busy || (notes[i.id] || '').trim().length < 5} onClick={() => resolve(i)}>Çözüldü</button></span>
            : <span>Çözüldü{i.note ? ' · ' + i.note : ''}</span>}</td>
        </tr>)}</tbody></table>)}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
