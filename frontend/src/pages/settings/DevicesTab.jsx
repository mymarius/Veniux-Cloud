import DialogShell from '../../components/ui/DialogShell';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { StatusBadge, Input } from '../../components/ui';
import { Smartphone, Plus, BatteryCharging, Wifi, RefreshCw, Loader2, X, CheckCircle2, Cpu, Activity } from 'lucide-react';

export default function DevicesTab() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    device_uid: '',
    device_name: '',
    device_type: 'PDA',
    manufacturer: 'Zebra Technologies',
    warehouse_id: '',
    battery_level: 100
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devRes, whRes] = await Promise.all([
        apiClient.get('/terminal/devices'),
        apiClient.get('/warehouses')
      ]);
      setDevices(devRes.data || []);
      setWarehouses(whRes.data || []);
      if (whRes.data?.length > 0) {
        setFormData(prev => ({ ...prev, warehouse_id: whRes.data[0].id }));
      }
    } catch (err) {
      showToast('Cihaz filosu bilgileri yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/terminal/register', formData);
      showToast('Yeni el terminali başarıyla filoya eklendi.', 'success');
      setShowAddModal(false);
      setFormData({
        device_uid: '',
        device_name: '',
        device_type: 'PDA',
        manufacturer: 'Zebra Technologies',
        warehouse_id: warehouses[0]?.id || 1,
        battery_level: 100
      });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Cihaz eklenirken hata oluştu.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">El terminalleri</h1>
          <p className="text-sm text-gray-500 mt-1">Terminal kayıtlarını ve son bildirilen verileri görün. Kayıtlı olması cihazın çevrimiçi olduğunu göstermez.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Terminal Ekle</span>
        </button>
      </div>

      {/* Device Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <div className="col-span-3 veniux-card p-12 text-center text-gray-500">
            <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900">Henüz Kayıtlı Terminal Yok</h3>
            <p className="text-xs text-gray-500 mt-1">Depoda kullandığınız Zebra, Honeywell veya akıllı telefon terminallerini ekleyin.</p>
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="veniux-card p-5 space-y-4 hover:border-brand-500/40 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{device.device_name}</h3>
                    <p className="text-[11px] text-gray-500 font-mono">{device.device_uid}</p>
                  </div>
                </div>
                <StatusBadge status="pending" text="KAYITLI" />
              </div>

              <div className="space-y-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> Üretici:</span>
                  <span className="font-medium text-gray-900">{device.manufacturer || 'Bilgi yok'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><BatteryCharging className="w-3.5 h-3.5 text-emerald-600" /> Batarya:</span>
                  <span className="font-mono font-semibold text-emerald-700">{device.battery_level == null ? 'Bilgi yok' : `%${device.battery_level}`} </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Wifi className="w-3.5 h-3.5 text-blue-500" /> IP / Sinyal:</span>
                  <span className="font-mono text-gray-700">{device.last_ip_address || 'Bilgi yok'}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-[10px] text-gray-400 font-mono">
                  Son Sinyal: {device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString('tr-TR') : 'Bilgi yok'}
                </span>
                <button
                  disabled
                  title="Bu sürümde cihazın canlı bağlantısını ölçen bir ping servisi bulunmuyor."
                  className="px-2.5 py-1 text-xs text-gray-400 rounded-lg cursor-not-allowed"
                >
                  <span>Canlı ping desteklenmiyor</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Register Device */}
      {showAddModal && (
        <DialogShell isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Terminal ekle">
            <form onSubmit={handleRegisterDevice} className="space-y-4">
              <Input
                label="Cihaz UID / Seri Numarası"
                value={formData.device_uid}
                onChange={(e) => setFormData({ ...formData, device_uid: e.target.value })}
                placeholder="Örn: TC26-SCAN-004"
                required
              />
              <Input
                label="Cihaz Görünen Adı"
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                placeholder="Örn: 2 Nolu Toplama Terminali"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                    Model / Üretici
                  </label>
                  <select
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                  >
                    <option value="Zebra Technologies">Zebra TC21/TC26</option>
                    <option value="Honeywell">Honeywell EDA51</option>
                    <option value="Datalogic">Datalogic Memor</option>
                    <option value="Newland">Newland MT90</option>
                    <option value="Mobile Camera">Android / iOS Kamera</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono block mb-1.5">
                    Atandığı Depo
                  </label>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
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
                  <span>Terminali Kaydet</span>
                </button>
              </div>
            </form>
        </DialogShell>
      )}
    </div>
  );
}
