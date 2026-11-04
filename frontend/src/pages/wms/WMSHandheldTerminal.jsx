import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import {
  Smartphone,
  Scan,
  Package,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Boxes,
  MapPin,
  ChevronRight,
  Warehouse,
  Check,
  Zap,
  Plus,
  Minus,
  Sparkles,
  Wifi
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function WMSHandheldTerminal() {
  const [activeMode, setActiveMode] = useState('LOOKUP'); // 'LOOKUP','PUTAWAY','TRANSFER','PICKING','COUNT'
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Operation specific states
  const [sourceBin, setSourceBin] = useState('');
  const [targetBin, setTargetBin] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qtyInput, setQtyInput] = useState(1);
  const [activeWaves, setActiveWaves] = useState([]);
  const [selectedWave, setSelectedWave] = useState(null);
  const [recentScans, setRecentScans] = useState([]);

  const inputRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    inputRef.current?.focus();
    fetchActiveWaves();
  }, []);

  const playFeedbackSound = (type = 'success') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}

    if (navigator.vibrate) {
      navigator.vibrate(type === 'success' ? 80 : [150, 50, 150]);
    }
  };

  const fetchActiveWaves = async () => {
    try {
      const res = await apiClient.get('/wms/picking/waves?status=pending');
      setActiveWaves(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBarcodeSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;

    setScanning(true);
    try {
      const res = await apiClient.post('/wms/barcode/resolve', {
        barcode: barcodeInput.trim(),
        operation: `${activeMode}_SCAN`
      });

      setScanResult(res.data);
      playFeedbackSound('success');

      // Append to recent scans
      setRecentScans(prev => [
        {
          code: barcodeInput.trim(),
          type: res.data.type,
          data: res.data.data,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev.slice(0, 4)
      ]);

      // Handle specific mode actions
      if (res.data.type === 'LOCATION') {
        if (activeMode === 'TRANSFER' && !sourceBin) {
          setSourceBin(res.data.data.location_code);
          showToast(`Kaynak Göz: ${res.data.data.location_code} seçildi.`, 'info');
        } else if (activeMode === 'TRANSFER' && sourceBin && !targetBin) {
          setTargetBin(res.data.data.location_code);
          showToast(`Hedef Göz: ${res.data.data.location_code} seçildi.`, 'info');
        }
      } else if (res.data.type === 'PRODUCT') {
        setSelectedProduct(res.data.data);
      }

      setBarcodeInput('');
    } catch (err) {
      playFeedbackSound('error');
      showToast('Barkod çözülemedi veya sistemde bulunamadı.', 'error');
    } finally {
      setScanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleExecuteTransfer = async () => {
    if (!sourceBin || !targetBin || !selectedProduct) {
      showToast('Kaynak göz, hedef göz ve ürün barkodu okutulmalıdır.', 'warning');
      return;
    }

    try {
      await apiClient.post('/wms/locations/relocate', {
        source_location_code: sourceBin,
        target_location_code: targetBin,
        product_id: selectedProduct.id,
        quantity: Number(qtyInput),
        notes: 'RF El Terminali Hızlı Transfer'
      });

      playFeedbackSound('success');
      showToast(`Stok ${targetBin} gözüne başarıyla taşındı.`, 'success');
      setSourceBin('');
      setTargetBin('');
      setSelectedProduct(null);
      setQtyInput(1);
      setScanResult(null);
    } catch (err) {
      playFeedbackSound('error');
      showToast(err.response?.data?.error || 'Transfer başarısız.', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in font-sans pb-12 text-gray-900">
      {/* 1. Header & Terminal Telemetry */}
      <div className="veniux-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg shadow-xs">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 uppercase">
                RF EL TERMİNALİ / PDA SAHA KONSOLU
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Wifi className="w-3 h-3" /> ONLINE
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Zebra / Honeywell GS1-128 Lazer Tarayıcı Motoru • Haptik Geri Bildirim
            </p>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2.5 rounded-xl border transition ${
            soundEnabled 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-white text-gray-500 border-gray-200'
          }`}
          title={soundEnabled ? 'Sesli Uyarı Açık' : 'Sesli Uyarı Kapalı'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Mode Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-white rounded-xl p-3 border border-gray-100 shadow-2xs text-xs">
        {[
          { id: 'LOOKUP', label: '1. SORGULA', icon: Scan },
          { id: 'PUTAWAY', label: '2. YERLEŞTİR', icon: Package },
          { id: 'TRANSFER', label: '3. TRANSFER', icon: ArrowRightLeft },
          { id: 'PICKING', label: '4. TOPLAMA', icon: Boxes },
          { id: 'COUNT', label: '5. SAYIM', icon: RotateCcw }
        ].map(m => {
          const Icon = m.icon;
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                setActiveMode(m.id);
                setScanResult(null);
                setSourceBin('');
                setTargetBin('');
                setSelectedProduct(null);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`py-2.5 px-3 rounded-full font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25 scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-xs truncate">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Modern Industrial Scanning Station */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
        {/* Laser Scanning Indicator Beam */}
        {scanning && (
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent animate-scanline pointer-events-none shadow-lg shadow-brand-500" />
        )}

        {/* Barcode Scanner Input Form */}
        <form onSubmit={handleBarcodeSubmit} className="space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-2 font-bold text-gray-800">
              <span className="p-1 rounded-lg bg-brand-50 text-brand-600 border border-brand-200">
                <Scan className="w-4 h-4" />
              </span>
              BARKOD / KAREKOD / RAF KODU OKUTUN:
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Auto-Focus Aktif
            </span>
          </div>

          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Örn: A-01-02-03 veya 8699500000000"
                className="w-full bg-brand-50/20 border-2 border-brand-400 text-gray-900 placeholder:text-gray-400 text-base sm:text-lg font-bold px-5 py-3.5 rounded-full outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={scanning}
              className="px-7 py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold text-sm rounded-full shadow-md shadow-brand-500/30 transition flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <span>{scanning ? '...' : 'OKUT'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Mode Specific Flow: TRANSFER */}
        {activeMode === 'TRANSFER' && (
          <div className="veniux-card p-5 space-y-3 text-xs">
            <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-brand-500" />
              HIZLI GÖZLER ARASI TRANSFER ADIMLARI:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`p-3 rounded-lg border ${sourceBin ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                <span className="text-[10px] block font-bold">1. KAYNAK GÖZ</span>
                <span className="text-sm font-bold text-gray-900">{sourceBin || 'Okutulmadı'}</span>
              </div>
              <div className={`p-3 rounded-lg border ${selectedProduct ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                <span className="text-[10px] block font-bold">2. ÜRÜN (SKU)</span>
                <span className="text-sm font-bold text-gray-900 truncate block">{selectedProduct?.name || 'Okutulmadı'}</span>
              </div>
              <div className={`p-3 rounded-lg border ${targetBin ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                <span className="text-[10px] block font-bold">3. HEDEF GÖZ</span>
                <span className="text-sm font-bold text-gray-900">{targetBin || 'Okutulmadı'}</span>
              </div>
            </div>

            {sourceBin && selectedProduct && targetBin && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Transfer Miktarı:</span>
                  <input
                    type="number"
                    min="1"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(Number(e.target.value))}
                    className="w-20 bg-gray-50 border border-gray-200 text-gray-900 font-bold px-2 py-1 rounded-lg text-center"
                  />
                </div>
                <button
                  onClick={handleExecuteTransfer}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Transferi Onayla</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Resolved Scan Result Card */}
        {scanResult && (
          <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-xl space-y-4 text-xs animate-fade-in">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-600 border border-brand-200">
                  {scanResult.type} ÇÖZÜLDÜ
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-1">
                  {scanResult.type === 'LOCATION' ? scanResult.data?.location_code : scanResult.data?.name}
                </h3>
              </div>
              <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs">
                <CheckCircle2 className="w-4 h-4" /> DOĞRULANDI
              </span>
            </div>

            {scanResult.type === 'PRODUCT' && (
              <div className="grid grid-cols-2 gap-3 text-gray-600">
                <div>SKU: <strong className="text-gray-900">{scanResult.data?.sku}</strong></div>
                <div>Stok: <strong className="text-emerald-700">{scanResult.data?.quantity || 0} Adet</strong></div>
                <div>Kategori: <strong className="text-gray-900">{scanResult.data?.category || 'Genel'}</strong></div>
                <div>Fiyat: <strong className="text-gray-900">₺{scanResult.data?.price || '0.00'}</strong></div>
              </div>
            )}

            {scanResult.type === 'LOCATION' && (
              <div className="grid grid-cols-2 gap-3 text-gray-600">
                <div>Bölge (Zone): <strong className="text-gray-900">{scanResult.data?.zone_name}</strong></div>
                <div>Durum: <strong className="text-emerald-700">{scanResult.data?.is_empty ? 'BOŞ' : 'DOLU'}</strong></div>
                <div>Kapasite: <strong className="text-gray-900">{scanResult.data?.max_weight_kg || 500} kg</strong></div>
                <div>Koridor: <strong className="text-gray-900">{scanResult.data?.aisle_code}</strong></div>
              </div>
            )}
          </div>
        )}

        {/* Recent Scans Strip */}
        <div className="space-y-2 font-mono text-xs pt-2">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">SON OKUTULAN BARKODLAR:</span>
          {recentScans.length === 0 ? (
            <div className="text-gray-500 text-[11px]">Henüz barkod okutulmadı.</div>
          ) : (
            <div className="space-y-1.5">
              {recentScans.map((s, idx) => (
                <div key={idx} className="p-2 bg-white rounded-xl border border-gray-200 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-brand-500">{s.code}</span>
                  <span className="text-gray-500">{s.type}</span>
                  <span className="text-gray-500">{s.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
