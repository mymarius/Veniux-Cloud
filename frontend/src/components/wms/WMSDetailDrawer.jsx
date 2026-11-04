import DialogShell from '../ui/DialogShell';
import { summarizeProductStock } from '../../lib/productStock.mjs';
import {readSessionUser} from '../../lib/sessionUser';
import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Package,
  Layers,
  Lock,
  Unlock,
  ArrowRightLeft,
  Clock,
  Boxes,
  ShieldAlert,
  CheckCircle2,
  FileText,
  DollarSign,
  Calendar,
  Tag,
  Barcode,
  AlertTriangle,
  Building2,
  TrendingUp
} from 'lucide-react';
import apiClient from '../../api/client';
import { useToast } from '../Toast';
import useWmsTransfer from '../../hooks/useWmsTransfer';
import { Dropdown } from '../ui';

export default function WMSDetailDrawer({
  isOpen,
  onClose,
  locationId = null,
  productId = null,
  onUpdated = null
}) {
  const transfer = useWmsTransfer();
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [ledgerLogs, setLedgerLogs] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Relocate state for location mode
  const [relocateForm, setRelocateForm] = useState({
    product_id: '',
    target_location_id: '',
    quantity: 1,
    notes: ''
  });

  const { showToast } = useToast();
  const isProductMode = !locationId && Boolean(productId);

  const currentUser = readSessionUser();
  const canViewCosts = ['admin', 'manager'].includes(currentUser.role) || Boolean(currentUser.is_platform_admin);



  useEffect(() => {
    if (isOpen && (locationId || productId)) {
      setActiveTab('overview');
      fetchDetail();
    }
  }, [isOpen, locationId, productId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      if (locationId) {
        const [locRes, logsRes] = await Promise.all([
          apiClient.get(`/wms/locations/${locationId}`),
          apiClient.get(`/wms/ledger?location_id=${locationId}`)
        ]);
        const locsRes = await apiClient.get('/wms/locations', {
          params: { warehouse_id: locRes.data.warehouse_id }
        });
        setData(locRes.data);
        setLedgerLogs(logsRes.data || []);
        setAllLocations(locsRes.data || []);
      } else if (productId) {
        const [prodDetailRes, wmsRes, logsRes] = await Promise.all([
          apiClient.get(`/products/${productId}`),
          apiClient.get(`/wms/ledger/product/${productId}`).catch(() => ({ data: {} })),
          apiClient.get(`/wms/ledger?product_id=${productId}`).catch(() => ({ data: [] }))
        ]);
        const pData = prodDetailRes.data;
        const wData = wmsRes.data || {};
        setData({
          product: pData,
          totals: summarizeProductStock(pData, wData),
          bins: wData.locations || [],
          lots: wData.lots || []
        });
        setLedgerLogs(logsRes.data || pData.recent_movements || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Detay verileri yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (!data?.id) return;
    try {
      const nextLocked = data.is_locked ? 0 : 1;
      const res = await apiClient.put(`/wms/locations/${data.id}/lock`, {
        is_locked: nextLocked,
        reason: nextLocked ? 'Bakım / Karantina Kilidi' : null
      });
      setData(prev => ({ ...prev, is_locked: res.data.is_locked, lock_reason: res.data.lock_reason }));
      showToast(nextLocked ? 'Raf lokasyonu kilitlendi.' : 'Raf kilidi kaldırıldı.', 'success');
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast('Kilit durumu değiştirilemedi.', 'error');
    }
  };

  const handleExecuteRelocate = async (e) => {
    e.preventDefault();
    if (!transfer.pending && (!relocateForm.target_location_id || !relocateForm.product_id)) {
      showToast('Hedef raf ve ürün seçiniz.', 'warning');
      return;
    }

    try {
      const moved = await transfer.execute({
        warehouse_id: data.warehouse_id || 1,
        source_location_id: data.id,
        target_location_id: parseInt(relocateForm.target_location_id, 10),
        product_id: parseInt(relocateForm.product_id, 10),
        lot_id: relocateForm.lot_id || null,
        quantity: parseFloat(relocateForm.quantity),
        notes: relocateForm.notes || 'Operasyonel Raf İkmali / Düzenleme'
      });

      if (!moved) return;
      showToast('Ürün hedef rafa başarıyla transfer edildi!', 'success');
      setActiveTab('overview');
      fetchDetail();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast(err.response?.data?.error || 'Transfer gerçekleştirilemedi.', 'error');
    }
  };

  if (!isOpen) return null;

  const product = isProductMode ? data?.product : null;
  const totals = isProductMode ? data?.totals : null;
  const bins = isProductMode ? data?.bins || [] : [];
  const lots = isProductMode ? data?.lots || [] : [];

  const tabs = isProductMode
    ? [
        { id: 'overview', label: canViewCosts ? 'Genel Bakış & Maliyet' : 'Genel Bakış & Fiyat' },
        { id: 'locations', label: `Raf Dağılımı (${bins.length})` },
        { id: 'lots', label: `Lot & SKT (${lots.length})` },
        { id: 'ledger', label: `Hareketler (${ledgerLogs.length})` }
      ]
    : [
        { id: 'overview', label: 'Genel Bakış' },
        { id: 'inventory', label: `Raftaki Ürünler (${data?.inventory?.length || 0})` },
        { id: 'ledger', label: 'İşlem Defteri (Ledger)' },
        { id: 'relocate', label: 'Raftan Rafa Transfer' }
      ];

  return (
    <DialogShell isOpen={isOpen} onClose={onClose} ariaLabel={isProductMode ? 'Ürün Detay Paneli' : 'Raf Lokasyon Paneli'} variant="drawer" size="xl">
      <div className="w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-white h-full shadow-2xl flex flex-col justify-between border-l border-gray-200/80 dark:border-slate-800 animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/70 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 border border-brand-500/20">
              {isProductMode ? <Package className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold font-mono text-gray-900 dark:text-white">
                  {isProductMode
                    ? product?.name || 'Ürün Detayı'
                    : data?.location_code || 'Lokasyon Detayı'}
                </h2>
                {isProductMode ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                    SKU: {product?.sku || '-'}
                  </span>
                ) : data?.is_locked ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>KİLİTLİ</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    AKTİF
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isProductMode
                  ? `${product?.category || 'Genel'} • Depo stoku: ${totals?.total_quantity ?? 0} ${product?.unit || 'Adet'}`
                  : `${data?.zone_name || 'Bölge'} • Kat ${data?.shelf_tier} • Göz ${data?.bin_position} • ${data?.location_type || 'Raf'}`}
              </p>
            </div>
          </div>

          <button
            aria-label="Detayları kapat" onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-gray-200 dark:border-slate-800 flex space-x-5 text-xs font-bold bg-white dark:bg-slate-900 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 border-b-2 whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-slate-800 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-16 text-center text-gray-500 text-xs">Yükleniyor...</div>
          ) : isProductMode ? (
            /* PRODUCT MODE CONTENT */
            <>
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase block">Depo stoku</span>
                      <p className="text-base font-bold font-mono text-brand-600 dark:text-brand-400">
                        {totals?.total_quantity ?? 0} {product?.unit || 'Adet'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase block">Kullanılabilir</span>
                      <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {totals?.available_quantity ?? 0}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase block">Rezerve</span>
                      <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
                        {totals?.total_reserved ?? 0}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase block">Raf Sayısı</span>
                      <p className="text-base font-bold font-mono text-slate-900 dark:text-white">
                        {totals?.location_count ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Commercial Specs */}
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      {canViewCosts ? 'Fiyatlandırma & Kâr Marjı' : 'Satış Fiyatlandırması'}
                    </h3>
                    <div className={`grid ${canViewCosts ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-3 text-xs`}>
                      {canViewCosts && (
                        <div>
                          <span className="text-[10px] text-gray-500 block">Alış Maliyeti</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {product?.purchase_price != null ? `₺${Number(product.purchase_price).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] text-gray-500 block">Satış Fiyatı</span>
                        <span className="font-mono font-bold text-emerald-600">
                          ₺{Number(product?.sale_price || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">KDV Oranı</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          %{product?.kdv_orani ?? 20}
                        </span>
                      </div>
                      {canViewCosts && (
                        <div>
                          <span className="text-[10px] text-gray-500 block">Birim Kâr</span>
                          <span className="font-mono font-bold text-brand-600">
                            {product?.purchase_price != null
                              ? `₺${(Number(product?.sale_price || 0) - Number(product.purchase_price)).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                              : '-'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Identification and Barcode */}
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-brand-600" />
                      Kimlik ve Barkod Bilgileri
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Barkod / GTIN</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {product?.barcode || product?.gtin || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">SKU</span>
                        <span className="font-bold text-slate-900 dark:text-white">{product?.sku || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Kayıt numarası</span>
                        <span className="font-bold text-slate-600 dark:text-slate-400">{String(product?.id || '-')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'locations' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Depolanan Raf Lokasyonları ({bins.length})
                  </h3>
                  {bins.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center border border-dashed rounded-xl">
                      Bu ürün henüz hiçbir WMS rafına yerleştirilmemiş.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {bins.map((bin, i) => (
                        <div
                          key={i}
                          className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-sm">
                              {bin.location_code}
                            </span>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {bin.zone_name || 'Bölge'} • Koridor {bin.aisle_code || '-'} • Kat {bin.shelf_tier} • Göz {bin.bin_position}
                            </p>
                            {bin.lot_number && (
                              <span className="inline-block mt-1 font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                Lot: {bin.lot_number} {bin.expiry_date ? `(SKT: ${bin.expiry_date})` : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                              {bin.quantity} {product?.unit || 'Adet'}
                            </span>
                            {bin.reserved_quantity > 0 && (
                              <p className="text-[10px] text-amber-500 font-mono">
                                Rezerve: {bin.reserved_quantity}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'lots' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Parti & Son Kullanma Tarihi Durumu ({lots.length})
                  </h3>
                  {lots.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center border border-dashed rounded-xl">
                      Bu ürüne tanımlı parti (lot) kaydı bulunmamaktadır.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lots.map((lot, i) => (
                        <div
                          key={i}
                          className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              Lot: {lot.lot_number}
                            </span>
                            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>SKT: {lot.expiry_date || 'Belirtilmedi'}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sm text-brand-600">
                              {lot.quantity} {product?.unit || 'Adet'}
                            </span>
                            <span className={`block text-[10px] font-bold uppercase mt-0.5 ${
                              lot.status === 'expired'
                                ? 'text-rose-600'
                                : lot.status === 'quarantine'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}>
                              {lot.status || 'Aktif'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'ledger' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Son Stok Defteri Hareketleri ({ledgerLogs.length})
                  </h3>
                  {ledgerLogs.length === 0 ? (
                    <p className="text-xs text-gray-500 py-8 text-center border border-dashed rounded-xl">
                      Bu ürüne ait son işlem kaydı bulunamadı.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ledgerLogs.slice(0, 15).map((log, i) => (
                        <div
                          key={i}
                          className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-brand-600">
                              {log.transaction_type}
                            </span>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {log.location_code ? `Raf: ${log.location_code} • ` : ''}
                              {new Date(log.created_at).toLocaleString('tr-TR')}
                            </p>
                          </div>
                          <span className={`font-mono font-bold ${
                            Number(log.quantity) > 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}>
                            {Number(log.quantity) > 0 ? `+${log.quantity}` : log.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* LOCATION MODE CONTENT (Original Refined) */
            <>
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase">Maksimum Yük</span>
                      <p className="text-sm font-bold font-mono">{data?.max_weight_kg || 500} kg</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase">Hacim Limiti</span>
                      <p className="text-sm font-bold font-mono">{data?.max_volume_m3 || 1.5} m³</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase">Saklama Sınıfı</span>
                      <p className="text-sm font-bold font-mono">{data?.allowed_storage_class || 'STANDART'}</p>
                    </div>
                  </div>

                  {data?.is_locked && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Kilit Sebebi: <strong>{data.lock_reason || 'Kullanım Dışı'}</strong></span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Raftaki Ürün Özeti</h3>
                    {data?.inventory?.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center border border-dashed rounded-xl">
                        Bu rafta kayıtlı ürün bulunmamaktadır.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {data?.inventory?.map(item => (
                          <div
                            key={item.id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-bold text-gray-900 dark:text-white">{item.product_name}</p>
                              <p className="text-[10px] font-mono text-gray-500">
                                SKU: {item.sku} {item.lot_number ? `• Lot: ${item.lot_number}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold font-mono text-brand-600">
                                {item.quantity} Adet
                              </span>
                              {item.reserved_qty > 0 && (
                                <p className="text-[10px] font-mono text-amber-500">
                                  Rezerve: {item.reserved_qty}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'inventory' && (
                <div className="space-y-3">
                  {data?.inventory?.map(item => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{item.product_name}</span>
                        <span className="font-mono text-base font-semibold text-brand-600">{item.quantity} Adet</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-gray-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <span className="block text-[10px] text-gray-400">SKU</span>
                          <span>{item.sku}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-400">LOT NO</span>
                          <span>{item.lot_number || '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-400">SKT</span>
                          <span>{item.expiry_date || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'ledger' && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Son Stok Defteri Hareketleri
                  </h3>
                  {ledgerLogs.length === 0 ? (
                    <p className="text-xs text-gray-500 py-6 text-center border border-dashed rounded-xl">
                      Bu lokasyonda geçmiş işlem kaydı yok.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ledgerLogs.slice(0, 10).map((log, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-brand-600">{log.transaction_type}</span>
                            <p className="text-[10px] text-gray-500">
                              {log.product_name} • {new Date(log.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <span className={`font-mono font-bold ${
                            log.quantity > 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}>
                            {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'relocate' && (
                <form onSubmit={handleExecuteRelocate} className="space-y-4 text-xs">
                  {transfer.pending && (
                    <p role="alert">
                      Transfer sonucu doğrulanmalı; bekleyen işlem aynı anahtarla tekrar kontrol edilecek.
                    </p>
                  )}
                  <fieldset disabled={transfer.busy || !!transfer.pending} className="space-y-4">
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1">Transfer Edilecek Ürün</label>
                      <Dropdown
                        required
                        value={relocateForm.source_bin_id || ''}
                        onChange={e => {
                          const row = data.inventory.find(i => String(i.id) === e.target.value);
                          setRelocateForm({
                            ...relocateForm,
                            source_bin_id: e.target.value,
                            product_id: row?.product_id || '',
                            lot_id: row?.lot_id || null
                          });
                        }}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500"
                      >
                        <option value="">-- Raftaki Ürünü Seçin --</option>
                        {data?.inventory?.map(i => (
                          <option key={i.id} value={i.id}>
                            {i.product_name} ({i.quantity} adet)
                          </option>
                        ))}
                      </Dropdown>
                    </div>

                    <div>
                      <label className="block text-gray-500 font-semibold mb-1">Hedef Raf Lokasyonu</label>
                      <Dropdown
                        required
                        value={relocateForm.target_location_id}
                        onChange={e => setRelocateForm({ ...relocateForm, target_location_id: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500"
                      >
                        <option value="">-- Hedef Rafı Seçin --</option>
                        {allLocations
                          .filter(l => l.id !== data.id)
                          .map(l => (
                            <option key={l.id} value={l.id}>
                              {l.location_code} ({l.zone_name} • Kat {l.shelf_tier})
                            </option>
                          ))}
                      </Dropdown>
                    </div>

                    <div>
                      <label className="block text-gray-500 font-semibold mb-1">Transfer Miktarı</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={relocateForm.quantity}
                        onChange={e => setRelocateForm({ ...relocateForm, quantity: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-500 font-semibold mb-1">Transfer Notu / Gerekçe</label>
                      <input
                        type="text"
                        value={relocateForm.notes}
                        onChange={e => setRelocateForm({ ...relocateForm, notes: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500"
                      />
                    </div>

                    <button type="submit" className="w-full btn-primary py-2.5">
                      Raftan Rafa Taşı
                    </button>
                  </fieldset>
                </form>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 flex justify-between items-center text-xs">
          {!isProductMode && data?.id && (
            <button
              onClick={handleToggleLock}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold border transition ${
                data?.is_locked
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {data?.is_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{data?.is_locked ? 'Kilidi Aç' : 'Rafı Kilitle'}</span>
            </button>
          )}

          {isProductMode && (
            <span className="text-[11px] text-gray-400 font-mono">
              Ürün ve depo kayıtları
            </span>
          )}

          <button aria-label="Detayları kapat" onClick={onClose} className="btn-secondary px-4 py-1.5">
            Kapat
          </button>
        </div>
      </div>
</DialogShell>
);
}


