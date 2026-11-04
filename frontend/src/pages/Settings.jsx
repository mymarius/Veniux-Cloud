import CashierPermissions from './settings/CashierPermissions';
import ScannerPanel from '../components/ScannerPanel';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Building2,
  Users,
  Shield,
  Warehouse,
  Smartphone,
  Blocks,
  Bell,
  Palette,
  Lock,
  Key,
  Database
} from 'lucide-react';

import AccountTab from './settings/AccountTab';
import CompanyTab from './settings/CompanyTab';
import UsersTab from './settings/UsersTab';
import RolesTab from './settings/RolesTab';
import WarehouseTab from './settings/WarehouseTab';
import DevicesTab from './settings/DevicesTab';
import IntegrationsTab from './settings/IntegrationsTab';
import NotificationsTab from './settings/NotificationsTab';
import AppearanceTab from './settings/AppearanceTab';
import SecurityTab from './settings/SecurityTab';
import LicenseTab from './settings/LicenseTab';
import SystemEngineTab from './settings/SystemEngineTab';
import AutomationTab from './settings/AutomationTab';

export default function SettingsPage() {
  const [searchParams,setSearchParams] = useSearchParams();
  const requestedTab=searchParams.get('tab')||'account';
  const setActiveTab=tab=>setSearchParams(previous=>{const next=new URLSearchParams(previous);next.set('tab',tab);return next;});

  const TABS = [
    { id: 'account', label: 'Hesabım', icon: User },
    { id: 'company', label: 'Şirket bilgileri', icon: Building2 },
    { id: 'users', label: 'Kullanıcılar', icon: Users },
    { id: 'roles', label: 'Roller ve yetkiler', icon: Shield },
    { id: 'warehouse', label: 'Depo ayarları', icon: Warehouse },
    { id: 'scanner', label: 'Barkod okuyucular ve kasa', icon: Smartphone },
    { id: 'devices', label: 'El terminalleri', icon: Smartphone },
    { id: 'integrations', label: 'Entegrasyonlar', icon: Blocks },
    { id: 'notifications', label: 'Bildirimler', icon: Bell },
    { id: 'automation', label: 'Asistan otomasyonu', icon: Bell },
    { id: 'appearance', label: 'Görünüm', icon: Palette },
    { id: 'security', label: 'Güvenlik', icon: Lock },
    { id: 'license', label: 'Lisans ve plan', icon: Key },
    { id: 'system', label: 'Sistem', icon: Database },
  ];
  const activeTab=TABS.some(tab=>tab.id===requestedTab)?requestedTab:'account';

  return (
    <div className="settings-workspace flex min-w-0 bg-white border border-gray-200 rounded-xl shadow-xs">
      {/* Left Navigation */}
      <div className="settings-navigation w-64 border-r border-gray-200 bg-gray-50/70 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-xs text-gray-900 font-mono uppercase tracking-widest">
            Ayarlar
          </h2>
        </div>
        <div className="p-3 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
              }`}
            >
              <tab.icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-500'}`} />
              <span className="text-left whitespace-normal">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="min-w-0 flex-1 bg-gray-100/60 p-6 sm:p-8">
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'company' && <CompanyTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'roles' && <RolesTab onNavigate={setActiveTab} />}
        {activeTab === 'warehouse' && <WarehouseTab />}
        {activeTab === 'scanner' && <><ScannerPanel settingsMode onCode={async()=>{}} /><CashierPermissions /></>}
        {activeTab === 'devices' && <DevicesTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'automation' && <AutomationTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'license' && <LicenseTab />}
        {activeTab === 'system' && <SystemEngineTab />}
      </div>
    </div>
  );
}
