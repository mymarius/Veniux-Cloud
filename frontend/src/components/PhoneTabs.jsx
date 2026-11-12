import { NavLink, useLocation } from 'react-router-dom';
import { Home, Package, ScanBarcode, Store, Menu as MenuIcon } from 'lucide-react';
import useAlertWatcher from '../pages/mobile/useAlertWatcher';
import useFcmRegistration from '../pages/mobile/useFcmRegistration';

// Telefonun tek alt gezinme çubuğu: mağaza ana ekranında da Veniux Cloud ekranlarında da aynı beş hedef, aynı görünüm.
// Menü: Veniux Cloud ekranlarında tüm ekranların yan menüsünü açar (onMenu); mağaza ekranlarında "Tüm modüller" sayfasına gider (menuTo).
const TABS = [
  { to: '/m', label: 'Ana ekran', Icon: Home, end: true },
  { to: '/normal-depo/products', label: 'Ürünler', Icon: Package },
  { to: '/m/tara', label: 'Barkod', Icon: ScanBarcode, scan: true },
  { to: '/m/magazalar', label: 'Mağazalar', Icon: Store }
];

export default function PhoneTabs({ onMenu, menuTo = '/m/moduller', menuOpen = false }) {
  const { pathname } = useLocation();
  // Alt çubuk her telefon ekranında durur: yeni uyarılar hangi ekranda olunursa olunsun telefon bildirimi olarak gelir.
  useAlertWatcher(() => {});
  useFcmRegistration();
  return <nav className="mobile-bottom-nav phone-tabs" aria-label="Mobil gezinme">
    {TABS.map(({ to, label, Icon, end, scan }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active ' : '') + (scan ? 'tab-scan' : '')}><Icon size={21} /><span>{label}</span></NavLink>)}
    {onMenu
      ? <button type="button" aria-label="Tüm ekranlar" aria-expanded={menuOpen} onClick={onMenu}><MenuIcon size={21} /><span>Menü</span></button>
      : <NavLink to={menuTo} className={pathname.startsWith(menuTo) ? 'active' : ''} aria-label="Tüm ekranlar"><MenuIcon size={21} /><span>Menü</span></NavLink>}
  </nav>;
}
