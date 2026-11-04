import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Scale,
  Lock,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';

export default function WMSExceptionCenter({
  exceptions = [],
  onResolve = null
}) {
  const defaultExceptions = [
    { id: 1, type: 'CRITICAL', title: 'Kritik Stok Eşiği', message: 'A-01-01-01 gözünde stok kritik seviye altında (3 Adet)', time: '5 dk önce', location: 'A-01-01-01' },
    { id: 2, type: 'WEIGHT', title: 'Kantar Tartım Uyarısı', message: 'SEVK-2026-004 irsaliyesinde +1.4 kg varyans tespit edildi', time: '12 dk önce', location: 'DOCK-02' },
    { id: 3, type: 'BLOCKED', title: 'Kilitli Raf Lokasyonu', message: 'C-02-01-03 bakım ve dezenfeksiyon sebebiyle kilitli', time: '25 dk önce', location: 'C-02-01-03' },
    { id: 4, type: 'EXPIRY', title: 'Yaklaşan SKT Uyarısı', message: 'LOT-2026-B2 partisinin son kullanım tarihi 60 gün içinde doluyor', time: '1 sa önce', location: 'A-02-01-01' }
  ];

  const items = exceptions.length > 0 ? exceptions : defaultExceptions;

  const getTypeBadge = (type) => {
    switch (type) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'WEIGHT':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'BLOCKED':
        return 'bg-gray-1000/10 text-gray-500 text-gray-500 border-slate-500/20';
      case 'EXPIRY':
        return 'bg-brand-500/10 text-brand-500 dark:text-brand-500 border-blue-500/20';
      default:
        return 'bg-brand-50 text-brand-500 dark:text-brand-500 border-brand-500/20';
    }
  };

  return (
    <div className="bg-white bg-gray-100 rounded-lg p-5 border border-gray-200 border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 border-gray-200 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 text-gray-900 uppercase tracking-wider">
              OPERASYONEL İSTİSNA MERKEZİ (EXCEPTIONS)
            </h3>
            <p className="text-[11px] text-gray-500">{items.length} Açık Operasyonel Uyarı & Hata</p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          {items.length} MÜDAHALE GEREKLİ
        </span>
      </div>

      <div className="space-y-2.5">
        {items.map(item => (
          <div
            key={item.id}
            className="p-3 bg-gray-100/70 dark:bg-gray-100/60 rounded-xl border border-gray-200/80 border-gray-200 flex items-center justify-between gap-3 hover:border-gray-200 dark:hover:border-gray-200 transition"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border ${getTypeBadge(item.type)}`}>
                  {item.type}
                </span>
                <span className="text-xs font-bold text-gray-900 text-gray-900">{item.title}</span>
                <span className="text-[10px] font-mono text-gray-500">• {item.time}</span>
              </div>
              <p className="text-[11px] text-gray-500 text-gray-500">{item.message}</p>
            </div>

            <button
              onClick={() => onResolve && onResolve(item)}
              className="p-1.5 rounded-lg bg-white dark:bg-white text-gray-500 text-gray-500 hover:text-brand-500 dark:hover:text-brand-500 border border-gray-200 border-gray-200 shadow-xs transition shrink-0"
              title="İncele & Çöz"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
