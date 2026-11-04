import React, { useState,useEffect } from 'react';
import api from '../api/client';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Cpu, Globe, Key, ShieldCheck } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import PricingCheckout from './public/PricingCheckout';
import LicenseSuccess from './LicenseSuccess';
import { AuthShell } from '../components/AuthShell';

export default function LicenseActivation() {
  const { activateLicenseKey, hardwareInfo, isLicensed, license,deactivateCurrentDevice } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [activatedData, setActivatedData] = useState(null);
  const navigate = useNavigate();
  const [policyReady,setPolicyReady]=useState(false);
  useEffect(()=>{let active=true;api.get('/license/policy').then(({data})=>{if(!active)return;setPolicyReady(true);}).catch(()=>{if(active){setError('Sunucu erişim türü doğrulanamadı. Hesap girişinden devam edebilir veya bağlantıyı kontrol edebilirsiniz.');setPolicyReady(true);}});return()=>{active=false;};},[navigate]);
  if(!policyReady)return <div role="status" className="p-8">Hesap erişimi kontrol ediliyor…</div>;

  const changeLicense=async()=>{await deactivateCurrentDevice();setActivatedData(null);setLicenseKey('');};
  if (isLicensed && license && !activatedData) return <LicenseSuccess licenseData={license} onChangeLicense={changeLicense} onContinue={() => navigate('/login')} />;
  if (activatedData) return <LicenseSuccess licenseData={activatedData} onChangeLicense={changeLicense} onContinue={() => navigate('/login')} />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!licenseKey.trim()) {
      setError('Lütfen kurumsal lisans anahtarınızı giriniz.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await activateLicenseKey(licenseKey);
      setActivatedData(response.data?.token?.payload || response.data);
    } catch (requestError) {
      setError(requestError.message || 'Lisans anahtarı doğrulanamadı. Lütfen kontrol ediniz.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Kurulum ve erişim" title="Lisansınızı etkinleştirin" description="Veniux çalışma alanını bu bilgisayarda yetkilendirmek için lisans anahtarınızı girin." footer={<span>Zaten etkin bir lisansınız var mı? <Link data-testid="link-activation-login" to="/login" className="font-bold text-brand-500 hover:underline">Sisteme giriş yapın</Link></span>}>
      {error && <div data-testid="status-activation-error" className="mb-5 flex gap-2 rounded-lg border border-danger/20 bg-red-50 px-3 py-3 text-xs font-semibold text-red-500"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
      <p className="mb-4 text-xs text-gray-500">VNX- ile başlayan lisans anahtarınızı girin. Aşağıdaki HW- cihaz kimliği lisans anahtarı değildir.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-500">Kurumsal lisans anahtarı</span><span className="relative block"><Key className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" /><input data-testid="input-license-key" type="text" required value={licenseKey} onChange={(event) => { setLicenseKey(event.target.value.toUpperCase()); setError(''); }} placeholder="VNX- ile başlayan lisans anahtarı" className="w-full rounded-md border border-gray-200 bg-gray-100 py-2.5 pl-10 pr-3 font-mono text-sm font-bold tracking-wider text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-primary/10" /></span></label>
        <div data-testid="panel-device-information" className="space-y-2 rounded-lg border border-gray-200 bg-gray-100 p-3 text-[11px] text-gray-500"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-brand-500" /> Cihaz kimliği</span><span className="font-mono font-bold text-gray-900">{hardwareInfo?.fingerprint || 'Hazırlanıyor'}</span></div><div className="flex items-center justify-between gap-3"><span>İşletim sistemi</span><span>{hardwareInfo?.osInfo || 'Windows'}</span></div><div className="flex items-center gap-1.5 border-t border-gray-200 pt-2"><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Güvenli lisans doğrulaması</div></div>
        <button data-testid="button-license-submit" type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:cursor-wait disabled:opacity-60"><span>{loading ? 'Doğrulanıyor...' : 'Lisansı etkinleştir'}</span><ArrowRight className="h-4 w-4" /></button>
      </form>
      <div className="mt-7 border-t border-gray-200 pt-5 text-center"><p className="text-xs text-gray-500">Henüz kurumsal lisansınız yok mu?</p><button data-testid="button-license-purchase" type="button" onClick={() => setShowCheckout(true)} className="btn-soft mt-3">Yıllık lisans seçeneklerini inceleyin</button></div>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-gray-500"><Globe className="h-3.5 w-3.5" /> Veniux Enterprise lisans yönetimi</p>
      {showCheckout && <PricingCheckout onClose={() => setShowCheckout(false)} onSuccess={(data) => { if (data?.license_key) setLicenseKey(data.license_key); setShowCheckout(false); }} />}
    </AuthShell>
  );
}

