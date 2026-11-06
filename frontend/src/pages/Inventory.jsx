import React, { useState, useEffect } from 'react';
import apiClient, { useDataSync } from '../api/client';
import {
  Search,
  Plus,
  Minus,
  RefreshCw,
  Boxes,
  ArrowRightLeft,
  MapPin
} from 'lucide-react';
import { QuickStockModal, QuickTransferModal, KarekodModal } from '../components/QuickModals';
import WMSDetailDrawer from '../components/wms/WMSDetailDrawer';
import { useToast } from '../components/Toast';
import { DataTable, StatusBadge, MetricCard, Dropdown } from '../components/ui';

export default function Inventory() {
  const [stockRecords, setStockRecords] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');

  // Modals & Drawer state
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalType, setStockModalType] = useState('inbound');
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [karekodModalOpen, setKarekodModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState(null);

  // WMS Detail Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const { showToast } = useToast();

  // Cross-page reactive sync: refresh inventory when any page mutates data
  useDataSync(() => {
    fetchData();
  });

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse, selectedCategory, search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedWarehouse) params.append('warehouse_id', selectedWarehouse);
      if (selectedCategory) params.append('category', selectedCategory);
      if (search) params.append('search', search);

      const [recordsRes, whRes, catRes] = await Promise.all([
        apiClient.get(`/stock/records?${params.toString()}`),
        apiClient.get('/warehouses'),
        apiClient.get('/products/categories')
      ]);

      setStockRecords(recordsRes.data || []);
      setWarehouses(whRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Stok kayıtları yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdjust = async (record, delta, e) => {
    e.stopPropagation();
    const newQty = Math.max(0, record.quantity + delta);
    try {
      await apiClient.post('/stock/adjust', {
        product_id: record.product_id,
        warehouse_id: record.warehouse_id,
        new_quantity: newQty,
        reason: delta > 0 ? `Fast +${delta} Adjustment` : `Fast ${delta} Adjustment`
      });
      showToast(`Stok ${newQty} ${record.unit || 'adet'} olarak güncellendi.`, 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Stok düzeltilemedi.', 'error');
    }
  };

  const handleOpenDrawer = (record) => {
    setSelectedProductId(record.product_id);
    setSelectedLocationId(record.location_id || null);
    setDrawerOpen(true);
  };

  const filteredRecords = stockRecords.filter((r) => {
    if (quickFilter === 'critical') return r.min_stock_level > 0 && r.quantity <= r.min_stock_level && r.quantity > 0;
    if (quickFilter === 'out_of_stock') return r.quantity === 0;
    if (quickFilter === 'medicines') return Boolean(r.is_medicine);
    return true;
  });

  const totalSKUCount = stockRecords.length;
  const totalUnitCount = stockRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const criticalCount = stockRecords.filter((r) => r.min_stock_level > 0 && r.quantity <= r.min_stock_level && r.quantity > 0).length;
  const outOfStockCount = stockRecords.filter((r) => r.quantity === 0).length;
  const totalValuation = stockRecords.reduce((sum, r) => sum + Number(r.stock_valuation ?? (r.quantity || 0) * (r.purchase_price || 0)), 0);

  const columns = [
    {
      key: 'product',
      label: 'Ürün ve SKU',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${row.is_medicine ? 'bg-info' : 'bg-brand-500'}`} />
          <div>
            <span className="font-bold text-gray-900 group-hover:text-brand-500 transition block">{row.product_name}</span>
            <span className="text-[10px] text-gray-500 block font-mono">SKU: {row.sku}</span>
          </div>
        </div>
      )
    },
    { key: 'category', label: 'Kategori', render: (row) => <span className="text-gray-500">{row.category || 'Genel'}</span> },
    {
      key: 'location',
      label: 'Depo ve raf',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-gray-500">
          <MapPin className="w-3.5 h-3.5 text-brand-500" />
          <span>{row.warehouse_name}</span>
          {row.location_code && (
            <span className="px-1.5 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-500 font-bold text-[10px] ml-1 font-mono">
              {row.location_code}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'quantity',
      label: 'Stok',
      align: 'right',
      render: (row) => {
        const isZero = row.quantity === 0;
        const isCritical = !isZero && row.min_stock_level > 0 && row.quantity <= row.min_stock_level;
        return (
          <span className={`font-bold tabular-nums text-sm ${isZero ? 'text-red-500' : isCritical ? 'text-yellow-600' : 'text-green-600'}`}>
            {row.quantity} {row.unit || 'adet'}
          </span>
        );
      }
    },
    {
      key: 'min',
      label: 'Minimum',
      align: 'right',
      render: (row) => <span className="text-gray-500 tabular-nums">{row.min_stock_level || 0}</span>
    },
    {
      key: 'status',
      label: 'Durum',
      align: 'center',
      render: (row) => {
        const isZero = row.quantity === 0;
        const isCritical = !isZero && row.min_stock_level > 0 && row.quantity <= row.min_stock_level;
        if (isZero) return <StatusBadge status="danger" text="TÜKENDİ" />;
        if (isCritical) return <StatusBadge status="warning" text="KRİTİK" />;
        return <StatusBadge status="success" text="YETERLİ" />;
      }
    },
    {
      key: 'actions',
      label: 'Hızlı düzeltme',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => handleQuickAdjust(row, -1, e)}
            className="p-1 rounded bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 border border-gray-200 transition"
            title="1 azalt"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => handleQuickAdjust(row, 1, e)}
            className="p-1 rounded bg-gray-100 hover:bg-green-50 text-gray-500 hover:text-green-600 border border-gray-200 transition"
            title="1 artır"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto text-gray-900 pb-12">
      {/* 1. Master Header */}
      <div className="veniux-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-500/20 text-brand-500 border border-brand-500/30 rounded-xl shadow-sm">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-gray-900">
                Stok listesi
              </h1>
              <StatusBadge status="info" text={`${totalSKUCount} kayıtlı ürün`} />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ürünlerinizin depo ve raf bazında güncel stoğu.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            onClick={() => { setSelectedProductForModal(null); setStockModalType('inbound'); setStockModalOpen(true); }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Stok girişi (F2)</span>
          </button>
          <button
            onClick={() => { setSelectedProductForModal(null); setStockModalType('outbound'); setStockModalOpen(true); }}
            className="btn-secondary text-red-500 hover:bg-red-50 hover:border-danger/30"
          >
            <Minus className="w-4 h-4" />
            <span>Stok çıkışı (F3)</span>
          </button>
          <button
            onClick={() => setTransferModalOpen(true)}
            className="btn-secondary"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer</span>
          </button>
          <button onClick={fetchData} className="btn-secondary" title="Yenile">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Tactical Metric HUD Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Ürün sayısı" value={totalSKUCount} trendLabel="Katalogdaki etkin ürünler" />
        <MetricCard title="Toplam stok" value={totalUnitCount.toLocaleString('tr-TR')} trendLabel="Depolardaki toplam birim" />
        <MetricCard title="Kritik ürünler" value={criticalCount} trendLabel="Minimum seviyede veya altında" />
        <MetricCard title="Stok değeri" value={`${totalValuation.toLocaleString('tr-TR')} ₺`} trendLabel="Alış fiyatıyla" />
      </div>

      {/* 3. Table Toolbar & Dense Data Matrix */}
      <div className="vx-table-wrap flex flex-col">
        <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row items-center justify-between gap-4 font-mono text-xs shrink-0">
          {/* Quick Filter Chips */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs overflow-x-auto w-full lg:w-auto">
            {[
              { id: 'all', label: `Tümü (${stockRecords.length})` },
              { id: 'critical', label: `Kritik (${criticalCount})` },
              { id: 'out_of_stock', label: `Tükenen (${outOfStockCount})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setQuickFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap font-bold ${
                  quickFilter === t.id
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="SKU veya ürün adı ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 text-gray-900 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:border-brand-500 transition"
              />
            </div>
            <Dropdown
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-gray-100 border border-gray-200 text-gray-900 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-brand-500 cursor-pointer transition"
            >
              <option value="">Tüm depolar</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Dropdown>
          </div>
        </div>

        {/* Dense Table */}
        <div className="max-h-[640px] overflow-y-auto custom-scrollbar">
          <DataTable 
            flush
            columns={columns}
            data={filteredRecords}
            loading={loading}
            onRowClick={handleOpenDrawer}
            emptyState="Stok kaydı bulunamadı."
          />
        </div>
      </div>

      <QuickStockModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        type={stockModalType}
        initialProduct={selectedProductForModal}
        onSuccess={fetchData}
      />
      <QuickTransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        initialProduct={selectedProductForModal}
        onSuccess={fetchData}
      />
      <KarekodModal
        isOpen={karekodModalOpen}
        onClose={() => setKarekodModalOpen(false)}
        product={barcodeProduct}
      />
      <WMSDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        locationId={selectedLocationId}
        productId={selectedProductId}
      />
    </div>
  );
}
