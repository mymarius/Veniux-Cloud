import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Boxes,
  Layers,
  Smartphone,
  Inbox,
  ShoppingCart,
  Truck,
  BarChart3,
  ScanLine,
  Package,
  ArrowRightLeft,
  Warehouse,
  Bell,
  ShieldAlert,
  FlaskConical,
  Users,
  ClipboardCheck,
  Plus,
  Minus,
  FileSpreadsheet,
  Settings,
  ArrowRight,
  Sparkles,
  Command,
  X,
  Pill,
  Clock,
  Zap,
  MapPin
} from 'lucide-react';
import apiClient from '../api/client';

export default function GlobalCommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Live Search against backend products and barcodes
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const [prodRes, barcodeRes] = await Promise.allSettled([
          apiClient.get(`/products?search=${encodeURIComponent(query.trim())}&limit=5`),
          apiClient.post('/wms/barcode/resolve', { barcode: query.trim() })
        ]);

        const items = [];
        if (barcodeRes.status === 'fulfilled' && barcodeRes.value?.data?.matched) {
          const b = barcodeRes.value.data;
          items.push({
            id: `barcode-${b.code}`,
            category: 'WMS Barkod / Lokasyon Eşleşmesi',
            title: `${b.type}: ${b.code}`,
            subtitle: b.message || 'Geçerli WMS Varlığı',
            path: b.type === 'LOCATION' ? '/normal-depo/locations' : b.type === 'WAVE' ? '/normal-depo/picking' : '/inventory',
            icon: b.type === 'LOCATION' ? MapPin : b.type === 'PRODUCT' ? Package : Zap
          });
        }

        if (prodRes.status === 'fulfilled') {
          const prods = prodRes.value.data.products || prodRes.value.data || [];
          prods.forEach(p => {
            items.push({
              id: `prod-${p.id}`,
              category: 'Ürün Kataloğu',
              title: p.name,
              subtitle: `SKU: ${p.sku} ${p.gtin ? `• Barkod: ${p.gtin}` : ''} • Fiyat: ₺${Number(p.sale_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
              path: '/inventory',
              icon: Package
            });
          });
        }

        setSearchResults(items);
      } catch (err) {
        console.error('Command search error:', err);
      } finally {
        setSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Static WMS and ERP Navigation Pages
  const pages = [
    { id: 'page-wms-map', category: 'Depo işlemleri', title: 'Depo ve raflar', subtitle: '2D koridor doluluk matrisi ve raf transferleri', path: '/normal-depo/locations', icon: Layers },
    { id: 'page-wms-pda', category: 'Depo işlemleri', title: 'Mobil ve el terminali', subtitle: 'Barkod okutma ve depo işlemleri', path: '/normal-depo/terminal', icon: Smartphone },
    { id: 'page-wms-inb', category: 'Depo işlemleri', title: 'Mal kabul', subtitle: 'Gelen ürünleri depoya kaydedin', path: '/normal-depo/inbound', icon: Inbox },
    { id: 'page-wms-pick', category: 'Depo işlemleri', title: 'Sipariş toplama', subtitle: 'Toplanacak ürünleri ve siparişleri takip edin', path: '/normal-depo/picking', icon: ShoppingCart },
    { id: 'page-wms-disp', category: 'Depo işlemleri', title: 'Paketleme ve sevkiyat', subtitle: 'Hazırlanan ürünlerin çıkışını takip edin', path: '/normal-depo/dispatch', icon: Truck },
    { id: 'page-wms-count', category: 'Depo işlemleri', title: 'Stok sayımı', subtitle: 'Sayılan miktarları kayıtlarla karşılaştırın', path: '/normal-depo/counting', icon: Boxes },
    { id: 'page-wms-slot', category: 'Depo raporları', title: 'Depoya genel bakış', subtitle: 'Depo durumunu ve işlem özetlerini görün', path: '/normal-depo/dashboard', icon: BarChart3 },
    { id: 'page-inv', category: 'Stok Defteri', title: 'Ürünler ve stok', subtitle: 'Ürün kayıtları ve kullanılabilir miktarlar', path: '/inventory', icon: Boxes },
    { id: 'page-mov', category: 'Stok Defteri', title: 'Stok hareketleri', subtitle: 'Depo giriş, çıkış ve transfer hareketleri', path: '/normal-depo/movements', icon: ArrowRightLeft },
  ];

  const q = query.toLowerCase().trim();

  const filteredPages = pages.filter((p) => !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

  const allItems = [...searchResults, ...filteredPages];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelectItem(allItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectItem = (item) => {
    onClose();
    navigate(item.path);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] text-gray-900 animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-gray-100 flex items-center px-5 py-4 bg-gray-50/70">
          <Search className="w-5 h-5 text-brand-500 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="SKU, Barkod, Raf (A-01-02-03), Palet, Dalga veya Sayfa ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-gray-900 text-gray-900 placeholder-slate-400 outline-none"
          />
          {searching && (
            <span className="text-[10px] font-mono text-brand-500 font-bold mr-2 animate-pulse">ARANIYOR...</span>
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-500 dark:hover:text-gray-900 rounded-lg hover:bg-slate-200 dark:hover:bg-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-gray-500 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-gray-500 opacity-60" />
              <p className="text-xs font-semibold">Aramanızla eşleşen WMS kaydı veya sayfa bulunamadı.</p>
            </div>
          ) : (
            allItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id || idx}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-brand-50 border border-indigo-200 dark:border-brand-500/30'
                      : 'hover:bg-gray-100 dark:hover:bg-white/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-white text-gray-500'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-900 text-gray-900 truncate">{item.title}</span>
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-white/80 px-1.5 py-0.2 rounded">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 text-gray-500 truncate">{item.subtitle}</p>
                    </div>
                  </div>

                  <ArrowRight className={`w-4 h-4 shrink-0 transition ${isSelected ? 'text-brand-500 dark:text-brand-500 translate-x-0.5' : 'text-gray-500 opacity-0'}`} />
                </div>
              );
            })
          )}
        </div>

        {/* Command Palette Footer */}
        <div className="px-4 py-2.5 bg-gray-100 dark:bg-white border-t border-gray-200 border-gray-200 flex items-center justify-between text-[11px] text-gray-500 font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ ile gezin</span>
            <span>↵ ile seç</span>
            <span>ESC ile kapat</span>
          </div>
          <span className="text-brand-500 font-bold">Veniux Universal WMS Resolver</span>
        </div>
      </div>
    </div>
  );
}
