import { Dropdown } from '../../components/ui';
﻿import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
  BarChart3,
  TrendingUp,
  Zap,
  ArrowRightLeft,
  Warehouse,
  Flame,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function WMSAnalytics() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [period, setPeriod] = useState('30d');
  const [abcData, setAbcData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchAnalytics();
    }
  }, [selectedWarehouseId, period]);

  const fetchWarehouses = async () => {
    try {
      const res = await apiClient.get('/warehouses');
      setWarehouses(res.data || []);
      if (res.data?.length > 0) {
        setSelectedWarehouseId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast('Depolar yüklenirken hata oluştu.', 'error');
    }
  };

  const fetchAnalytics = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      const [abcRes, recRes, repRes] = await Promise.all([
        apiClient.get(`/wms/slotting/abc?warehouse_id=${selectedWarehouseId}&period=${period}`),
        apiClient.get(`/wms/slotting/recommendations?warehouse_id=${selectedWarehouseId}`),
        apiClient.get(`/wms/slotting/replenishment?warehouse_id=${selectedWarehouseId}`)
      ]);

      setAbcData(abcRes.data || null);
      setRecommendations(recRes.data || []);
      setReplenishments(repRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Depo analitik verileri yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReplenish = async (item) => {
    try {
      // Find a bulk location
      const bulkRes = await apiClient.get(`/wms/locations?warehouse_id=${selectedWarehouseId}&location_type=storage`);
      const targetBulk = bulkRes.data?.find(l => !l.is_locked) || bulkRes.data?.[0];

      if (!targetBulk) {
        showToast('Kaynak dökme raf bulunamadı.', 'warning');
        return;
      }

      await apiClient.post('/wms/locations/relocate', {
        warehouse_id: selectedWarehouseId,
        source_location_id: targetBulk.id,
        target_location_id: item.location_id,
        product_id: item.product_id,
        quantity: item.needed_replenishment_qty || 20,
        notes: `Otomatik Toplama Rafı İkmali (${item.location_code})`
      });

      showToast(`${item.product_name} için toplama rafına ikmal yapıldı!`, 'success');
      fetchAnalytics();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'İkmal gerçekleştirilemedi.', 'error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-100">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WMS Komuta Merkezi & Slotting Analitiği</h1>
            <p className="text-sm text-gray-500">ABC ürün hareket hızı, akıllı raf yerleşim önerileri ve otomatik ikmal (Replenishment)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
            <Warehouse className="w-4 h-4 text-gray-500" />
            <Dropdown
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Dropdown>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            {[{ id: '30d', label: '30 Gün' }, { id: '90d', label: '90 Gün' }].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  period === p.id ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-lg border border-gray-200 text-center text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-2" />
          <p>ABC ve slotting analitiği hesaplanıyor...</p>
        </div>
      ) : (
        <>
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                <span>A Grubu (Hızlı Dönen)</span>
                <Flame className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{abcData?.class_a_count || 0} Ürün</p>
              <p className="text-[11px] text-gray-400">Toplam hacmin %70'ini oluşturanlar</p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                <span>B Grubu (Orta Hız)</span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{abcData?.class_b_count || 0} Ürün</p>
              <p className="text-[11px] text-gray-400">Toplam hacmin %20'si</p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                <span>C Grubu (Yavaş Dönen)</span>
                <Layers className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{abcData?.class_c_count || 0} Ürün</p>
              <p className="text-[11px] text-gray-400">Üst kat / arka koridor ürünleri</p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                <span>Toplam Hareket</span>
                <Zap className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{abcData?.total_movement_units?.toLocaleString('tr-TR') || 0} Adet</p>
              <p className="text-[11px] text-gray-400">Seçili dönemdeki toplam çıkış</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Slotting Recommendations */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span>Akıllı Raf Yerleşim Önerileri</span>
                </h2>
                <span className="text-xs text-purple-700 bg-purple-50 font-bold px-2.5 py-1 rounded-full">
                  {recommendations.length} Öneri
                </span>
              </div>

              {recommendations.length === 0 ? (
                <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl text-xs">
                  Tüm A sınıfı hızlı ürünler optimum koridor ve raflara yerleşmiş durumda!
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="p-4 rounded-xl border border-purple-100 bg-purple-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900">{rec.product_name}</span>
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold text-xs rounded">
                          {rec.abc_class} Grubu
                        </span>
                      </div>

                      <p className="text-xs text-gray-600">{rec.reason}</p>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-100 text-gray-500">
                        <span>Mevcut: <strong className="font-mono text-gray-700">{rec.current_locations?.join(', ') || 'Yok'}</strong></span>
                        <span className="text-purple-700 font-bold">Öneri: {rec.recommended_zone} / Kat {rec.recommended_tier}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Replenishment Alerts */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Kritik Toplama Rafı İkmal İhtiyaçları</span>
                </h2>
                <span className="text-xs text-amber-700 bg-amber-50 font-bold px-2.5 py-1 rounded-full">
                  {replenishments.length} İkmal
                </span>
              </div>

              {replenishments.length === 0 ? (
                <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl text-xs">
                  Toplama raflarındaki (Pick Face) stok seviyeleri yeterli.
                </div>
              ) : (
                <div className="space-y-3">
                  {replenishments.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-gray-900">{item.product_name}</span>
                          {item.is_urgent && (
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Acil</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Raf: <strong className="font-mono text-gray-800">{item.location_code}</strong> • Mevcut: <strong className="text-rose-600">{item.pick_face_qty} Adet</strong>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Dökme Stok: {item.available_in_bulk} Adet • İkmal Önerisi: {item.needed_replenishment_qty} Adet
                        </p>
                      </div>

                      <button
                        onClick={() => handleExecuteReplenish(item)}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs whitespace-nowrap"
                      >
                        İkmali Yap
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
