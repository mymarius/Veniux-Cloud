import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { StatusBadge, Input } from '../../components/ui';
import { User, Lock, Shield, Smartphone, Mail, Phone, Calendar, Save, Loader2, CheckCircle2, Camera, Trash2 } from 'lucide-react';
import UserAvatar from '../../components/UserAvatar';
import { resizeAvatar, updateStoredUser } from '../../lib/avatar';

export default function AccountTab() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mfa,setMfa]=useState(null);
  useEffect(()=>{apiClient.get('/auth/mfa').then(r=>setMfa(r.data)).catch(()=>setMfa(null));},[]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  const [profile, setProfile] = useState({
    id: '',
    email: '',
    fullName: '',
    phone: '',
    role: '',
    createdAt: '',
    lastLogin: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings/account');
      setProfile(res.data);
    } catch (err) {
      // Fallback to localStorage or /auth/me
      try {
        const meRes = await apiClient.get('/auth/me');
        setProfile({
          id: meRes.data.id,
          email: meRes.data.email,
          fullName: meRes.data.email?.split('@')[0] || 'Kullanıcı',
          phone: meRes.data.phone || '',
          role: meRes.data.role || 'viewer',
          createdAt: meRes.data.created_at || null,
          lastLogin: meRes.data.last_login || null
        });
      } catch (e) {
        showToast('Profil bilgisi alınamadı.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiClient.put('/settings/account', {
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email
      });
      updateStoredUser({ full_name: profile.fullName, email: profile.email });
      showToast('Hesap profiliniz başarıyla güncellendi.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Profil güncellenirken hata oluştu.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingAvatar(true);
    try {
      const image = await resizeAvatar(file);
      await apiClient.put('/settings/account/avatar', { image });
      setProfile(p => ({ ...p, avatarUrl: image }));
      updateStoredUser({ avatar_url: image });
      showToast('Profil fotoğrafınız güncellendi.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Profil fotoğrafı yüklenemedi.', 'error');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setSavingAvatar(true);
    try {
      await apiClient.delete('/settings/account/avatar');
      setProfile(p => ({ ...p, avatarUrl: null }));
      updateStoredUser({ avatar_url: null });
      showToast('Profil fotoğrafı kaldırıldı.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Profil fotoğrafı kaldırılamadı.', 'error');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return showToast('Yeni şifreler birbiriyle eşleşmiyor.', 'warning');
    }
    if (passwordForm.newPassword.length < 8) {
      return showToast('Yeni şifre en az 8 karakter olmalıdır.', 'warning');
    }

    setSavingPassword(true);
    try {
      await apiClient.put('/settings/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      localStorage.removeItem('token'); localStorage.removeItem('user');
      showToast('Şifreniz değiştirildi. Yeni şifrenizle tekrar giriş yapın.', 'success');
      navigate('/login', { replace: true });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Şifre güncellenemedi. Mevcut şifrenizi kontrol edin.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Hesap bilgilerim</h1>
        <p className="text-sm text-gray-500 mt-1">Kişisel kullanıcı profilinizi ve oturum güvenlik ayarlarınızı yönetin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Summary Card */}
        <div className="veniux-card p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <UserAvatar src={profile.avatarUrl} name={profile.fullName || profile.email} letters={1}
              className="w-24 h-24 rounded-full bg-brand-50 border-2 border-brand-500/30 flex items-center justify-center text-brand-600 font-bold text-3xl shadow-inner" />
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={savingAvatar}
              className="absolute bottom-0 right-0 grid place-items-center w-9 h-9 rounded-full bg-brand-600 text-white border-2 border-white shadow-md hover:bg-brand-800 disabled:opacity-60 transition-colors"
              title="Profil fotoğrafını değiştir" aria-label="Profil fotoğrafını değiştir">
              {savingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleAvatarSelect} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-soft" data-size="sm" onClick={() => avatarInputRef.current?.click()} disabled={savingAvatar}>
              <Camera className="w-3.5 h-3.5" /> {profile.avatarUrl ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
            </button>
            {profile.avatarUrl && (
              <button type="button" className="btn-soft" data-size="sm" data-tone="danger" onClick={handleAvatarRemove} disabled={savingAvatar}>
                <Trash2 className="w-3.5 h-3.5" /> Kaldır
              </button>
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">{profile.fullName || 'Sistem Yöneticisi'}</h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{profile.email}</p>
          </div>
          <StatusBadge status={profile.role === 'admin' ? 'active' : 'info'} text={profile.role?.toUpperCase()} />

          <div className="w-full pt-4 border-t border-gray-200 text-left space-y-3 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Kayıt Tarihi:</span>
              <span className="font-medium text-gray-900">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('tr-TR') : '-'}</span>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-brand-500"/><span className="font-semibold text-gray-900">Hesap güvenliği</span></div>
              <div className="flex justify-between gap-3"><span>Giriş yöntemi</span><span className="font-medium">Parola</span></div>
              <div className="flex justify-between gap-3"><span>İki aşamalı doğrulama</span><span className="font-medium">{mfa?mfa.enabled?'Açık':'Kapalı':'Doğrulanamadı'}</span></div>
              <p className="text-gray-500 leading-relaxed">Oturum süresini ve yeni parolalarda istenen kuralları güvenlik ayarlarından düzenleyebilirsiniz.</p>
              <button type="button" className="btn-soft w-full" onClick={()=>navigate('/settings?tab=security')}>Güvenlik ayarlarını aç</button>
            </div>
          </div>
        </div>

        {/* Right: Profile Edit Form */}
        <div className="md:col-span-2 veniux-card p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
            <User className="w-5 h-5 text-brand-500" />
            <h2 className="font-bold text-sm text-gray-900">Profil Detayları</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ad Soyad"
                value={profile.fullName || ''}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                required
              />
              <Input
                label="E-Posta Adresi"
                type="email"
                value={profile.email || ''}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Telefon Numarası"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+90 (5XX) XXX XX XX"
              />
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                  Kullanıcı Rolü
                </label>
                <input
                  disabled
                  value={profile.role?.toUpperCase() || 'ADMIN'}
                  className="w-full bg-gray-100/50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 font-mono cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Değişiklikleri Kaydet</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Password Change Card */}
      <div className="veniux-card p-6 space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <Lock className="w-5 h-5 text-brand-500" />
          <h2 className="font-bold text-sm text-gray-900">Şifre Değiştir</h2>
        </div>

        <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input
            label="Mevcut Şifre"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            placeholder="••••••••"
            required
          />
          <Input
            label="Yeni Şifre"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="En az 8 karakter"
            required
          />
          <Input
            label="Yeni Şifre (Tekrar)"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder="En az 8 karakter"
            required
          />
          <div className="sm:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingPassword}
              className="btn-primary"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Şifreyi Güncelle</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Session Info */}
      <div className="veniux-card p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-brand-500" />
            <h2 className="font-bold text-sm text-gray-900">Aktif Oturum ve Güvenlik Cihazı</h2>
          </div>
          <StatusBadge status="active" text="BU CİHAZ AKTİF" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-600 gap-2">
          <div>
            <p className="font-semibold text-gray-900">Masaüstü Web İstemcisi ({navigator.platform || 'Windows'})</p>
            <p className="text-gray-500 text-[11px] font-mono mt-0.5">{navigator.userAgent.slice(0, 75)}...</p>
          </div>
          <div className="text-right">
            <span className="text-gray-500">Son Erişim: </span>
            <span className="font-mono font-medium text-gray-900">{new Date().toLocaleString('tr-TR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

