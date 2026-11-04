import ProductPackageSelection from '../../components/ProductPackageSelection';
import BankTransferPayment from '../../components/BankTransferPayment';
import React, { useState } from 'react';
import MobileConnection from './MobileConnection';
import { useLicense } from '../../context/LicenseContext';
import { useToast } from '../../components/Toast';
import { StatusBadge, Input } from '../../components/ui';
import { Key, ShieldCheck, Check, Sparkles, Cpu, HardDrive, Warehouse, Smartphone, Package, Loader2, ArrowRight } from 'lucide-react';

export default function LicenseTab() {
  const { license, isLicensed, hardwareInfo, activateLicenseKey, isOfflineMode, graceDaysRemaining } = useLicense();
  const { showToast } = useToast();
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activating, setActivating] = useState(false);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      return showToast('Lütfen geçerli bir lisans anahtarı girin.', 'warning');
    }

    setActivating(true);
    try {
      await activateLicenseKey(licenseKeyInput.trim().toUpperCase());
      showToast('Lisans anahtarı başarıyla doğrulandı ve etkinleştirildi!', 'success');
      setLicenseKeyInput('');
    } catch (err) {
      showToast(err.message || 'Lisans doğrulama başarısız. Anahtarı kontrol edin.', 'error');
    } finally {
      setActivating(false);
    }
  };

  const planName = license?.plan_tier || 'Doğrulanmış lisans paketi yok';
  const expiresAt = license?.expires_at ? new Date(license.expires_at).toLocaleDateString('tr-TR') : 'Belirtilmedi';

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in"><BankTransferPayment/><ProductPackageSelection/>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Lisans ve plan</h1>
        <p className="text-sm text-gray-500 mt-1">Yazılım lisans durumu, donanım kimliği ve modül yetkilerini görüntüleyin.</p>
      </div>

      {/* Plan Card */}
      <div className="veniux-card p-6 bg-gradient-to-br from-white via-white to-brand-50/30 border border-brand-500/20 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-brand-500 text-white shadow-lg shadow-brand-500/25">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-brand-600 uppercase tracking-widest font-mono">
                LİSANS PAKETİ
              </span>
              <h2 className="text-xl font-semibold text-gray-900">{planName}</h2>
            </div>
          </div>
          <StatusBadge
            status={isLicensed ? 'success' : 'warning'}
            text={isLicensed ? (isOfflineMode ? `ÇEVRİMDIŞI (${graceDaysRemaining} GÜN)` : 'AKTİF LİSANSLI') : 'AKTİF LİSANS YOK'}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Geçerlilik Bitiş</span>
            <span className="font-bold text-sm text-gray-900">{expiresAt}</span>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Donanım İstemcisi</span>
            <span className="font-bold text-sm text-gray-900 truncate block">{hardwareInfo?.deviceName || 'Web Terminal'}</span>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Cihaz Parmak İzi (Fingerprint)</span>
            <span className="font-mono text-xs text-brand-600 truncate block">{hardwareInfo?.fingerprint || 'Ölçülmedi'}</span>
          </div>
        </div>
      </div>

      <div className="veniux-card p-6 space-y-3"><h3 className="font-bold text-sm">Kapasite ve erişim</h3><p className="text-sm text-gray-500">Bu ekranda canlı kapasite sayaçları henüz bağlı değildir. Modül erişimini sunucu, firmanıza atanmış paket ve kullanıcı yetkileriyle kontrol eder. Platform yöneticisinin yönetim erişimi müşteri lisansı değildir.</p></div>

      <MobileConnection />
      {/* License Key Activation Form */}
      <div className="veniux-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <Key className="w-5 h-5 text-brand-500" />
          <h3 className="font-bold text-sm text-gray-900">Yeni Lisans Anahtarı Etkinleştir</h3>
        </div>
        <p className="text-xs text-gray-500">
          Yönetici tarafından sağlanan lisans anahtarını aşağıdaki alana girin. Çevrimiçi satın alma bu sürümde açık değildir.
        </p>

        <form onSubmit={handleActivate} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Input
              label="Lisans Anahtarı"
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              placeholder="VNX- ile başlayan lisans anahtarı"
              required
            />
          </div>
          <button
            type="submit"
            disabled={activating}
            className="btn-primary w-full sm:w-auto"
          >
            {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>Lisansı Doğrula & Etkinleştir</span>
          </button>
        </form>
      </div>
    </div>
  );
}

