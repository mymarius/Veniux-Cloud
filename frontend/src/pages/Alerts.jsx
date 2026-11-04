import { Link } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Filter,
  Check,
  Zap,
  Boxes,
  Warehouse,
  ShieldAlert,
  ShieldCheck,
  ArrowUpRight
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [runningEngine, setRunningEngine] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.severity) params.append('severity', filter.severity);

      const response = await apiClient.get(`/alerts?${params.toString()}`);
      setAlerts(response.data || []);
    } catch (err) {
      console.error(err);
      showToast('Uyarılar yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await apiClient.put(`/alerts/${id}`, { status: 'read' });
      showToast('Uyarı çözümlendi / okundu.', 'info');
      fetchAlerts();
    } catch (err) {
      showToast('İşlem başarısız oldu.', 'error');
    }
  };

  const handleRunRuleEngine = async () => {
    setRunningEngine(true);
    try {
      const res = await apiClient.post('/alerts/run-rule-engine');
      showToast(`Kural motoru taraması tamamlandı: ${res.data.created || 0} yeni istisna oluşturuldu.`, 'success');
      fetchAlerts();
    } catch (err) {
      showToast('Kural motoru çalıştırılamadı.', 'error');
    } finally {
      setRunningEngine(false);
    }
  };

  const unreadCount = alerts.filter((a) => a.status === 'unread' || a.status === 'active').length;
  const criticalCount = alerts.filter((a) => (a.severity === 'critical' || a.severity === 'danger') && (a.status === 'unread' || a.status === 'active')).length;

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
      case 'danger':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default:
        return 'bg-brand-500/10 text-brand-500 dark:text-brand-500 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Sistem Uyarıları ve Bildirimler
            </h1>
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                {criticalCount} KRİTİK
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Depo operasyonlarındaki anormallikler, stok eşik uyarıları ve zamanlanmış bildirimler.
          </p>
        </div>

        <button
          onClick={handleRunRuleEngine}
          disabled={runningEngine}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${runningEngine ? 'animate-spin' : ''}`} />
          <span>{runningEngine ? 'Denetleniyor...' : 'Manuel Denetim Başlat'}</span>
        </button>
      </div>

      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">AÇIK UYARILAR</span>
          <p className="text-3xl font-light text-slate-800">{unreadCount}</p>
          <span className="text-xs text-slate-400 mt-1">İncelenmesi gereken toplam kayıt</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-500 mb-2">KRİTİK UYARILAR</span>
          <p className="text-3xl font-light text-red-600">{criticalCount}</p>
          <span className="text-xs text-slate-400 mt-1">Acil müdahale gerektirir</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500 mb-2">NORMAL UYARILAR</span>
          <p className="text-3xl font-light text-brand-600">
            {alerts.filter(a => a.severity === 'warning').length}
          </p>
          <span className="text-xs text-slate-400 mt-1">Takip gerektiren kalemler</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-2">SİSTEM DURUMU</span>
          <p className="text-xl font-semibold text-emerald-600 mt-1">AKTİF</p>
          <span className="text-xs text-slate-400 mt-1">Arka plan denetimleri çalışıyor</span>
        </div>
      </div>

      {/* Main Alerts List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-200/50 p-1 rounded-md border border-slate-200 text-sm font-medium">
            {[
              { id: '', label: `Tümü (${alerts.length})` },
              { id: 'critical', label: `Kritik (${criticalCount})` },
              { id: 'warning', label: 'Uyarılar' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setFilter({ ...filter, severity: t.id })}
                className={`px-4 py-1.5 rounded transition-colors ${
                  filter.severity === t.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAlerts}
            className="p-2 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="p-0">
          {loading && alerts.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-slate-400" />
              <span className="text-sm">Kayıtlar yükleniyor...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-20 text-center text-slate-500 bg-slate-50/50">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
              <p className="font-semibold text-slate-700">Açık sistem uyarısı bulunmuyor.</p>
              <p className="text-sm text-slate-500 mt-1">Tüm operasyonel süreçler normal değerler içerisinde.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      {a.severity === 'critical' || a.severity === 'danger' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-sm">
                          <AlertTriangle className="w-3 h-3" /> Kritik
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-100 px-2 py-0.5 rounded-sm">
                          <Bell className="w-3 h-3" /> Uyarı
                        </span>
                      )}
                      <h3 className="font-semibold text-sm text-slate-800">{(a.title || a.message)?.replace(/^\[lot:\d+:\d+\]\s*/, '')}</h3>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(a.created_at).toLocaleString('tr-TR')}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mt-1">{(a.message || a.description)?.replace(/^\[lot:\d+:\d+\]\s*/, '')}</p>

                    {a.product_id&&<Link className="btn-soft" data-size="sm" to={'/normal-depo/products?product='+a.product_id+'&lot='+(a.message?.match(/\[lot:(\d+):/)?.[1]||'')}>Ürün / lotu incele</Link>}
                    {a.product_name && (
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-2 bg-slate-100 px-2 py-1 rounded w-fit">
                        <Boxes className="w-3.5 h-3.5" />
                        <span>Ürün: <strong>{a.product_name}</strong></span>
                        {a.warehouse_name && (
                          <>
                            <span className="text-slate-300">|</span>
                            <Warehouse className="w-3.5 h-3.5" />
                            <span>Depo: <strong>{a.warehouse_name}</strong></span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleMarkAsRead(a.id)}
                    className="px-4 py-2 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-md text-xs font-semibold transition-colors shrink-0 flex items-center gap-2 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Çözüldü İşaretle
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
