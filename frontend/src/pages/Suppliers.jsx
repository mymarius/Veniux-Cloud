import { money } from '../lib/stockAnalytics';
﻿import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Package,
  X,
  Building2,
  CheckCircle2,
  Search,
  RefreshCw,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '../components/Toast';
import {Link} from 'react-router-dom';
import {SupplierReturnPanel,purchaseStatus,procurementUser} from '../components/ProcurementPanels';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    tax_no: '',
    lead_time_days: 3
  });

  const { showToast } = useToast();
  const user=procurementUser(),canManage=user.is_platform_admin||['admin','manager'].includes(user.role);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/suppliers');
      setSuppliers(res.data || []);
      if (res.data?.length > 0 && !selectedSupplierDetail) {
        handleViewDetail(res.data[0]);
      }
    } catch (err) {
      console.error(err);
      showToast('Tedarikçiler yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      tax_no: '',
      lead_time_days: 3
    });
    setShowModal(true);
  };

  const handleOpenEdit = (s, e) => {
    if (e) e.stopPropagation();
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      contact_name: s.contact_name || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      tax_no: s.tax_no || '',
      lead_time_days: s.lead_time_days || 3
    });
    setShowModal(true);
  };

  const handleViewDetail = async (s) => {
    try {
      const res = await apiClient.get(`/suppliers/${s.id}`);
      setSelectedSupplierDetail(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        lead_time_days: parseInt(formData.lead_time_days, 10) || 3
      };

      if (editingSupplier) {
        await apiClient.put(`/suppliers/${editingSupplier.id}`, payload);
        showToast('Tedarikçi bilgileri güncellendi.', 'success');
      } else {
        await apiClient.post('/suppliers', payload);
        showToast('Yeni tedarikçi kaydı eklendi.', 'success');
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Kayıt başarısız.', 'error');
    }
  };

  const handleDelete = async (s, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`${s.name} tedarikçisini silmek istediğinize emin misiniz?`)) return;
    try {
      await apiClient.delete(`/suppliers/${s.id}`);
      showToast('Tedarikçi sistemden kaldırıldı.', 'success');
      fetchSuppliers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Silme işlemi başarısız.', 'error');
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
      (s.tax_no && s.tax_no.includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto text-gray-900 dark:text-gray-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white bg-gray-100 p-5 rounded-lg border border-gray-200 border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-brand-500 text-white rounded-xl shadow-md shadow-indigo-600/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-mono tracking-tight uppercase">
                Tedarikçiler
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-500 dark:text-brand-500 border border-brand-500/20 font-mono">
                {suppliers.length} AKTİF TEDARİKÇİ
              </span>
            </div>
            <p className="text-xs text-gray-500 text-gray-500 mt-0.5">
              Selçuk Ecza, Alliance Healthcare, Hedef Ecza ve sözleşmeli lojistik dağıtım ortakları
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          disabled={!canManage}
          className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Tedarikçi Ekle</span>
        </button>
      </div>

      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white bg-gray-100 p-4 rounded-xl border border-gray-200 border-gray-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">AKTİF TEDARİKÇİ</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-gray-900 text-gray-900">{suppliers.length}</p>
          <span className="text-[10px] text-gray-500 block">Kayıtlı ecza deposu</span>
        </div>

        <div className="bg-white bg-gray-100 p-4 rounded-xl border border-gray-200 border-gray-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">ORTALAMA TEMİN SÜRESİ</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-brand-500">
            {(suppliers.reduce((s, d) => s + (d.lead_time_days || 3), 0) / (suppliers.length || 1)).toFixed(1)} Gün
          </p>
          <span className="text-[10px] text-gray-500 block">Lead-time ortalaması</span>
        </div>

        <div className="bg-white bg-gray-100 p-4 rounded-xl border border-gray-200 border-gray-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">TEDARİK EDİLEN ÜRÜNLER</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-500">{suppliers.reduce((n,s)=>n+Number(s.product_count||0),0)}</p>
          <span className="text-[10px] text-gray-500 block">Tedarikçi ürün bağlantıları</span>
        </div>

        <div className="bg-white bg-gray-100 p-4 rounded-xl border border-gray-200 border-gray-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">SİPARİŞ GEÇMİŞİ</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-gray-900 text-gray-900">{suppliers.reduce((n,s)=>n+Number(s.order_count||0),0)}</p>
          <span className="text-[10px] text-gray-500 block">Otomatik dış gönderim kapalı</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((s) => {
          const isSelected = selectedSupplierDetail?.id === s.id;

          return (
            <div
              key={s.id}
              onClick={() => handleViewDetail(s)}
              className={`p-5 rounded-lg border transition-all cursor-pointer space-y-4 ${
                isSelected
                  ? 'bg-white bg-gray-100 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                  : 'bg-white bg-gray-100 border-gray-200 border-gray-200 hover:border-gray-200 dark:hover:border-gray-200 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-white text-slate-700 text-gray-500 font-bold">
                    <Building2 className="w-5 h-5 text-brand-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 text-gray-900">{s.name}</h3>
                    <span className="text-[10px] font-mono text-gray-500 block mt-0.5">VKN: {s.tax_no || 'Belirtilmedi'}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleOpenEdit(s, e)}
                    disabled={!canManage}
                    className="p-1 text-gray-500 hover:text-brand-500 rounded-lg transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(s, e)}
                    disabled={!user.is_platform_admin&&user.role!=='admin'}
                    className="p-1 text-gray-500 hover:text-rose-500 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5 text-xs text-gray-500 text-gray-500">
                {s.contact_name && (
                  <p className="font-semibold text-slate-800 dark:text-gray-900">İlgili: {s.contact_name}</p>
                )}
                {s.phone && (
                  <div className="flex items-center space-x-1.5">
                    <Phone className="w-3 h-3 text-gray-500" />
                    <span className="font-mono">{s.phone}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center space-x-1.5">
                    <Mail className="w-3 h-3 text-gray-500" />
                    <span>{s.email}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-200 border-gray-200 flex items-center justify-between text-xs font-mono">
                <span className="text-gray-500">Teslimat Süresi:</span>
                <span className="font-bold text-brand-500">{s.lead_time_days || 3} Gün</span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedSupplierDetail&&<section className="veniux-card p-5 space-y-5"><div className="flex justify-between gap-3"><div><h2 className="text-lg font-semibold">{selectedSupplierDetail.name} · Tedarikçi kartı</h2><p className="text-sm text-gray-500">{selectedSupplierDetail.contact_name||'Yetkili belirtilmedi'} · {selectedSupplierDetail.phone||'Telefon yok'} · {selectedSupplierDetail.email||'E-posta yok'}</p><p className="text-sm text-gray-500">{selectedSupplierDetail.address||'Adres belirtilmedi'}</p></div><button className="btn-soft" onClick={()=>handleViewDetail(selectedSupplierDetail)}>Yenile</button></div><div className="grid lg:grid-cols-2 gap-5"><div><h3 className="font-semibold text-sm mb-2">Tedarik edilen ürünler</h3>{selectedSupplierDetail.products?.length?<div className="max-h-72 overflow-auto">{selectedSupplierDetail.products.map(p=><div key={p.id} className="border-b py-2 text-sm"><b>{p.name}</b><p className="text-xs text-gray-500">{p.sku} · Alış {money(p.purchase_price)}</p></div>)}</div>:<p className="text-sm text-gray-500">Henüz ürün bağlantısı yok.</p>}</div><div><h3 className="font-semibold text-sm mb-2">Sipariş geçmişi</h3>{selectedSupplierDetail.orders?.length?<div className="max-h-72 overflow-auto">{selectedSupplierDetail.orders.map(o=><Link key={o.id} className="block border-b py-2 text-sm" to={'/purchase-orders?order='+o.id}><b className="break-all">{o.order_no}</b><p className="text-xs text-gray-500">{purchaseStatus[o.status]||o.status} · Alınan {o.received_quantity} · Kalan {o.remaining_quantity} · {money(o.total_amount)}</p></Link>)}</div>:<p className="text-sm text-gray-500">Henüz sipariş yok.</p>}</div></div>{!!selectedSupplierDetail.deliveries?.length&&<div><h3 className="font-semibold text-sm">Mal kabul geçmişi</h3><div className="max-h-72 overflow-auto">{selectedSupplierDetail.deliveries.map(i=><p key={i.id} className="text-sm border-b py-2">{i.product_name} · {i.waybill_no||i.receipt_no} · Alınan {i.received_qty}, iade {i.returned_qty} · Lot {i.lot_number||'Yok'} · {i.expiry_date||'Tarih yok'} · {i.location_code||'Rafsız'}</p>)}</div></div>}{canManage&&<SupplierReturnPanel key={selectedSupplierDetail.id} deliveries={selectedSupplierDetail.deliveries||[]} endpoint={'/suppliers/'+selectedSupplierDetail.id+'/returns'} onDone={async()=>{await handleViewDetail(selectedSupplierDetail);showToast('Tedarikçiye iade kaydedildi.','success');}}/>}{!!selectedSupplierDetail.returns?.length&&<div><h3 className="font-semibold text-sm">Tedarikçiye iade geçmişi</h3>{selectedSupplierDetail.returns.map(r=><p key={r.id} className="text-sm border-b py-2">{new Date(r.created_at).toLocaleString('tr-TR')} · {r.reason}</p>)}</div>}</section>}

      {/* Add / Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white bg-gray-100 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200 border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 border-gray-200 pb-3">
              <h3 className="text-base font-bold text-gray-900 text-gray-900 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-brand-500" />
                <span>{editingSupplier ? 'Tedarikçi Bilgilerini Güncelle' : 'Yeni Tedarikçi Ekle'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-500 hover:text-gray-500 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-medium">
              <div>
                <label className="block text-gray-500 mb-1">Tedarikçi Firma Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Selçuk Ecza Deposu A.Ş."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 mb-1">Yetkili / Temsilci</label>
                  <input
                    type="text"
                    placeholder="Ahmet Yılmaz"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Vergi No / VKN</label>
                  <input
                    type="text"
                    placeholder="1234567890"
                    value={formData.tax_no}
                    onChange={(e) => setFormData({ ...formData, tax_no: e.target.value })}
                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 mb-1">Telefon</label>
                  <input
                    type="text"
                    placeholder="0216 555 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">E-Posta</label>
                  <input
                    type="email"
                    placeholder="siparis@selcukecza.com.tr"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Ortalama Temin Süresi (Gün)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                  className="w-full p-2.5 bg-gray-100 dark:bg-gray-100 border border-gray-200 border-gray-200 rounded-xl font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <label className="block text-gray-500">Adres<textarea value={formData.address} onChange={e=>setFormData({...formData,address:e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-xl"/></label>

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
                  {editingSupplier ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
