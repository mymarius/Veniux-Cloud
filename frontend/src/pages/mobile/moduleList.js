import { Store, ScanLine, Tag, BarChart3, PackagePlus, ShoppingCart, Package, Printer, Bell, Settings, FileText, Search, AlertTriangle, Layers, Grid3x3, Utensils, ChefHat, ClipboardList, Smartphone } from 'lucide-react';

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
  { key: 'device', title: 'Cihaz Testi', to: '/m/cihaz-testi', Icon: Smartphone, tone: 'teal' },
  { key: 'settings', title: 'Ayarlar', to: '/settings', Icon: Settings, tone: 'sky' }
];
// Sektör paketleri: yalnız ilgili paket hesapta açıksa görünür (her paket ayrı satın alınır).
export const SECTOR_MODULES = [
  { key: 'h-search', title: 'Ürün Ara', to: '/m/urun-ara', Icon: Search, tone: 'blue', pack: 'hardware' },
  { key: 'h-critical', title: 'Kritik Stok', to: '/m/kritik', Icon: AlertTriangle, tone: 'rose', pack: 'hardware' },
  { key: 't-sets', title: 'Takımlar', to: '/m/setler', Icon: Layers, tone: 'violet', pack: 'tableware' },
  { key: 't-shelf', title: 'Raf Etiketleri', to: '/m/raf-etiket', Icon: Grid3x3, tone: 'teal', pack: 'tableware' },
  { key: 't-price', title: 'Fiyat Etiketi', to: '/m/fiyat-etiket', Icon: Printer, tone: 'orange', pack: 'tableware' },
  { key: 'r-waiter', title: 'Garson', to: '/m/garson', Icon: Utensils, tone: 'orange', pack: 'restaurant' },
  { key: 'r-kitchen', title: 'Mutfak', to: '/m/mutfak', Icon: ChefHat, tone: 'rose', pack: 'restaurant' },
  { key: 'r-owner', title: 'Esnaf Paneli', to: '/m/esnaf', Icon: ClipboardList, tone: 'blue', pack: 'restaurant' }
];
export const HOME_TILES = 8;
export const sectorFor = packs => SECTOR_MODULES.filter(m => packs && packs[m.pack]);

export function visibleModules(setup, moduleForPath) {
  if (!setup || setup.revision === 0 || !Array.isArray(setup.modules)) return MOBILE_MODULES;
  return MOBILE_MODULES.filter(m => m.to.startsWith('/m/') || !moduleForPath(m.to.split('?')[0]) || setup.modules.includes(moduleForPath(m.to.split('?')[0])));
}
