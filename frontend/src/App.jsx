import PageLoading from './components/PageLoading';
import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import apiClient from './api/client';
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { LicenseProvider, useLicense } from './context/LicenseContext';
import DesktopTitleBar from './components/desktop/DesktopTitleBar';
import SystemHealthModal from './components/desktop/SystemHealthModal';
import AssistantLauncher from './components/AssistantLauncher';
import ConnectionStatus from './components/ConnectionStatus';
import BackupHealth from './components/BackupHealth';
import PrintStationWorker from './components/PrintStationWorker';
import PrintStationLink from './components/PrintStationLink';
const LabelCenter=lazy(()=>import('./pages/LabelCenter'));

const PageSkeleton = PageLoading;

// Public Promotional Website & Activation

// Normal Depo
const StockMovementInsights = lazy(() => import('./pages/normal-depo/StockMovementInsights'));
const BusinessPortal = lazy(() => import('./pages/BusinessPortal'));
const BusinessInvite = lazy(() => import('./pages/BusinessInvite'));
const NormalDashboard = lazy(() => import('./pages/normal-depo/NormalDashboard'));
const RetailPos = lazy(() => import('./pages/RetailPos'));
const RetailQuickAdd = lazy(() => import('./pages/RetailQuickAdd'));
const NormalWarehouses = lazy(() => import('./pages/normal-depo/NormalWarehouses'));
const NormalLocations = lazy(() => import('./pages/normal-depo/NormalLocations'));
const NormalProducts = lazy(() => import('./pages/normal-depo/NormalProducts'));
const NormalInbound = lazy(() => import('./pages/normal-depo/NormalInbound'));
const NormalPicking = lazy(() => import('./pages/normal-depo/NormalPicking'));
const NormalDispatch = lazy(() => import('./pages/normal-depo/NormalDispatch'));
const NormalTransfers = lazy(() => import('./pages/normal-depo/NormalTransfers'));
const NormalCounting = lazy(() => import('./pages/normal-depo/NormalCounting'));
const NormalMovements = lazy(() => import('./pages/normal-depo/NormalMovements'));
const VirtualTerminal = lazy(() => import('./pages/normal-depo/VirtualTerminal'));

const LicenseActivation = lazy(() => import('./pages/LicenseActivation'));

