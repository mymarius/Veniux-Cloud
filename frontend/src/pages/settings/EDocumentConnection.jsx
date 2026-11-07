import { useEffect, useState } from 'react';
import api from '../../api/client';

const errorOf = (e, fallback) => e.response?.data?.error || fallback;
const STATE = { draft: 'Taslak', sending: 'Gönderiliyor', sent: 'Gönderildi', rejected: 'Reddedildi', unknown: 'Sonucu belirsiz', retry: 'Yeniden gönderilebilir' };

export default function EDocumentConnection() {
  const [status, setStatus] = useState(null), [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({ username: '', password: '' }), [vkn, setVkn] = useState('');
  const [busy, setBusy] = useState(false), [note, setNote] = useState(null);
  const load = async () => {
    const [connection, list] = await Promise.all([api.get('/edocuments/connection'), api.get('/edocuments')]);
    setStatus(connection.data); setDocuments(list.data || []);
  };
  useEffect(() => { load().catch(() => setNote({ error: true, text: 'e-Belge ayarını yalnız firma genelinde yetkili yönetici görebilir.' })); }, []);
  const run = async (work, done) => {
    setBusy(true); setNote(null);
    try { const { data } = await work(); setNote({ text: done(data) }); await load(); } catch (e) { setNote({ error: true, text: errorOf(e, 'İşlem tamamlanamadı.') }); await load().catch(() => {}); } finally { setBusy(false); }
  };
  const save = e => { e.preventDefault(); run(async () => { const r = await api.put('/edocuments/connection', form); setForm({ username: '', password: '' }); return r; }, () => 'Hesap kaydedildi. Bağlantıyı deneyin.'); };
  return <section className="veniux-card p-5 space-y-4" aria-label="e-Belge">
    <div><h2 className="font-semibold">e-Fatura ve e-Arşiv</h2><p className="text-sm text-slate-500">Kendi entegratör hesabınızı bağlarsınız. Bu sürümde mükellef sorgulama çalışır; <strong>gerçek belge gönderimi henüz açık değildir.</strong></p></div>
    <form className="grid sm:grid-cols-2 gap-3" onSubmit={save}>
      <label className="text-sm">Kullanıcı adı<input className="block w-full" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} autoComplete="off" required /></label>
      <label className="text-sm">Parola<input className="block w-full" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required /></label>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy}>Kaydet</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={() => run(() => api.post('/edocuments/connection/test'), () => 'Bağlantı çalışıyor.')}>Bağlantıyı dene</button>
        <button type="button" className="btn-soft" disabled={busy || !status?.connected} onClick={() => run(() => api.delete('/edocuments/connection'), () => 'Hesap bağlantısı kaldırıldı.')}>Bağlantıyı kaldır</button>
      </div>
    </form>
    <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); run(() => api.post('/edocuments/taxpayer', { vkn }), d => d.registered ? 'e-Fatura mükellefi. Önerilen belge: e-Fatura.' : 'e-Fatura mükellefi değil. Önerilen belge: e-Arşiv.'); }}>
      <label className="text-sm">Mükellef sorgula<input className="block" value={vkn} onChange={e => setVkn(e.target.value)} inputMode="numeric" pattern="\d{10,11}" placeholder="VKN veya TCKN" required /></label>
      <button className="btn-soft" disabled={busy || !status?.connected}>Sorgula</button>
    </form>
    {note && <p role={note.error ? 'alert' : 'status'} className={note.error ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold text-emerald-700'}>{note.text}</p>}
    {documents.length > 0 && <table className="w-full text-sm"><thead><tr><th className="text-left">Satış</th><th className="text-left">Tür</th><th className="text-left">Durum</th></tr></thead><tbody>{documents.map(d => <tr key={d.id}><td>{d.sale_id}</td><td>{d.document_type === 'E_FATURA' ? 'e-Fatura' : 'e-Arşiv'}</td><td>{STATE[d.status] || d.status}</td></tr>)}</tbody></table>}
  </section>;
}
