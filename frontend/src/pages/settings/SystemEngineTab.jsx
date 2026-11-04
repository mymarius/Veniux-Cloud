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
      showToast('Sistem motoru telemetrisi alınamadı.', 'error');
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
          <p className="text-sm text-gray-500 mt-1">Veritabanı altyapısı, bellek kullanımı, arka plan işçileri ve bakım operasyonları.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDatabaseMigration(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-semibold transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Veritabanı Geçişi</span>
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
            <span>Veritabanını Optimize Et</span>
          </button>
        </div>
      </div>

      {/* Cluster & Engine Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="veniux-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-500 font-mono uppercase">Veritabanı Motoru</span>
            <StatusBadge status="active" text="AKTİF MOTOR" />
          </div>
          <h3 className="font-semibold text-base text-gray-900">{system?.engine || 'Ölçülmedi'}</h3>
          <p className="text-xs text-gray-500 font-mono">Mod: {system?.journalMode || 'Ölçülmedi'}</p>
          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
            <span>Disk Boyutu:</span>
            <span className="font-mono font-bold text-gray-900">{system?.dbSize || 'Ölçülmedi'}</span>
          </div>
        </div>

        <div className="veniux-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-500 font-mono uppercase">Node.js Çalışma Zamanı</span>
            <StatusBadge status="success" text="STABLE" />
          </div>
          <h3 className="font-semibold text-base text-gray-900">{system?.nodeVersion || 'Ölçülmedi'}</h3>
          <p className="text-xs text-gray-500 font-mono">Platform: {system?.platform || 'Ölçülmedi'}</p>
          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
            <span>Kesintisiz Çalışma (Uptime):</span>
            <span className="font-mono font-bold text-emerald-600">{system?.uptimeFormatted || 'Ölçülmedi'}</span>
          </div>
        </div>

        <div className="veniux-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-500 font-mono uppercase">Node.js heap belleği</span>
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
            <span>Resident Set Size (RSS):</span>
            <span className="font-mono font-bold text-gray-900">{system?.memoryUsage?.rssMB || 'Ölçülmedi'} MB</span>
          </div>
        </div>
      </div>

      {/* Database Record Statistics */}
      <div className="veniux-card p-6 space-y-4">
        <h3 className="font-bold text-sm text-gray-900 pb-3 border-b border-gray-200">
          Çekirdek Veri Tabloları İstatistiği
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Ürün SKU</span>
            <span className="font-semibold text-lg text-gray-900 font-mono">{system?.counts?.products || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Aktif Depolar</span>
            <span className="font-semibold text-lg text-gray-900 font-mono">{system?.counts?.warehouses || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Stok Girdisi</span>
            <span className="font-semibold text-lg text-gray-900 font-mono">{system?.counts?.stockRecords || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">El Terminalleri</span>
            <span className="font-semibold text-lg text-gray-900 font-mono">{system?.counts?.devices || 0}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="text-[10px] text-gray-400 font-mono block uppercase">Denetim Günlüğü</span>
            <span className="font-semibold text-lg text-gray-900 font-mono">{system?.counts?.auditLogs || 0}</span>
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
              SQLite ve MySQL/MariaDB hedefleri için ayrı veritabanında geçiş ve kabul kontrolleri.
            </p>
          </div>
          <button
            onClick={() => setShowDatabaseMigration(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Veritabanı Geçişini Aç</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Şema Parite Skoru</span>
            <span className="font-bold text-base text-brand-600">Hedefte doğrulanmalı</span>
            <p className="text-[11px] text-slate-500">Şema uyumu geçiş önizlemesi ve kabul testleriyle ölçülür.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Çift Yazma Koruması</span>
            <span className="font-bold text-base text-brand-600">Sunucuda erişim denetimi</span>
            <p className="text-[11px] text-slate-500">Hedef kilidi ve geçiş durumu ayrıca doğrulanmalıdır.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">Kurtarma Kapsamı</span>
            <span className="font-bold text-base text-slate-900">Güvenlik yedeği</span>
            <p className="text-[11px] text-slate-500">Yeni hedefte yazı sonrası geri dönüş veri uzlaştırması gerektirir.</p>
          </div>
        </div>
      </div>

      <HostingSponsor/>
      {readSessionUser().is_platform_admin && <BackupPanel />}

      <DatabaseMigrationModal
        isOpen={showDatabaseMigration}
        onClose={() => setShowDatabaseMigration(false)}
      />
    </div>
  );
}
