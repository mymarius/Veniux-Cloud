import CashierPermissions from './settings/CashierPermissions';
import PromoSettings from './settings/PromoSettings';
import PosPolicySettings from './settings/PosPolicySettings';
import PosDevices from './settings/PosDevices';
import ScannerPanel from '../components/ScannerPanel';
import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Building2,
  Users,
  Shield,
  Warehouse,
  Smartphone,
  ScanBarcode,
  Bot,
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
    { id: 'scanner', label: 'Barkod okuyucular ve kasa', icon: ScanBarcode },
    { id: 'devices', label: 'El terminalleri', icon: Smartphone },
    { id: 'integrations', label: 'Entegrasyonlar', icon: Blocks },
    { id: 'notifications', label: 'Bildirimler', icon: Bell },
    { id: 'automation', label: 'Asistan otomasyonu', icon: Bot },
    { id: 'appearance', label: 'Görünüm', icon: Palette },
    { id: 'security', label: 'Güvenlik', icon: Lock },
    { id: 'license', label: 'Lisans ve plan', icon: Key },
    { id: 'system', label: 'Sistem', icon: Database },
  ];
  const GROUPS = [
    ['Hesabınız', ['account', 'security', 'appearance']],
    ['İşletme', ['company', 'users', 'roles', 'license']],
    ['Depo ve cihazlar', ['warehouse', 'scanner', 'devices']],
    ['Bağlantılar', ['integrations', 'notifications', 'automation']],
    ['Bakım', ['system']],
  ];
  const activeTab=TABS.some(tab=>tab.id===requestedTab)?requestedTab:'account';

  // Mobil şeritte seçili ayar görünür kalsın.
  const menuRef = useRef(null);
  useEffect(() => {
    const menu = menuRef.current, active = menu?.querySelector('[aria-pressed="true"]');
    if (!active || menu.scrollWidth <= menu.clientWidth) return;
    const box = menu.getBoundingClientRect(), item = active.getBoundingClientRect();
    menu.scrollLeft += item.left - box.left - (box.width - item.width) / 2;
  }, [activeTab]);

  return (
    <div className="settings-workspace vx-set flex min-w-0">
      {/* Left Navigation */}
      <div className="settings-navigation flex flex-col shrink-0">
        <div className="vx-set-title"><h2>Ayarlar</h2></div>
        <div className="vx-set-menu" ref={menuRef}>
          {GROUPS.map(([title, ids]) => (
            <div className="vx-set-group" key={title}>
              <p>{title}</p>
              {ids.map(id => TABS.find(tab => tab.id === id)).map(tab => (
                <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                  <tab.icon aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="vx-set-body min-w-0 flex-1">
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'company' && <CompanyTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'roles' && <RolesTab onNavigate={setActiveTab} />}
        {activeTab === 'warehouse' && <WarehouseTab />}
        {activeTab === 'scanner' && <><div className="mb-5"><h1>Barkod okuyucular ve kasa</h1><p className="text-sm mt-2">Okuyucunuzu deneyin, bağlantı ayarlarını yapın ve kasiyer yetkilerini belirleyin.</p></div><ScannerPanel settingsMode onCode={async()=>{}} /><CashierPermissions /><PosPolicySettings /><PosDevices /><PromoSettings /></>}
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
