import React, { useState } from 'react';
import { Key, Copy, CheckCircle2, ShieldAlert } from 'lucide-react';
import apiClient from '../api/client';

export default function SecretLicenseGenerator() {
  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
    plan_id: 'ENTERPRISE_SUITE_ANNUAL'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setCopied(false);

    try {
      const response = await apiClient.post('/license/purchase', {
        ...formData,
        payment_method: 'ADMIN_OVERRIDE'
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Üretim hatası');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.license_key) {
      navigator.clipboard.writeText(result.license_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-200 font-sans">
      <div className="w-full max-w-lg bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
        
        {/* Hacker/Secret Vibe Decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-brand-500 to-yellow-500"></div>
        <div className="absolute top-4 right-4 animate-pulse flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-[9px] uppercase tracking-widest text-slate-400">Gizli Yönetici Erişimi</span>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-slate-900 border border-slate-700 flex items-center justify-center rounded-lg text-brand-500 shadow-inner">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Lisans Jeneratörü</h1>
            <p className="text-xs text-slate-400 mt-1">Veniux Kurumsal Master Key Üretici</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex gap-3 text-red-400 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Firma / Kurum Adı</label>
            <input 
              type="text" 
              required
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Örn: Master Kurumsal A.Ş."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Yönetici E-posta</label>
            <input 
              type="email" 
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="admin@sirket.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Lisans Tipi</label>
            <select
              value={formData.plan_id}
              onChange={(e) => setFormData({...formData, plan_id: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
            >
              <option value="NORMAL_WMS_ANNUAL">Normal Depo (WMS) Lisansı</option>
              
              <option value="ENTERPRISE_SUITE_ANNUAL">Kurumsal Stok ve Depo</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-xl mt-4 transition-colors shadow-[0_0_15px_rgba(234,88,12,0.3)] disabled:opacity-50"
          >
            {loading ? 'SİSTEME KAYDEDİLİYOR...' : 'MASTER LİSANS ÜRET'}
          </button>
        </form>

        {result && (
          <div className="mt-8 p-6 bg-green-900/20 border border-green-500/30 rounded-lg animate-fade-in text-center">
            <h3 className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">Lisans Başarıyla Üretildi</h3>
            <div 
              onClick={copyToClipboard}
              className="bg-slate-900 p-4 rounded-xl border border-slate-700 font-mono text-2xl font-bold text-white tracking-widest cursor-pointer hover:border-green-500 transition-colors flex items-center justify-between group"
            >
              {result.license_key}
              {copied ? <CheckCircle2 className="text-green-500 w-5 h-5" /> : <Copy className="text-slate-500 w-5 h-5 group-hover:text-green-500" />}
            </div>
            <p className="text-slate-500 text-xs mt-3">Sistemi kopyalamak için anahtara tıklayın.</p>
          </div>
        )}
      </div>
    </div>
  );
}
