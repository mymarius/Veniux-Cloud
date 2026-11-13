import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react';
import apiClient from '../../api/client';
import { useLicense } from '../../context/LicenseContext';
import BankTransferPayment from '../../components/BankTransferPayment';
import './mobile-hub.css';
import { SUPPORT_URL } from './mobileKit';

// Mobil giriş: A101 SOS'taki sade akış (hoş geldin metni, iki alan, tek düğme, "Bize Ulaş"), Veniux sitesinin görünümüyle.
// Oturum açma mantığı masaüstü girişle aynıdır (e-posta ve şifre, gerekirse doğrulama kodu, ödeme bilgisi).
export default function MobileLogin() {
  const navigate = useNavigate();
  const { centralRequired, isLicensed, loading: licenseLoading } = useLicense();
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('veniux-remembered-email') || ''; } catch { return ''; } });
  const [password, setPassword] = useState(''), [show, setShow] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false), [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [billing, setBilling] = useState(null);

  const submit = async event => {
    event.preventDefault(); setError(''); setLoading(true);
    sessionStorage.removeItem('platform-tenant'); sessionStorage.removeItem('platform-tenant-name');
    try {
      const response = await apiClient.post('/auth/login', { email, password, ...(mfaRequired ? { mfa_code: mfaCode } : {}) });
      if (response.data.mfa_required) { setMfaRequired(true); return; }
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      try { localStorage.setItem('veniux-remembered-email', email); } catch { /* yok say */ }
      const fullProgram = (window.veniuxDesktop || window.veniuxMobile) && response.data.user.portal_role === 'admin';
      navigate(response.data.user.portal_role && !fullProgram ? '/business' : '/dashboard');
    } catch (requestError) {
      setBilling(requestError.response?.data?.billing || null);
      setError(requestError.response?.data?.error || (!requestError.response ? 'Sunucuya ulaşılamıyor. Bağlantınızı ve sunucu adresini kontrol edin.' : 'Giriş yapılamadı. Bilgilerinizi kontrol edin.'));
    } finally { setLoading(false); }
  };

  if (centralRequired && licenseLoading) return <div className="vm-login" role="status"><div className="logo"><img src="/veniux-logo.png" alt="" width="40" height="40" />Veniux</div><p className="sub" style={{ marginTop: 40 }}>Lisansınız kontrol ediliyor…</p></div>;
  if (centralRequired && !isLicensed) return <Navigate to="/activate" replace />;
  return <div className="vm-login">
    <div className="logo"><img src="/veniux-logo.png" alt="" width="40" height="40" />Veniux</div>
    <p className="eyebrow">Stok · Kasa · Etiket</p>
    <h1>Hesabına <em>gir.</em></h1>
    <p className="sub">E-posta adresin ve şifrenle giriş yap; mağazan cebinde.</p>
    {error && <div role="alert" className="alert" data-testid="status-login-error"><ShieldAlert size={18} />{error}</div>}
    {billing && <div style={{ marginBottom: 12 }}><BankTransferPayment billing={billing} /></div>}
    <form onSubmit={submit}>
      <label className="vm-field"><Mail size={18} /><input type="email" inputMode="email" autoComplete="email" placeholder="E-posta" aria-label="E-posta" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label className="vm-field"><Lock size={18} /><input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Şifre" aria-label="Şifre" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="button" aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'} onClick={() => setShow(v => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></label>
      {mfaRequired && <label className="vm-field"><ShieldAlert size={18} /><input autoFocus autoComplete="one-time-code" placeholder="Doğrulama veya kurtarma kodu" aria-label="Doğrulama kodu" maxLength={24} value={mfaCode} onChange={e => setMfaCode(e.target.value)} required /></label>}
      <div className="opts"><Link to="/forgot-password">Şifremi unuttum</Link></div>
      <button type="submit" className="vm-btn" disabled={loading} data-testid="button-login-submit">{loading ? 'Doğrulanıyor…' : 'Giriş'}</button>
    </form>
    <p className="help">Sorun mu yaşıyorsun? <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Bize ulaş</a></p>
    <div className="ticket" aria-hidden="true"><i /><span>veniux.com</span></div>
  </div>;
}
