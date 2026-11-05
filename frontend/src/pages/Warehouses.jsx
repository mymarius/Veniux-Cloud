import { Dropdown } from '../components/ui';
﻿import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import {
  Warehouse,
  Plus,
  Edit2,
  Trash2,
  Boxes,
  MapPin,
  DollarSign,
  Layers,
  ChevronRight,
  X,
  ArrowRightLeft,
  Truck,
  Thermometer,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouseDetail, setSelectedWarehouseDetail] = useState(null);
  const [warehouseInventory, setWarehouseInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'internal',
    location: '',
    capacity: 10000,
    source_config: ''
  });

  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/warehouses');
      setWarehouses(res.data || []);
      if (res.data?.length > 0 && !selectedWarehouseDetail) {
        handleOpenDetail(res.data[0]);
      }
    } catch (err) {
      console.error(err);
      showToast('Depolar yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (wh) => {
    setSelectedWarehouseDetail(wh);
    setInventoryLoading(true);
    try {
      const res = await apiClient.get(`/warehouses/${wh.id}`);
      setWarehouseInventory(res.data.inventory || []);
    } catch (err) {
      console.error(err);
      showToast('Depo envanteri yüklenemedi.', 'error');
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingWarehouse(null);
    setFormData({
      name: '',
      type: 'internal',
      location: '',
      capacity: 10000,
      source_config: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (wh, e) => {
    if (e) e.stopPropagation();
    setEditingWarehouse(wh);
    setFormData({
      name: wh.name,
      type: wh.type || 'internal',
      location: wh.location || '',
      capacity: wh.capacity || 10000,
      source_config: wh.source_config || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        capacity: parseInt(formData.capacity, 10) || 10000
      };

      if (editingWarehouse) {
        await apiClient.put(`/warehouses/${editingWarehouse.id}`, payload);
        showToast('Depo bilgileri güncellendi.', 'success');
      } else {
        await apiClient.post('/warehouses', payload);
        showToast('Yeni lojistik depo eklendi.', 'success');
      }
      setShowModal(false);
      fetchWarehouses();
    } catch (err) {
      showToast(err.response?.data?.error || 'Kayıt başarısız.', 'error');
    }
  };

  const handleDelete = async (wh, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`${wh.name} deposunu silmek istediğinize emin misiniz?`)) return;
    try {
      await apiClient.delete(`/warehouses/${wh.id}`);
      showToast('Depo sistemden kaldırıldı.', 'success');
      fetchWarehouses();
    } catch (err) {
      showToast(err.response?.data?.error || 'Silme işlemi başarısız.', 'error');
    }
  };

  const totalCapacity = warehouses.reduce((sum, w) => sum + (w.capacity || 0), 0);
  const totalStockItems = warehouses.reduce((sum, w) => sum + (w.unique_product_count || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto text-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-brand-600 text-white rounded-xl shadow-md shadow-brand-600/20">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-mono tracking-tight uppercase">
                DEPO & LOJİSTİK TESİS YÖNETİMİ
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800 font-mono">
                {warehouses.length} AKTİF TESİS
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Merkez dağıtım merkezleri, şube depoları, soğuk zincir odaları ve rampa kapasiteleri
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => navigate('/wms/locations')}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-600"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2D Raf Haritası</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Tesis / Depo Ekle</span>
          </button>
        </div>
      </div>

      {/* Facility Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">TOPLAM DEPO TESİSİ</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">{warehouses.length}</p>
          <span className="text-[10px] text-gray-400 block">Lojistik lokasyon ağı</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">TOPLAM KAPASİTE</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-brand-600 dark:text-brand-400">
            {totalCapacity.toLocaleString('tr-TR')}
          </p>
          <span className="text-[10px] text-gray-400 block">Maksimum palet/koli hacmi</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">MEVCUT STOKLU ÜRÜN</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {totalStockItems.toLocaleString('tr-TR')}
          </p>
          <span className="text-[10px] text-gray-400 block">Farklı kalem toplamı</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">SOĞUK ZİNCİR UYUMLU</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">AKTİF (+4°C)</p>
          <span className="text-[10px] text-gray-400 block">Sensör entegrasyonu devrede</span>
        </div>
      </div>

      {/* Facilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((wh) => {
          const isSelected = selectedWarehouseDetail?.id === wh.id;
          const usagePercent = wh.capacity > 0 ? Math.round(((wh.total_quantity || 0) / wh.capacity) * 100) : 45;

          return (
            <div
              key={wh.id}
              onClick={() => handleOpenDetail(wh)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-4 hover:shadow-md ${
                isSelected
                  ? 'bg-white dark:bg-slate-800 border-brand-500 shadow-md ring-1 ring-brand-500/30'
                  : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-brand-600 dark:text-brand-400 font-bold">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{wh.name}</h3>
                    <div className="flex items-center space-x-1.5 text-[11px] text-gray-500 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{wh.location || 'Merkez Lojistik Bölgesi'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleOpenEdit(wh, e)}
                    className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg transition"
                    title="Düzenle"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(wh, e)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Capacity Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-500">Doluluk Oranı:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{usagePercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent > 85 ? 'bg-rose-500' : usagePercent > 60 ? 'bg-amber-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                  />
                </div>
              </div>

              {/* Quick Specs */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/80 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-gray-400 block">KAPASİTE</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{wh.capacity || 10000} Birim</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">MEVCUT ÜRÜN</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">{wh.unique_product_count || 0} SKU</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Facility Inventory Table */}
      {selectedWarehouseDetail && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-brand-600" />
                <span>{selectedWarehouseDetail.name} — Anlık Depo Envanteri</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bu tesiste depolanan kalemler ve lokasyon dağılımları</p>
            </div>

            <button
              onClick={() => navigate('/wms/locations')}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
            >
              <span>2D Raf Matrisini Aç</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {inventoryLoading ? (
            <div className="py-12 text-center text-gray-500 text-xs">Envanter yükleniyor...</div>
          ) : warehouseInventory.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs border border-dashed rounded-xl">
              Bu tesiste henüz stok kaydı bulunmamaktadır.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-2.5">Ürün Adı & SKU</th>
                    <th className="px-4 py-2.5">Kategori</th>
                    <th className="px-4 py-2.5 text-right">Mevcut Miktar</th>
                    <th className="px-4 py-2.5 text-right">Birim Maliyet</th>
                    <th className="px-4 py-2.5 text-right">Toplam Değer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-medium">
                  {warehouseInventory.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-900 dark:text-white">{item.product_name}</span>
                        <span className="block font-mono text-[10px] text-gray-500 dark:text-gray-400">SKU: {item.sku}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{item.category || 'Genel'}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                        {item.quantity} {item.unit || 'Adet'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        ₺{Number(item.cost_price || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        ₺{Number((item.quantity || 0) * (item.cost_price || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Warehouse Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white bg-gray-100 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 border-gray-200 pb-3">
              <h3 className="text-base font-bold text-gray-900 text-gray-900 flex items-center space-x-2">
                <Warehouse className="w-5 h-5 text-brand-500" />
                <span>{editingWarehouse ? 'Depo Bilgilerini Güncelle' : 'Yeni Lojistik Tesis Ekle'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-500 hover:text-gray-500 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-medium">
              <div>
                <label className="block text-gray-500 mb-1">Depo / Tesis Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Istanbul Anadolu Dağıtım Merkezi"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Adres / Lokasyon</label>
                <input
                  type="text"
                  placeholder="Tuzla Lojistik Üssü"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 mb-1">Tesis Tipi</label>
                  <Dropdown
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    <option value="internal">Ana Dağıtım Merkezi</option>
                    <option value="branch">Şube / Bölge Deposu</option>
                    <option value="cold_storage">Soğuk Hava Deposu</option>
                    <option value="transit">Transit Aktarma Merkezi</option>
                  </Dropdown>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Maksimum Kapasite</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200 border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-white text-slate-700 text-gray-500 rounded-xl font-bold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20"
                >
                  {editingWarehouse ? 'Güncelle' : 'Kaydet ve Aktif Et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
