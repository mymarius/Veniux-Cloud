import { Dropdown } from '../components/ui';
import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import {
  ClipboardCheck,
  Plus,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  X,
  Check,
  Save,
  Boxes,
  FileSpreadsheet
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function StockCount() {
  const [counts, setCounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Count Session Detail
  const [activeCount, setActiveCount] = useState(null);
  const [activeItems, setActiveItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingItem, setSavingItem] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    fetchCounts();
    fetchWarehouses();
  }, []);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/stock-counts');
      setCounts(res.data);
    } catch (err) {
      console.error(err);
      showToast('Sayım kayıtları yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await apiClient.get('/warehouses');
      setWarehouses(res.data);
      if (res.data.length > 0) setSelectedWarehouseId(res.data[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartCount = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/stock-counts', {
        warehouse_id: selectedWarehouseId,
        notes
      });
      showToast('Fiziksel sayım oturumu başlatıldı.', 'success');
      setShowModal(false);
      fetchCounts();
      handleOpenCountDetail(res.data.stock_count.id);
    } catch (err) {
      showToast(err.response?.data?.error || 'Sayım başlatılamadı.', 'error');
    }
  };

  const handleOpenCountDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await apiClient.get(`/stock-counts/${id}`);
      setActiveCount(res.data);
      setActiveItems(res.data.items || []);
    } catch (err) {
      console.error(err);
      showToast('Sayım detayı yüklenemedi.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleQuantityChange = (itemId, newCounted) => {
    setActiveItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const counted = parseInt(newCounted, 10) || 0;
          return {
            ...it,
            counted_quantity: counted,
            difference: counted - it.system_quantity
          };
        }
        return it;
      })
    );
  };

  const handleSaveItem = async (item) => {
    setSavingItem(item.id);
    try {
      await apiClient.put(`/stock-counts/${activeCount.id}/items/${item.id}`, {
        counted_quantity: item.counted_quantity,
        notes: item.notes
      });
      showToast(`"${item.product_name}" sayım miktarı kaydedildi.`, 'info');
    } catch (err) {
      showToast('Kaydedilemedi.', 'error');
    } finally {
      setSavingItem(null);
    }
  };

  const handleFinalizeCount = async () => {
    if (!window.confirm('Sayımı kesinleştirmek ve oluşan farklar için otomatik "Sayım Fark Fişi" kesmek istiyor musunuz?')) return;

    try {
      const res = await apiClient.post(`/stock-counts/${activeCount.id}/finalize`);
      showToast(res.data.message, 'success');
      handleOpenCountDetail(activeCount.id);
      fetchCounts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Sayım kesinleştirilemedi.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Corporate Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Fiziksel Stok Sayımı & Mutabakat
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-600 border border-brand-200/80 tabular-nums">
              {counts.length} Oturum
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-1">
            Depo sayımları, sistem stoğu karşılaştırması ve otomatik sayım fark fişi mutabakatı
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Sayım Oturumu Başlat</span>
        </button>
      </div>

      {/* Counts Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {counts.map((c) => {
          const isCompleted = c.status === 'completed';
          const isSelected = activeCount?.id === c.id;

          return (
            <div
              key={c.id}
              onClick={() => handleOpenCountDetail(c.id)}
              className={`p-5 rounded-xl border cursor-pointer transition-all duration-200 bg-white ${
                isSelected 
                  ? 'ring-2 ring-brand-500 border-brand-300 shadow-md bg-brand-50/20' 
                  : 'border-gray-100 shadow-2xs hover:border-brand-200 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-bold text-xs text-brand-600 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200/60">{c.count_no}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {isCompleted ? 'Mutabakat Tamamlandı' : 'Sayım Devam Ediyor'}
                </span>
              </div>

              <h3 className="font-bold text-gray-900 text-sm mt-1">{c.warehouse_name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{c.notes || 'Dönemsel fiziksel sayım'}</p>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400">Tarih: {new Date(c.created_at).toLocaleDateString('tr-TR')}</span>
                <span className="font-bold text-gray-800">{c.total_items || 0} Kalem</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Count Workbench */}
      {activeCount && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-gray-900">
                  Sayım Çalışma Masası: <span className="text-brand-600 font-bold">{activeCount.count_no}</span>
                </h3>
                <span className="text-xs text-gray-500 font-semibold">({activeCount.warehouse_name})</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Fiziksel olarak rafta sayılan miktarları girin. Farklar anlık hesaplanır.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeCount.status !== 'completed' ? (
                <button
                  onClick={handleFinalizeCount}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xs transition flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" /> Sayımı Onayla & Fark Fişi Kes
                </button>
              ) : (
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Mutabakat Kesinleşti
                </span>
              )}
              <button
                onClick={() => setActiveCount(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium rounded-full text-xs transition"
              >
                Kapat
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <p className="text-xs text-gray-400 text-center py-8">Sayım kalemleri taranıyor...</p>
          ) : activeItems.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Bu depoda sayım yapılacak ürün bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Ürün Adı</th>
                    <th className="py-3 px-4 text-right">Sistem Stoğu</th>
                    <th className="py-3 px-4 text-center">Fiziksel Sayılan Miktar</th>
                    <th className="py-3 px-4 text-right">Sayım Farkı</th>
                    <th className="py-3 px-4 text-right">Kaydet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeItems.map((item) => {
                    return (
                      <tr key={item.id} className="hover:bg-brand-50/40 transition">
                        <td className="py-2.5 px-4 text-gray-500 font-medium">{item.sku}</td>
                        <td className="py-2.5 px-4 font-bold text-gray-900">{item.product_name}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-gray-900 tabular-nums">
                          {item.system_quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {activeCount.status !== 'completed' ? (
                            <input
                              type="number"
                              min="0"
                              value={item.counted_quantity}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              className="w-24 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold tabular-nums text-gray-900 outline-none focus:border-brand-500"
                            />
                          ) : (
                            <span className="font-bold text-gray-900">{item.counted_quantity} {item.unit}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                          {item.difference > 0 ? (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">+{item.difference} (Fazla)</span>
                          ) : item.difference < 0 ? (
                            <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">{item.difference} (Eksik)</span>
                          ) : (
                            <span className="text-gray-500">0 (Tam)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {activeCount.status !== 'completed' && (
                            <button
                              onClick={() => handleSaveItem(item)}
                              disabled={savingItem === item.id}
                              className="px-3 py-1 bg-gray-100 hover:bg-brand-500 hover:text-white text-gray-700 rounded-full text-xs font-semibold transition inline-flex items-center gap-1"
                            >
                              <Save className="w-3 h-3" />
                              {savingItem === item.id ? '...' : 'Kaydet'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Start New Count Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-gray-100 rounded-xl max-w-md w-full p-6 shadow-2xl relative text-gray-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-gray-900">Yeni Sayım Oturumu</h3>
                <p className="text-xs text-gray-500">Sayımı yapılacak depoyu seçin</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartCount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Sayım Yapılacak Depo *</label>
                <Dropdown
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none font-medium"
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Dropdown>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Sayım Açıklaması / Dönemi</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Örn: 2026 Q1 Fiziksel Sayım"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-full font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-bold shadow-xs"
                >
                  Sayımı Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
