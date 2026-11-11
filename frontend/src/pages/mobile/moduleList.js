import { Store, ScanLine, Tag, BarChart3, PackagePlus, ShoppingCart, Package, Printer, Bell, Settings, FileText } from 'lucide-react';

// Mobil uygulamadaki tüm modüller. İlk beşi ana ekranda gösterilir; "Tüm modüller" sayfası hepsini listeler.
export const MOBILE_MODULES = [
  { key: 'stores', title: 'Mağazalar', to: '/m/magazalar', Icon: Store, tone: 'blue' },
  { key: 'labels', title: 'Etiket Kontrolü', to: '/m/tara?mod=etiket', Icon: ScanLine, tone: 'teal' },
  { key: 'price', title: 'Fiyat Gör', to: '/m/tara?mod=fiyat', Icon: Tag, tone: 'orange' },
  { key: 'reports', title: 'Raporlar', to: '/normal-depo/analytics', Icon: BarChart3, tone: 'violet' },
  { key: 'receive', title: 'Mal Kabul', to: '/magaza/hizli-ekle', Icon: PackagePlus, tone: 'sky' },
  { key: 'pos', title: 'Kasa', to: '/magaza/kasa', Icon: ShoppingCart, tone: 'rose' },
  { key: 'products', title: 'Ürünler', to: '/normal-depo/products', Icon: Package, tone: 'blue' },
  { key: 'print', title: 'Etiket Yazdır', to: '/magaza/etiketler', Icon: Printer, tone: 'teal' },
  { key: 'alerts', title: 'Uyarılar', to: '/alerts', Icon: Bell, tone: 'orange' },
  { key: 'docs', title: 'Kılavuzlar', to: '/m/dokumanlar', Icon: FileText, tone: 'violet' },
  { key: 'settings', title: 'Ayarlar', to: '/settings', Icon: Settings, tone: 'sky' }
];
export const HOME_TILES = 5;

export function visibleModules(setup, moduleForPath) {
  if (!setup || setup.revision === 0 || !Array.isArray(setup.modules)) return MOBILE_MODULES;
  return MOBILE_MODULES.filter(m => m.to.startsWith('/m/') || !moduleForPath(m.to.split('?')[0]) || setup.modules.includes(moduleForPath(m.to.split('?')[0])));
}
