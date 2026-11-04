
﻿import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldAlert } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from '../components/Toast';
import { AuthShell } from '../components/AuthShell';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone,setPhone]=useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/register', { email: email.trim(), password,phone });
      showToast('Hesabınız oluşturuldu. Şimdi giriş yapabilirsiniz.', 'success');
      navigate('/login');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Kayıt işlemi başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Yeni çalışma alanı kullanıcısı" title="Hesap oluşturun" description="Yeni işletme hesabınızı oluşturun. Modül erişimi lisans paketinizle belirlenir." footer={<span>Zaten hesabınız var mı? <Link data-testid="link-login" to="/login" className="font-bold text-brand-500 hover:underline">Sisteme giriş yapın</Link></span>}>
      {error && <div data-testid="status-register-error" className="mb-5 flex gap-2 rounded-lg border border-danger/20 bg-red-50 px-3 py-3 text-xs font-semibold text-red-500"><ShieldAlert className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-500">Kurumsal e-posta</span><span className="relative block"><Mail className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" /><input data-testid="input-register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="isim@sirket.com" autoComplete="email" className="w-full rounded-md border border-gray-200 bg-gray-100 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-primary/10" required /></span></label>
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-500">Şifre</span><span className="relative block"><Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" /><input data-testid="input-register-password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="En az 8 karakter" autoComplete="new-password" className="w-full rounded-md border border-gray-200 bg-gray-100 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-primary/10" required /></span></label>
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-500">Firma sahibinin cep telefonu</span><input data-testid="input-register-phone" type="tel" autoComplete="tel" required maxLength={24} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="05xx xxx xx xx" className="w-full rounded-md border border-gray-200 bg-gray-100 p-3 text-sm"/><span className="mt-2 block text-xs text-slate-500">Otomasyon tamamlanma bildirimleri için kullanılır.</span></label>
        <p className="text-xs text-slate-500">Yeni işletmenizin yöneticisi olarak kaydolursunuz. Ekip üyelerini giriş yaptıktan sonra ekleyebilirsiniz.</p>
        <button data-testid="button-register-submit" type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3 disabled:cursor-wait disabled:opacity-60"><span>{loading ? 'Kaydediliyor...' : 'Hesabı oluştur'}</span><ArrowRight className="h-4 w-4" /></button>
      </form>
    </AuthShell>
  );
}
