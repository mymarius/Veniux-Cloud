import { readSessionUser } from '../lib/sessionUser';
import veniuxLogo from '../assets/veniux-logo.webp';
import React, { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Activity, ArrowRightLeft, BarChart3, Bell, Boxes, Building2, CalendarClock,
  ChevronDown, ClipboardCheck, Database, FileSpreadsheet, Handshake, IdCard, Inbox, Layers,
  ListTodo, LogOut, Menu, Minus, Package, Pill, Plus, ScanBarcode, Search, Settings,
  ShieldCheck, ShoppingCart, Thermometer, Truck, Users, Warehouse, X, LayoutDashboard,
  Sparkles, UserPlus, MonitorSmartphone, History, Printer, PanelLeftClose, PanelLeftOpen
, Utensils, ChefHat, Search as SearchIcon, AlertTriangle as AlertTriangleIcon, Grid3x3, Printer as PrinterIcon} from 'lucide-react';
import apiClient, { useDataSync } from '../api/client';
import { QuickStockModal, QuickTransferModal } from './QuickModals';
import UserAvatar from './UserAvatar';
import GlobalCommandPalette from './GlobalCommandPalette';
import PhoneTabs from './PhoneTabs';
import { useToast } from './Toast';
import OwnerWelcome from './OwnerWelcome';
import ReleaseNotes, { PROGRAM_VERSION } from './ReleaseNotes';
import release from '../data/programRelease.json';
import { useSectorPacks } from '../lib/useSectorPacks';
import { evaluateCompatibility } from '../lib/versionCompat.mjs';
import useCustomerSetup from '../hooks/useCustomerSetup';
import {personalizeNavigation,PROFILES,profileActions} from '../lib/customerExperience.mjs';