// Core Veniux ERP & Stock Management Pages
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
// Mobil mağaza uygulaması (Android arayüzü veya cihazda açılan "mobil görünüm"): kendi üst bandı olan /m ekranları.
const MOBILE_UI = !!window.veniuxMobile || (() => { try { return localStorage.getItem('veniux-mobile-ui') === '1'; } catch { return false; } })();
const MobileProductSearch = lazy(() => import('./pages/mobile/sector/MobileHardware').then(m => ({ default: m.MobileProductSearch })));
const MobileCritical = lazy(() => import('./pages/mobile/sector/MobileHardware').then(m => ({ default: m.MobileCritical })));
const MobileSets = lazy(() => import('./pages/mobile/sector/MobileTableware').then(m => ({ default: m.MobileSets })));
const MobileShelfTags = lazy(() => import('./pages/mobile/sector/MobileTableware').then(m => ({ default: m.MobileShelfTags })));
const MobilePriceLabel = lazy(() => import('./pages/mobile/sector/MobileTableware').then(m => ({ default: m.MobilePriceLabel })));
const MobileWaiter = lazy(() => import('./pages/mobile/sector/MobileRestaurant').then(m => ({ default: m.MobileWaiter })));
const MobileKitchen = lazy(() => import('./pages/mobile/sector/MobileRestaurant').then(m => ({ default: m.MobileKitchen })));
const MobileOwner = lazy(() => import('./pages/mobile/sector/MobileRestaurant').then(m => ({ default: m.MobileOwner })));
const MobileRestaurantSetup = lazy(() => import('./pages/mobile/sector/MobileRestaurant').then(m => ({ default: m.MobileRestaurantSetup })));
const MobileLogin = lazy(() => import('./pages/mobile/MobileLogin'));
const MobileHome = lazy(() => import('./pages/mobile/MobileHome'));
const MobileModules = lazy(() => import('./pages/mobile/MobileModules'));
const MobileStores = lazy(() => import('./pages/mobile/MobileStores').then(m => ({ default: m.MobileStores })));
const MobileStoreDetail = lazy(() => import('./pages/mobile/MobileStores').then(m => ({ default: m.MobileStoreDetail })));
const MobileScan = lazy(() => import('./pages/mobile/MobileScan'));
const MobileList = lazy(() => import('./pages/mobile/MobileList'));
const MobileNotifications = lazy(() => import('./pages/mobile/MobileInfo').then(m => ({ default: m.MobileNotifications })));
const MobileDocs = lazy(() => import('./pages/mobile/MobileInfo').then(m => ({ default: m.MobileDocs })));
const MobileReleaseNotes = lazy(() => import('./pages/mobile/MobileInfo').then(m => ({ default: m.MobileReleaseNotes })));
const MobileSupport = lazy(() => import('./pages/mobile/MobileInfo').then(m => ({ default: m.MobileSupport })));
const Inventory = lazy(() => import('./pages/Inventory'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const ImportExport = lazy(() => import('./pages/ImportExport'));
const Settings = lazy(() => import('./pages/Settings'));
const CustomerSetup = lazy(() => import('./pages/CustomerSetup'));
const ApiManagement = lazy(() => import('./pages/ApiManagement'));

// CRM pages with persistent, directly accessible routes.
const CRMWorkspace = lazy(() => import('./pages/CRMWorkspace'));

// Hesap bilgisi oturum boyunca saklanır: sayfa hemen açılır, doğrulama arkada sürer. Yetkiyi her istekte sunucu denetler.
let accessCache = null;
const ProtectedRoute = ({ children }) => {
  const {centralRequired,isLicensed,loading:licenseLoading}=useLicense();
  const token = localStorage.getItem('token');
  const { pathname } = useLocation();
  const [access, setAccess] = useState(() => (accessCache?.token === token ? accessCache.value : null));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    if (accessCache?.token !== token) setAccess(null);
    // Cihaz lisans başlığı lisans yüklenince eklenir; önce gidilirse sunucu 423 döner ve oturum silinir.
    if (token && !licenseLoading) apiClient.get('/auth/me').then(({data}) => {
      if (current) { localStorage.setItem('user', JSON.stringify(data)); const value = {type:data.module_type,platform:data.is_platform_admin,package:data.product_package}; accessCache = {token, value}; setAccess(value); }
    }).catch(() => { if (current) { accessCache = null; setAccess({error:true}); } });
    return () => { current = false; };
  }, [token, pathname, retry, licenseLoading]);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (centralRequired && licenseLoading) return <PageSkeleton />;
  if (centralRequired && !isLicensed) return <Navigate to="/activate" replace />;
  if (!access) return <PageSkeleton />;
  if (access.error) return <div role="alert" className="p-8"><h1 className="text-xl font-bold">Hesap erişimi doğrulanamadı</h1><p className="mt-3">Bağlantınızı kontrol edip tekrar deneyin. İşlem yapılmadı.</p><button className="btn-primary mt-4" onClick={() => setRetry(value => value + 1)}>Tekrar dene</button></div>;
  if (access.type === 'NONE'  && pathname !== '/settings' && !pathname.startsWith('/admin/')) return <Layout><div role="status" className="p-8"><h1 className="text-xl font-bold">Müşteri hesabınız hazır</h1><p className="mt-3">Operasyon ekranları, hesabınıza aktif lisans paketi tanımlandığında açılır. Paketinizin etkinleştirilmesi için Veniux yöneticisiyle iletişime geçin.</p></div></Layout>;
  if (pathname.startsWith('/admin/') && !access.platform) return <Layout><p role="alert" className="p-8">Bu alan yalnızca platform yöneticisine açıktır.</p></Layout>;
  const familyRequired=pathname.startsWith('/magaza/')?'pos':/^\/normal-depo\/(inbound|outbound|locations|counting|picking|transfers)/.test(pathname)?'wms':null;
  if(access.package&&familyRequired&&!access.package.modules?.includes(familyRequired))return <Layout><p role="alert" className="p-8">Bu ekran paketinizde bulunmuyor. Paket değişikliği için yöneticinizle görüşün.</p></Layout>;
  const required = pathname.startsWith('/normal-depo/') || pathname.startsWith('/magaza/') ? 'NORMAL' : null;
  if (required && access.type !== 'BOTH' && access.type !== required) {
    return <Layout><div role="alert" className="p-8"><h1 className="text-xl font-bold">Bu modül paketinizde bulunmuyor</h1><p className="mt-3">Paketinize dahil ekranları sol menüden kullanabilirsiniz.</p></div></Layout>;
  }
  return pathname==='/magaza/kasa' || pathname==='/m' || pathname.startsWith('/m/') ? children : <Layout>{children}</Layout>;
};

