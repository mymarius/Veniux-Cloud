import { readSessionUser } from '../../lib/sessionUser';
import HostingSponsor from '../../components/HostingSponsor';
import React, { useState, useEffect } from 'react';
import BackupPanel from './BackupPanel';
import DatabaseMigrationModal from '../../components/migration/DatabaseMigrationModal';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { StatusBadge } from '../../components/ui';
import { Database, Cpu, HardDrive, RefreshCw, Activity, Layers, ShieldCheck, Download, Zap, Loader2, Server, ArrowRightLeft } from 'lucide-react';

export default function SystemEngineTab() {
  const { showToast } = useToast();
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [showDatabaseMigration, setShowDatabaseMigration] = useState(false);

  useEffect(() => {
    fetchSystemEngine();
  }, []);

  const fetchSystemEngine = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings/system-engine');
      setSystem(res.data);
    } catch (err) {
      showToast('Sistem bilgileri alınamadı.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVacuum = async () => {
    setOptimizing(true);
    try {
      const res = await apiClient.post('/settings/system-engine/vacuum');
      showToast(res.data?.message || 'Veritabanı optimizasyonu başarıyla tamamlandı.', 'success');
      fetchSystemEngine();
    } catch (err) {
      showToast(err.response?.data?.error || 'Optimizasyon işlemi sırasında hata oluştu.', 'error');
    } finally {
      setOptimizing(false);
    }
  };


  if (loading && !system) {
    return (
      <div role="status" aria-label="Sistem bilgileri yükleniyor" className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!system) return <div role="alert" className="veniux-card p-6">Sistem verileri alınamadı. <button onClick={fetchSystemEngine} className="btn-secondary">Yeniden dene</button></div>;

  const memoryPercent = system?.memoryUsage
    ? Math.min(100, Math.round((parseFloat(system.memoryUsage.heapUsedMB) / parseFloat(system.memoryUsage.heapTotalMB)) * 100))
    : 0;

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sistem durumu</h1>
          <p className="text-sm text-gray-500 mt-1">Programın çalıştığı ortam, kayıt sayıları ve bakım işlemleri.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDatabaseMigration(true)}
            className="btn-secondary"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Veritabanı geçişi</span>
          </button>
          <button
            onClick={fetchSystemEngine}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
          <button
            onClick={handleVacuum}
            disabled={optimizing}
            className="btn-primary"
          >
            {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>Veritabanını düzenle</span>
          </button>
        </div>
      </div>

      {/* Cluster & Engine Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="veniux-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-500">Veritabanı</span>
            <StatusBadge status="active" text="Kullanımda" />
          </div>
          <h3 className="font-semibold text-base text-gray-900">{system?.engine || 'Ölçülmedi'}</h3>
          <p className="text-xs text-gray-500">Kayıt modu: {system?.journalMode || 'Ölçülmedi'}</p>
          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
            <span>Disk boyutu</span>
            <span className="font-mono font-bold text-gray-900">{system?.dbSize || 'Ölçülmedi'}</span>
          </div>
        </div>

        <div className="veniux-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-500">Program sunucusu</span>
          </div>
          <h3 className="font-semibold text-base text-gray-900">{system?.nodeVersion || 'Ölçülmedi'}</h3>
          <p className="text-xs text-gray-500">Platform: {system?.platform || 'Ölçülmedi'}</p>
          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
            <span>Açık kaldığı süre</span>
            <span className="font-mono font-bold text-emerald-600">{system?.uptimeFormatted || 'Ölçülmedi'}</span>
          </div>
        </div>

        <div className="veniux-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-500">Bellek kullanımı</span>
            <StatusBadge status="info" text={`%${memoryPercent}`} />
          </div>
          <h3 className="font-semibold text-base text-gray-900">
            {system?.memoryUsage?.heapUsedMB || 'Ölçülmedi'} MB / {system?.memoryUsage?.heapTotalMB || 'Ölçülmedi'} MB
          </h3>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${memoryPercent}%` }}
            ></div>
          </div>
          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
            <span>Toplam ayrılan bellek</span>
            <span className="font-mono font-bold text-gray-900">{system?.memoryUsage?.rssMB || 'Ölçülmedi'} MB</span>
          </div>
        </div>
      </div>

      {/* Database Record Statistics */}
      <div className="veniux-card p-6 space-y-4">
        <h3 className="font-bold text-sm text-gray-900 pb-3 border-b border-gray-200">
          Kayıt sayıları
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="vx-set-stat-label block">Ürün</span>
            <span className="vx-set-stat-value">{system?.counts?.products || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="vx-set-stat-label block">Depo</span>
            <span className="vx-set-stat-value">{system?.counts?.warehouses || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="vx-set-stat-label block">Stok kaydı</span>
            <span className="vx-set-stat-value">{system?.counts?.stockRecords || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="vx-set-stat-label block">El terminali</span>
            <span className="vx-set-stat-value">{system?.counts?.devices || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="vx-set-stat-label block">İşlem kaydı</span>
            <span className="vx-set-stat-value">{system?.counts?.auditLogs || 0}</span>
          </div>
        </div>
      </div>

      {/* MySQL Migration & Parity Overview Card */}
      <div className="veniux-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-brand-600" />
              Veritabanı geçişi ve kurtarma
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Verileri başka bir veritabanına taşımadan önce ayrı bir kopyada denenir; mevcut verileriniz bu sırada değişmez.
            </p>
          </div>
          <button
            onClick={() => setShowDatabaseMigration(true)}
            className="btn-secondary"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Geçişi aç</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="vx-set-stat-label block">Uyum</span>
            <span className="font-bold text-base text-brand-600">Geçişte denenir</span>
            <p className="text-[11px] text-slate-500">Yeni veritabanının uyumu geçiş önizlemesinde kontrol edilir.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="vx-set-stat-label block">Çakışma koruması</span>
            <span className="font-bold text-base text-brand-600">Geçişte kontrol edilir</span>
            <p className="text-[11px] text-slate-500">Geçiş sırasında iki veritabanına birden yazılmadığını ayrıca doğrulayın.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="vx-set-stat-label block">Geri dönüş</span>
            <span className="font-bold text-base text-slate-900">Yedekten</span>
            <p className="text-[11px] text-slate-500">Yeni veritabanına kayıt girildikten sonra geri dönmek, o kayıtların elle aktarılmasını gerektirir.</p>
          </div>
        </div>
      </div>

      <HostingSponsor/>
      {(readSessionUser().is_platform_admin || readSessionUser().role === 'admin') && <BackupPanel />}

      <DatabaseMigrationModal
        isOpen={showDatabaseMigration}
        onClose={() => setShowDatabaseMigration(false)}
      />
    </div>
  );
}
