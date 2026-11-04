import ScannerPanel from '../../components/ScannerPanel';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { Panel } from '../../components/dashboard/AnalyticsKit';
import './VirtualTerminal.css';
import { isSoundEnabled } from '../../lib/appearance';
import {
  Smartphone, Scan, Package, ArrowRightLeft, CheckCircle2, AlertTriangle, RotateCcw, Volume2, VolumeX, MapPin, Plus, Minus, Wifi, WifiOff, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Activity, Radio, List, Search, ClipboardList, Power, Loader2, X, Download, Upload, MonitorSmartphone, ChevronLeft, Clock
} from 'lucide-react';

// ═══════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════
const DEVICE_UID = `VTERM-${Date.now().toString(36).toUpperCase()}`;
const HEARTBEAT_INTERVAL = 15000;

const MODES = [
  { id: 'MENU',     label: 'Ana Menü',       icon: List,           color: '#426b9c' },
  { id: 'LOOKUP',   label: 'Ürün Sorgula',   icon: Search,         color: '#3B82F6' },
  { id: 'INBOUND',  label: 'Mal Kabul',      icon: Download,       color: '#10B981' },
  { id: 'OUTBOUND', label: 'Çıkış',          icon: Upload,         color: '#EF4444' },
  { id: 'TRANSFER', label: 'Raf Transferi',  icon: ArrowRightLeft, color: '#8B5CF6' },
  { id: 'COUNT',    label: 'Sayım',          icon: ClipboardList,  color: '#F59E0B' }
];

// ═══════════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════════
let audioCtx = null;
const getAudioCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
};

const playBeep = (type = 'scan') => {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'scan') {
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'error') {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) { /* audio not available */ }
};

