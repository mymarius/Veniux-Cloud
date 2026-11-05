import { Dropdown } from '../../components/ui';
import React, { useState, useEffect } from 'react';
import apiClient, { useDataSync } from '../../api/client';
import {
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Search,
  Calendar,
  Warehouse,
  Boxes,
  Plus,
  RefreshCw,
  Clock,
  Layers,
  MapPin,
  FileText,
  User
} from 'lucide-react';
import { QuickStockModal, QuickTransferModal } from '../../components/QuickModals';
import { useToast } from '../../components/Toast';
import { DataTable } from '../../components/ui/DataTable';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Drawer } from '../../components/ui/Drawer';

export default function NormalMovements() {
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const { showToast } = useToast();

  // Cross-page reactive sync: refresh ledger when any page mutates data
  useDataSync(() => {
    fetchMovements();
  });

  useEffect(() => {
    fetchMovements();
  }, [selectedType, selectedWarehouse, selectedProduct]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedType) params.append('movement_type', selectedType);
      if (selectedWarehouse) params.append('warehouse_id', selectedWarehouse);
      if (selectedProduct) params.append('product_id', selectedProduct);

      const [movRes, whRes, prodRes] = await Promise.all([
        apiClient.get(`/stock/movements?${params.toString()}&limit=300`),
        apiClient.get('/warehouses'),
        apiClient.get('/products')
      ]);

      setMovements(movRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Hareketler yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (movements.length === 0) {
      showToast('Dışa aktarılacak hareket bulunamadı.', 'warning');
      return;
    }

    const headers = ['Tarih', 'SKU', 'Ürün Adı', 'Depo', 'Hedef Depo', 'Hareket Tipi', 'Miktar', 'Kaynak', 'Not'];
    const rows = movements.map((m) => [
      new Date(m.created_at).toLocaleString('tr-TR'),
      m.sku,
      `"${(m.product_name || '').replace(/"/g, '""')}"`,
      `"${m.warehouse_name || ''}"`,
      `"${m.target_warehouse_name || '-'}"`,
      m.movement_type,
      m.change_amount,
      m.source || 'manual',
      `"${(m.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wms_stok_hareket_defteri_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Stok hareketleri CSV olarak indirildi.', 'success');
  };

    const columns = [
    {
      header: 'Tarih & Saat',
      accessorFn: row => new Date(row.created_at).toLocaleString('tr-TR'),
      id: 'created_at',
      cell: (info) => (
        <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
          {info.getValue()}
        </span>
      )
    },
    {
      header: 'İşlem Tipi',
      accessorKey: 'movement_type',
      cell: (info) => {
        const type = info.getValue();
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {({ inbound: 'Giriş', outbound: 'Çıkış', transfer: 'Transfer', adjustment: 'Düzeltme', sale: 'Satış', return: 'İade' })[type] || type}
          </span>
        );
      }
    },
    {
      header: 'Ürün & SKU',
      accessorFn: row => row,
      id: 'product',
      cell: (info) => {
        const m = info.getValue();
        return (
          <div>
            <span className="font-semibold text-slate-800">{m.product_name}</span>
            <span className="block text-[10px] font-mono text-slate-500 mt-0.5">SKU: {m.sku}</span>
          </div>
        );
      }
    },
    {
      header: 'Depo & Lokasyon Rotası',
      accessorFn: row => row,
      id: 'warehouse',
      cell: (info) => {
        const m = info.getValue();
        return (
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{m.warehouse_name}</span>
            {m.target_warehouse_name && (
              <span className="font-medium">➔ {m.target_warehouse_name}</span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Miktar Değişimi',
      accessorKey: 'change_amount',
      cell: (info) => {
        const val = info.getValue();
        const isPositive = val > 0;
        return (
          <div className="text-right">
            <span className={`font-mono text-sm font-bold tabular-nums ${
              isPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {isPositive ? `+${val}` : val}
            </span>
          </div>
        );
      }
    },
    {
      header: 'İşlem Kaynağı & Not',
      accessorFn: row => row,
      id: 'source_note',
      cell: (info) => {
        const m = info.getValue();
        return (
          <div className="flex items-center space-x-2 text-slate-500 text-xs">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              {m.source || 'SYSTEM'}
            </span>
            <span className="truncate max-w-xs">{m.note || '-'}</span>
          </div>
        );
      }
    }
  ];

  const filteredMovements = movements.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.sku && m.sku.toLowerCase().includes(q)) ||
      (m.product_name && m.product_name.toLowerCase().includes(q)) ||
      (m.note && m.note.toLowerCase().includes(q))
    );
  });

  const totalInbound = movements.filter(m => m.change_amount > 0).reduce((sum, m) => sum + m.change_amount, 0);
  const totalOutbound = movements.filter(m => m.change_amount < 0).reduce((sum, m) => sum + Math.abs(m.change_amount), 0);
  const totalTransfers = movements.filter(m => m.movement_type === 'TRANSFER').length;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto text-slate-800 font-sans pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Stok Hareketleri ve Denetim İzi
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              AUDIT LOGS
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Mal kabul, raf transferi, toplama ve çıkış hareketlerinin tarihçesi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-xs font-semibold transition-colors border border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Dışa Aktar</span>
          </button>

          <button
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Yeni Transfer Emri</span>
          </button>
        </div>
      </div>

      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">TOPLAM İŞLEM KAYDI</span>
          <p className="text-3xl font-light text-slate-800">{movements.length}</p>
          <span className="text-xs text-slate-400 mt-1">Deftere işlenen hareketler</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">TOPLAM GİRİŞ HACMİ</span>
          <p className="text-3xl font-light text-emerald-600">+{totalInbound.toLocaleString('tr-TR')}</p>
          <span className="text-xs text-slate-400 mt-1">Mal kabul ve iadeler</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">TOPLAM ÇIKIŞ HACMİ</span>
          <p className="text-3xl font-light text-rose-600">-{totalOutbound.toLocaleString('tr-TR')}</p>
          <span className="text-xs text-slate-400 mt-1">Toplama ve sevkiyat</span>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">RAF TRANSFERLERİ</span>
          <p className="text-3xl font-light text-slate-800">{totalTransfers}</p>
          <span className="text-xs text-slate-400 mt-1">Bin-to-bin ikmal hareketleri</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Toolbar */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Quick Filter Chips */}
          <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200 text-xs font-semibold overflow-x-auto w-full lg:w-auto">
            {[
              { id: '', label: `Tümü (${movements.length})` },
              { id: 'INBOUND', label: 'Mal Kabul / Giriş' },
              { id: 'OUTBOUND', label: 'Toplama / Çıkış' },
              { id: 'TRANSFER', label: 'Raf Transferi' },
              { id: 'COUNT_ADJUSTMENT', label: 'Sayım Mutabakatı' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  selectedType === t.id
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search & Selectors */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ürün adı, SKU veya Not ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 text-sm rounded-md pl-9 pr-3 py-2 outline-none focus:border-slate-400 text-slate-800 placeholder:text-slate-400 transition-colors"
              />
            </div>

            <Dropdown
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-white border border-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:border-slate-400 cursor-pointer text-slate-700 transition-colors"
            >
              <option value="">Tüm Depolar</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Dropdown>
          </div>
        </div>

        {/* Dense Enterprise Table */}
        <div className="p-0">
          <DataTable flush
            columns={columns}
            data={filteredMovements}
            loading={loading}
            emptyMessage={search || selectedType ? "Kriterlere uygun stok hareketi bulunamadı." : "Hareket bulunamadı."}
          />
        </div>
      </div>

      <QuickStockModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        type="inbound"
        onSuccess={fetchMovements}
      />

      <QuickTransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={fetchMovements}
      />
    </div>
  );
}
