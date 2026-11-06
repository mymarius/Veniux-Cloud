import DialogShell from '../../components/ui/DialogShell';
import { Dropdown } from '../../components/ui';
﻿import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
  Truck,
  Plus,
  Package,
  Boxes,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Warehouse,
  Scale,
  Send,
  RefreshCw,
  X
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function NormalDispatch() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [handlingUnits, setHandlingUnits] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Handling Unit Modal
  const [showHUModal, setShowHUModal] = useState(false);
  const [huForm, setHuForm] = useState({
    hu_type: 'BOX',
    max_weight_kg: 30
  });

  // Dispatch Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedHU, setSelectedHU] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    carrier_company: 'Öz Lojistik Nakliyat',
    driver_name: '',
    plate_number: '',
    waybill_no: '',
    actual_weight_kg: 10
  });

  // New Dock Appointment Modal
  const [showAppModal, setShowAppModal] = useState(false);
  const [appForm, setAppForm] = useState({
    dock_code: 'DOCK-01',
    direction: 'OUTBOUND',
    appointment_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    carrier_company: '',
    driver_name: '',
    driver_phone: '',
    plate_number: '',
    notes: ''
  });

  const { showToast } = useToast();

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchDispatchData();
    }
  }, [selectedWarehouseId]);

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

  const fetchDispatchData = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      const [huRes, appRes] = await Promise.all([
        apiClient.get(`/wms/packing/handling-units?warehouse_id=${selectedWarehouseId}`),
        apiClient.get(`/wms/packing/dock-appointments?warehouse_id=${selectedWarehouseId}`)
      ]);
      setHandlingUnits(huRes.data || []);
      setAppointments(appRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Sevkiyat verileri yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHU = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/wms/packing/handling-units', {
        warehouse_id: selectedWarehouseId,
        ...huForm
      });
      showToast(`Yeni taşıma birimi (${res.data.hu_code}) oluşturuldu!`, 'success');
      setShowHUModal(false);
      fetchDispatchData();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Taşıma birimi oluşturulamadı.', 'error');
    }
  };

  const handleOpenDispatch = (hu) => {
    setSelectedHU(hu);
    setDispatchForm({
      carrier_company: 'Öz Lojistik Nakliyat',
      driver_name: '',
      plate_number: '',
      waybill_no: `SEVK-${Date.now()}`,
      actual_weight_kg: hu.weight_kg || 15
    });
    setShowDispatchModal(true);
  };

  const handleExecuteDispatch = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/wms/packing/dispatch', {
        warehouse_id: selectedWarehouseId,
        handling_unit_id: selectedHU.id,
        ...dispatchForm,
        actual_weight_kg: parseFloat(dispatchForm.actual_weight_kg)
      });
      showToast(`Sevkiyat tamamlandı! İrsaliye: ${res.data.waybill_no}`, 'success');
      setShowDispatchModal(false);
      fetchDispatchData();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Sevkiyat gerçekleştirilemedi.', 'error');
    }
  };

  const handleCreateApp = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/wms/packing/dock-appointments', {
        warehouse_id: selectedWarehouseId,
        ...appForm
      });
      showToast('Rampa randevusu kaydedildi!', 'success');
      setShowAppModal(false);
      fetchDispatchData();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Randevu oluşturulamadı.', 'error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-500 text-white rounded-xl shadow-md shadow-blue-100">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sevkiyat</h1>
            <p className="text-sm text-gray-500">Paketleme, koli ve palet, tartım kontrolü ve çıkış randevuları.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
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

          <button
            onClick={() => setShowHUModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Koli / Palet Oluştur</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Handling Units Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-brand-500" />
                <span>Koli ve paletler</span>
              </h2>
              <span className="text-xs text-gray-500">{handlingUnits.length} Kayıt</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                <p className="text-xs">Yükleniyor...</p>
              </div>
            ) : handlingUnits.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl text-xs">
                Bu depoda henüz açık koli veya palet bulunmamaktadır.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {handlingUnits.map(hu => (
                  <div key={hu.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          hu.hu_type === 'PALLET' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-brand-500'
                        }`}>
                          {hu.hu_type}
                        </span>
                        <span className="font-mono font-bold text-sm text-gray-900">{hu.hu_code}</span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        hu.status === 'shipped' ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {hu.status === 'shipped' ? 'Sevk Edildi' : 'Açık'}
                      </span>
                    </div>

                    {hu.sscc_code && (
                      <div className="text-[11px] font-mono text-gray-500 bg-white p-1.5 rounded border border-gray-200">
                        SSCC: {hu.sscc_code}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Maks: {hu.max_weight_kg} kg</span>
                      <span className="font-semibold text-gray-900">{hu.weight_kg || 0} kg Tartım</span>
                    </div>

                    {hu.status !== 'shipped' && (
                      <button
                        onClick={() => handleOpenDispatch(hu)}
                        className="w-full py-2 bg-brand-500 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center justify-center space-x-1.5 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Araca Yükle & Sevk Et</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dock Appointments Column (1 col) */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-brand-500" />
                <span>Çıkış randevuları</span>
              </h2>
              <button
                onClick={() => setShowAppModal(true)}
                className="btn-soft" data-size="sm"
              >
                + Randevu
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl text-xs">
                Bugün için planlanmış rampa randevusu yok.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map(app => (
                  <div key={app.id} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                        {app.dock_code}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(app.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-gray-900">{app.carrier_company || 'Nakliye Firması'}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Plaka: {app.plate_number || '-'}</span>
                      <span className="font-semibold text-brand-500">{app.direction}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Handling Unit Modal */}
      {showHUModal && (
        <DialogShell isOpen={showHUModal} onClose={()=>setShowHUModal(false)} title="Taşıma birimi oluştur">
<form onSubmit={handleCreateHU} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Birim Tipi</label>
                <Dropdown
                  value={huForm.hu_type}
                  onChange={(e) => setHuForm({ ...huForm, hu_type: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                >
                  <option value="BOX">Koli (Box / Carton)</option>
                  <option value="PALLET">Ahşap Palet (SSCC Barkodlu)</option>
                  <option value="TOTE">Toplama Sepeti (Tote)</option>
                  <option value="CART">Toplama Arabası (Cart)</option>
                </Dropdown>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Maksimum Taşıma Kapasitesi (kg)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={huForm.max_weight_kg}
                  onChange={(e) => setHuForm({ ...huForm, max_weight_kg: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHUModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm"
                >
                  Oluştur
                </button>
              </div>
            </form>
</DialogShell>
)}

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <DialogShell isOpen={showDispatchModal} onClose={()=>setShowDispatchModal(false)} title="Sevkiyat bilgileri">
<form onSubmit={handleExecuteDispatch} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nakliye / Kargo Firması</label>
                <input
                  type="text"
                  required
                  value={dispatchForm.carrier_company}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, carrier_company: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Araç Plakası</label>
                  <input
                    type="text"
                    placeholder="34 ABC 123"
                    value={dispatchForm.plate_number}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, plate_number: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl uppercase font-mono outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Kantar / Tartım (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={dispatchForm.actual_weight_kg}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, actual_weight_kg: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Sevk İrsaliye No</label>
                <input
                  type="text"
                  required
                  value={dispatchForm.waybill_no}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, waybill_no: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm"
                >
                  İrsaliyeyi Bas & Sevk Et
                </button>
              </div>
            </form>
</DialogShell>
)}

      {/* Dock Appointment Modal */}
      {showAppModal && (
        <DialogShell isOpen={showAppModal} onClose={()=>setShowAppModal(false)} title="Rampa randevusu">
<form onSubmit={handleCreateApp} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rampa Kodu</label>
                  <Dropdown
                    value={appForm.dock_code}
                    onChange={(e) => setAppForm({ ...appForm, dock_code: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    <option value="DOCK-01">Rampa 01 (Giriş / Mal Kabul)</option>
                    <option value="DOCK-02">Rampa 02 (Çıkış / Sevkiyat)</option>
                  </Dropdown>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Yön</label>
                  <Dropdown
                    value={appForm.direction}
                    onChange={(e) => setAppForm({ ...appForm, direction: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    <option value="OUTBOUND">Çıkış (Sevkiyat)</option>
                    <option value="INBOUND">Giriş (Mal Kabul)</option>
                  </Dropdown>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Randevu Saati</label>
                <input
                  type="datetime-local"
                  required
                  value={appForm.appointment_time}
                  onChange={(e) => setAppForm({ ...appForm, appointment_time: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Firma Adı</label>
                <input
                  type="text"
                  placeholder="Kargo / Lojistik firması"
                  value={appForm.carrier_company}
                  onChange={(e) => setAppForm({ ...appForm, carrier_company: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm"
                >
                  Randevuyu Kaydet
                </button>
              </div>
            </form>
</DialogShell>
)}
    </div>
  );
}