// ═══════════════════════════════════════════════════
//  VIRTUAL TERMINAL COMPONENT
// ═══════════════════════════════════════════════════
export default function VirtualTerminal() {
  const { showToast } = useToast();

  // === Device State ===
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [batteryDrainActive, setBatteryDrainActive] = useState(false);
  // Starts from the device-wide setting (Ayarlar → Görünüm); the header button overrides it for this session.
  const [soundEnabled, setSoundEnabled] = useState(isSoundEnabled);
  const [heartbeatOk, setHeartbeatOk] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);

  // === Screen State ===
  const [currentMode, setCurrentMode] = useState('MENU');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [operationResult, setOperationResult] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [targetLocation, setTargetLocation] = useState(null);
  const [countedQuantity, setCountedQuantity] = useState('');

  // === Protocol Audit Console ===
  const [protocolLog, setProtocolLog] = useState([]);
  const [showConsole, setShowConsole] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [quickCodes, setQuickCodes] = useState([]);

  const barcodeRef = useRef(null);
  const heartbeatRef = useRef(null);
  const batteryRef = useRef(null);
  const consoleRef = useRef(null);
  // Heartbeat reads the latest telemetry without restarting its timer on every change.
  const telemetryRef = useRef({ batteryLevel: 100, currentMode: 'MENU' });
  telemetryRef.current = { batteryLevel, currentMode };

  // ─── Helper: Add Protocol Log ───
  const addLog = useCallback((method, url, status, body = null, response = null) => {
    const entry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('tr-TR'),
      method,
      url,
      status,
      body: body ? JSON.stringify(body).slice(0, 200) : null,
      response: response ? JSON.stringify(response).slice(0, 300) : null,
      ok: status >= 200 && status < 300
    };
    setProtocolLog(prev => [...prev.slice(-100), entry]);
  }, []);

  // ─── Fetch Warehouses ───
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await apiClient.get('/warehouses');
        const data = Array.isArray(res.data) ? res.data : (res.data?.warehouses || []);
        setWarehouses(data);
        if (data.length > 0) {
          setWarehouseId(data[0].id);
          setWarehouseName(data[0].name);
        }
      } catch (e) { /* no warehouses */ }
    };
    fetchWarehouses();
  }, []);

  // ─── Battery Drain Simulator ───
  useEffect(() => {
    if (batteryDrainActive) {
      batteryRef.current = setInterval(() => {
        setBatteryLevel(prev => Math.max(0, prev - 1));
      }, 2000);
    } else {
      clearInterval(batteryRef.current);
    }
    return () => clearInterval(batteryRef.current);
  }, [batteryDrainActive]);

  // ─── Heartbeat ───
  useEffect(() => {
    if (!deviceRegistered || !isOnline) return;

    const sendHB = async () => {
      try {
        const { batteryLevel: battery_level, currentMode: current_mode } = telemetryRef.current;
        const body = { device_uid: DEVICE_UID, battery_level, status: 'active', current_mode };
        const res = await apiClient.post('/terminal/heartbeat', body);
        addLog('POST', '/api/terminal/heartbeat', res.status, body, res.data);
        setHeartbeatOk(true);
        setLastHeartbeat(new Date());
      } catch (e) {
        addLog('POST', '/api/terminal/heartbeat', e.response?.status || 0, null, e.response?.data);
        setHeartbeatOk(false);
      }
    };
    sendHB();
    heartbeatRef.current = setInterval(sendHB, HEARTBEAT_INTERVAL);
    return () => clearInterval(heartbeatRef.current);
  }, [deviceRegistered, isOnline, addLog]);

  // ─── Focus the scan field without moving the page ───
  useEffect(() => {
    if (deviceRegistered && currentMode !== 'MENU') barcodeRef.current?.focus({ preventScroll: true });
  }, [deviceRegistered, currentMode]);

  // ─── Status bar clock ───
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // ─── Quick test codes from this warehouse's real data ───
  useEffect(() => {
    if (!warehouseId) return;
    let active = true;
    Promise.all([
      apiClient.get('/wms/locations', { params: { warehouse_id: warehouseId } }).then(r => r.data).catch(() => []),
      apiClient.get('/products').then(r => r.data).catch(() => [])
    ]).then(([locations, products]) => {
      if (!active) return;
      const list = x => (Array.isArray(x) ? x : x?.data || x?.products || x?.locations || []);
      const locs = list(locations).filter(l => l.location_code).slice(0, 3).map(l => ({ code: l.location_code, label: l.location_code, kind: 'Raf' }));
      const prods = list(products).filter(p => p.barcode || p.sku).slice(0, 4).map(p => ({ code: p.barcode || p.sku, label: p.name, kind: 'Ürün' }));
      setQuickCodes([...locs, ...prods]);
    });
    return () => { active = false; };
  }, [warehouseId]);

  // ─── Auto-scroll console ───
  useEffect(() => {
    // Scroll only the console box; scrollIntoView would also move the whole page.
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [protocolLog]);

  // ═══════════════════════════════════════════════
  //  API OPERATIONS
  // ═══════════════════════════════════════════════

  const registerDevice = async () => {
    try {
      const body = {
        device_uid: DEVICE_UID,
        device_name: 'Virtual Terminal (Simulator)',
        device_type: 'VIRTUAL_PDA',
        manufacturer: 'Veniux Simulator',
        warehouse_id: warehouseId,
        battery_level: batteryLevel
      };
      const res = await apiClient.post('/terminal/register', body);
      addLog('POST', '/api/terminal/register', res.status, body, res.data);
      setDeviceRegistered(true);
      setDeviceInfo(res.data.device);
      if (soundEnabled) playBeep('success');
      showToast('Terminal sisteme bağlandı ✓', 'success');
    } catch (e) {
      addLog('POST', '/api/terminal/register', e.response?.status || 0, null, e.response?.data);
      if (soundEnabled) playBeep('error');
      showToast('Terminal kaydı başarısız: ' + (e.response?.data?.error || e.message), 'error');
    }
  };

  const handleScan = async (code) => {
    if (!code?.trim() || !isOnline) return;
    setScanning(true);
    setScanResult(null);
    if (soundEnabled) playBeep('scan');

    // Visual laser effect
    setTimeout(() => setScanning(false), 600);

    try {
      const body = { barcode: code.trim(), warehouse_id: warehouseId, device_uid: DEVICE_UID };
      const res = await apiClient.post('/terminal/scan', body);
      addLog('POST', '/api/terminal/scan', res.status, body, res.data);
      setScanResult(res.data);

      if (res.data.type === 'PRODUCT') {
        setSelectedProduct(res.data.item);
        if (soundEnabled) playBeep('success');
      } else if (res.data.type === 'LOCATION') {
        if (!selectedLocation && currentMode !== 'TRANSFER') {
          setSelectedLocation(res.data.item);
        } else if (currentMode === 'TRANSFER' && selectedLocation && !targetLocation) {
          setTargetLocation(res.data.item);
        } else {
          setSelectedLocation(res.data.item);
        }
        if (soundEnabled) playBeep('success');
      }
    } catch (e) {
      addLog('POST', '/api/terminal/scan', e.response?.status || 0, { barcode: code }, e.response?.data);
      setScanResult({ success: false, error: e.response?.data?.error || 'Barkod okunamadı' });
      if (soundEnabled) playBeep('error');
    }
    setBarcodeInput('');
  };

  // Every write carries an idempotency key so a retried tap cannot double-book stock.
  const runOperation = async (path, body, extra = {}) => {
    if (busy) return;
    setBusy(true);
    const url = '/api/terminal/operations/' + path;
    try {
      const res = await apiClient.post('/terminal/operations/' + path, body, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      addLog('POST', url, res.status, body, res.data);
      setOperationResult({ success: true, message: res.data.message, ...(extra.keepData ? { data: res.data } : {}) });
      if (soundEnabled) playBeep('success');
      showToast(res.data.message, 'success');
      resetOperationState();
    } catch (e) {
      addLog('POST', url, e.response?.status || 0, body, e.response?.data);
      setOperationResult({ success: false, message: e.response?.data?.error || 'İşlem başarısız. Bağlantıyı kontrol edip tekrar deneyin.' });
      if (soundEnabled) playBeep('error');
    } finally {
      setBusy(false);
    }
  };

  const base = () => ({ warehouse_id: warehouseId, product_id: selectedProduct.id, device_uid: DEVICE_UID });

  const executeInbound = () => selectedProduct && runOperation('inbound', { ...base(), location_id: selectedLocation?.id, quantity });
  const executeOutbound = () => selectedProduct && runOperation('outbound', { ...base(), location_id: selectedLocation?.id, quantity });
  const executeTransfer = () => selectedProduct && selectedLocation && targetLocation &&
    runOperation('relocate', { ...base(), source_location_id: selectedLocation.id, target_location_id: targetLocation.id, quantity });
  const executeCount = () => selectedProduct && selectedLocation &&
    runOperation('count', { ...base(), location_id: selectedLocation.id, counted_quantity: Number(countedQuantity) }, { keepData: true });

  const resetOperationState = () => {
    setSelectedProduct(null);
    setSelectedLocation(null);
    setTargetLocation(null);
    setQuantity(1);
    setCountedQuantity('');
    setScanResult(null);
  };

  // ═══════════════════════════════════════════════
  //  BATTERY ICON HELPER
  // ═══════════════════════════════════════════════
  const BatteryIcon = batteryLevel > 60 ? BatteryFull : batteryLevel > 30 ? BatteryMedium : batteryLevel > 10 ? BatteryLow : BatteryWarning;
  const batteryColor = batteryLevel > 60 ? '#10B981' : batteryLevel > 30 ? '#F59E0B' : '#EF4444';

  // ═══════════════════════════════════════════════
  //  RENDER: REGISTRATION SCREEN
  // ═══════════════════════════════════════════════
  const renderRegistration = () => (
    <div className="flex flex-col items-center justify-center h-full p-4 gap-4">
      <div className="w-16 h-16 bg-brand-500/20 rounded-lg flex items-center justify-center mb-2">
        <MonitorSmartphone className="w-8 h-8 text-brand-400" />
      </div>
      <h2 className="text-lg font-bold text-white">Terminal Kaydı</h2>
      <p className="text-xs text-gray-400 text-center">Cihazı sisteme bağlamak için depo seçin ve kayıt edin.</p>

      <div className="w-full space-y-3 mt-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Cihaz ID</label>
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-brand-400 font-mono">
            {DEVICE_UID}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Hedef Depo</label>
          <select
            value={warehouseId || ''}
            onChange={e => {
              const w = warehouses.find(w => w.id === Number(e.target.value));
              setWarehouseId(Number(e.target.value));
              setWarehouseName(w?.name || '');
            }}
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-brand-500 outline-none"
          >
            {warehouses.length === 0 && <option value="">Depo bulunamadı</option>}
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={registerDevice}
        disabled={!warehouseId}
        className="w-full mt-3 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-95"
      >
        <Power className="w-4 h-4 inline mr-2" />
        Sisteme Bağlan
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════
  //  RENDER: MAIN MENU
  // ═══════════════════════════════════════════════
  const renderMenu = () => (
    <div className="flex flex-col h-full p-3 gap-2">
      <div className="text-center mb-2">
        <h3 className="text-sm font-bold text-white">İşlem Seçin</h3>
        <p className="text-[10px] text-gray-500">{warehouseName}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1 content-start">
        {MODES.filter(m => m.id !== 'MENU').map(mode => (
          <button
            key={mode.id}
            onClick={() => {
              setCurrentMode(mode.id);
              resetOperationState();
              setOperationResult(null);
            }}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-700/50 bg-gray-800/40 hover:bg-gray-700/60 transition-all active:scale-95 gap-2"
            style={{ borderColor: mode.color + '30' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: mode.color + '20' }}>
              <mode.icon className="w-5 h-5" style={{ color: mode.color }} />
            </div>
            <span className="text-xs font-medium text-gray-300">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  //  RENDER: BARCODE INPUT BAR
  // ═══════════════════════════════════════════════
  const renderBarcodeBar = () => (
    <div aria-busy={scanning} className={`terminal-scan relative flex items-center gap-2 p-2 border-b border-gray-800 ${scanning ? 'bg-red-900/20' : 'bg-gray-900/60'}`}>
      {scanning && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="terminal-scan-beam absolute inset-x-0 top-0 h-0.5 bg-cyan-300" />
        </div>
      )}
      <Scan className={`w-5 h-5 flex-shrink-0 ${scanning ? 'text-red-400 animate-pulse' : 'text-gray-500'}`} />
      <input
        ref={barcodeRef}
        type="text"
        value={barcodeInput}
        onChange={e => setBarcodeInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleScan(barcodeInput)}
        placeholder="Barkod / Karekod tara veya yaz..."
        className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none font-mono"
      />
      <button
        onClick={() => handleScan(barcodeInput)}
        disabled={!barcodeInput.trim() || !isOnline}
        className="bg-brand-500/20 hover:bg-brand-500/40 disabled:opacity-30 text-brand-400 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
      >
        TARA
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════
  //  RENDER: SCAN RESULT CARD
  // ═══════════════════════════════════════════════
  const renderScanResult = () => {
    if (!scanResult) return null;
    const isError = !scanResult.success;

    return (
      <div className={`mx-2 mt-2 p-2 rounded-lg border text-xs ${isError ? 'bg-red-900/20 border-red-800/50 text-red-300' : 'bg-emerald-900/20 border-emerald-800/50 text-emerald-300'}`}>
        <div className="flex items-center gap-2 mb-1">
          {isError ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          <span className="font-bold">{isError ? 'Bulunamadı' : scanResult.type === 'PRODUCT' ? 'Ürün Bulundu' : 'Lokasyon Bulundu'}</span>
        </div>
        {isError ? (
          <p className="text-[10px] text-red-400">{scanResult.error}</p>
        ) : (
          <div className="space-y-0.5">
            <p className="font-medium text-white text-[11px]">{scanResult.item?.name || scanResult.item?.location_code || '-'}</p>
            {scanResult.item?.barcode && <p className="text-gray-400 font-mono text-[10px]">Barkod: {scanResult.item.barcode}</p>}
            {scanResult.item?.sku && <p className="text-gray-400 font-mono text-[10px]">SKU: {scanResult.item.sku}</p>}
            {scanResult.parsed_karekod && (
              <div className="mt-1 bg-gray-800/60 rounded p-1.5 text-[10px] space-y-0.5">
                <p className="text-gray-400">GS1 Karekod Çözümlendi:</p>
                {scanResult.parsed_karekod.gtin && <p className="text-blue-400">GTIN: {scanResult.parsed_karekod.gtin}</p>}
                {scanResult.parsed_karekod.lot_number && <p className="text-purple-400">Lot: {scanResult.parsed_karekod.lot_number}</p>}
                {scanResult.parsed_karekod.expiry_date && <p className="text-yellow-400">SKT: {scanResult.parsed_karekod.expiry_date}</p>}
                {scanResult.parsed_karekod.serial_number && <p className="text-cyan-400">SN: {scanResult.parsed_karekod.serial_number}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  //  RENDER: OPERATION RESULT BANNER
  // ═══════════════════════════════════════════════
  const renderOperationResult = () => {
    if (!operationResult) return null;
    return (
      <div className={`mx-2 mt-2 p-2 rounded-lg border text-xs flex items-start gap-2 ${operationResult.success ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-red-900/20 border-red-800/50'}`}>
        {operationResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
        <div>
          <p className={`font-medium ${operationResult.success ? 'text-emerald-300' : 'text-red-300'}`}>{operationResult.message}</p>
          {operationResult.data?.difference !== undefined && (
            <p className="text-gray-400 text-[10px] mt-0.5">
              Sistem: {operationResult.data.system_quantity} → Sayılan: {operationResult.data.counted_quantity} (Fark: {operationResult.data.difference > 0 ? '+' : ''}{operationResult.data.difference})
            </p>
          )}
        </div>
        <button onClick={() => setOperationResult(null)} className="ml-auto text-gray-500 hover:text-white">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  //  RENDER: SELECTED ITEMS DISPLAY
  // ═══════════════════════════════════════════════
  const renderSelectedItems = () => (
    <div className="mx-2 mt-2 space-y-1.5">
      {selectedLocation && (
        <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-800/40 rounded-lg px-2 py-1.5 text-[10px]">
          <MapPin className="w-3 h-3 text-blue-400" />
          <span className="text-blue-300 font-medium">{currentMode === 'TRANSFER' ? 'Kaynak:' : 'Lokasyon:'}</span>
          <span className="text-white font-mono">{selectedLocation.location_code}</span>
          <button onClick={() => setSelectedLocation(null)} className="ml-auto text-gray-500 hover:text-white"><X className="w-2.5 h-2.5" /></button>
        </div>
      )}
      {targetLocation && (
        <div className="flex items-center gap-2 bg-purple-900/20 border border-purple-800/40 rounded-lg px-2 py-1.5 text-[10px]">
          <MapPin className="w-3 h-3 text-purple-400" />
          <span className="text-purple-300 font-medium">Hedef:</span>
          <span className="text-white font-mono">{targetLocation.location_code}</span>
          <button onClick={() => setTargetLocation(null)} className="ml-auto text-gray-500 hover:text-white"><X className="w-2.5 h-2.5" /></button>
        </div>
      )}
      {selectedProduct && (
        <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-2 py-1.5 text-[10px]">
          <Package className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-300 font-medium">Ürün:</span>
          <span className="text-white truncate">{selectedProduct.name}</span>
          <button onClick={() => setSelectedProduct(null)} className="ml-auto text-gray-500 hover:text-white"><X className="w-2.5 h-2.5" /></button>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════
  //  RENDER: QUANTITY CONTROL
  // ═══════════════════════════════════════════════
  const renderQuantityControl = () => (
    <div className="mx-2 mt-2 flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2">
      <span className="text-[10px] text-gray-400 uppercase tracking-wider">Miktar:</span>
      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center text-white active:scale-90 transition-all">
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={quantity}
        onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
        className="w-14 bg-gray-900/60 text-white text-center text-sm font-bold rounded-lg py-1 border border-gray-700 outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button onClick={() => setQuantity(quantity + 1)} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center text-white active:scale-90 transition-all">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════
  //  RENDER: OPERATION SCREENS
  // ═══════════════════════════════════════════════
  const renderOperationScreen = () => {
    const modeConf = MODES.find(m => m.id === currentMode);
    if (!modeConf) return null;

    const instructions = {
      LOOKUP: ['1. Ürün barkodunu taratın', '2. Ürün bilgileri görüntülenecek'],
      INBOUND: ['1. Önce lokasyon taratın (opsiyonel)', '2. Ürün barkodunu taratın', '3. Miktarı belirleyin ve onaylayın'],
      OUTBOUND: ['1. Ürün barkodunu taratın', '2. Miktarı belirleyin ve çıkış yapın'],
      TRANSFER: ['1. Kaynak raf/göz taratın', '2. Ürün barkodunu taratın', '3. Hedef raf/göz taratın', '4. Miktarı belirleyin ve onaylayın'],
      COUNT: ['1. Lokasyon taratın', '2. Ürün barkodunu taratın', '3. Fiziksel sayım miktarını girin']
    };

    const canExecute = {
      LOOKUP: false,
      INBOUND: !!selectedProduct,
      OUTBOUND: !!selectedProduct,
      TRANSFER: !!selectedProduct && !!selectedLocation && !!targetLocation,
      COUNT: !!selectedProduct && !!selectedLocation && countedQuantity !== ''
    };

    const execLabel = {
      INBOUND: 'Mal Kabul Onayla',
      OUTBOUND: 'Çıkış Onayla',
      TRANSFER: 'Transfer Onayla',
      COUNT: 'Sayımı Kaydet'
    };

    const execFn = {
      INBOUND: executeInbound,
      OUTBOUND: executeOutbound,
      TRANSFER: executeTransfer,
      COUNT: executeCount
    };

    return (
      <div className="flex flex-col h-full">
        {/* Mode Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800" style={{ borderColor: modeConf.color + '30' }}>
          <button onClick={() => { setCurrentMode('MENU'); resetOperationState(); setOperationResult(null); }} className="text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: modeConf.color + '20' }}>
            <modeConf.icon className="w-3.5 h-3.5" style={{ color: modeConf.color }} />
          </div>
          <span className="text-xs font-bold text-white">{modeConf.label}</span>
          <button onClick={resetOperationState} className="ml-auto text-gray-500 hover:text-white text-[10px] flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Sıfırla
          </button>
        </div>

        {/* Barcode Input */}
        {renderBarcodeBar()}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pb-16 custom-scrollbar">
          {renderOperationResult()}
          {renderScanResult()}
          {renderSelectedItems()}

          {/* Quantity for inbound/outbound/transfer */}
          {(currentMode === 'INBOUND' || currentMode === 'OUTBOUND' || currentMode === 'TRANSFER') && selectedProduct && renderQuantityControl()}

          {/* Count quantity input */}
          {currentMode === 'COUNT' && selectedProduct && selectedLocation && (
            <div className="mx-2 mt-2 bg-gray-800/40 rounded-lg px-3 py-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">Fiziksel Sayım Miktarı</label>
              <input
                type="number"
                value={countedQuantity}
                onChange={e => setCountedQuantity(e.target.value)}
                placeholder="Sayılan adedi girin..."
                className="w-full bg-gray-900/60 text-white text-sm font-bold rounded-lg px-3 py-2 border border-gray-700 outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          {/* Instructions */}
          {!selectedProduct && !operationResult && (
            <div className="mx-2 mt-3 space-y-1.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Adımlar</p>
              {instructions[currentMode]?.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-gray-400">
                  <span className="w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center text-[9px] text-gray-500 flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        {currentMode !== 'LOOKUP' && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent pt-6">
            <button
              onClick={execFn[currentMode]}
              disabled={!canExecute[currentMode] || !isOnline || busy}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: canExecute[currentMode] ? modeConf.color : '#374151' }}
            >
              {busy ? <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />İşleniyor…</> : execLabel[currentMode]}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  //  RENDER: STATUS BAR
  // ═══════════════════════════════════════════════
  const renderStatusBar = () => (
    <div className="flex items-center justify-between px-2 py-1 bg-gray-950 border-b border-gray-800 text-[9px] text-gray-400">
      <div className="flex items-center gap-1.5">
        {isOnline ? (
          <Wifi className="w-3 h-3 text-emerald-400" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-400" />
        )}
        <div className={`w-1.5 h-1.5 rounded-full ${heartbeatOk ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
        <span className="text-gray-500">{warehouseName || 'Bağlantı Yok'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="w-2.5 h-2.5 text-gray-600" />
        <span>{now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
        <BatteryIcon className="w-3.5 h-3.5 ml-1" style={{ color: batteryColor }} />
        <span style={{ color: batteryColor }}>{batteryLevel}%</span>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  //  RENDER: PROTOCOL AUDIT CONSOLE
  // ═══════════════════════════════════════════════
  const renderProtocolConsole = () => (
    <Panel icon={Activity} title="Protokol konsolu" subtitle={`Terminalin gönderdiği API istekleri · ${protocolLog.length} kayıt`}
      action={<div className="flex gap-1.5">
        <button onClick={() => setProtocolLog([])} className="icon-btn" title="Konsolu temizle" aria-label="Konsolu temizle"><RotateCcw className="w-3.5 h-3.5" /></button>
        <button onClick={() => setShowConsole(!showConsole)} className="icon-btn" title={showConsole ? 'Konsolu daralt' : 'Konsolu genişlet'} aria-label={showConsole ? 'Konsolu daralt' : 'Konsolu genişlet'} aria-expanded={showConsole}>{showConsole ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}</button>
      </div>}>
      {showConsole && (
        <div ref={consoleRef} className="vt-console custom-scrollbar" role="log" aria-live="polite">
          {protocolLog.length === 0 ? (
            <div className="vt-console-empty"><Radio className="w-5 h-5" /><p>Terminali bağlayıp barkod okuttuğunuzda istekler burada görünür.</p></div>
          ) : (
            protocolLog.map(entry => (
              <div key={entry.id} className="vt-log" data-ok={entry.ok}>
                <div className="vt-log-head">
                  <span className="vt-log-method">{entry.method}</span>
                  <span className="vt-log-url">{entry.url}</span>
                  <span className="vt-log-status">{entry.status || 'Ağ hatası'}</span>
                  <span className="vt-log-time">{entry.time}</span>
                </div>
                {entry.body && <code>→ {entry.body}</code>}
                {entry.response && <code>← {entry.response}</code>}
              </div>
            ))
          )}
        </div>
      )}
    </Panel>
  );

  const resetDevice = () => {
    setDeviceRegistered(false);
    setDeviceInfo(null);
    setCurrentMode('MENU');
    resetOperationState();
    setOperationResult(null);
    setBatteryLevel(100);
    setIsOnline(true);
    setBatteryDrainActive(false);
    setProtocolLog([]);
  };

  const successCount = protocolLog.filter(e => e.ok).length;

  // ═══════════════════════════════════════════════
  //  MAIN LAYOUT
  // ═══════════════════════════════════════════════
  return (
    <div className="ax-page">
      <header className="ax-head">
        <div>
          <span className="ax-eyebrow"><i />Depo operasyonları · el terminali</span>
          <h1>Sanal terminal</h1>
          <p>El terminali işlemlerini gerçek stok verisiyle deneyin: ürün sorgulama, mal kabul, çıkış, raf transferi ve sayım.</p>
        </div>
        <div className="ax-actions">
          <button className="ax-btn" onClick={() => setSoundEnabled(!soundEnabled)} aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />} {soundEnabled ? 'Ses açık' : 'Ses kapalı'}
          </button>
          <button className="ax-btn" onClick={resetDevice}>
            <RotateCcw size={15} /> Cihazı sıfırla
          </button>
        </div>
      </header>

      <div className="ax-stats vt-stats">
        <div><span>Cihaz</span><b className={deviceRegistered && isOnline ? 'text-teal-700' : 'text-slate-500'}>{!isOnline ? 'Çevrimdışı' : deviceRegistered ? 'Bağlı' : 'Bağlı değil'}</b></div>
        <div><span>Depo</span><b className="truncate">{warehouseName || '—'}</b></div>
        <div><span>Pil</span><b style={{ color: batteryColor }}>%{batteryLevel}</b></div>
        <div><span>Başarılı istek</span><b>{successCount} / {protocolLog.length}</b></div>
      </div>

      <div className="vt-layout">
        {/* PDA device */}
        <div className="vt-device-col">
          <div className="vt-device">
            <div className="vt-device-top" aria-hidden="true"><span /><i /></div>
            <div className="vt-screen">
              {renderStatusBar()}
              <div className="relative h-[calc(100%-24px)] flex flex-col overflow-hidden">
                {batteryLevel === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <BatteryWarning className="w-12 h-12 text-red-500 animate-pulse" />
                    <p className="text-sm text-red-400 font-bold">Pil bitti</p>
                    <p className="text-[11px] text-gray-500">Simülatörden pil seviyesini artırın.</p>
                  </div>
                ) : !isOnline ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                    <WifiOff className="w-12 h-12 text-gray-500 animate-pulse" />
                    <p className="text-sm text-gray-300 font-bold">Çevrimdışı</p>
                    <p className="text-[11px] text-gray-500 text-center">Bağlantı kesik. Simülatör ayarlarından tekrar çevrimiçi yapın.</p>
                  </div>
                ) : !deviceRegistered ? (
                  renderRegistration()
                ) : currentMode === 'MENU' ? (
                  renderMenu()
                ) : (
                  renderOperationScreen()
                )}
              </div>
            </div>
            <div className="vt-device-chin">
              <button onClick={() => barcodeRef.current?.focus({ preventScroll: true })} className="vt-trigger" title="Sol tetik: barkod alanına odaklan" aria-label="Sol tetik" />
              <div className="vt-keys" aria-hidden="true"><span /><span /><span /></div>
              <button onClick={() => barcodeRef.current?.focus({ preventScroll: true })} className="vt-trigger" title="Sağ tetik: barkod alanına odaklan" aria-label="Sağ tetik" />
            </div>
          </div>

          <Panel icon={MonitorSmartphone} title="Simülatör ayarları" subtitle="Bağlantı ve pil durumunu deneyin">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-slate-600">Bağlantı</span>
                <button onClick={() => setIsOnline(!isOnline)} className="btn-soft" data-size="sm" data-tone={isOnline ? undefined : 'danger'} aria-pressed={isOnline}>
                  {isOnline ? <><Wifi className="w-3.5 h-3.5" /> Çevrimiçi</> : <><WifiOff className="w-3.5 h-3.5" /> Çevrimdışı</>}
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label htmlFor="vt-battery" className="text-[12.5px] text-slate-600">Pil seviyesi · %{batteryLevel}</label>
                  <button onClick={() => setBatteryDrainActive(!batteryDrainActive)} className="btn-soft" data-size="sm" data-tone={batteryDrainActive ? 'danger' : undefined} aria-pressed={batteryDrainActive}>
                    {batteryDrainActive ? 'Boşaltmayı durdur' : 'Pili boşalt'}
                  </button>
                </div>
                <input id="vt-battery" type="range" min="0" max="100" value={batteryLevel} onChange={e => setBatteryLevel(Number(e.target.value))} className="w-full accent-brand-600" />
              </div>
            </div>
          </Panel>
        </div>

        {/* Right column */}
        <div className="vt-side">
          <div className="ax-grid ax-1-1" style={{ marginBottom: 0 }}>
            <Panel icon={Scan} title="Hızlı barkod testi" subtitle={warehouseName ? `${warehouseName} deposundaki gerçek kodlar` : 'Depo seçildiğinde kodlar yüklenir'}>
              {!deviceRegistered ? (
                <p className="ax-empty">Önce terminali sisteme bağlayın.</p>
              ) : quickCodes.length === 0 ? (
                <p className="ax-empty">Bu depoda barkodlu ürün veya raf bulunamadı.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {quickCodes.map(item => (
                    <button key={item.kind + item.code} onClick={() => { setBarcodeInput(item.code); handleScan(item.code); }} disabled={!isOnline || currentMode === 'MENU'} className="vt-code" title={currentMode === 'MENU' ? 'Önce terminalde bir işlem seçin' : item.code}>
                      <small>{item.kind}</small><span>{item.label}</span>
                    </button>
                  ))}
                  {currentMode === 'MENU' && <p className="w-full text-[11.5px] text-slate-500">Kodları göndermek için terminalde bir işlem seçin.</p>}
                </div>
              )}
            </Panel>
            <ScannerPanel onCode={async (raw, { processed }) => handleScan(processed)} />
          </div>

          {renderProtocolConsole()}

          {deviceInfo && (
            <Panel icon={Smartphone} title="Cihaz bilgisi" subtitle="Sisteme kaydedilen terminal">
              <div className="ax-stats" style={{ marginBottom: 0 }}>
                <div><span>Cihaz kimliği</span><b className="text-[13px] break-all">{deviceInfo.device_uid}</b></div>
                <div><span>Cihaz adı</span><b className="text-[13px]">{deviceInfo.device_name}</b></div>
                <div><span>Depo</span><b className="text-[13px]">{warehouses.find(w => w.id === deviceInfo.warehouse_id)?.name || deviceInfo.warehouse_id}</b></div>
                <div><span>IP adresi</span><b className="text-[13px]">{deviceInfo.last_ip_address}</b></div>
                <div><span>Durum</span><b className="text-[13px] text-teal-700">{deviceInfo.status === 'active' ? 'Aktif' : deviceInfo.status}</b></div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
