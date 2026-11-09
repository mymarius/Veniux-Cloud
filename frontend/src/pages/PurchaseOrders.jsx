import PurchaseOrderSend from '../components/PurchaseOrderSend';
import { money } from '../lib/stockAnalytics';
import { Dropdown } from '../components/ui';
import { useLocation } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import apiClient, { useDataSync } from '../api/client';
import {
  ShoppingBag,
  Plus,
  Truck,
  Warehouse,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  X,
  FileText,
  Calendar,
  Check,
  ChevronRight,
  Boxes,
  RefreshCw
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Drawer } from '../components/ui/Drawer';
import {PurchaseReceiptPanel,SupplierReturnPanel,purchaseStatus,procurementUser,useProcurementRequest} from '../components/ProcurementPanels';

export default function PurchaseOrders() {
  const location=useLocation();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receivingId, setReceivingId] = useState(null);
  const [cancelReason,setCancelReason]=useState('');
  const [cancelConfirmed,setCancelConfirmed]=useState(false);
  const [statusError,setStatusError]=useState('');
  const statusInFlight=useRef(false);
  const [saving,setSaving]=useState(false);
  const send=useProcurementRequest();
  const user=procurementUser(),canManage=user.is_platform_admin||['admin','manager'].includes(user.role);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState([
    { product_id: '', quantity: 10, unit_price: 0 }
  ]);

  const { showToast } = useToast();

  // Cross-page reactive sync: refresh orders when any page mutates data
  useDataSync(() => {
    fetchOrders();
  });

  useEffect(() => {
    fetchOrders();
    fetchMetadata();
  }, []);
  useEffect(()=>{const id=new URLSearchParams(location.search).get('order');if(id)handleOpenDetail({id});},[location.search]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/purchase-orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
      showToast('Siparişler yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [supRes, whRes, prodRes] = await Promise.all([
        apiClient.get('/suppliers'),
        apiClient.get('/warehouses'),
        apiClient.get('/products')
      ]);
      setSuppliers(supRes.data || []);
      setWarehouses(whRes.data || []);
      const prods = prodRes.data.products || prodRes.data || [];
      setProducts(prods);

      if (supRes.data?.length > 0) setSupplierId(supRes.data[0].id);
      if (whRes.data?.length > 0) setTargetWarehouseId(whRes.data[0].id);
      if(location.state?.stockSuggestions?.length){
        setOrderItems(location.state.stockSuggestions.map(p=>({product_id:p.id,quantity:p.suggested_quantity,unit_price:prods.find(x=>x.id===p.id)?.purchase_price||0})));
        setNotes('Düşük stok önerisi — miktar, tedarikçi ve depo onaylanmalıdır.');setSupplierId('');setTargetWarehouseId('');setShowModal(true);
      } else if (prods.length > 0) {
        setOrderItems([
          {
            product_id: prods[0].id,
            quantity: 10,
            unit_price: prods[0].purchase_price || prods[0].cost_price || 0
          }
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    setOrderItems([
      ...orderItems,
      {
        product_id: products[0].id,
        quantity: 10,
        unit_price: products[0].purchase_price || products[0].cost_price || 0
      }
    ]);
  };

  const handleRemoveItemRow = (index) => {
    if (orderItems.length <= 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, val) => {
    const next = [...orderItems];
    next[index][field] = val;
    if (field === 'product_id') {
      const p = products.find((x) => x.id === parseInt(val, 10));
      if (p) {
        next[index].unit_price = p.purchase_price || p.cost_price || 0;
      }
    }
    setOrderItems(next);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if(saving)return;
    setSaving(true);
    try {
      const payload = {
        supplier_id: parseInt(supplierId, 10),
        target_warehouse_id: parseInt(targetWarehouseId, 10),
        notes,
        items: orderItems.map((item) => ({
          product_id: parseInt(item.product_id, 10),
          quantity: Number(item.quantity),
          unit_price: parseFloat(item.unit_price) || 0
        }))
      };

      await send('/purchase-orders', payload);
      showToast('Tedarik emri başarıyla oluşturuldu.', 'success');
      setShowModal(false);
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'Sipariş oluşturulamadı.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetail = async (order) => {
    try {
      const res = await apiClient.get(`/purchase-orders/${order.id}`);
      setSelectedOrder(res.data);
      setCancelReason('');setCancelConfirmed(false);
      setStatusError('');
    } catch (err) {
      console.error(err);
      showToast('Sipariş detayları yüklenemedi.', 'error');
    }
  };

  const handleStatus = async (action) => {
    if(statusInFlight.current||!selectedOrder)return;
    if(action==='cancel'&&(!cancelConfirmed||cancelReason.trim().length<3))return;
    statusInFlight.current=true;
    setStatusError('');
    let committed=false;
    try {
      setReceivingId(selectedOrder.id);
      const response=await apiClient.post(`/purchase-orders/${selectedOrder.id}/status`, {action,reason:cancelReason.trim()});
      committed=true;
      // The server has accepted this transition, even if the following read fails.
      setSelectedOrder(order=>order&&({...order,status:response.data.status,
        ...(action==='cancel'?{cancel_reason:cancelReason.trim(),items:order.items.map(i=>({...i,cancelled_quantity:Math.max(0,Number(i.quantity)-Number(i.received_quantity)),remaining_quantity:0}))}:{})}));
      setCancelConfirmed(false);
      showToast('Sipariş durumu güncellendi. Stok değişmedi.', 'success');
      const results=await Promise.allSettled([
        apiClient.get(`/purchase-orders/${selectedOrder.id}`),
        apiClient.get('/purchase-orders')
      ]);
      if(results[0].status==='fulfilled')setSelectedOrder(results[0].value.data);
      if(results[1].status==='fulfilled')setOrders(results[1].value.data||[]);
      if(results.some(r=>r.status==='rejected'))setStatusError('İşlem kaydedildi; güncel bilgiler alınamadı. Bilgileri yeniden yükleyin.');
    } catch (err) {
      const message=committed?'İşlem kaydedildi; güncel bilgileri yeniden yükleyin.':
        err.response?.status>=500?'Sipariş işlemi şu anda tamamlanamadı. Gerekçeniz korunuyor; yeniden deneyebilirsiniz.':
        err.response?.data?.error||'Bağlantı nedeniyle sonuç doğrulanamadı. Gerekçeniz korunuyor; yeniden deneyebilirsiniz.';
      setStatusError(message);
      showToast(message, 'error');
    } finally {
      setReceivingId(null);
      statusInFlight.current=false;
    }
  };

  const getStatusType = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_transit': return 'info';
      case 'approved': return 'info';
      case 'partially_received': return 'info';
      case 'cancelled': return 'error';
      default: return 'warning';
    }
  };
  
  const getStatusText = (status) => {
    return purchaseStatus[status]||status;
  };

  const columns = [
    { 
      header: 'Sipariş No', 
      accessorKey: 'order_no', 
      cell: (info) => <span className="font-mono font-bold text-gray-900">{info.getValue()}</span>
    },
    { 
      header: 'Tedarikçi', 
      accessorKey: 'supplier_name', 
      cell: (info) => <span className="font-semibold text-gray-900">{info.getValue() || '—'}</span>
    },
    { 
      header: 'Hedef Depo', 
      accessorKey: 'target_warehouse_name', 
      cell: (info) => <span className="text-gray-500">{info.getValue() || '—'}</span>
    },
    { 
      header: 'Kalem / Miktar', 
      accessorKey: 'item_count', 
      cell: (info) => <span className="font-mono text-brand-500 tabular-nums">{info.row.original.item_count} kalem · Alınan {info.row.original.received_quantity} · Kalan {info.row.original.remaining_quantity}</span>
    },
    { 
      header: 'Sipariş Tutarı', 
      accessorKey: 'total_amount', 
      cell: (info) => <span className="font-mono font-bold text-gray-900 tabular-nums">₺{Number(info.getValue() || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
    },
    { 
      header: 'Durum', 
      accessorKey: 'status', 
      cell: (info) => (
        <StatusBadge status={getStatusType(info.getValue())} text={getStatusText(info.getValue())}/>
      ) 
    },
    { 
      header: 'Tarih', 
      accessorKey: 'created_at', 
      cell: (info) => <span className="font-mono text-gray-500">{new Date(info.getValue()).toLocaleDateString('tr-TR')}</span>
    },
    { 
      header: 'Aksiyon', 
      id: 'actions', 
      cell: (info) => (
        <button
          onClick={() => handleOpenDetail(info.row.original)}
          className="px-3 py-1.5 bg-white hover:bg-brand-500/10 hover:text-brand-500 text-gray-500 rounded-lg text-xs font-bold transition"
        >
          İncele & Kabul
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto text-gray-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-brand-500 text-white rounded-xl shadow-md shadow-primary/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-mono tracking-tight uppercase text-gray-900">
                Satın alma siparişleri
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/10 text-brand-500 border border-brand-500/20 font-mono">
                {orders.length} SİPARİŞ EMRİ
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Taslak, onay ve teslimat takibi · Siparişler tedarikçiye otomatik gönderilmez
            </p>
          </div>
        </div>

        <button
          disabled={!canManage}
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-500/90 text-white rounded-xl text-xs font-bold transition shadow-md shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Satınalma Emri</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            TÜM SATINALMA EMİRLERİ LİSTESİ
          </h2>
          <span className="text-xs font-mono text-gray-500">{orders.length} Kayıt</span>
        </div>
        <div className="p-0">
          <DataTable flush 
            columns={columns} 
            data={orders} 
            isLoading={loading} 
            emptyMessage="Henüz kayıtlı satınalma emri bulunmamaktadır."
          />
        </div>
      </div>

      {/* Order Detail Drawer */}
      <Drawer
        isOpen={!!selectedOrder}
        onClose={() => {if(!statusInFlight.current)setSelectedOrder(null);}}
        title={selectedOrder?.order_no||''}
        size="xl"
      >
        {selectedOrder && (
          <div className="space-y-6 flex flex-col h-full">
            <div className="space-y-5 flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-500">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-mono text-gray-900">
                    {selectedOrder.order_no}
                  </h2>
                  <p className="text-xs text-gray-500">Tedarikçi: {selectedOrder.supplier_name}</p>
                  <p className="text-xs text-gray-500">{getStatusText(selectedOrder.status)} · {selectedOrder.target_warehouse_name}</p>
                </div>
              </div>

              {/* Items in PO */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Sipariş Kalemleri</h3>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, i) => (
                    <div key={i} className="p-3 bg-white rounded-xl border border-gray-200 flex flex-wrap gap-2 items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-900">{item.product_name}</p>
                        <p className="text-[10px] font-mono text-gray-500">Birim fiyat: {money(item.unit_price)}</p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-xs font-bold text-brand-500">{item.quantity} Adet</span>
                        <p className="text-xs text-gray-500">Alınan {item.received_quantity} · Kalan {item.remaining_quantity} · İptal {item.cancelled_quantity}</p>
                        <p className="text-xs text-gray-500">Depodaki güncel stok: {item.warehouse_stock_quantity} {item.unit}</p>
                        <p className="text-[11px] font-semibold text-gray-900">{money(item.quantity * item.unit_price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selectedOrder.cancel_reason&&<section className="border rounded-xl p-4 text-sm space-y-1"><h3 className="font-semibold">İptal geçmişi</h3><p>İptal gerekçesi: {selectedOrder.cancel_reason}</p><p className="text-xs text-gray-500">{selectedOrder.cancelled_at&&new Date(selectedOrder.cancelled_at).toLocaleString('tr-TR')} · İşlemi yapan kullanıcı: {selectedOrder.cancelled_by}</p><p className="text-xs text-gray-500">Alınan stok korunarak yalnızca kalan miktar kapatıldı.</p></section>}
              {canManage&&<PurchaseOrderSend key={'send-'+selectedOrder.id} order={selectedOrder}/>}
              {canManage&&['approved','partially_received'].includes(selectedOrder.status)&&<PurchaseReceiptPanel order={selectedOrder} onDone={async()=>{await handleOpenDetail(selectedOrder);await fetchOrders();showToast('Teslimat kabul edildi.','success');}}/>}
              {!!selectedOrder.deliveries?.length&&<section className="border rounded-xl p-4 space-y-2"><h3 className="font-semibold text-sm">Teslimat geçmişi</h3>{selectedOrder.deliveries.map(i=><div key={i.id} className="border-b pb-2 text-sm"><b>{i.product_name}</b><p className="text-xs text-gray-500">{i.waybill_no} · {i.received_qty} {i.unit} · İade {i.returned_qty} · Lot {i.lot_number||'Yok'} · {i.expiry_date||'Tarih yok'} · {i.location_code} · {money(i.unit_purchase_price)}</p></div>)}</section>}
              {canManage&&<SupplierReturnPanel key={selectedOrder.id} deliveries={selectedOrder.deliveries||[]} endpoint={'/purchase-orders/'+selectedOrder.id+'/returns'} onDone={async()=>{await handleOpenDetail(selectedOrder);await fetchOrders();showToast('Tedarikçiye iade kaydedildi.','success');}}/>}
              {!!selectedOrder.returns?.length&&<section className="text-sm"><h3 className="font-semibold">İade geçmişi</h3>{selectedOrder.returns.map(r=><p key={r.id}>{new Date(r.created_at).toLocaleString('tr-TR')} · {r.reason}</p>)}</section>}
            </div>

            <div className="border-t border-gray-200 pt-4 flex justify-between items-center mt-auto">
              <div>
                <span className="text-[10px] font-mono text-gray-500 block">TOPLAM TUTAR</span>
                <span className="text-lg font-bold font-mono text-green-600">
                  ₺{Number(selectedOrder.total_amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex space-x-2">
                {canManage&&['draft','pending'].includes(selectedOrder.status) && (
                  <button
                    onClick={() => handleStatus(selectedOrder.status==='draft'?'submit':'approve')}
                    disabled={receivingId === selectedOrder.id}
                    className="px-4 py-2 bg-green-500 hover:bg-green-500/90 text-white font-bold text-xs rounded-xl transition shadow-md shadow-success/20 flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{receivingId === selectedOrder.id ? 'İşleniyor...' : selectedOrder.status==='draft'?'Onaya gönder':'Siparişi onayla'}</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  disabled={!!receivingId}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-900 font-bold text-xs rounded-xl"
                >
                  Kapat
                </button>
              </div>
            </div>
            {statusError&&<div role="alert" className="text-sm text-red-700 border border-red-100 rounded-lg p-3"><p>{statusError}</p>{selectedOrder.status==='cancelled'&&<button type="button" className="btn-soft mt-2" disabled={!!receivingId} onClick={async()=>{await handleOpenDetail(selectedOrder);await fetchOrders();}}>Bilgileri yeniden yükle</button>}</div>}
            {canManage&&['draft','pending','approved','partially_received'].includes(selectedOrder.status)&&<div className="border-t pt-3 space-y-2"><label className="text-sm">Kalan miktarı iptal etme gerekçesi<input disabled={!!receivingId} className="w-full border rounded-lg p-2" value={cancelReason} onChange={e=>{setCancelReason(e.target.value);setCancelConfirmed(false);setStatusError('');}}/></label><p className="text-sm text-slate-600">Alınan stok korunacak; yalnızca kalan sipariş miktarı kapatılacak.</p><button type="button" aria-pressed={cancelConfirmed} disabled={!!receivingId||cancelReason.trim().length<3} className="text-sm border rounded-lg px-3 py-2 disabled:opacity-50" onClick={()=>{setCancelConfirmed(!cancelConfirmed);setStatusError('');}}>{cancelConfirmed?'İptal onayı verildi — geri al':'Kalan miktarın iptalini onaylıyorum'}</button><button disabled={!!receivingId||cancelReason.trim().length<3||!cancelConfirmed} className="text-sm text-red-700 disabled:opacity-50" onClick={()=>handleStatus('cancel')}>{receivingId?'İptal işleniyor…':'Kalan siparişi iptal et'}</button></div>}
          </div>
        )}
      </Drawer>

      {/* New Purchase Order Drawer (Replaced Modal) */}
      <Drawer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Yeni Satınalma & Tedarik Emri"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center space-x-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-brand-500" />
            <span className="text-base font-bold text-gray-900">Yeni Satınalma & Tedarik Emri</span>
          </div>

          <form onSubmit={handleCreateOrder} className="space-y-4 text-xs font-medium flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-500 mb-1">Tedarikçi Firma</label>
                <Dropdown
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-500 cursor-pointer text-gray-900"
                >
                  <option value="">Tedarikçi seçin</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Dropdown>
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Hedef Depo</label>
                <Dropdown
                  required
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-500 cursor-pointer text-gray-900"
                >
                  <option value="">Depo seçin</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Dropdown>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2 border-t border-gray-200 pt-3 flex-1">
              <div className="flex items-center justify-between">
                <label className="text-gray-500 font-bold">Sipariş Edilecek Ürünler</label>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="text-xs text-brand-500 font-bold hover:underline"
                >
                  + Ürün Satırı Ekle
                </button>
              </div>

              {orderItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-gray-200">
                  <div className="col-span-6">
                    <Dropdown
                      required
                      value={item.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                      className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-900"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </Dropdown>
                  </div>

                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      required
                      placeholder="Miktar"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono text-gray-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Birim Fiyat"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono text-gray-900"
                    />
                  </div>

                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="text-gray-500 hover:text-red-500 p-1"
                    >
                      <X className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <label className="text-sm">Sipariş notu<textarea className="w-full border rounded-xl p-2" maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>

            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200 mt-auto">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-xl font-bold"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={saving||!canManage}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-500/90 text-white rounded-xl font-bold shadow-md shadow-primary/20"
              >
                {saving?'Kaydediliyor…':'Taslak siparişi kaydet'}
              </button>
            </div>
          </form>
        </div>
      </Drawer>
    </div>
  );
}


