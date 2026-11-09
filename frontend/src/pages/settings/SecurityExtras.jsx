import { useEffect, useState } from 'react';
import api from '../../api/client';

const PROBLEM = { modified: 'değiştirilmiş', deleted: 'silinmiş', inserted: 'sonradan araya eklenmiş', chain_broken: 'zinciri bozulmuş' };

// İşlem kaydı bütünlüğü: yönetici tek tıkla tüm kayıt zincirini doğrular.
export function AuditIntegrity() {
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false);
  const check = async () => { setBusy(true); try { setResult((await api.get('/audit-logs/integrity')).data); } catch (e) { setResult({ error: e.response?.data?.error || 'Kontrol yapılamadı veya yetkiniz yok.' }); } finally { setBusy(false); } };
  return <div className="veniux-card p-5 space-y-2">
    <h2 className="font-bold">İşlem kaydı bütünlüğü</h2>
    <p className="text-sm">Her işlem kaydı bir öncekine şifreli olarak bağlanır. Biri veritabanında bir kaydı değiştirir, siler veya araya kayıt eklerse bu kontrol bunu gösterir.</p>
    <button type="button" className="btn-secondary" disabled={busy} onClick={check}>{busy ? 'Kontrol ediliyor…' : 'Kayıtları doğrula'}</button>
    {result && (result.error ? <p role="alert" className="text-sm">{result.error}</p>
      : result.ok ? <p role="status" className="text-sm text-emerald-700">Sağlam: {result.checked} kayıt doğrulandı.</p>
        : <p role="alert" className="text-sm text-red-700">Uyarı: {result.audit_id ? `#${result.audit_id} numaralı kayıt ` : ''}{PROBLEM[result.problem] || result.problem}{result.count ? ` (${result.count} kayıt)` : ''}. Yedekten karşılaştırın ve erişimleri gözden geçirin.</p>)}
  </div>;
}

// Bu hesabın giriş yaptığı cihazlar; kaldırılan cihazın oturumu kapanır.
export function LoginDevices() {
  const [devices, setDevices] = useState(null), [message, setMessage] = useState('');
  const load = () => api.get('/auth/devices').then(r => setDevices(r.data)).catch(() => setMessage('Cihazlar yüklenemedi.'));
  useEffect(() => { load(); }, []);
  const remove = async d => {
    if (!window.confirm(`${d.label} cihazı kaldırılsın mı? Tüm oturumlarınız kapanır ve yeniden giriş yapmanız gerekir.`)) return;
    try { await api.delete('/auth/devices/' + d.id); } catch (e) { setMessage(e.response?.data?.error || 'Kaldırılamadı.'); }
  };
  return <div className="veniux-card p-5 space-y-2">
    <h2 className="font-bold">Giriş yaptığınız cihazlar</h2>
    <p className="text-sm">Yeni bir cihazdan giriş yapıldığında işlem kaydına yazılır ve ayar açıksa size e-posta gelir. Tanımadığınız bir cihaz varsa kaldırın ve şifrenizi değiştirin.</p>
    {devices?.length ? <ul className="text-sm space-y-1">{devices.map(d => <li key={d.id} className="flex flex-wrap gap-2 items-center"><b>{d.label}</b><span>ilk: {String(d.first_seen).slice(0, 16)}</span><span>son: {String(d.last_seen).slice(0, 16)}</span><button type="button" className="btn-soft" onClick={() => remove(d)}>Kaldır</button></li>)}</ul> : devices && <p className="text-sm">Kayıtlı cihaz yok.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}

// Sade dille: veriniz nerede duruyor, kim görebilir.
export function DataLocation() {
  return <div className="veniux-card p-5 space-y-3 text-sm">
    <h2 className="font-bold">Verileriniz nerede, kim görebilir?</h2>
    <p><b>Nerede durur?</b> Masaüstü (yerel) kurulumda ürün, stok, satış ve müşteri bilgileriniz bu bilgisayardaki veritabanında durur; internet kesilse de çalışır. Bulut kurulumda verileriniz Veniux sunucusunda, firmanıza ayrılmış alanda tutulur. Yedekler, siz açtıysanız seçtiğiniz ikinci konuma ve şifreli olarak yedek depolama hizmetine gider.</p>
    <p><b>Kim görebilir?</b> Firmanızın kullanıcıları yalnız rollerinin izin verdiği ekranları görür (Roller ve yetkiler sayfası). Şube kısıtı olan kullanıcı yalnız kendi şubesini görür. Başka bir firma sizin verinizi göremez. Veniux destek ekibi verinize yalnız sizin talebinizle ve destek amacıyla erişir; bu erişim de işlem kaydına yazılır.</p>
    <p><b>Neler kaydedilir?</b> Kim, neyi, ne zaman değiştirdi: işlem kaydında tutulur ve değiştirilirse fark edilir. Giriş yapılan cihazın türü (ör. "Chrome · Windows") tutulur; IP adresi cihaz listesinde saklanmaz.</p>
    <p><b>Ne kadar saklanır?</b> İşlem kayıtları yukarıda seçtiğiniz süre kadar saklanır, sonra otomatik silinir. Satış ve fatura kayıtları vergi mevzuatı gereği daha uzun tutulması gereken kayıtlardır; onları siz silmedikçe sistem silmez.</p>
    <p><b>Dışarıya ne gider?</b> Yalnız sizin açtığınız bağlantılara: e-posta sunucusu, SMS (Netgsm), WhatsApp, pazaryeri (Trendyol), e-belge sağlayıcısı ve yedek depolama. Kapalı bağlantılara veri gönderilmez.</p>
    <p className="text-xs text-gray-500">Bu metin bilgilendirme amaçlıdır; KVKK aydınlatma metninin yerine geçmez. Aydınlatma metnini firmanız (veri sorumlusu) hazırlar.</p>
  </div>;
}
