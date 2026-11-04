import React from 'react';
import {
  Activity,
  ArrowRightLeft,
  Package,
  ShoppingCart,
  Boxes,
  Truck,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function WMSLiveActivityStream({
  activities = []
}) {
  const defaultActivities = [
    { id: 1, type: 'PICK', title: 'Dalga Toplama Onaylandı', details: '12 × Parol 500mg • A-01-01-01', user: 'Mehmet K. (PDA-01)', time: '14:32:11' },
    { id: 2, type: 'RECEIVE', title: 'İrsaliyeli Mal Kabul', details: '50 × Aspirin Plus C • IRS-2026-9901', user: 'Ali D. (Kabul Masası)', time: '14:31:40' },
    { id: 3, type: 'TRANSFER', title: 'Raftan Rafa Transfer', details: '5 × Flakon • A-01-01-02 ➔ B-01-02-01', user: 'Sistem İkmal', time: '14:28:15' },
    { id: 4, type: 'COUNT', title: 'Kör Sayım Mutabakatı', details: 'A-02-01-03 • Fark: +2 Adet Düzeltildi', user: 'Ahmet Y. (Supervisor)', time: '14:20:00' },
    { id: 5, type: 'SHIP', title: 'Koli Sevkiyat Çıkışı', details: 'PAL-2026-0001 • Yurtiçi Kargo (DOCK-02)', user: 'Sevkiyat Masası', time: '14:15:30' }
  ];

  const items = activities.length > 0 ? activities : defaultActivities;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'PICK': return <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />;
      case 'RECEIVE': return <Package className="w-3.5 h-3.5 text-emerald-500" />;
      case 'TRANSFER': return <ArrowRightLeft className="w-3.5 h-3.5 text-brand-500" />;
      case 'COUNT': return <Boxes className="w-3.5 h-3.5 text-purple-500" />;
      case 'SHIP': return <Truck className="w-3.5 h-3.5 text-brand-500" />;
      default: return <Activity className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white bg-gray-100 rounded-lg p-5 border border-gray-200 border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 border-gray-200 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-brand-50 text-brand-500 dark:text-brand-500">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 text-gray-900 uppercase tracking-wider">
              CANLI OPERASYON AKIŞI (LIVE FEED)
            </h3>
            <p className="text-[11px] text-gray-500">Depo içi anlık hareketler, PDA taramaları ve sevk onayları</p>
          </div>
        </div>

        <span className="flex items-center space-x-1 text-[10px] font-mono text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Realtime Sync</span>
        </span>
      </div>

      <div className="space-y-2.5">
        {items.map(item => (
          <div
            key={item.id}
            className="p-3 bg-gray-100/70 dark:bg-gray-100/60 rounded-xl border border-gray-200/80 border-gray-200 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-white dark:bg-white border border-gray-200 border-gray-200 shrink-0">
                {getTypeIcon(item.type)}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-900 text-gray-900">{item.title}</span>
                  <span className="text-[10px] font-mono text-gray-500">• {item.time}</span>
                </div>
                <p className="text-[11px] text-gray-500 text-gray-500 mt-0.5">{item.details}</p>
              </div>
            </div>

            <span className="text-[10px] font-mono text-gray-500 bg-white dark:bg-white px-2 py-1 rounded border border-gray-200 border-gray-200 whitespace-nowrap">
              {item.user}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
