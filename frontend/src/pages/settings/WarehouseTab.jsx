import DialogShell from '../../components/ui/DialogShell';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { StatusBadge, Input } from '../../components/ui';
import { Warehouse, Plus, Layers, MapPin, CheckCircle2, Loader2, X, Sliders, Settings2 } from 'lucide-react';

export default function WarehouseTab() {
  const { showToast } = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Strategy form
  const [strategy, setStrategy] = useState({
    algorithm: 'FEFO', // FEFO, FIFO, LIFO
    shelfFormat: 'KORIDOR-RAF-KAT-GÖZ (Örn: A-02-03-01)',
    autoReserve: true,
    bufferPercent: 10,
    coldChainAlarm: true
  });

  // New warehouse form
  const [formData, setFormData] = useState({
    name: '',
    type: 'internal',
    location: '',
    capacity: 10000,
    warehouse_type: 'NORMAL'
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/warehouses');
      setWarehouses(res.data || []);
    } catch (err) {
      showToast('Depo listesi yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/warehouses', formData);
      showToast('Yeni depo tesisi başarıyla eklendi.', 'success');
      setShowAddModal(false);
      setFormData({ name: '', type: 'internal', location: '', capacity: 10000, warehouse_type: 'NORMAL' });
      fetchWarehouses();
    } catch (err) {
      showToast(err.response?.data?.error || 'Depo eklenemedi.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Depo ayarları</h1>
          <p className="text-sm text-gray-500 mt-1">Fiziksel depo tesislerinizi, raf adresleme formatlarını ve stok algoritmalarını yapılandırın.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Depo Ekle</span>
        </button>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : warehouses.length === 0 ? (
          <div className="col-span-3 veniux-card p-12 text-center text-gray-500">
            Kayıtlı depo bulunamadı.
          </div>
        ) : (
          warehouses.map((wh) => (
            <div key={wh.id} className="veniux-card p-5 space-y-4 hover:border-brand-500/40 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{wh.name}</h3>
                    <p className="text-[11px] text-gray-500 font-mono">ID: #{wh.id}</p>
                  </div>
                </div>
                <StatusBadge status="active" text={wh.warehouse_type || 'NORMAL'} />
              </div>

              <div className="space-y-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Konum:</span>
                  <span className="font-medium text-gray-900 truncate max-w-[150px]">{wh.location || 'Belirtilmedi'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Kapasite:</span>
                  <span className="font-mono font-semibold text-gray-900">{wh.capacity?.toLocaleString('tr-TR') ?? 'Belirtilmedi'} Palet/Göz</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Global WMS Strategy & Routing Config */}
      <div className="veniux-card p-6 space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <Settings2 className="w-5 h-5 text-brand-500" />
          <h2 className="font-bold text-sm text-gray-900">Otomatik Stok Yönlendirme ve Tahsis Motoru</h2>
        </div>

        <p role="status" className="text-sm text-gray-500">Strateji seçenekleri önizlemedir; bu sürümde kaydedilemez ve stok kurallarını değiştirmez. Mevcut lot ve FEFO kuralları ilgili işlem ekranlarında uygulanır.</p>
        <fieldset disabled className="space-y-5 opacity-60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                Toplama ve Çıkış Yönlendirme Algoritması (WMS Router)
              </label>
              <select
                value={strategy.algorithm}
                onChange={(e) => setStrategy({ ...strategy, algorithm: e.target.value })}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
              >
                <option value="FEFO">FEFO (First Expired, First Out) - Son Kullanma Tarihi En Yakın Olan Önce Çıkar</option>
                <option value="FIFO">FIFO (First In, First Out) - İlk Giren Stok İlk Çıkar</option>
                <option value="LIFO">LIFO (Last In, First Out) - Son Giren İlk Çıkar</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Son kullanma tarihi izlenen ürünlerde önce miadı yaklaşan partiyi çıkarmak için FEFO kullanılabilir.
              </p>
            </div>

            <Input
              label="Raf ve Lokasyon Kod Şablonu"
              value={strategy.shelfFormat}
              onChange={(e) => setStrategy({ ...strategy, shelfFormat: e.target.value })}
              placeholder="Örn: KORIDOR-RAF-KAT-GÖZ (A-01-02-03)"
            />

            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                Kritik Güvenlik Tamponu (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={strategy.bufferPercent}
                onChange={(e) => setStrategy({ ...strategy, bufferPercent: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Sipariş önerileri Operasyon Asistanı ekranında listelenir; tek tıkla satın alma taslağına dönüştürülür.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-2 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={strategy.autoReserve}
                  onChange={(e) => setStrategy({ ...strategy, autoReserve: e.target.checked })}
                  className="w-4 h-4 text-brand-500 rounded border-gray-300 focus:ring-brand-500"
                />
                <span className="text-xs font-semibold text-gray-800">
                  Satış ve sevkiyat emirlerinde stoğu anında rezerve et
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={strategy.coldChainAlarm}
                  onChange={(e) => setStrategy({ ...strategy, coldChainAlarm: e.target.checked })}
                  className="w-4 h-4 text-brand-500 rounded border-gray-300 focus:ring-brand-500"
                />
                <span className="text-xs font-semibold text-gray-800">
                  Soğuk zincir (2-8°C) sapmalarında sevkiyatı otomatik dondur
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-200">
            <button
              type="submit"
              disabled
              className="btn-primary"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Strateji kaydetme henüz açık değil</span>
            </button>
          </div>
        </fieldset>
      </div>

      {/* Modal: Add Warehouse */}
      {showAddModal && (
        <DialogShell isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Depo ekle">
            <form onSubmit={handleAddWarehouse} className="space-y-4">
              <Input
                label="Depo Adı"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Örn: Anadolu Dağıtım Deposu"
                required
              />
              <Input
                label="Fiziksel Konum / Şehir"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Örn: Kocaeli / Gebze OSB"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Kapasite (Palet/Göz)"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 0 })}
                  required
                />
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                    Depo Türü
                  </label>
                  <select
                    value={formData.warehouse_type}
                    onChange={(e) => setFormData({ ...formData, warehouse_type: e.target.value })}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                  >
                    <option value="NORMAL">Normal Ticari Depo</option>
                    
                    <option value="COLD_CHAIN">Soğuk Hava Deposu (2-8°C)</option>
                    <option value="QUARANTINE">Karantina & İade Bölgesi</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Depoyu Kaydet</span>
                </button>
              </div>
            </form>
        </DialogShell>
      )}
    </div>
  );
}
