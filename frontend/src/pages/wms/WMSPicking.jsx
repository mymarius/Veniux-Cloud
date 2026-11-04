import { Dropdown } from '../../components/ui';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
  ShoppingCart,
  Plus,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Layers,
  ChevronRight,
  Search,
  X,
  RefreshCw,
  Boxes,
  Zap,
  Check,
  Flame,
  ArrowRight
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function WMSPicking() {
  const [waves, setWaves] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWave, setSelectedWave] = useState(null);

  // New Wave Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: '',
    picking_type: 'WAVE',
    items: [{ product_id: '', requested_qty: 5 }]
  });

  const { showToast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [wavesRes, whRes, prodRes] = await Promise.all([
        apiClient.get('/wms/picking/waves'),
        apiClient.get('/warehouses'),
        apiClient.get('/products')
      ]);

      setWaves(wavesRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data || []);

      if (whRes.data?.length > 0) {
        setForm(prev => ({ ...prev, warehouse_id: whRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
      showToast('Toplama dalgaları yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWaveDetail = async (wave) => {
    try {
      const res = await apiClient.get(`/wms/picking/waves/${wave.id}`);
      setSelectedWave(res.data);
    } catch (err) {
      console.error(err);
      showToast('Dalga görevleri yüklenemedi.', 'error');
    }
  };

  const handleAddItemRow = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', requested_qty: 5 }]
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    setForm({ ...form, items: newItems });
  };

  const handleRemoveItemRow = (index) => {
    if (form.items.length <= 1) return;
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index)
    });
  };

  const handleCreateWave = async (e) => {
    e.preventDefault();
    if (!form.warehouse_id || form.items.some(i => !i.product_id || !i.requested_qty)) {
      showToast('Lütfen depo ve geçerli ürün kalemleri seçiniz.', 'warning');
      return;
    }

    try {
      await apiClient.post('/wms/picking/waves', form);
      showToast('Toplama dalgası ve Dijkstra rota haritası oluşturuldu.', 'success');
      setShowModal(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Dalga oluşturulamadı.', 'error');
    }
  };

  const handleConfirmPick = async (task) => {
    try {
      await apiClient.post(`/wms/picking/tasks/${task.id}/confirm`, {
        picked_qty: task.requested_qty
      });
      showToast(`${task.product_name} toplandı ve rezerve stok defterden düşüldü.`, 'success');
      if (selectedWave) handleOpenWaveDetail(selectedWave);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Toplama onaylanamadı.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1700px] mx-auto text-gray-900 font-sans pb-12">
      {/* 1. Master Header */}
      <div className="veniux-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded-lg shadow-lg shadow-cyan-600/20">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 uppercase">
                Toplama görevleri
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                {waves.length} DALGA HAVUZU
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Dijkstra En Kısa Yürüme Rotası • Toplu Sipariş Gruplama • Lazer Onaylı Toplama
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-full shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Toplama Dalgası Başlat</span>
        </button>
      </div>

      {/* 2. Wave Tasks Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center text-xs bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-brand-500" />
            <h3 className="font-bold text-gray-900 uppercase">TOPLAMA DALGASI LİSTESİ</h3>
          </div>
          <button onClick={fetchInitialData} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-900 transition shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading && waves.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
            <span>Toplama dalgaları taranıyor...</span>
          </div>
        ) : waves.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <Boxes className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">Aktif toplama dalgası bulunmuyor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Dalga Kodu</th>
                  <th className="px-4 py-3">Depo</th>
                  <th className="px-4 py-3">Tür</th>
                  <th className="px-4 py-3">Kalem İlerlemesi</th>
                  <th className="px-4 py-3">Tahmini Süre</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {waves.map(wave => {
                  const progress = wave.total_lines > 0 ? Math.round((wave.picked_lines / wave.total_lines) * 100) : 0;
                  return (
                    <tr key={wave.id} className="hover:bg-brand-50/40 transition">
                      <td className="px-4 py-3 font-bold text-gray-900">{wave.wave_no || `WAV-2026-${wave.id}`}</td>
                      <td className="px-4 py-3 text-gray-500">{wave.warehouse_name}</td>
                      <td className="px-4 py-3 text-brand-600 font-bold">{wave.picking_type || 'WAVE'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">%{progress}</span>
                          <span className="text-[10px] text-gray-500">({wave.picked_lines}/{wave.total_lines} Kalem)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {wave.estimated_time_minutes ? `${wave.estimated_time_minutes} Dk` : '3.5 Dk'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          wave.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        }`}>
                          {wave.status === 'completed' ? 'TAMAMLANDI' : 'İŞLENİYOR'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenWaveDetail(wave)}
                          className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 rounded-xl font-bold transition"
                        >
                          Rota & Kalemler
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Wave Detail & Dijkstra Path Timeline Drawer */}
      {selectedWave && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white border-l border-gray-200 p-6 shadow-2xl overflow-y-auto space-y-6 font-sans text-gray-900 animate-fade-in">
          <div className="flex justify-between items-center border-b border-gray-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedWave.wave_no || `WAV-${selectedWave.id}`}</h2>
                <p className="text-xs text-gray-500">Dijkstra Optimize Rota • {selectedWave.warehouse_name}</p>
              </div>
            </div>
            <button onClick={() => setSelectedWave(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <h3 className="text-xs font-bold text-gray-500 uppercase">TOPLAMA ROTA SIRALAMASI</h3>

            <div className="space-y-3">
              {selectedWave.tasks?.map((task, idx) => (
                <div key={task.id || idx} className="p-4 rounded-lg border border-gray-100 bg-gray-50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 flex items-center justify-center font-bold text-[10px]">
                        {task.pick_sequence || idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{task.product_name}</p>
                        <span className="text-[10px] text-gray-500 block">SKU: {task.sku}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{task.requested_qty} Adet</span>
                  </div>

                  {/* Location & Confirm */}
                  <div className="flex items-center justify-between bg-cyan-50 p-3 rounded-xl border border-cyan-200 text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-700" />
                      <span className="text-gray-700">Alınacak Raf: <strong className="text-cyan-900 font-bold">{task.source_location_code || 'A-01-02-01'}</strong></span>
                    </div>

                    {task.status !== 'completed' ? (
                      <button
                        onClick={() => handleConfirmPick(task)}
                        className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full shadow-xs transition"
                      >
                        Toplandı Onayla
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Toplandı
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. New Wave Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans text-gray-900">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-xs">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-500" />
                <span>Yeni Toplama Dalgası Oluştur</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWave} className="space-y-4">
              <div>
                <label className="block text-gray-600 mb-1 font-medium">Depo Seçimi</label>
                <Dropdown
                  required
                  value={form.warehouse_id}
                  onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                  className="w-full bg-gray-50 p-2.5 border border-gray-200 text-gray-900 rounded-xl outline-none font-medium"
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Dropdown>
              </div>

              {/* Items Rows */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">Toplanacak Ürün Kalemleri</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full shadow-xs"
                  >
                    + Kalem Ekle
                  </button>
                </div>

                {form.items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 grid grid-cols-3 gap-2 items-center">
                    <div className="col-span-2">
                      <Dropdown
                        required
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                        className="w-full bg-white p-2 border border-gray-200 text-gray-900 rounded-xl outline-none font-medium"
                      >
                        <option value="">Ürün Seçiniz...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </Dropdown>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.requested_qty}
                        onChange={(e) => handleItemChange(idx, 'requested_qty', Number(e.target.value))}
                        placeholder="Adet"
                        className="w-full bg-white p-2 border border-gray-200 text-gray-900 rounded-xl outline-none text-center font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-full text-gray-700 hover:bg-gray-100 font-medium"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full shadow-xs"
                >
                  Dalgayı Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
