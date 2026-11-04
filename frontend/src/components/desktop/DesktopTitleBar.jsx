import React, { useEffect, useState } from 'react';
import { Activity, Minus, Square, X } from 'lucide-react';
import veniuxLogo from '../../assets/veniux-logo.png';
import { useLicense } from '../../context/LicenseContext';

export default function DesktopTitleBar({ onOpenHealthModal }) {
  const { license, isLicensed, isDesktop } = useLicense();
  const [isMaximized, setIsMaximized] = useState(false);
  const [connection,setConnection]=useState({connected:false,label:'Bağlantı kontrol ediliyor'});
  useEffect(()=>{
    if(!isDesktop)return;
    let active=true;
    const check=()=>window.veniuxDesktop.getConnectionStatus?.().then(state=>{if(active)setConnection(state);}).catch(()=>{if(active)setConnection({connected:false,label:'Bağlantı doğrulanamadı'});});
    check(); window.veniuxDesktop.isMaximized?.().then(value=>{if(active)setIsMaximized(value);});
    const timer=setInterval(check,30000);
    return()=>{active=false;clearInterval(timer);};
  },[isDesktop]);

  useEffect(() => {
    if (isDesktop && window.veniuxDesktop?.onWindowStateChange) {
      return window.veniuxDesktop.onWindowStateChange((state) => setIsMaximized(state.isMaximized));
    }
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <div className="desktop-titlebar mac-titlebar sticky top-0 z-50 h-11 shrink-0" style={{WebkitAppRegion:'drag'}}>
      <div className="mac-window-controls" style={{WebkitAppRegion:'no-drag'}}>
        <button data-testid="button-window-close" onClick={()=>window.veniuxDesktop?.close?.()} aria-label="Sistem tepsisine gizle" title="Saat yanındaki simgeye gizle" className="mac-dot mac-close"><X size={9}/></button>
        <button data-testid="button-window-minimize" onClick={()=>window.veniuxDesktop?.minimize?.()} aria-label="Pencereyi küçült" title="Küçült" className="mac-dot mac-minimize"><Minus size={9}/></button>
        <button data-testid="button-window-maximize" onClick={()=>window.veniuxDesktop?.maximize?.()} aria-label={isMaximized?'Pencereyi geri yükle':'Pencereyi büyüt'} title={isMaximized?'Geri yükle':'Ekranı kapla'} className="mac-dot mac-maximize"><Square size={7}/></button>
      </div>
      <div className="mac-window-title"><img src={veniuxLogo} alt=""/><span>Veniux Cloud <span className="mac-title-divider">·</span> {isLicensed&&license?license.tenant_name||'Çalışma alanı':'İşletme Yönetimi'}</span></div>
      <div className="mac-window-status" style={{WebkitAppRegion:'no-drag'}}>
        <span role="status" title={connection.label} className={connection.connected?'mac-connected':'mac-disconnected'}><i aria-hidden="true"/>{connection.label}</span>
        {onOpenHealthModal&&<button data-testid="button-system-health" onClick={onOpenHealthModal} aria-label="Sistem durumu" title="Sistem durumu"><Activity size={14}/></button>}
      </div>
    </div>
  );
}
