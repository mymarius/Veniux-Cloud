import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { useLicense } from '../../context/LicenseContext';
import DialogShell from '../ui/DialogShell';
import { 
  Activity, 
  Server, 
  Database, 
  ShieldCheck, 
  Cpu, 
  Smartphone, 
  Snowflake, 
  X,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

export default function SystemHealthModal({ isOpen, onClose }) {
  const { license, isLicensed, isOfflineMode, hardwareInfo, graceDaysRemaining } = useLicense();

  const [connection,setConnection]=useState('Kontrol edilmedi');
  const [moduleType,setModuleType]=useState(null);
  useEffect(()=>{
    if(!isOpen)return;
    let active=true;
    setConnection('Kontrol ediliyor…');setModuleType(null);
    api.get('/auth/me').then(({data})=>{if(active){setConnection('API erişilebilir');setModuleType(data.module_type);}}).catch(()=>{if(active)setConnection('Bağlantı doğrulanamadı');});
    return()=>{active=false;};
  },[isOpen]);
  if (!isOpen) return null;

  return (
    <DialogShell isOpen={isOpen} onClose={onClose} title="Sistem durumu" subtitle="Bağlantı, lisans ve terminal bilgileri" icon={Activity} size="lg">
      <div className="space-y-6">
        {/* Status Nodes */}
        <div className="space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl border border-gray-200">
            <span className="flex items-center gap-2 text-gray-500">
              <Server className="w-4 h-4 text-brand-500" />
              Masaüstü WMS Çekirdeği
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px] bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              {connection}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="flex items-center gap-2 text-gray-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-cyan-600" />
              Merkezi Lisans Doğrulama
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px] bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              {moduleType === 'NONE' ? 'Aktif paket yok' : moduleType ? 'Paket: ' + moduleType : 'Doğrulanmadı'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="flex items-center gap-2 text-gray-700 font-medium">
              <Snowflake className="w-4 h-4 text-brand-500" />
              IoT Soğuk Zincir Telemetrisi
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px] bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Sensör verisi bu panelde ölçülmüyor
            </span>
          </div>
        </div>

        {/* Machine info */}
        <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-100 text-[11px] space-y-1.5 text-gray-600">
          <div className="flex justify-between">
            <span>Terminal Adı:</span>
            <span className="text-gray-900 font-bold">{license?.terminal_name || hardwareInfo?.deviceName}</span>
          </div>
          <div className="flex justify-between">
            <span>Donanım Parmak İzi:</span>
            <span className="text-brand-600 font-bold">{hardwareInfo?.fingerprint}</span>
          </div>
          <div className="flex justify-between">
            <span>İşletim Sistemi:</span>
            <span className="text-gray-700 font-medium">{hardwareInfo?.osInfo}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold rounded-full transition"
        >
          Kapat
        </button>
      </div>
    </DialogShell>
  );
}
