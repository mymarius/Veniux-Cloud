import React, { useState } from 'react';
import { Link, useNavigate,Navigate } from 'react-router-dom';
import { ArrowRight, Building2, Key, Lock, Mail, ShieldAlert } from 'lucide-react';
import apiClient from '../api/client';
import { useLicense } from '../context/LicenseContext';
import { useToast } from '../components/Toast';
import { AuthShell } from '../components/AuthShell';
import HostingSponsor from '../components/HostingSponsor';

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('veniux-remembered-email') || '');
  const [password, setPassword] = useState('');
  const [mfaRequired,setMfaRequired]=useState(false),[mfaCode,setMfaCode]=useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { license,centralRequired,isLicensed,loading:licenseLoading } = useLicense();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    sessionStorage.removeItem('platform-tenant');
    sessionStorage.removeItem('platform-tenant-name');
    try {
      const response = await apiClient.post('/auth/login', { email, password, ...(mfaRequired?{mfa_code:mfaCode}:{}) });
      if(response.data.mfa_required){setMfaRequired(true);return;}
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      if (rememberMe) localStorage.setItem('veniux-remembered-email', email);
      else localStorage.removeItem('veniux-remembered-email');
      showToast('Giriş başarılı. Çalışma alanına yönlendiriliyorsunuz.', 'success');
      const fullProgram=(window.veniuxDesktop||window.veniuxMobile)&&response.data.user.portal_role==='admin';
      navigate(response.data.user.portal_role&&!fullProgram ? '/business' : '/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.error || (!requestError.response ? 'Sunucuya ulaşılamıyor. Bağlantınızı ve sunucu adresini kontrol edin.' : 'Giriş yapılamadı. Bilgilerinizi kontrol edin.'));
    } finally {
      setLoading(false);
    }
  };

  if(centralRequired&&licenseLoading)return <div className="p-8" role="status">Lisansınız kontrol ediliyor…</div>;
  if(centralRequired&&!isLicensed)return <Navigate to="/activate" replace/>;
  return (
    <AuthShell eyebrow="Yetkili erişim" title="Çalışma alanınıza giriş yapın" description="Veniux hesabınızla depo ve işletme operasyonlarınıza devam edin." footer={<><span>{license && window.veniuxDesktop && window.veniuxDesktop.apiBase!=='https://business.veniux.com/api' && <><Link to="/register" className="font-semibold text-brand-500">Bu sunucuda işletme hesabı oluştur</Link><br/></>}Davetiniz var mı? <Link data-testid="link-register" to="/business-invite" className="font-bold text-brand-500 hover:underline">Davet kodum var</Link></span><HostingSponsor compact/></>}>
      {license && <div data-testid="status-license" className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-xs"><span className="flex min-w-0 items-center gap-2 font-semibold"><Building2 className="h-4 w-4 shrink-0 text-brand-500" /><span className="truncate">{license.tenant_name || 'Kurumsal çalışma alanı'}</span></span><span className="shrink-0 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[10px] font-bold text-green-700">Lisans aktif</span></div>}
      {error && <div data-testid="status-login-error" className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-600"><ShieldAlert className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-gray-600">Kurumsal e-posta</span>
          <span className="relative block">
            <Mail className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
            <input data-testid="input-login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="isim@sirket.com" autoComplete="email" className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-3 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" required />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-gray-600">Şifre</span>
          <span className="relative block">
            <Lock className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
            <input data-testid="input-login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Şifrenizi girin" autoComplete="current-password" className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-3 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" required />
          </span>
        </label>
        {mfaRequired&&<label className="block text-sm">Doğrulama uygulaması veya kurtarma kodu<input autoFocus autoComplete="one-time-code" required className="w-full border rounded-lg p-3 mt-2" value={mfaCode} maxLength={24} onChange={e=>setMfaCode(e.target.value)}/></label>}
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500 pt-1">
          <label className="flex cursor-pointer items-center gap-2 font-medium">
            <input data-testid="input-remember-me" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded-md border-gray-300 text-brand-500 focus:ring-brand-500" /> Beni hatırla
          </label>
          <Link data-testid="button-forgot-password" to="/forgot-password" className="font-bold text-brand-600 hover:underline">Şifremi unuttum</Link>
        </div>
        <button data-testid="button-login-submit" type="submit" disabled={loading} className="btn-primary w-full py-3.5 rounded-full shadow-md shadow-brand-500/25 disabled:cursor-wait disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
          <span>{loading ? 'Doğrulanıyor...' : 'Giriş Yap'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <div className="mt-7 flex items-center justify-between border-t border-gray-200 pt-4 text-[11px] text-gray-500">
        <Link data-testid="link-license-activation" to="/activate" className="flex items-center gap-1.5 font-semibold hover:text-brand-600 transition-colors">
          <Key className="h-3.5 w-3.5" /> Lisans Kontrolü
        </Link>
        <span className="font-semibold text-gray-400">Veniux Cloud</span>
      </div>
    </AuthShell>
  );
}
