import { Dropdown } from '../../components/ui';
import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
  Layers,
  Warehouse,
  Plus,
  ArrowRightLeft,
  Lock,
  Unlock,
  Package,
  Boxes,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Snowflake,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function WMSLocations() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedAisle, setSelectedAisle] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected bin detail drawer
  const [selectedBin, setSelectedBin] = useState(null);
  const [binDetailLoading, setBinDetailLoading] = useState(false);

  // Relocate Modal
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [relocateForm, setRelocateForm] = useState({
    product_id: '',
    lot_id: '',
    target_location_id: '',
    quantity: 1,
    notes: ''
  });

  // Aisle Generator Modal
  const [showGridModal, setShowGridModal] = useState(false);
  const [gridForm, setGridForm] = useState({
    aisle_code: '',
    zone_name: 'General',
    rack_count: 4,
    tier_count: 3,
    bin_count: 3,
    max_weight_kg: 500
  });

  const { showToast } = useToast();

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchLocations();
    }
  }, [selectedWarehouseId, selectedZone, selectedAisle]);

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

  const fetchLocations = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      let url = `/wms/locations?warehouse_id=${selectedWarehouseId}`;
      if (selectedZone !== 'ALL') url += `&zone_name=${selectedZone}`;
      if (selectedAisle !== 'ALL') url += `&aisle_code=${selectedAisle}`;
      const res = await apiClient.get(url);
      setLocations(res.data || []);
    } catch (err) {
      console.error(err);
      showToast('Depo raf lokasyonları yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBinDetail = async (bin) => {
    setBinDetailLoading(true);
    setSelectedBin(bin);
    try {
      const res = await apiClient.get(`/wms/locations/${bin.id}`);
      setSelectedBin(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBinDetailLoading(false);
    }
  };

  const handleToggleLock = async (binId, currentLockStatus) => {
    try {
      await apiClient.post(`/wms/locations/${binId}/lock`, {
        is_locked: !currentLockStatus,
        reason: !currentLockStatus ? 'Operatör tarafından manuel kilitlendi' : ''
      });
      showToast(`Göz ${!currentLockStatus ? 'kilitlendi' : 'kilidi açıldı'}.`, 'success');
      fetchLocations();
      if (selectedBin?.id === binId) {
        handleOpenBinDetail({ id: binId });
      }
    } catch (err) {
      console.error(err);
      showToast('Göz kilit durumu değiştirilemedi.', 'error');
    }
  };

  const handleGenerateGrid = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/wms/locations/generate-grid', {
        warehouse_id: selectedWarehouseId,
        ...gridForm
      });
      showToast(`${gridForm.aisle_code} koridoru ve rafları oluşturuldu.`, 'success');
      setShowGridModal(false);
      fetchLocations();
    } catch (err) {
      console.error(err);
      showToast('Koridor oluşturulurken hata oluştu.', 'error');
    }
  };

  const handleRelocateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBin?.id) return;
    try {
      await apiClient.post('/wms/locations/relocate', {
        source_location_id: selectedBin.id,
        target_location_id: relocateForm.target_location_id,
        product_id: relocateForm.product_id,
        lot_id: relocateForm.lot_id || null,
        quantity: Number(relocateForm.quantity),
        notes: relocateForm.notes
      });
      showToast('Stok transferi (Relocation) başarıyla gerçekleştirildi.', 'success');
      setShowRelocateModal(false);
      fetchLocations();
      if (selectedBin) handleOpenBinDetail(selectedBin);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Stok transferi başarısız oldu.', 'error');
    }
  };

  // Filter Locations
  const filteredLocations = locations.filter(loc => {
    if (!searchQuery) return true;
    return loc.location_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (loc.barcode && loc.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Extract unique Zones and Aisles
  const zones = Array.from(new Set(locations.map(l => l.zone_name).filter(Boolean)));
  const aisles = Array.from(new Set(locations.map(l => l.aisle_code).filter(Boolean))).sort();

  // Group by Aisle -> Rack -> Tier -> Bin
  const groupedByAisle = {};
  filteredLocations.forEach(loc => {
    if (!groupedByAisle[loc.aisle_code]) groupedByAisle[loc.aisle_code] = {};
    if (!groupedByAisle[loc.aisle_code][loc.rack_number]) groupedByAisle[loc.aisle_code][loc.rack_number] = [];
    groupedByAisle[loc.aisle_code][loc.rack_number].push(loc);
  });

  const getOccupancyBadge = (loc) => {
    if (loc.is_locked) return 'bg-white border-gray-200 text-gray-500 opacity-60';
    if (loc.zone_name === 'COLD_STORAGE') return 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300';
    if (loc.zone_name === 'QUARANTINE') return 'bg-purple-950/60 border-purple-500/40 text-purple-300';
    if (loc.is_empty) return 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400';
    if (loc.is_full) return 'bg-rose-950/50 border-rose-500/50 text-rose-300 hover:border-rose-400';
    return 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:border-amber-400';
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1700px] mx-auto text-gray-900 font-sans pb-12">
      {/* 1. Header */}
      <div className="veniux-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-500/20 text-brand-500 border border-brand-500/30 rounded-lg shadow-lg shadow-indigo-600/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 uppercase">
                2D / 3D SPATIAL RAF & GÖZ MATRİSİ
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-600 border border-brand-200">
                {locations.length} TOPLAM GÖZ
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Koridor (Aisle), Raf (Rack), Kat (Tier) ve Göz (Bin) Hiyerarşik Doluluk Haritası
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Warehouse Selector */}
          <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-2 rounded-full border border-gray-200 text-xs">
            <Warehouse className="w-4 h-4 text-brand-500" />
            <Dropdown
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-transparent text-gray-900 font-bold outline-none cursor-pointer"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id} className="bg-white">{w.name}</option>
              ))}
            </Dropdown>
          </div>

          <button
            onClick={() => setShowGridModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-full shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Koridor / Raf Ekle</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar & Color Legend */}
      <div className="veniux-card p-5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Göz kodu ara (A-01-02-03)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-full outline-none focus:border-brand-500 w-64 text-xs font-medium"
            />
          </div>

          {/* Zone Filter */}
          <Dropdown
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3.5 py-2 bg-gray-50 border border-gray-200 text-gray-900 rounded-full outline-none focus:border-brand-500 cursor-pointer text-xs font-medium"
          >
            <option value="ALL">Tüm Bölgeler (Zones)</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </Dropdown>

          {/* Aisle Filter */}
          <Dropdown
            value={selectedAisle}
            onChange={(e) => setSelectedAisle(e.target.value)}
            className="px-3.5 py-2 bg-gray-50 border border-gray-200 text-gray-900 rounded-full outline-none focus:border-brand-500 cursor-pointer text-xs font-medium"
          >
            <option value="ALL">Tüm Koridorlar (Aisles)</option>
            {aisles.map(a => <option key={a} value={a}>{a} Koridoru</option>)}
          </Dropdown>
        </div>

        {/* Tactical Legend */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50 inline-block" />
            <span>Boş (%0)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50 inline-block" />
            <span>Kısmi Dolu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/50 inline-block" />
            <span>Tam Dolu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/50 inline-block" />
            <span>Soğuk Alan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-gray-200 inline-block" />
            <span>Kilitli</span>
          </div>
        </div>
      </div>

      {/* 3. Main Spatial Rack Grid */}
      {loading ? (
        <div className="veniux-card p-5 text-center text-gray-500 font-mono text-xs">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-brand-500 mb-2" />
          <p>Depo raf matrisi taranıyor...</p>
        </div>
      ) : Object.keys(groupedByAisle).length === 0 ? (
        <div className="veniux-card p-5 text-center text-gray-500 text-xs">
          <Boxes className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700">Eşleşen raf lokasyonu bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByAisle).map(([aisleCode, racks]) => (
            <div key={aisleCode} className="veniux-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1 bg-brand-500 text-white font-bold text-sm rounded-full shadow-xs">
                    KORİDOR {aisleCode}
                  </span>
                  <span className="text-xs text-gray-500">
                    {Object.keys(racks).length} Raf Ünitesi • {Object.values(racks).flat().length} Göz
                  </span>
                </div>
              </div>

              {/* Racks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(racks).map(([rackNumber, bins]) => (
                  <div key={rackNumber} className="bg-gray-50 p-3.5 rounded-lg border border-gray-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-600">
                      <span className="font-bold text-gray-900">Raf #{rackNumber}</span>
                      <span>{bins.length} Göz</span>
                    </div>

                    {/* Bins in this rack */}
                    <div className="grid grid-cols-3 gap-2">
                      {bins.map(bin => {
                        const styleClass = getOccupancyBadge(bin);
                        return (
                          <div
                            key={bin.id}
                            onClick={() => handleOpenBinDetail(bin)}
                            className={`p-2 rounded-xl border text-center cursor-pointer transition-all hover:scale-105 select-none relative ${styleClass}`}
                          >
                            {bin.is_locked && (
                              <Lock className="w-3 h-3 text-gray-500 absolute top-1 right-1" />
                            )}
                            <span className="text-[10px] font-bold block truncate">
                              {bin.location_code.split('-').slice(2).join('-') || bin.location_code}
                            </span>
                            <span className="text-[9px] text-gray-500 block mt-0.5">
                              {bin.is_empty ? 'BOŞ' : `${bin.product_count || 1} SKU`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Bin Detail Drawer */}
      {selectedBin && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-gray-200 p-6 shadow-2xl overflow-y-auto space-y-6 font-sans animate-fade-in text-gray-900">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-600">{selectedBin.zone_name}</span>
                {selectedBin.is_locked && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    KİLİTLİ
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedBin.location_code}</h2>
            </div>
            <button
              onClick={() => setSelectedBin(null)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleToggleLock(selectedBin.id, selectedBin.is_locked)}
              className={`py-2.5 px-3 rounded-full border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                selectedBin.is_locked
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              {selectedBin.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{selectedBin.is_locked ? 'Kilidi Kaldır' : 'Gözü Kilitle'}</span>
            </button>

            <button
              onClick={() => {
                setRelocateForm({ ...relocateForm, target_location_id: '' });
                setShowRelocateModal(true);
              }}
              className="py-2.5 px-3 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Stok Transferi</span>
            </button>
          </div>

          {/* Stored Items in Bin */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase">GÖZDE BULUNAN STOKLAR</h3>
            {binDetailLoading ? (
              <div className="p-4 text-center text-xs text-gray-400">Yükleniyor...</div>
            ) : selectedBin.records?.length > 0 ? (
              selectedBin.records.map((rec, idx) => (
                <div key={idx} className="p-3.5 bg-gray-50 rounded-lg border border-gray-100 space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-gray-900 block">{rec.product_name}</span>
                      <span className="text-[10px] text-gray-500">SKU: {rec.sku}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">{rec.quantity} Adet</span>
                  </div>
                  {rec.lot_number && (
                    <div className="text-[10px] text-gray-500 flex justify-between border-t border-gray-200/60 pt-1.5">
                      <span>Parti (Lot): <strong className="text-gray-900">{rec.lot_number}</strong></span>
                      <span>SKT: <strong className="text-gray-900">{rec.expiry_date || 'Yok'}</strong></span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                Bu gözde şu an ürün bulunmuyor (Boş).
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Aisle Generator Modal */}
      {showGridModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-900 font-sans">
          <div className="bg-white border border-gray-100 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">Yeni Koridor & Raf Şablonu Üret</h3>
              <button onClick={() => setShowGridModal(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateGrid} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-gray-500 mb-1">Koridor Kodu (A, B, C...)</label>
                <input
                  type="text"
                  required
                  value={gridForm.aisle_code}
                  onChange={(e) => setGridForm({ ...gridForm, aisle_code: e.target.value.toUpperCase() })}
                  placeholder="Örn: B"
                  className="w-full bg-gray-100 border border-gray-200 text-white rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-500 mb-1 text-[11px]">Raf Sayısı</label>
                  <input
                    type="number"
                    min="1"
                    value={gridForm.rack_count}
                    onChange={(e) => setGridForm({ ...gridForm, rack_count: Number(e.target.value) })}
                    className="w-full bg-gray-100 border border-gray-200 text-white rounded-xl px-3 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1 text-[11px]">Kat Sayısı</label>
                  <input
                    type="number"
                    min="1"
                    value={gridForm.tier_count}
                    onChange={(e) => setGridForm({ ...gridForm, tier_count: Number(e.target.value) })}
                    className="w-full bg-gray-100 border border-gray-200 text-white rounded-xl px-3 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1 text-[11px]">Göz / Kat</label>
                  <input
                    type="number"
                    min="1"
                    value={gridForm.bin_count}
                    onChange={(e) => setGridForm({ ...gridForm, bin_count: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowGridModal(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-full text-gray-700 hover:bg-gray-100 font-medium"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-full shadow-xs"
                >
                  Rafları Üret
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