// Her bölümde en sık kullanılan sayfalar görünür; seyrek kullanılanlar
// "Daha fazla" altında toplanır. Tüm sayfalar Ctrl K aramasından da açılır.
const NAVIGATION = [
  {
    id: 'general',
    items: [
      { name: 'Genel Bakış', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Saha ve bayi', path: '/business', icon: Handshake, cloudOnly: true },
      { name: 'Bildirimler', path: '/alerts', icon: Bell, badgeKey: 'alerts' }
    ]
  },
  {
    id: 'normal-depo',
    group: 'Stok ve Depo',
    modules: ['NORMAL', 'BOTH'],
    items: [
      { name: 'Depo Özeti', path: '/normal-depo/dashboard', icon: BarChart3 },
      { name: 'Stok Analizi', path: '/normal-depo/analytics', icon: BarChart3 },
      { name: 'Ürünler', path: '/normal-depo/products', icon: Package },
      { name: 'Stok Hareketleri', path: '/normal-depo/movements', icon: ArrowRightLeft },
      { name: 'Depolar', path: '/normal-depo/warehouses', icon: Warehouse },
      { name: 'Sanal Terminal', path: '/normal-depo/terminal', icon: MonitorSmartphone }
    ],
    more: [
      { name: 'Raf ve Lokasyonlar', path: '/normal-depo/locations', icon: Layers },
      { name: 'Mal Kabul', path: '/normal-depo/inbound', icon: Inbox },
      { name: 'Toplama', path: '/normal-depo/picking', icon: ClipboardCheck },
      { name: 'Sevkiyat', path: '/normal-depo/dispatch', icon: Truck },
      { name: 'Transfer', path: '/normal-depo/transfers', icon: ArrowRightLeft },
      { name: 'Stok Sayımı', path: '/normal-depo/counting', icon: ClipboardCheck },
      { name: 'Satın Alma Siparişleri', path: '/purchase-orders', icon: ShoppingCart },
      { name: 'Tedarikçiler', path: '/suppliers', icon: Handshake },
      { name: 'Stok Listesi', path: '/inventory', icon: Boxes },
      { name: 'Market Kasası', path: '/magaza/kasa', icon: ShoppingCart },
      { name: 'Hızlı Ürün Ekle', path: '/magaza/hizli-ekle', icon: ShoppingCart },
      { name: 'Etiket atölyesi', path: '/magaza/etiketler', icon: Printer }
    ]
  },
  {
    id: 'crm',
    group: 'Müşteriler ve Ekip',
    items: [
      { name: 'CRM Paneli', path: '/crm/dashboard', icon: Activity },
      { name: 'Satış Fırsatları', path: '/crm/deals', icon: Handshake },
      { name: 'Şirketler', path: '/crm/companies', icon: Building2 },
      { name: 'Kişiler', path: '/crm/contacts', icon: Users },
      { name: 'Görevler', path: '/crm/tasks', icon: ListTodo },
      { name: 'Personel', path: '/crm/team', icon: IdCard }
    ],
    more: [
      { name: 'Aday Müşteriler', path: '/crm/leads', icon: UserPlus },
      { name: 'Aktiviteler', path: '/crm/activities', icon: FileSpreadsheet },
      { name: 'CRM Analitik', path: '/crm/analytics', icon: BarChart3 },
      { name: 'Otomasyon', path: '/crm/automations', icon: Sparkles }
    ]
  },
  {
    id: 'tools',
    group: 'Araçlar',
    items: [
      { name: 'Operasyon Asistanı', path: '/ai-assistant', icon: Sparkles },
      { name: 'Veri Aktarımı', path: '/import-export', icon: FileSpreadsheet },
      { name: 'Sistem Ayarları', path: '/settings', icon: Settings },
      { name: 'Kurulum rehberi', path: '/setup', icon: ClipboardCheck },
      { name: 'API Yönetim Merkezi', path: '/admin/api', icon: ShieldCheck, platformOnly: true }
    ]
  }
];
// Sektör paketleri: her biri ayrı satın alınır; yalnız hesapta açık olanın bağlantıları görünür. Ekranlar telefon düzenindedir, masaüstünde de çalışır.
const SECTOR_NAV = [
  { name: 'Ürün Ara', path: '/sektor/urun-ara', icon: SearchIcon, pack: 'hardware' },
  { name: 'Kritik Stok', path: '/sektor/kritik', icon: AlertTriangleIcon, pack: 'hardware' },
  { name: 'Takımlar', path: '/sektor/setler', icon: Layers, pack: 'tableware' },
  { name: 'Raf Etiketleri', path: '/sektor/raf-etiket', icon: Grid3x3, pack: 'tableware' },
  { name: 'Fiyat Etiketi', path: '/sektor/fiyat-etiket', icon: PrinterIcon, pack: 'tableware' },
  { name: 'Garson', path: '/sektor/garson', icon: Utensils, pack: 'restaurant' },
  { name: 'Mutfak', path: '/sektor/mutfak', icon: ChefHat, pack: 'restaurant' },
  { name: 'Esnaf Paneli', path: '/sektor/esnaf', icon: ClipboardCheck, pack: 'restaurant' }
];
const ALL_ITEMS = NAVIGATION.flatMap(g => [...g.items, ...(g.more || [])]);
const ROLE_LABELS = { admin: 'İşletme yöneticisi', manager: 'Ekip yöneticisi', viewer: 'Görüntüleme' };

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('veniux_sidebar_collapsed') === '1'; } catch { return false; } });
  const toggleSidebar = () => setSidebarCollapsed(current => {
    try { localStorage.setItem('veniux_sidebar_collapsed', current ? '0' : '1'); } catch { /* tercih bu oturumda geçerli kalır */ }
    return !current;
  });
  const [unreadAlerts, setUnreadAlerts] = useState([]);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalType, setStockModalType] = useState('inbound');
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [compatibility, setCompatibility] = useState(null);
  useEffect(() => {
    let active = true;
    apiClient.get('/version').then(({ data }) => { if (active) setCompatibility(evaluateCompatibility({ clientVersion: PROGRAM_VERSION, minServer: release.minServer, server: data })); }).catch(() => {});
    return () => { active = false; };
  }, []);
  
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef(null);
  useEffect(() => {
    if (document.documentElement.dataset.motion==='off' || !contentRef.current?.animate) return;
    // Kısa bir kayma + belirme. Dönüşüm yalnızca animasyon süresince uygulanır
    // (fill yok); pencereler artık body'ye portal ile açıldığından etkilenmez.
    const transition = contentRef.current.animate(
      [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }],
      { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' }
    );
    return () => transition.cancel();
  }, [location.pathname, location.search]);
  const { showToast } = useToast();
  const [, setUserRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setUserRevision(n => n + 1);
    window.addEventListener('veniux:user-updated', refresh);
    return () => window.removeEventListener('veniux:user-updated', refresh);
  }, []);
  const user = readSessionUser();

  // Sekmeli sayfalarda (CRM) aynı rotayı paylaşan bağlantılar için aktiflik,
  // yalnızca yol değil ?sekme parametresi de dikkate alınarak hesaplanır.
  const isItemActive = (item) => {
    if (!item.tab) return location.pathname.startsWith(item.path);
    if (location.pathname !== item.path) return false;
    const current = new URLSearchParams(location.search).get('sekme') || 'panel';
    return current === item.tab;
  };

  const moduleType = user.module_type || 'NONE';
  const {setup:customerSetup}=useCustomerSetup();
  useEffect(()=>{
    if(location.pathname==='/dashboard'&&user.role==='admin'&&customerSetup?.suggestFirstRun)navigate('/setup',{replace:true});
  },[customerSetup?.suggestFirstRun,location.pathname,user.role,navigate]);
  const groups = useMemo(() => personalizeNavigation(NAVIGATION
    .filter(group => !group.modules || group.modules.includes(moduleType))
    .map(group => ({ ...group, items: group.items.filter(item => (!item.platformOnly || user.is_platform_admin)&&(!item.cloudOnly||window.veniuxDesktop?.apiBase==='https://business.veniux.com/api'||window.VeniuxAndroid?.isCloud?.())) })),customerSetup,location.pathname),
  [moduleType, user.is_platform_admin,customerSetup,location.pathname]);
  const sectorPacks = useSectorPacks();
  const sectorItems = SECTOR_NAV.filter(item => sectorPacks && sectorPacks[item.pack]);
  const navGroups = useMemo(() => (sectorItems.length ? [...groups.slice(0, -1), { id: 'sector', group: 'Sektör paketleri', items: sectorItems }, ...groups.slice(-1)] : groups), [groups, sectorItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Varsayılan olarak yalnızca aktif sayfanın bölümü açıktır; başka bir
  // bölüme geçildiğinde menü yine sadeleşir.
  const [openSections, setOpenSections] = useState({});
  const [showMore, setShowMore] = useState({});
  const activeGroupId = navGroups.find(g => [...g.items, ...(g.more || [])].some(isItemActive))?.id;
  const isSectionOpen = id => openSections[id] === true;
  const toggleSection = id => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  useEffect(() => { setOpenSections(activeGroupId ? { [activeGroupId]: true } : {}); }, [activeGroupId]);

  // Menü rozetleri canlı verilerden gelir ve her kayıt değişikliğinden sonra yenilenir.
  const [expiringLots, setExpiringLots] = useState(0);
  const refreshBadges = useMemo(() => () => {
    apiClient.get('/alerts?status=active')
      .then(response => setUnreadAlerts(Array.isArray(response.data) ? response.data : []))
      .catch(() => setUnreadAlerts([]));

  }, [moduleType]);
  useEffect(() => { refreshBadges(); }, [refreshBadges]);
  useDataSync(refreshBadges, [refreshBadges]);
  const badges = { alerts: unreadAlerts.length, expiring: expiringLots };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); toggleSidebar(); }
      if (event.key === 'F2') { event.preventDefault(); setStockModalType('inbound'); setStockModalOpen(true); }
      if (event.key === 'F3') { event.preventDefault(); setStockModalType('outbound'); setStockModalOpen(true); }
      if (event.key === 'F4') { event.preventDefault(); navigate('/magaza/kasa'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('platform-tenant');
    sessionStorage.removeItem('platform-tenant-name');
    window.location.href = '/login';
  };

  return (
    <div className="enterprise-shell min-h-screen" data-sb-collapsed={sidebarCollapsed}>
      <a className="skip-navigation" href="#main-content">İçeriğe geç</a>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside aria-label="Ana menü" className={`sb fixed inset-y-0 left-0 z-40 flex h-screen w-[224px] flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 select-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="sb-brand">
          <Link to="/dashboard" onClick={() => setSidebarOpen(false)}>
            <img src={veniuxLogo} alt="" />
            <span><b>Veniux Cloud</b><small>İş Yönetim Platformu</small></span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} aria-label="Menüyü kapat" className="sb-icon-btn lg:hidden"><X size={16} /></button>
        </div>

        <button className="sb-search" aria-label="Ara veya git" title={sidebarCollapsed ? 'Ara veya git' : undefined} onClick={() => setIsCommandPaletteOpen(true)}>
          <Search size={15} /><span>Ara veya git…</span><kbd>Ctrl K</kbd>
        </button>

        <nav className="sb-nav">
          {navGroups.map(group => {
            const open = !group.group || isSectionOpen(group.id);
            const extraActive = (group.more || []).some(isItemActive);
            const moreOpen = showMore[group.id] || extraActive;
            const visible = moreOpen ? [...group.items, ...(group.more || [])] : group.items;
            const sectionId = `sb-section-${group.id}`;
            const GroupIcon = group.group === 'Stok ve Depo' ? Warehouse : group.group === 'Müşteriler ve Ekip' ? Users : Layers;
            return (
              <div key={group.id} className="sb-section" data-expanded={open}>
                {group.group && (
                  <button className="sb-section-title" aria-expanded={open} aria-controls={sectionId} title={sidebarCollapsed ? group.group : undefined} onClick={() => { if (sidebarCollapsed) { toggleSidebar(); setOpenSections(prev => ({ ...prev, [group.id]: true })); } else toggleSection(group.id); }}>
                    <span className="sb-group-mark"><GroupIcon size={17} strokeWidth={1.7}/></span><span>{group.group}</span>
                    <ChevronDown size={14} data-open={open} />
                  </button>
                )}
                {open && (
                  <div id={sectionId} className="sb-items">
                    {visible.map(item => {
                      const Icon = item.icon;
                      const active = isItemActive(item);
                      const badge = badges[item.badgeKey] || 0;
                      return (
                        <NavLink key={item.path} to={item.path} data-active={active} aria-current={active ? 'page' : undefined} title={sidebarCollapsed ? item.name : undefined} aria-label={item.name} onClick={() => setSidebarOpen(false)} className="sb-item">
                          <Icon size={16} strokeWidth={1.9} />
                          <span>{item.name}</span>
                          {badge > 0 && <em data-tone={item.badgeKey === 'expiring' ? 'warn' : undefined}>{badge > 99 ? '99+' : badge}</em>}
                        </NavLink>
                      );
                    })}
                    {group.more?.length > 0 && !extraActive && (
                      <button className="sb-more" aria-expanded={moreOpen} onClick={() => setShowMore(prev => ({ ...prev, [group.id]: !prev[group.id] }))}>
                        <ChevronDown size={13} data-open={moreOpen} />
                        {moreOpen ? 'Daha az göster' : `Daha fazla (${group.more.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <button type="button" className="sb-release-notes" aria-label="Sürüm notları" title={sidebarCollapsed ? 'Sürüm notları' : undefined} aria-haspopup="dialog" onClick={() => { setSidebarOpen(false); setReleaseNotesOpen(true); }}>
          <History size={16} aria-hidden="true"/><span>Sürüm notları</span><small>v{PROGRAM_VERSION}</small>
        </button>
        <div className="sb-account">
          <Link to="/settings" onClick={() => setSidebarOpen(false)} className="sb-account-main" title={user.email} aria-label="Hesap ayarları">
            <UserAvatar src={user.avatar_url} name={user.full_name || user.username || user.email} className="sb-avatar" />
            <span className="sb-account-text">
              <b>{user.full_name || user.username || user.email?.split('@')[0] || 'Hesabım'}</b>
              <small>{user.is_platform_admin ? 'Platform yöneticisi' : (ROLE_LABELS[user.role] || 'Kullanıcı')}</small>
            </span>
          </Link>
          <button onClick={handleLogout} className="sb-icon-btn" aria-label="Oturumu kapat" title="Oturumu kapat"><LogOut size={16} /></button>
        </div>
      </aside>

      {/* ── MAIN CONTENT COCKPIT ── */}
      <div className="sb-main flex min-w-0 flex-1 flex-col lg:pl-[224px] min-h-screen">
        
        {/* Oval Corporate Header */}
        <header className="enterprise-header sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-gray-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button 
              aria-label="Ana menüyü aç" aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)} 
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={sidebarCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'} aria-expanded={!sidebarCollapsed} title={`${sidebarCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'} (Ctrl+B)`}
              onClick={toggleSidebar}
              className="sb-toggle hidden h-9 w-9 items-center justify-center text-gray-600 hover:bg-gray-100 lg:flex"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            {window.veniuxMobile&&<img className="mobile-header-brand" src={veniuxLogo} alt=""/>}
            <div className="mobile-workspace-title hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{ALL_ITEMS.find(isItemActive)?.name || 'Veniux'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {window.veniuxMobile&&<button aria-label="İşletme asistanını aç" className="mobile-header-assistant" onClick={()=>window.dispatchEvent(new Event('veniux:assistant-open'))}><Sparkles size={20}/></button>}
            {/* Pill Search */}
            <button 
              onClick={() => setIsCommandPaletteOpen(true)} 
              className="hidden h-9 items-center gap-2 rounded-full border border-gray-200 bg-gray-50/80 px-3.5 text-[12.5px] text-gray-500 hover:border-brand-300 hover:bg-white hover:text-gray-800 transition-all lg:flex shadow-2xs"
            >
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <span>Menü veya ürün ara...</span>
              <kbd className="ml-3 rounded-full border border-gray-200 bg-white px-2 py-0.5 font-mono text-[9px] text-gray-400 font-semibold shadow-2xs">Ctrl K</kbd>
            </button>

            {/* Pill Stock In */}
            <button 
              onClick={() => { setStockModalType('inbound'); setStockModalOpen(true); }} 
              className="hidden h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-4 text-[12.5px] font-bold text-white shadow-sm shadow-brand-500/25 hover:from-brand-600 hover:to-brand-700 transition-all sm:flex"
            >
              <Plus className="h-3.5 w-3.5" /> Stok Girişi
            </button>

            {/* Pill Stock Out */}
            <button 
              onClick={() => { setStockModalType('outbound'); setStockModalOpen(true); }} 
              className="hidden h-9 items-center gap-1.5 rounded-full border border-gray-200/90 bg-white px-4 text-[12.5px] font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all sm:flex shadow-2xs"
            >
              <Minus className="h-3.5 w-3.5" /> Stok Çıkışı
            </button>

            {/* Pill Alert Bell */}
            <div className="relative">
              <button 
                aria-label="Bildirimleri göster" aria-expanded={showAlertsDropdown}
                onClick={() => setShowAlertsDropdown(p => !p)} 
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-2xs"
              >
                <Bell className="h-4 w-4" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-semibold text-white shadow-sm ring-2 ring-white">
                    {unreadAlerts.length}
                  </span>
                )}
              </button>
              
              {showAlertsDropdown && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl z-50 animate-scale-in">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <span className="text-[13px] font-semibold text-gray-900">Aktif Bildirimler</span>
                    <Link to="/alerts" onClick={() => setShowAlertsDropdown(false)} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-600 hover:bg-brand-100 transition-colors">
                      Tümünü Gör
                    </Link>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-auto pt-2.5 custom-scrollbar">
                    {unreadAlerts.length === 0 ? (
                      <p className="p-4 text-center text-[12.5px] text-gray-400">Yeni bildirim bulunmuyor.</p>
                    ) : (
                      unreadAlerts.slice(0, 5).map((alert, i) => (
                        <div key={alert.id || i} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 hover:border-brand-200 transition-colors">
                          <p className="text-[12.5px] font-bold text-gray-800">{alert.title || 'Depo Uyarısı'}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500">{alert.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport Content */}
        <main id="main-content" tabIndex={-1} className="enterprise-content min-w-0 flex-1 bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
          {compatibility && <div role="alert" className="vx-compat-alert">{compatibility.message}</div>}
          {user.is_platform_admin && sessionStorage.getItem('platform-tenant') && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap justify-between gap-3 text-sm text-amber-900"><span>Platform yönetimi · Aktif işletme: <strong>{sessionStorage.getItem('platform-tenant-name')}</strong></span><button className="btn-soft" data-tone="amber" onClick={()=>{sessionStorage.removeItem('platform-tenant');sessionStorage.removeItem('platform-tenant-name');window.location.assign(window.location.protocol==='file:'?'#/admin/api':'/admin/api');}}>Kendi hesabıma dön</button></div>}
          <div ref={contentRef} className="mx-auto w-full max-w-[1560px]">{['/dashboard','/normal-depo/dashboard'].includes(location.pathname)&&user.role==='admin'&&!customerSetup?.completed&&<section className="veniux-card p-4 mb-5 flex flex-wrap gap-3 items-center justify-between" aria-label="İşletme kurulum durumu"><div><h2 className="font-semibold">{customerSetup?.completed?'Çalışma alanınızın ayarları':'İlk iş gününe hazırlık'}</h2><p className="text-sm text-slate-500">{customerSetup?`${PROFILES.find(p=>p.id===customerSetup.profile)?.name||'Genel perakende'} · ${customerSetup.steps.filter(s=>s==='reviewed').length} incelenen, ${customerSetup.steps.filter(s=>s==='skipped').length} sonraya bırakılan adım`:'Kurulum durumu henüz doğrulanmadı.'}</p></div><Link className="btn-primary" to="/setup">{customerSetup?.completed?'Ayarları gözden geçir':'Kuruluma devam et'}</Link></section>}{['/dashboard','/normal-depo/dashboard'].includes(location.pathname)&&customerSetup&&<nav aria-label="İşletme profiline göre hızlı işlemler" className="flex flex-wrap gap-2 mb-5">{profileActions(customerSetup).map(([label,to])=><Link className="btn-secondary" key={to} to={to}>{label}</Link>)}</nav>}<Suspense fallback={<div className="vx-route-skeleton" role="status" aria-label="Sayfa yükleniyor"><i /><i /><i /></div>}>{children}</Suspense></div>
        </main>
      </div>

      {/* Global Modals */}
      {window.veniuxMobile&&<PhoneTabs onMenu={()=>setSidebarOpen(true)} menuOpen={sidebarOpen}/>}
      <QuickStockModal isOpen={stockModalOpen} onClose={() => setStockModalOpen(false)} type={stockModalType} onSuccess={() => { showToast(`Stok ${stockModalType === 'inbound' ? 'girişi' : 'çıkışı'} tamamlandı.`, 'success'); setStockModalOpen(false); }} />
      <QuickTransferModal isOpen={transferModalOpen} onClose={() => setTransferModalOpen(false)} onSuccess={() => { showToast('Depolar arası stok transferi tamamlandı.', 'success'); setTransferModalOpen(false); }} />
      <GlobalCommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
      <OwnerWelcome userId={user.id} />
      <ReleaseNotes isOpen={releaseNotesOpen} onClose={() => setReleaseNotesOpen(false)} />
    </div>
  );
}
