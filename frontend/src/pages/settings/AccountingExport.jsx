import { useEffect, useState } from 'react';
import api from '../../api/client';

const TYPES = { sales: 'Satış', payments: 'Tahsilat', returns: 'İade ve iptal', purchases: 'Alış siparişi', stock: 'Stok hareketi', contacts: 'Cari' };
const STATUS = { created: 'Oluşturuldu', imported: 'İçe alındı', cancelled: 'İptal edildi' };
const PAYMENT = { cash: 'Nakit', credit_card: 'Kredi kartı', on_account: 'Veresiye' };
const label = key => {
  const [kind, a, b] = key.split(':');
  if (kind === 'sale') return `Satış, KDV %${b}`;
  if (kind === 'return') return `İade, KDV %${b}`;
  if (kind === 'payment') return `Tahsilat, ${PAYMENT[a] || a}`;
  return 'Alış';
};
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';
const errorOf = (e, fallback) => e.response?.data?.error || fallback;

export default function AccountingExport() {
  const [form, setForm] = useState({ type: 'sales', from: monthStart(), to: today() });
  const [preview, setPreview] = useState(null), [codes, setCodes] = useState({}), [exports, setExports] = useState([]);
  const [busy, setBusy] = useState(false), [note, setNote] = useState(null);
  const load = async () => setExports((await api.get('/accounting-exports')).data || []);
  useEffect(() => { load().catch(() => setNote({ error: true, text: 'Muhasebe aktarımını yalnız firma genelinde yetkili yönetici kullanabilir.' })); }, []);
  const run = async (work, done) => {
    setBusy(true); setNote(null);
    try { const result = await work(); if (done) setNote({ text: done(result) }); await load(); return result; } catch (e) { setNote({ error: true, text: errorOf(e, 'İşlem tamamlanamadı.') }); return null; } finally { setBusy(false); }
  };
  const check = e => { e?.preventDefault(); run(async () => { const { data } = await api.post('/accounting-exports/preview', form); setPreview(data); return data; }); };
  const change = name => e => { setForm({ ...form, [name]: e.target.value }); setPreview(null); };
  const saveCodes = e => { e.preventDefault(); run(async () => { await api.put('/accounting-exports/maps', { maps: codes }); const { data } = await api.post('/accounting-exports/preview', form); setPreview(data); setCodes({}); return data; }, () => 'Hesap kodları kaydedildi.'); };
  const download = async item => {
    setBusy(true); setNote(null);
    try {
      const response = await api.get(`/accounting-exports/${item.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data), link = document.createElement('a');
      link.href = url; link.download = `veniux-${item.export_type}-${item.date_from}-${item.date_to}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch { setNote({ error: true, text: 'Dosya indirilemedi.' }); } finally { setBusy(false); }
  };
  const create = () => run(async () => { await api.post('/accounting-exports', form); const { data } = await api.post('/accounting-exports/preview', form); setPreview(data); return data; }, () => 'Paket oluşturuldu. Aşağıdan indirebilirsiniz.');
  const cancel = item => {
    if (item.status === 'imported' && !window.confirm('Bu paketi muhasebe programında geri aldığınızı onaylıyor musunuz? Onaylarsanız kayıtlar yeniden aktarılabilir.')) return;
    run(() => api.post(`/accounting-exports/${item.id}/cancel`, { reverted_in_target: item.status === 'imported' }), () => 'Paket iptal edildi.');
  };
  const ready = preview && !preview.issue_count && !preview.missing_accounts.length && preview.row_count > 0;
  return <section className="veniux-card p-5 space-y-4" aria-label="Muhasebe aktarımı">
    <div><h2 className="font-semibold">Muhasebe aktarımı (CSV)</h2><p className="text-sm text-slate-500">Kayıtları Excel'de açılabilen dosyaya aktarır. Aynı kayıt iki geçerli pakete girmez. Hesap kodlarını mali müşavirinizle belirleyin; dosyayı içe almadan önce kontrol edin.</p></div>
    <form className="grid sm:grid-cols-4 gap-3 items-end" onSubmit={check}>
      <label className="text-sm">Veri<select className="block w-full" value={form.type} onChange={change('type')}>{Object.entries(TYPES).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <label className="text-sm">Başlangıç<input className="block w-full" type="date" value={form.from} onChange={change('from')} required /></label>
      <label className="text-sm">Bitiş<input className="block w-full" type="date" value={form.to} onChange={change('to')} required /></label>
      <button className="btn-soft" disabled={busy}>Kontrol et</button>
    </form>
    {preview && <div className="space-y-3 text-sm" role="status">
      <p><strong>{preview.row_count}</strong> satır aktarılacak{preview.already_exported > 0 && `, ${preview.already_exported} kayıt daha önce pakete girdi`}.</p>
      {preview.warnings.map(text => <p key={text} className="text-amber-700">{text}</p>)}
      {preview.issue_count > 0 && <div className="text-red-700"><p className="font-semibold">{preview.issue_count} sorun var, paket oluşturulamaz:</p><ul className="list-disc pl-5">{preview.issues.map(text => <li key={text}>{text}</li>)}</ul></div>}
      {preview.missing_accounts.length > 0 && <form className="space-y-2" onSubmit={saveCodes}>
        <p className="font-semibold">Eşleşmemiş hesap kodları</p>
        <div className="grid sm:grid-cols-2 gap-3">{preview.missing_accounts.map(key => <label key={key}>{label(key)}<input className="block w-full" value={codes[key] || ''} onChange={e => setCodes({ ...codes, [key]: e.target.value })} maxLength={40} required /></label>)}</div>
        <button className="btn-primary" disabled={busy}>Hesap kodlarını kaydet</button>
      </form>}
      {ready && <button type="button" className="btn-primary" disabled={busy} onClick={create}>Paketi oluştur</button>}
    </div>}
    {note && <p role={note.error ? 'alert' : 'status'} className={note.error ? 'text-sm font-semibold text-red-700' : 'text-sm font-semibold text-emerald-700'}>{note.text}</p>}
    {exports.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Veri</th><th className="text-left">Aralık</th><th className="text-left">Satır</th><th className="text-left">Durum</th><th className="text-left">İşlem</th></tr></thead><tbody>{exports.map(item => <tr key={item.id}>
      <td>{TYPES[item.export_type] || item.export_type}</td><td>{item.date_from} / {item.date_to}</td><td>{item.row_count}</td><td>{STATUS[item.status] || item.status}</td>
      <td className="flex flex-wrap gap-2">{item.status !== 'cancelled' && <><button type="button" className="btn-soft" disabled={busy} onClick={() => download(item)}>İndir</button>{item.status === 'created' && <button type="button" className="btn-soft" disabled={busy} onClick={() => run(() => api.post(`/accounting-exports/${item.id}/imported`), () => 'İçe alındı olarak işaretlendi.')}>İçe alındı</button>}<button type="button" className="btn-soft" disabled={busy} onClick={() => cancel(item)}>İptal</button></>}</td>
    </tr>)}</tbody></table></div>}
  </section>;
}
