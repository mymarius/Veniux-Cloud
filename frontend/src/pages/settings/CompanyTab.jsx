import { readSessionUser } from '../../lib/sessionUser';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { StatusBadge, Input, Select } from '../../components/ui';
import { Building2, Save, Loader2, Globe, MapPin, Phone, Mail, FileText, CheckCircle2 } from 'lucide-react';

export default function CompanyTab({embedded=false}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [company, setCompany] = useState({
    companyName: '',
    tenantCode: '',
    industry: '',
    taxNumber: '',
    taxOffice: '',
    email: '',
    phone: '',
    ownerPhone: '',
    address: '',
    currency: 'TRY',
    timezone: 'Europe/Istanbul'
  });

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings/company');
      setCompany(res.data);
    } catch (err) {
      showToast('Şirket profili alınamadı.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload={...company};const user=readSessionUser();if(!payload.ownerPhone||user.role!=='admin')delete payload.ownerPhone;
      await apiClient.put('/settings/company', payload);
      showToast('Şirket profili başarıyla güncellendi.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Kayıt sırasında hata oluştu.', 'error');
    } finally {
      setSaving(false);
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
      <div className="flex justify-between items-start">
        <div>
          {embedded?<h3 className="text-xl font-bold text-gray-900">Şirket bilgileri</h3>:<h1 className="text-xl font-bold text-gray-900">Şirket bilgileri</h1>}
          <p className="text-sm text-gray-500 mt-1">İşletmenizin kurumsal fatura, adres, para birimi ve operasyonel ayarlarını yönetin.</p>
        </div>
        {!embedded&&<StatusBadge status="active" text={`İşletme kodu: ${company.tenantCode || 'Henüz tanımlanmadı'}`} />}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Company Details */}
        <div className="veniux-card p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
            <Building2 className="w-5 h-5 text-brand-500" />
            <h2 className="font-bold text-sm text-gray-900">Kurumsal Bilgiler</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Firma / Şirket Ünvanı"
              value={company.companyName || ''}
              onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
              required
            />
            <Input
              label="Faaliyet Alanı / Sektör"
              value={company.industry || ''}
              onChange={(e) => setCompany({ ...company, industry: e.target.value })}
              placeholder="Depolama, Perakende, E-Ticaret"
            />
            <Input
              label="Vergi Kimlik Numarası (VKN/TCKN)"
              value={company.taxNumber || ''}
              onChange={(e) => setCompany({ ...company, taxNumber: e.target.value })}
            />
            <Input
              label="Vergi Dairesi"
              value={company.taxOffice || ''}
              onChange={(e) => setCompany({ ...company, taxOffice: e.target.value })}
            />
          </div>
        </div>

        {/* Contact & Location */}
        <div className="veniux-card p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
            <MapPin className="w-5 h-5 text-brand-500" />
            <h2 className="font-bold text-sm text-gray-900">İletişim ve Adres Bilgileri</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Kurumsal E-Posta"
              type="email"
              value={company.email || ''}
              onChange={(e) => setCompany({ ...company, email: e.target.value })}
              required
            />
            <Input
              label="Müşteri Hizmetleri / Telefon"
              value={company.phone || ''}
              onChange={(e) => setCompany({ ...company, phone: e.target.value })}
            />
            <Input label="Gizli bildirim telefonu (WhatsApp/SMS)" type="tel" value={company.ownerPhone||''} placeholder={company.ownerPhoneConfigured?'Kayıtlı numara gizli; değiştirmek için yeni numara girin':'05xx xxx xx xx'} onChange={e=>setCompany({...company,ownerPhone:e.target.value})}/>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                Merkez Tesis / Fatura Adresi
              </label>
              <textarea
                rows={3}
                value={company.address || ''}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:border-brand-500 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Mahalle, Cadde, Sokak, İlçe / İl"
              />
            </div>
          </div>
        </div>

        {/* Regional & Financial Preferences */}
        <div className="veniux-card p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
            <Globe className="w-5 h-5 text-brand-500" />
            <h2 className="font-bold text-sm text-gray-900">Bölgesel ve Para Birimi Standartları</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                Varsayılan Para Birimi
              </label>
              <select
                value={company.currency || 'TRY'}
                onChange={(e) => setCompany({ ...company, currency: e.target.value })}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
              >
                <option value="TRY">Türk Lirası (₺ - TRY)</option>
                <option value="USD">Amerikan Doları ($ - USD)</option>
                <option value="EUR">Euro (€ - EUR)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                Zaman Dilimi
              </label>
              <select
                value={company.timezone || 'Europe/Istanbul'}
                onChange={(e) => setCompany({ ...company, timezone: e.target.value })}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
              >
                <option value="Europe/Istanbul">İstanbul (UTC+03:00)</option>
                <option value="UTC">UTC (Standart Zaman)</option>
                <option value="Europe/London">Londra (UTC+00:00 / +01:00)</option>
                <option value="Europe/Berlin">Berlin (UTC+01:00 / +02:00)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                Sistem Dili
              </label>
              <select
                disabled
                value="tr"
                className="w-full bg-gray-100/50 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-600 outline-none cursor-not-allowed"
              >
                <option value="tr">Türkçe (Varsayılan)</option>
                <option value="en">English (Global)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Şirket Profilini Kaydet</span>
          </button>
        </div>
      </form>
    </div>
  );
}
