import { useState } from 'react';
import apiClient from '../api/client';

// Siparişi tedarikçiye gönderme: PDF indir, e-postayla gönder, WhatsApp'ta hazır mesaj aç.
// Hiçbiri otomatik çalışmaz; her gönderim kullanıcının tıklamasıyla yapılır.
export default function PurchaseOrderSend({ order }) {
  const [to, setTo] = useState(order.supplier_email || ''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState(null);
  const run = async (work, done) => { setBusy(true); setNote(null); try { setNote({ text: done(await work()) }); } catch (e) { setNote({ error: true, text: e.response?.data?.error || 'İşlem tamamlanamadı.' }); } finally { setBusy(false); } };
  const download = format => run(async () => {
    const r = await apiClient.get(`/purchase-orders/${order.id}/document`, { params: { format, download: 1 }, responseType: 'blob' });
    const url = URL.createObjectURL(r.data), a = document.createElement('a');
    a.href = url; a.download = `siparis-${order.order_no}.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, () => 'Belge indirildi.');
  const email = () => {
    if (!window.confirm(`${order.order_no} numaralı sipariş ${to} adresine gönderilsin mi?`)) return;
    run(() => apiClient.post(`/purchase-orders/${order.id}/send-email`, { to, message }), r => `Sipariş ${r.data.to} adresine gönderildi (${r.data.attachment}).`);
  };
  const whatsapp = () => run(async () => { const r = await apiClient.get(`/purchase-orders/${order.id}/whatsapp-link`); window.open(r.data.url, '_blank', 'noopener'); }, () => 'WhatsApp açıldı; mesajı kontrol edip kendiniz gönderin. PDF\'i ayrıca ekleyebilirsiniz.');
  if (['cancelled'].includes(order.status)) return null;
  return <section className="border rounded-xl p-4 space-y-3 text-sm">
    <h3 className="font-semibold">Tedarikçiye gönder</h3>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => download('pdf')}>PDF indir</button>
      <button type="button" className="btn-soft" disabled={busy} onClick={() => download('html')}>Yazdırılabilir sayfa</button>
      <button type="button" className="btn-soft" disabled={busy || !order.supplier_phone} onClick={whatsapp} title={order.supplier_phone ? '' : 'Tedarikçi kartına telefon ekleyin'}>WhatsApp'ta aç</button>
    </div>
    <div className="grid sm:grid-cols-2 gap-2">
      <label>E-posta adresi<input className="block w-full" type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="tedarikci@ornek.com" /></label>
      <label>Ek not (isteğe bağlı)<input className="block w-full" value={message} maxLength={1000} onChange={e => setMessage(e.target.value)} /></label>
    </div>
    <button type="button" className="btn-primary" disabled={busy || !to} onClick={email}>E-postayla gönder</button>
    {note && <p role={note.error ? 'alert' : 'status'} className={note.error ? 'text-red-700' : 'text-emerald-700'}>{note.text}</p>}
  </section>;
}
