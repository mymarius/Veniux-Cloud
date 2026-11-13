import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Copy, Mail, ShieldAlert, Store } from 'lucide-react';
import apiClient from '../api/client';
import { AuthShell } from '../components/AuthShell';

// Kendi kendine açılan 14 günlük deneme: /deneme (istek) ve /deneme/onay#t=… (onay).
// Belirteç adres çubuğunun # kısmında gelir; sunucu günlüklerine düşmez. Onay bir düğmeyle yapılır ki
// e-posta tarayıcılarının bağlantıyı önceden açması hesabı tüketmesin.
const errorBox = text => <div role="alert" className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-600"><ShieldAlert className="h-4 w-4 shrink-0" />{text}</div>;
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-brand-500';

function TrialRequest() {
  const [form, setForm] = useState({ email: '', company: '', consent: false, website: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = key => event => setForm(value => ({ ...value, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const submit = async event => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await apiClient.post('/trial/request', form); setSent(true); }
    catch (requestError) { setError(requestError.response?.data?.error || 'İstek gönderilemedi. Biraz sonra tekrar deneyin.'); }
    finally { setLoading(false); }
  };
  return (
    <AuthShell title="14 gün ücretsiz deneyin" description="İşletme paketiyle, örnek ürün ve stoklarla hazır bir hesap. Kart bilgisi istenmez." footer={<Link to="/login" className="font-bold text-brand-500 hover:underline">Hesabım var, giriş yap</Link>}>
      {error && errorBox(error)}
      {sent ? (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-sm font-semibold text-green-700">E-postanıza bir onay bağlantısı gönderdik. 24 saat içinde bağlantıyı açıp hesabınızı oluşturun. Gelmediyse istenmeyen (spam) klasörüne bakın.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">İşletme adı</span>
            <span className="relative block"><Store className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" /><input required minLength={2} maxLength={80} value={form.company} onChange={set('company')} autoComplete="organization" placeholder="Örnek Market" className={inputClass} /></span></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">E-posta</span>
            <span className="relative block"><Mail className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" /><input type="email" required maxLength={254} value={form.email} onChange={set('email')} autoComplete="email" placeholder="isim@isletme.com" className={inputClass} /></span></label>
          <label className="trial-trap" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>Web sitesi<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
          <label className="flex items-start gap-2.5 text-xs text-gray-600"><input type="checkbox" required checked={form.consent} onChange={set('consent')} className="mt-0.5" />
            <span><a href="https://veniux.com/kvkk-aydinlatma" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-500 hover:underline">Aydınlatma metnini</a> okudum. E-postam yalnız deneme hesabı için kullanılır.</span></label>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 rounded-full disabled:cursor-wait disabled:opacity-60">{loading ? 'Gönderiliyor...' : 'Onay bağlantısı gönder'}</button>
          <p className="text-xs text-gray-500">Deneme 14 gün sürer. Süre bitince giriş kapanır, 30 gün sonra deneme verileri silinir.</p>
        </form>
      )}
    </AuthShell>
  );
}

function CopyRow({ label, value }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setDone(true); } catch { /* elle seçilebilir */ } };
  return (
    <div className="rounded-lg border border-gray-300 bg-white px-3.5 py-3">
      <span className="block text-xs font-bold text-gray-600">{label}</span>
      <span className="mt-1 flex items-center justify-between gap-3"><code className="break-all text-sm font-semibold">{value}</code>
        <button type="button" onClick={copy} className="btn-secondary shrink-0 px-3 py-1.5 text-xs" aria-label={`${label} kopyala`}><Copy className="h-3.5 w-3.5" />{done ? 'Kopyalandı' : 'Kopyala'}</button></span>
    </div>
  );
}

function TrialConfirm() {
  const token = useRef(new URLSearchParams(window.location.hash.slice(1)).get('t') || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(token.current ? '' : 'Bağlantı eksik. E-postadaki bağlantıyı tam olarak açın.');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (token.current) window.history.replaceState(null, '', window.location.pathname); }, []);
  const confirm = async () => {
    setError(''); setLoading(true);
    try { const { data } = await apiClient.post('/trial/confirm', { token: token.current }, { timeout: 30000 }); setResult(data); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Hesap açılamadı. Biraz sonra tekrar deneyin.'); }
    finally { setLoading(false); }
  };
  if (result) return (
    <AuthShell title="Deneme hesabınız hazır" description="Bu bilgiler yalnız bu sayfada bir kez gösterilir. Şimdi kaydedin." footer={<a href={result.activate_url} className="font-bold text-brand-500 hover:underline">Lisansı etkinleştir</a>}>
      <div className="space-y-3">
        <CopyRow label="E-posta" value={result.email} />
        <CopyRow label="Şifre" value={result.password} />
        <CopyRow label="Lisans anahtarı" value={result.license_key} />
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
          <li>“Lisansı etkinleştir” sayfasında lisans anahtarını girin.</li>
          <li>Ardından e-posta ve şifrenizle giriş yapın.</li>
          <li>İlk girişten sonra şifrenizi Ayarlar → Hesabım’dan değiştirin.</li>
        </ol>
        <p className="text-xs text-gray-500">Deneme bitişi: {new Date(result.expires_at).toLocaleDateString('tr-TR')}. Lisans 2 cihazda (ör. bilgisayar ve telefon) kullanılabilir.</p>
        <a href={result.activate_url} className="btn-primary block w-full py-3.5 text-center rounded-full">Lisansı etkinleştir</a>
      </div>
    </AuthShell>
  );
  return (
    <AuthShell title="Deneme hesabınızı açın" description="Düğmeye bastığınızda İşletme paketiyle 14 günlük hesabınız oluşturulur." footer={<Link to="/deneme" className="font-bold text-brand-500 hover:underline">Yeni deneme isteği</Link>}>
      {error && errorBox(error)}
      {token.current && <button type="button" onClick={confirm} disabled={loading} className="btn-primary w-full py-3.5 rounded-full disabled:cursor-wait disabled:opacity-60">{loading ? 'Hesabınız hazırlanıyor...' : 'Hesabımı oluştur'}</button>}
    </AuthShell>
  );
}

export default function Trial() {
  return useLocation().pathname.startsWith('/deneme/onay') ? <TrialConfirm /> : <TrialRequest />;
}
