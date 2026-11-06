import { Dropdown } from '../../components/ui';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
  Inbox,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Calendar,
  Warehouse,
  ChevronRight,
  Search,
  X,
  RefreshCw,
  FileText,
  Boxes,
  ArrowRight
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function NormalInbound() {
  const [receipts, setReceipts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // New Receipt Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: '',
    supplier_id: '',
    waybill_no: '',
    items: [{ product_id: '', expected_qty: 10, lot_number: '', expiry_date: '' }]
  });

  const { showToast } = useToast();

  // Tarih ve miktar biçimleyicileri: API tarihleri 'YYYY-MM-DD' metni,
  // miktarlar ise sayı olarak döner; ekranda ham gösterilmemeli.
  const trDate = (value) => {
    if (!value) return '—';
    const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const qty = (value) => Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [recRes, whRes, supRes, prodRes] = await Promise.all([
        apiClient.get('/wms/inbound/receipts'),
        apiClient.get('/warehouses'),
        apiClient.get('/suppliers'),
        apiClient.get('/products')
      ]);

      setReceipts(recRes.data || []);
      setWarehouses(whRes.data || []);
      setSuppliers(supRes.data || []);
      setProducts(prodRes.data || []);

      if (whRes.data?.length > 0) {
        setForm(prev => ({ ...prev, warehouse_id: whRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
      showToast('Mal kabul verileri yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (receipt) => {
    try {
      const res = await apiClient.get(`/wms/inbound/receipts/${receipt.id}`);
      setSelectedReceipt(res.data);
    } catch (err) {
      console.error(err);
      showToast('Belge detayları yüklenemedi.', 'error');
    }
  };

  const handleAddItemRow = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', expected_qty: 10, lot_number: '', expiry_date: '' }]
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

  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/wms/inbound/receipts', form);
      showToast('Mal kabul belgesi ve yerleştirme görevleri oluşturuldu.', 'success');
      setShowModal(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Mal kabul oluşturulamadı.', 'error');
    }
  };

  const handlePutawayItem = async (item) => {
    try {
      // Uç `/wms/inbound/putaway` ve gövde alan adları backend sözleşmesiyle
      // birebir olmalı (önceden var olmayan bir adrese farklı alanlarla
      // istek atılıyordu; buton her zaman 404 alıyordu).
      await apiClient.post('/wms/inbound/putaway', {
        receipt_id: selectedReceipt?.id,
        item_id: item.id,
        actual_location_id: item.target_location_id,
        quantity: item.expected_qty
      });
      showToast(`${item.product_name} rafa yerleştirildi ve stok defterine işlendi.`, 'success');
      if (selectedReceipt) handleOpenDetail(selectedReceipt);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Yerleştirme başarısız.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1700px] mx-auto text-gray-900 font-sans pb-12">
      {/* 1. Master Header */}
      <div className="veniux-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg shadow-lg shadow-emerald-600/20">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 uppercase">
                Mal kabul ve yerleştirme
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {receipts.length} İRSALİYE KAYDI
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Gelen ürünü irsaliyeyle karşılaştırın, kontrol edin ve rafa yerleştirin.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-full shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Mal Kabul Başlat</span>
        </button>
      </div>

      {/* 2. Receipts Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center text-xs bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-gray-900 uppercase">RAMPA İRSALİYE KUYRUĞU</h3>
          </div>
          <button onClick={fetchInitialData} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-900 transition shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading && receipts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <span>Mal kabul kayıtları yükleniyor...</span>
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <Inbox className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">Bekleyen mal kabul belgesi bulunmuyor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Kabul No</th>
                  <th className="px-4 py-3">Depo</th>
                  <th className="px-4 py-3">Tedarikçi</th>
                  <th className="px-4 py-3">İrsaliye No</th>
                  <th className="px-4 py-3">Miktar (Kabul/Beklenen)</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Kabul Tarihi</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {receipts.map(rec => (
                  <tr key={rec.id} className="hover:bg-brand-50/40 transition">
                    <td className="px-4 py-3 font-bold text-gray-900">{rec.receipt_no}</td>
                    <td className="px-4 py-3 text-gray-500">{rec.warehouse_name}</td>
                    <td className="px-4 py-3 text-gray-500">{rec.supplier_name || 'Genel Tedarikçi'}</td>
                    <td className="px-4 py-3 text-brand-600 font-bold">{rec.waybill_no || '-'}</td>
                    <td className="px-4 py-3 font-bold">
                      <span className="text-emerald-700">{rec.total_received_qty}</span> / {rec.total_expected_qty}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.status === 'stored'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : rec.status === 'receiving'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      }`}>
                        {rec.status === 'stored' ? 'TAMAMLANDI' : rec.status === 'receiving' ? 'YERLEŞTİRİLİYOR' : 'BEKLİYOR'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(rec.received_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenDetail(rec)}
                        className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-500 text-brand-600 hover:text-white border border-brand-200 rounded-full font-bold text-xs transition shadow-2xs"
                      >
                        Detay & Putaway
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Detail & Putaway Drawer with Overlay Backdrop */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Smooth Dark Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setSelectedReceipt(null)}
          />

          {/* Drawer Sidebar */}
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl border-l border-gray-100 flex flex-col z-10 animate-fade-in">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">{selectedReceipt.receipt_no}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedReceipt.status === 'stored'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedReceipt.status === 'receiving'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {selectedReceipt.status === 'stored' ? 'TAMAMLANDI'
                        : selectedReceipt.status === 'receiving' ? 'YERLEŞTİRİLİYOR' : 'BEKLİYOR'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    İrsaliye: <strong className="text-brand-600 font-bold">{selectedReceipt.waybill_no || '-'}</strong> • Depo: {selectedReceipt.warehouse_name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedReceipt(null)} 
                className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  MAL KABUL KALEMLERİ ({selectedReceipt.items?.length || 0})
                </h3>
                <span className="text-gray-400 text-[11px]">Hedef rafa yerleştirerek stoğu onaylayın</span>
              </div>

              <div className="space-y-3">
                {selectedReceipt.items?.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50/80 hover:bg-gray-50 hover:border-brand-200 transition-all space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{item.product_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                          <span className="bg-white px-2 py-0.5 rounded-full border border-gray-200 font-mono font-bold">SKU: {item.sku}</span>
                          {item.lot_number && <span className="bg-white px-2 py-0.5 rounded-full border border-gray-200 font-bold">Lot: {item.lot_number}</span>}
                          {item.expiry_date && <span className="bg-white px-2 py-0.5 rounded-full border border-gray-200 tabular-nums">SKT: {trDate(item.expiry_date)}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-gray-900 bg-white px-3 py-1 rounded-full border border-gray-200 tabular-nums">
                        {qty(item.expected_qty)} <span className="text-[11px] font-bold text-gray-400">adet</span>
                      </span>
                    </div>

                    {/* Smart Slotting Suggestion */}
                    <div className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border text-xs ${
                      item.status === 'completed' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-brand-50/70 border-brand-200'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className={`w-4 h-4 shrink-0 ${item.status === 'completed' ? 'text-emerald-600' : 'text-brand-600'}`} />
                        <span className="text-gray-700 truncate">
                          {item.status === 'completed' ? 'Yerleştirildiği raf' : 'Önerilen hedef raf'}:{' '}
                          <strong className={`font-bold ${item.status === 'completed' ? 'text-emerald-900' : 'text-brand-900'}`}>
                            {item.actual_location_code || item.target_location_code || '—'}
                          </strong>
                        </span>
                      </div>

                      {item.status !== 'completed' ? (
                        <button
                          onClick={() => handlePutawayItem(item)}
                          className="shrink-0 px-3.5 py-1.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold rounded-full shadow-sm shadow-brand-500/25 transition"
                        >
                          Rafa Yerleştir
                        </button>
                      ) : (
                        <span className="shrink-0 text-emerald-700 font-bold text-[11px] flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Yerleşti
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. New Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans text-gray-900">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto text-xs animate-fade-in">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Yeni İrsaliyeli Mal Kabul Belgesi</h3>
                  <p className="text-[11px] text-gray-500">Mal kabul ve raf yerleştirme kaydı</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1 font-semibold">Hedef Depo *</label>
                  <Dropdown
                    required
                    value={form.warehouse_id}
                    onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                    className="w-full bg-gray-50 p-2.5 border border-gray-200 text-gray-900 rounded-xl outline-none font-medium focus:border-brand-500"
                  >
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Dropdown>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1 font-semibold">Tedarikçi</label>
                  <Dropdown
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    className="w-full bg-gray-50 p-2.5 border border-gray-200 text-gray-900 rounded-xl outline-none font-medium focus:border-brand-500"
                  >
                    <option value="">Seçiniz (Opsiyonel)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Dropdown>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1 font-semibold">İrsaliye No *</label>
                  <input
                    type="text"
                    required
                    value={form.waybill_no}
                    onChange={(e) => setForm({ ...form, waybill_no: e.target.value })}
                    placeholder="Örn: IRS-2026-001"
                    className="w-full bg-gray-50 p-2.5 border border-gray-200 text-gray-900 rounded-xl outline-none font-bold placeholder:text-gray-400 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Items Dynamic Rows */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 text-xs">Gelen Ürün Kalemleri ({form.items.length})</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full text-xs shadow-xs transition"
                  >
                    + Kalem Ekle
                  </button>
                </div>

                <div className="space-y-2.5">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50/90 rounded-lg border border-gray-200/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                        <span>Kalem #{idx + 1}</span>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({
                                ...prev,
                                items: prev.items.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="text-red-500 hover:text-red-700 font-semibold"
                          >
                            Sil
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-center">
                        <div className="sm:col-span-3">
                          <Dropdown
                            required
                            value={item.product_id}
                            onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                            className="w-full bg-white p-2.5 border border-gray-200 text-gray-900 rounded-xl outline-none font-medium focus:border-brand-500 text-xs"
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
                            value={item.expected_qty}
                            onChange={(e) => handleItemChange(idx, 'expected_qty', Number(e.target.value))}
                            placeholder="Miktar"
                            className="w-full bg-white p-2.5 border border-gray-200 text-gray-900 rounded-xl outline-none text-center font-bold focus:border-brand-500 text-xs"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={item.lot_number}
                            onChange={(e) => handleItemChange(idx, 'lot_number', e.target.value)}
                            placeholder="Lot / Parti No"
                            className="w-full bg-white p-2.5 border border-gray-200 text-gray-900 rounded-xl outline-none focus:border-brand-500 text-xs placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-full text-gray-700 hover:bg-gray-100 font-medium transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold rounded-full shadow-sm transition"
                >
                  Mal Kabulü Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
