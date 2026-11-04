import React, { useState } from 'react';
import {
  Layers,
  MapPin,
  Lock,
  Boxes,
  Zap,
  Navigation,
  Sparkles,
  Search,
  Filter,
  Eye,
  UserCheck
} from 'lucide-react';

export default function WMSLiveMap({
  locations = [],
  onSelectLocation = null,
  activeWaves = [],
  highlightZone = 'ALL'
}) {
  const [selectedZone, setSelectedZone] = useState(highlightZone || 'ALL');
  const [hoveredBin, setHoveredBin] = useState(null);

  const zones = Array.from(new Set(locations.map(l => l.zone_name))).filter(Boolean);

  const filteredLocations = locations.filter(loc => {
    if (selectedZone === 'ALL') return true;
    return loc.zone_name === selectedZone;
  });

  // Group by Aisle -> Rack
  const groupedByAisle = {};
  filteredLocations.forEach(loc => {
    const aisle = loc.aisle_code || 'GEN';
    if (!groupedByAisle[aisle]) groupedByAisle[aisle] = {};
    const rack = loc.rack_number || 1;
    if (!groupedByAisle[aisle][rack]) groupedByAisle[aisle][rack] = [];
    groupedByAisle[aisle][rack].push(loc);
  });

  const getBinColor = (loc) => {
    if (loc.is_locked) return 'bg-slate-300 dark:bg-slate-700/60 border-slate-400 dark:border-slate-600 text-gray-500 opacity-60';
    if (loc.zone_name === 'COLD_STORAGE') return 'bg-cyan-500/10 dark:bg-cyan-500/20 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:border-cyan-400';
    if (loc.zone_name === 'QUARANTINE') return 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:border-purple-400';
    if (loc.is_empty) return 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400';
    if (loc.is_full) return 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:border-rose-400';
    return 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:border-amber-400';
  };

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-100 shadow-2xs space-y-4">
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center bg-brand-50 text-brand-600 rounded-lg border border-brand-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                Canlı Depo 2D Izgara & Doluluk Haritası
              </h3>
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>CANLI</span>
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">Gerçek zamanlı raf dolulukları, koridor rotaları ve aktif toplama hedefleri</p>
          </div>
        </div>

        {/* Zone Filter Chips */}
        <div className="flex items-center space-x-1.5 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setSelectedZone('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs ${
              selectedZone === 'ALL'
                ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/25'
                : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tüm Bölgeler ({locations.length})
          </button>
          {zones.map(z => (
            <button
              key={z}
              onClick={() => setSelectedZone(z)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs ${
                selectedZone === z
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-white text-gray-500 text-gray-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Special Zones Strip (Docks & Staging & Cold) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
            <span className="text-xs font-bold text-gray-800 tracking-tight">RAMPA 01-02</span>
          </div>
          <span className="text-[10px] font-semibold rounded-full bg-brand-50 px-2 py-0.5 text-brand-600 border border-brand-200/60">GİRİŞ / ÇIKIŞ</span>
        </div>

        <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-gray-800 tracking-tight">STAGE-IN-01</span>
          </div>
          <span className="text-[10px] font-semibold rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200/60">MAL KABUL ALANI</span>
        </div>

        <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
            <span className="text-xs font-bold text-gray-800 tracking-tight">COLD-01 (+4°C)</span>
          </div>
          <span className="text-[10px] font-semibold rounded-full bg-cyan-50 px-2 py-0.5 text-cyan-700 border border-cyan-200/60">SOĞUK ZİNCİR</span>
        </div>

        <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            <span className="text-xs font-bold text-gray-800 tracking-tight">QUAR-01</span>
          </div>
          <span className="text-[10px] font-semibold rounded-full bg-purple-50 px-2 py-0.5 text-purple-700 border border-purple-200/60">KARANTİNA</span>
        </div>
      </div>

      {/* Main Aisles Visual Rack Grid */}
      <div className="space-y-4">
        {Object.entries(groupedByAisle).map(([aisleCode, racks]) => (
          <div
            key={aisleCode}
            className="bg-gray-100/60 dark:bg-gray-100/40 p-3.5 rounded-xl border border-gray-200/80 border-gray-200/60 space-y-2.5"
          >
            {/* Aisle Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-brand-500 text-white font-mono text-xs font-bold rounded">
                  {aisleCode}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-gray-900">{aisleCode} KORİDORU</span>
              </div>
              <span className="text-[11px] font-mono text-gray-500">{Object.keys(racks).length} Raf Ünitesi</span>
            </div>

            {/* Racks Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2.5">
              {Object.entries(racks).map(([rackNumber, bins]) => (
                <div
                  key={rackNumber}
                  className="bg-white bg-gray-100 p-2 rounded-lg border border-gray-200 border-gray-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase px-1">
                    <span>Raf {rackNumber}</span>
                    <span className="font-mono">{bins.length} Göz</span>
                  </div>

                  {/* Bins in rack */}
                  <div className="grid grid-cols-3 gap-1">
                    {bins.map(bin => (
                      <button
                        key={bin.id}
                        onClick={() => onSelectLocation && onSelectLocation(bin)}
                        onMouseEnter={() => setHoveredBin(bin)}
                        onMouseLeave={() => setHoveredBin(null)}
                        className={`p-1.5 rounded-md border text-center transition cursor-pointer relative group ${getBinColor(bin)}`}
                      >
                        <span className="block font-mono text-[10px] font-bold leading-none">
                          {bin.location_code.split('-').slice(-2).join('-')}
                        </span>
                        <span className="block text-[9px] font-mono mt-1 opacity-80">
                          {bin.occupancy_rate}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Map Legend */}
      <div className="pt-2 border-t border-gray-200 border-gray-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500"></span>
            <span>Boş / Düşük Dolu</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500"></span>
            <span>Orta Doluluk</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500"></span>
            <span>Kritik Dolu</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-cyan-500/20 border border-cyan-500"></span>
            <span>Soğuk Alan</span>
          </div>
        </div>

        <span className="font-semibold text-gray-500">Detay ve stok dökümü için herhangi bir göze tıklayın.</span>
      </div>
    </div>
  );
}