// Eski /crm/... adreslerini tek sayfadaki ilgili sekmeye yönlendirir.
const LEGACY_CRM_TABS = { panel: 'dashboard', firsatlar: 'deals', adaylar: 'leads', hesaplar: 'companies', gorevler: 'tasks', analitik: 'analytics', otomasyon: 'automations', personel: 'team' };
const LegacyCRMRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={'/crm/' + (LEGACY_CRM_TABS[new URLSearchParams(search).get('sekme')] || 'dashboard')} replace />;
};

// Sık kullanılan sayfalar boşta önceden yüklenir; yeni sürüm sonrası bulunamayan kod dosyasında sayfa bir kez yenilenir.
const PRELOAD = [() => import('./pages/Dashboard'), () => import('./pages/normal-depo/NormalProducts'), () => import('./pages/normal-depo/NormalMovements'), () => import('./pages/normal-depo/NormalWarehouses'), () => import('./pages/normal-depo/NormalDashboard'), () => import('./pages/RetailPos'), () => import('./pages/Settings')];
function usePreloadPages() {
  useEffect(() => {
    if (navigator.connection?.saveData) return undefined;
    let stopped = false, index = 0, timer;
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 400));
    const next = () => { if (stopped || index >= PRELOAD.length) return; PRELOAD[index++]().catch(() => {}).finally(() => { timer = idle(next); }); };
    timer = setTimeout(() => idle(next), 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
}
window.addEventListener('vite:preloadError', event => {
  try {
    if (sessionStorage.getItem('veniux-chunk-reload')) return;
    sessionStorage.setItem('veniux-chunk-reload', '1');
    event.preventDefault();
    window.location.reload();
  } catch { /* depolama kapalıysa hata ekranı gösterilir */ }
});

function AppContent() {
  usePreloadPages();
  const [showHealth, setShowHealth] = useState(false);
  const terminal=useLocation().pathname==='/magaza/kasa';

  return (
    <div data-mobile={!!window.veniuxMobile} data-desktop={!!window.veniuxDesktop?.isDesktop} className="flex flex-col min-h-screen bg-bg">
      <PrintStationWorker/><PrintStationLink/>
      {/* Frameless Desktop Titlebar */}
      <DesktopTitleBar onOpenHealthModal={() => setShowHealth(true)} />

      {/* System Health Diagnostic Modal */}
      <SystemHealthModal isOpen={showHealth} onClose={() => setShowHealth(false)} />

      <main className="flex-1 flex flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* PUBLIC */}
            <Route path="/business" element={<ProtectedRoute><BusinessPortal /></ProtectedRoute>} />
            <Route path="/business-invite" element={<BusinessInvite />} />
            <Route path="/login" element={MOBILE_UI ? <MobileLogin /> : <Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/api" element={<ProtectedRoute><ApiManagement /></ProtectedRoute>} />
            <Route path="/activate" element={<LicenseActivation />} />
            <Route path="/admin/master-key-generator" element={<Navigate to="/admin/api" replace />} />
            <Route path="/" element={<Navigate to={localStorage.getItem('token') ? '/dashboard' : '/login'} replace />} />
            
            {/* DASHBOARD / GENERAL */}
            <Route path="/dashboard" element={MOBILE_UI ? <Navigate to="/m" replace /> : <ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/m" element={<ProtectedRoute><MobileHome /></ProtectedRoute>} />
            <Route path="/m/moduller" element={<ProtectedRoute><MobileModules /></ProtectedRoute>} />
            <Route path="/m/magazalar" element={<ProtectedRoute><MobileStores /></ProtectedRoute>} />
            <Route path="/m/magazalar/:id" element={<ProtectedRoute><MobileStoreDetail /></ProtectedRoute>} />
            <Route path="/m/tara" element={<ProtectedRoute><MobileScan /></ProtectedRoute>} />
            <Route path="/m/liste" element={<ProtectedRoute><MobileList /></ProtectedRoute>} />
            <Route path="/m/bildirimler" element={<ProtectedRoute><MobileNotifications /></ProtectedRoute>} />
            <Route path="/m/dokumanlar" element={<ProtectedRoute><MobileDocs /></ProtectedRoute>} />
            <Route path="/m/surum-notlari" element={<ProtectedRoute><MobileReleaseNotes /></ProtectedRoute>} />
            <Route path="/m/destek" element={<ProtectedRoute><MobileSupport /></ProtectedRoute>} />
            <Route path="/m/urun-ara" element={<ProtectedRoute><MobileProductSearch /></ProtectedRoute>} />
            <Route path="/m/kritik" element={<ProtectedRoute><MobileCritical /></ProtectedRoute>} />
            <Route path="/m/setler" element={<ProtectedRoute><MobileSets /></ProtectedRoute>} />
            <Route path="/m/raf-etiket" element={<ProtectedRoute><MobileShelfTags /></ProtectedRoute>} />
            <Route path="/m/fiyat-etiket" element={<ProtectedRoute><MobilePriceLabel /></ProtectedRoute>} />
            <Route path="/m/garson" element={<ProtectedRoute><MobileWaiter /></ProtectedRoute>} />
            <Route path="/m/mutfak" element={<ProtectedRoute><MobileKitchen /></ProtectedRoute>} />
            <Route path="/m/esnaf" element={<ProtectedRoute><MobileOwner /></ProtectedRoute>} />
            <Route path="/m/restoran-ayar" element={<ProtectedRoute><MobileRestaurantSetup /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/setup" element={<ProtectedRoute><CustomerSetup /></ProtectedRoute>} />
            <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
            <Route path="/import-export" element={<ProtectedRoute><ImportExport /></ProtectedRoute>} />

            {/* NORMAL DEPO */}
            <Route path="/magaza/etiketler" element={<ProtectedRoute><LabelCenter /></ProtectedRoute>} />
            <Route path="/magaza/kasa" element={<ProtectedRoute><RetailPos /></ProtectedRoute>} />
            <Route path="/magaza/hizli-ekle" element={<ProtectedRoute><RetailQuickAdd /></ProtectedRoute>} />
            <Route path="/normal-depo/analytics" element={<ProtectedRoute><StockMovementInsights /></ProtectedRoute>} />
            <Route path="/normal-depo/dashboard" element={<ProtectedRoute><NormalDashboard /></ProtectedRoute>} />
            <Route path="/normal-depo/warehouses" element={<ProtectedRoute><NormalWarehouses /></ProtectedRoute>} />
            <Route path="/normal-depo/locations" element={<ProtectedRoute><NormalLocations /></ProtectedRoute>} />
            <Route path="/normal-depo/products" element={<ProtectedRoute><NormalProducts /></ProtectedRoute>} />
            <Route path="/normal-depo/inbound" element={<ProtectedRoute><NormalInbound /></ProtectedRoute>} />
            <Route path="/normal-depo/picking" element={<ProtectedRoute><NormalPicking /></ProtectedRoute>} />
            <Route path="/normal-depo/dispatch" element={<ProtectedRoute><NormalDispatch /></ProtectedRoute>} />
            <Route path="/normal-depo/transfers" element={<ProtectedRoute><NormalTransfers /></ProtectedRoute>} />
            <Route path="/normal-depo/counting" element={<ProtectedRoute><NormalCounting /></ProtectedRoute>} />
            <Route path="/normal-depo/movements" element={<ProtectedRoute><NormalMovements /></ProtectedRoute>} />
            <Route path="/normal-depo/terminal" element={<ProtectedRoute><VirtualTerminal /></ProtectedRoute>} />

            {/* Retired sector routes are handled by the fallback. */}

            {/* CRM & Personel */}
            <Route path="/crm" element={<LegacyCRMRedirect />} />
            <Route path="/crm/:section/:id?" element={<ProtectedRoute><CRMWorkspace /></ProtectedRoute>} />
            <Route path="/crm/*" element={<Navigate to="/crm/dashboard" replace />} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
      {!terminal&&<AssistantLauncher />}
      <ConnectionStatus />
      {!terminal&&<BackupHealth />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LicenseProvider>
          <Router>
            <AppContent />
          </Router>
        </LicenseProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
