import React from 'react';
import { Bell, CheckCheck, ClipboardList, Handshake, Users } from 'lucide-react';
import { Drawer } from '../../ui';
import { useCRM } from '../../../context/CRMContext';
import { Chip, Empty } from './Parts';

const CATEGORY = {
  deals: { label: 'Fırsat', icon: Handshake, tone: 'orange' },
  tasks: { label: 'Görev', icon: ClipboardList, tone: 'amber' },
  leads: { label: 'Aday', icon: Users, tone: 'violet' }
};

/** CRM bildirim çekmecesi — okundu işaretleme ve sekmeye yönlendirme. */
export default function CrmNotifications({ isOpen, onClose, onGoTab }) {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useCRM();
  const unread = notifications.filter((n) => !n.read);

  // Eski /crm/... bağlantıları artık sekme kimliğine karşılık gelir.
  const tabOf = (link) => {
    if (!link) return null;
    if (link.includes('deals')) return 'firsatlar';
    if (link.includes('leads')) return 'adaylar';
    if (link.includes('tasks')) return 'gorevler';
    if (link.includes('companies') || link.includes('contacts')) return 'hesaplar';
    return 'panel';
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Bildirimler" size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-gray-500">
            {unread.length ? `${unread.length} okunmamış bildirim` : 'Tümü okundu'}
          </span>
          {unread.length > 0 && (
            <button
              onClick={markAllNotificationsAsRead}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11.5px] font-bold text-brand-600 transition-colors hover:bg-brand-100"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tümünü okundu işaretle
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {notifications.map((n) => {
            const cat = CATEGORY[n.category] || { label: n.category, icon: Bell, tone: 'slate' };
            const Icon = cat.icon;
            const tab = tabOf(n.link);
            return (
              <button
                key={n.id}
                onClick={() => {
                  markNotificationAsRead(n.id);
                  if (tab) {
                    onGoTab?.(tab);
                    onClose();
                  }
                }}
                className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                  n.read ? 'border-gray-100 bg-white hover:border-gray-200' : 'border-brand-200/70 bg-brand-50/50 hover:border-brand-300'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${n.read ? 'bg-gray-100 text-gray-400' : 'bg-white text-brand-600 shadow-2xs'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className={`min-w-0 flex-1 text-[12.5px] font-bold ${n.read ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</p>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-gray-500">{n.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Chip tone={cat.tone}>{cat.label}</Chip>
                    <span className="text-[10.5px] font-semibold text-gray-400">{n.timestamp}</span>
                  </div>
                </div>
              </button>
            );
          })}

          {notifications.length === 0 && <Empty icon={Bell} title="Bildirim yok" hint="Yeni bir olay olduğunda burada görünür." />}
        </div>
      </div>
    </Drawer>
  );
}
