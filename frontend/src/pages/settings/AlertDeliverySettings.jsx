import { useEffect, useState } from 'react';
import api from '../../api/client';

const TYPES = { low_stock: 'Kritik stok', expiry: 'Miadı yaklaşan ürün', count_variance: 'Sayım farkı' };
const CHANNELS = { email: 'E-posta (firma e-postası ve ek alıcılar)', sms: 'SMS (patron telefonu, Netgsm)', whatsapp: 'WhatsApp (patron telefonu; resmî WhatsApp Business API ayarlıysa o kullanılır)' };

const NAMES = { email: 'E-posta', sms: 'SMS', whatsapp: 'WhatsApp' };
const STATUS = { sent: 'gönderildi', accepted: 'gönderildi', unknown: 'sonucu belirsiz', nothing: 'gönderilecek yeni uyarı yok', daily_limit: 'günlük sınır doldu', not_configured: 'kanal ayarlı değil', not_connected: 'WhatsApp bağlı değil', no_recipient: 'alıcı yok', invalid_phone: 'telefon numarası geçersiz', failed: 'gönderilemedi', rejected: 'sağlayıcı reddetti', not_registered: 'numara WhatsApp kullanmıyor' };
function describe(r) {
  if (r.skipped === 'disabled') return 'Hiç kanal veya uyarı türü seçili değil.';
  if (r.skipped === 'quiet_hours') return 'Şu an sessiz saatlerdesiniz; uyarılar sessiz saat bitince gönderilecek.';
  return Object.entries(r).map(([k, v]) => `${NAMES[k] || k}: ${typeof v === 'string' ? STATUS[v] || v : `${STATUS[v.status] || v.status}${v.alerts ? ` (${v.alerts} uyarı)` : ''}`}`).join(' · ');
}
// Uyarıların hangi kanaldan, hangi saatlerde iletileceği. Yalnız firma yöneticisi değiştirir.
export default function AlertDeliverySettings() {
  const [s, setS] = useState(null), [extra, setExtra] = useState(''), [consent, setConsent] = useState(false), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/settings/alert-delivery').then(r => { setS(r.data); setExtra(r.data.extraEmails.join(', ')); }).catch(() => setMessage('İletim tercihleri yüklenemedi.')); }, []);
  if (!s) return message ? <p role="status">{message}</p> : null;
  const toggle = (group, key) => e => setS({ ...s, [group]: { ...s[group], [key]: e.target.checked } });
  const save = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.put('/settings/alert-delivery', { ...s, extraEmails: extra.split(',').map(x => x.trim()).filter(Boolean), consentConfirmed: consent });
      setS(r.data); setConsent(false); setMessage('İletim tercihleri kaydedildi.');
    } catch (err) { setMessage(err.response?.data?.error || 'Kaydedilemedi.'); } finally { setBusy(false); }
  };
  const test = async () => { setBusy(true); try { const r = await api.post('/settings/alert-delivery/run'); setMessage(describe(r.data)); } catch (err) { setMessage(err.response?.data?.error || 'Gönderilemedi.'); } finally { setBusy(false); } };
  return <form onSubmit={save} className="veniux-card p-5 space-y-4">
    <h2 className="font-semibold">Uyarıları telefona ve e-postaya ilet</h2>
    <p className="text-sm">Yeni uyarılar 10 dakikada bir tek bir özet mesajla gönderilir. Her uyarı her kanaldan bir kez gider. Sessiz saatlerde bekletilir.</p>
    <fieldset className="space-y-1"><legend className="font-medium">Kanallar</legend>{Object.entries(CHANNELS).map(([k, l]) => <label key={k} className="block"><input type="checkbox" checked={s.channels[k]} onChange={toggle('channels', k)} /> {l}</label>)}</fieldset>
    <fieldset className="space-y-1"><legend className="font-medium">Uyarı türleri</legend>{Object.entries(TYPES).map(([k, l]) => <label key={k} className="block"><input type="checkbox" checked={s.types[k]} onChange={toggle('types', k)} /> {l}</label>)}</fieldset>
    <div className="flex flex-wrap gap-3">
      <label>Sessiz saat başlangıcı<input className="block border rounded-lg p-2" type="number" min="0" max="23" value={s.quietStart} onChange={e => setS({ ...s, quietStart: Number(e.target.value) })} /></label>
      <label>Sessiz saat bitişi<input className="block border rounded-lg p-2" type="number" min="0" max="23" value={s.quietEnd} onChange={e => setS({ ...s, quietEnd: Number(e.target.value) })} /></label>
      <label>Kanal başına günlük en çok özet<input className="block border rounded-lg p-2" type="number" min="1" max="24" value={s.dailyLimit} onChange={e => setS({ ...s, dailyLimit: Number(e.target.value) })} /></label>
    </div>
    <label className="block">Ek e-posta alıcıları (virgülle ayırın, en çok 10)<input className="block w-full border rounded-lg p-2" value={extra} onChange={e => setExtra(e.target.value)} placeholder="mudur@firma.com, depo@firma.com" /></label>
    <label className="block text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Yeni eklediğim kişileri bu bildirimler hakkında bilgilendirdim ve izinlerini aldım.</label>
    {s.consentConfirmedAt && <p className="text-xs text-gray-500">Son izin onayı: {new Date(s.consentConfirmedAt).toLocaleString('tr-TR')} · {s.consentConfirmedBy}</p>}
    <p className="text-xs text-gray-500">Mesajlar yalnız işletmenizin kendi yetkililerine gider ve ürün/stok bilgisi içerir; müşteri kişisel verisi gönderilmez. SMS için Netgsm, WhatsApp için Entegrasyonlar bölümündeki bağlantı gerekir.</p>
    <div className="flex gap-2"><button className="btn-primary" disabled={busy}>Kaydet</button><button type="button" className="btn-secondary" disabled={busy} onClick={test}>Bekleyenleri şimdi gönder</button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
