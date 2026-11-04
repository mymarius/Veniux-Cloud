import React from 'react';
import { ArrowRight, CheckCircle2, Smartphone, Users, Warehouse } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';

export default function LicenseSuccess({ licenseData, onContinue,onChangeLicense }) {
  if(!licenseData?.expires_at)return <div role="alert" className="p-8">Lisans bilgisi doğrulanamadı. Lisansınızı yeniden kontrol edin.</div>;
  const data = licenseData;
  const formattedExpiry = new Date(data.expires_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <AuthShell eyebrow="Kurulum tamamlandı" title="Lisans etkinleştirildi" description="Bu bilgisayar Veniux çalışma alanınız için doğrulandı.">
      <div data-testid="status-license-success" className="mb-5 flex items-center gap-3 rounded-lg border border-success/20 bg-green-50 p-3 text-sm font-bold text-green-600"><CheckCircle2 className="h-5 w-5" /> Erişim hazır</div>
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4 text-sm">
        <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Firma</p><p className="mt-1 truncate font-bold">{data.tenant_name}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Plan</p><p className="mt-1 font-bold text-brand-500">{data.plan_id}</p></div></div>
        <div className="flex items-center justify-between border-b border-gray-200 pb-4"><span className="text-xs text-gray-500">Geçerlilik tarihi</span><strong className="text-xs">{formattedExpiry}</strong></div>
        <div className="space-y-2"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Kaynak limitleri</p><div className="flex items-center justify-between rounded-md border border-gray-200 bg-white-raised px-3 py-2 text-xs"><span className="flex items-center gap-2 text-gray-500"><Users className="h-3.5 w-3.5 text-brand-500" /> Kullanıcı</span><strong>{data.max_users}</strong></div><div className="flex items-center justify-between rounded-md border border-gray-200 bg-white-raised px-3 py-2 text-xs"><span className="flex items-center gap-2 text-gray-500"><Warehouse className="h-3.5 w-3.5 text-brand-500" /> Depo</span><strong>{data.max_warehouses}</strong></div><div className="flex items-center justify-between rounded-md border border-gray-200 bg-white-raised px-3 py-2 text-xs"><span className="flex items-center gap-2 text-gray-500"><Smartphone className="h-3.5 w-3.5 text-brand-500" /> El terminali</span><strong>{data.max_pdas}</strong></div></div>
      </div>
      <button data-testid="button-license-continue" onClick={onContinue} className="btn-primary mt-5 w-full py-3">Sisteme giriş yap <ArrowRight className="h-4 w-4" /></button>
      {onChangeLicense&&<button onClick={onChangeLicense} className="btn-soft mt-3 w-full">Başka lisans kullan</button>}
    </AuthShell>
  );
}
