import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  DollarSign,
  AtSign,
  CheckSquare,
  ShieldAlert,
  Sparkles,
  X,
  ArrowRight
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function NotificationDrawer() {
  const {
    notifications,
    isNotificationDrawerOpen,
    setIsNotificationDrawerOpen,
    markNotificationAsRead,
    markAllNotificationsAsRead
  } = useCRM();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'deals' | 'mentions' | 'tasks' | 'system'
  const navigate = useNavigate();

  if (!isNotificationDrawerOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    return n.category === activeTab;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'deals':
        return <DollarSign className="w-3.5 h-3.5 text-green-600" />;
      case 'mentions':
        return <AtSign className="w-3.5 h-3.5 text-brand-500" />;
      case 'tasks':
        return <CheckSquare className="w-3.5 h-3.5 text-amber-500" />;
      case 'system':
      default:
        return <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsNotificationDrawerOpen(false)}
    >
      <div
        className="w-full max-w-md h-full bg-white dark:bg-gray-100 border-l border-gray-200/50 border-gray-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-gray-200/50 border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-gray-100 dark:bg-white text-gray-900 dark:text-gray-900">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 text-gray-900">Notifications</h3>
              <p className="text-[11px] text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="text-[11px] font-semibold text-brand-500 dark:text-brand-500 hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
            <button
              onClick={() => setIsNotificationDrawerOpen(false)}
              className="p-1 text-gray-500 hover:text-gray-500 dark:hover:text-gray-900 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200/50 border-gray-200 bg-gray-100/50 dark:bg-slate-950/40 text-xs font-semibold overflow-x-auto">
          {['all', 'deals', 'mentions', 'tasks', 'system'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-md capitalize transition ${
                activeTab === tab
                  ? 'bg-gray-100 dark:bg-gray-100 text-white dark:text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40 dark:divide-slate-800/60 p-2">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-xs space-y-1">
              <Sparkles className="w-6 h-6 mx-auto text-gray-500 text-gray-500" />
              <p className="font-semibold text-gray-900 text-gray-500">No notifications</p>
              <p className="text-[11px]">You're all caught up with your team updates.</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  markNotificationAsRead(notif.id);
                  if (notif.link) {
                    navigate(notif.link);
                    setIsNotificationDrawerOpen(false);
                  }
                }}
                className={`p-3 rounded-lg text-xs cursor-pointer transition-all space-y-1.5 ${
                  !notif.read
                    ? 'bg-brand-500/10/60 dark:bg-blue-900/10 border-l-2 border-blue-600'
                    : 'hover:bg-gray-100 dark:hover:bg-white/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-gray-900">
                    {getCategoryIcon(notif.category)}
                    <span className="truncate">{notif.title}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-2">{notif.timestamp}</span>
                </div>

                <p className="text-gray-500 text-gray-500 text-[11.5px] leading-relaxed">{notif.message}</p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500">
                    {notif.category}
                  </span>
                  <span className="text-brand-500 dark:text-brand-500 text-[11px] font-semibold flex items-center gap-0.5 hover:underline">
                    View <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}



