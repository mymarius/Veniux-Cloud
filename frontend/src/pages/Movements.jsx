import { Dropdown } from '../components/ui';
import React, { useState, useEffect } from 'react';
import apiClient, { useDataSync } from '../api/client';
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
import { QuickStockModal, QuickTransferModal } from '../components/QuickModals';
import { useToast } from '../components/Toast';
import { DataTable } from '../components/ui/DataTable';
import { MetricCard } from '../components/ui/MetricCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Drawer } from '../components/ui/Drawer';

export default function Movements() {
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

  const filteredMovements = movements.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.product_name && m.product_name.toLowerCase().includes(q)) ||
      (m.sku && m.sku.toLowerCase().includes(q)) ||
      (m.note && m.note.toLowerCase().includes(q)) ||
      (m.warehouse_name && m.warehouse_name.toLowerCase().includes(q))
    );
  });

  // Metrics summary
  const totalInbound = movements.filter((m) => m.change_amount > 0).reduce((acc, m) => acc + m.change_amount, 0);
  const totalOutbound = movements.filter((m) => m.change_amount < 0).reduce((acc, m) => acc + Math.abs(m.change_amount), 0);
  const totalTransfers = movements.filter((m) => m.movement_type === 'TRANSFER' || m.movement_type === 'RELOCATE').length;

  const columns = [
    {
      header: 'Tarih & Saat',
      accessorKey: 'created_at',
      cell: (info) => (
        <span className="font-mono text-[11px] text-gray-500">
          {new Date(info.getValue()).toLocaleString('tr-TR')}
        </span>
      )
    },
    {
      header: 'İşlem Tipi',
      accessorKey: 'movement_type',
      cell: (info) => (
        <StatusBadge status={info.getValue()} />
      )
    },
    {
      header: 'Ürün & SKU',
      accessorFn: row => row,
      id: 'product',
      cell: (info) => {
        const m = info.getValue();
        return (
          <div>
            <span className="font-bold text-gray-900">{m.product_name}</span>
            <span className="block text-[10px] font-mono text-gray-500">SKU: {m.sku}</span>
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
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-500" />
            <span className="font-semibold text-gray-500">{m.warehouse_name}</span>
            {m.target_warehouse_name && (
              <span className="text-gray-500">➔ {m.target_warehouse_name}</span>
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
              isPositive ? 'text-green-600' : 'text-red-500'
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
          <div className="flex items-center space-x-2 text-gray-500">
            <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded">
              {m.source || 'SYSTEM'}
            </span>
            <span className="truncate max-w-xs">{m.note || '-'}</span>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto text-gray-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-brand-500 text-white rounded-xl shadow-sm">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-mono tracking-tight uppercase">
                STOK HAREKET DEFTERİ & DENETİM İZİ (AUDIT LOGS)
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/10 text-brand-500 border border-brand-500/20 font-mono">
                IMMUTABLE AUDIT TRAIL
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Mal kabul, rafa yerleştirme, dalga toplama, sevk çıkış ve sayım düzeltme hareketleri
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-500 rounded-xl text-xs font-bold transition border border-gray-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Dışa Aktar</span>
          </button>

          <button
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-500/90 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Yeni Transfer Emri</span>
          </button>
        </div>
      </div>

      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <MetricCard
          title="TOPLAM İŞLEM KAYDI"
          value={movements.length}
          subtitle="Deftere işlenen hareketler"
        />
        <MetricCard
          title="TOPLAM GİRİŞ HACMİ"
          value={`+${totalInbound.toLocaleString('tr-TR')}`}
          subtitle="Mal kabul ve iadeler"
          valueColor="text-green-600"
        />
        <MetricCard
          title="TOPLAM ÇIKIŞ HACMİ"
          value={`-${totalOutbound.toLocaleString('tr-TR')}`}
          subtitle="Toplama ve sevkiyat"
          valueColor="text-red-500"
        />
        <MetricCard
          title="RAF TRANSFERLERİ"
          value={totalTransfers}
          subtitle="Bin-to-bin ikmal hareketleri"
          valueColor="text-brand-500"
        />
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Toolbar */}
        <div className="p-3.5 border-b border-gray-200 bg-gray-100 flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Quick Filter Chips */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold overflow-x-auto w-full lg:w-auto">
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
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  selectedType === t.id
                    ? 'bg-white text-brand-500 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search & Selectors */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Ürün adı, SKU veya Not ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 text-xs font-semibold rounded-xl pl-9 pr-3 py-2 outline-none focus:border-brand-500"
              />
            </div>

            <Dropdown
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-gray-100 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-brand-500 cursor-pointer"
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
          <DataTable
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
