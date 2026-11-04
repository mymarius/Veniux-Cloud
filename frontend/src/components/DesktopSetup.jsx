import React, { useState } from 'react';
import { Server, ArrowRight, Download, Minus, X } from 'lucide-react';
import HostingSponsor from './HostingSponsor';

export default function DesktopSetup() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function complete(kind) {
    setBusy(true); setError('');
    try { await window.veniuxDesktop.completeFirstSetup({ kind, apiBase: url }); }
    catch { setError('Bağlantı kurulamadı. Sunucu adresini ve internet bağlantınızı kontrol edip tekrar deneyin. Hazır bir sunucunuz yoksa otomatik yerel kurulumu seçebilirsiniz.'); setBusy(false); }
  }
  return <main className="desktop-setup-page"><header className="desktop-setup-titlebar"><span>Veniux · Kurulum</span><div><button type="button" aria-label="Simge durumuna küçült" onClick={()=>window.veniuxDesktop.minimize()}><Minus size={15}/></button><button type="button" aria-label="Kurulumu kapat" onClick={()=>window.veniuxDesktop.close()}><X size={15}/></button></div></header><div className="desktop-setup-inner"><p className="desktop-setup-kicker">VENIUX · BAĞLANTI KURULUMU</p><h1>Ayrı sunucunuza bağlanın.</h1><p>Hazır bir Veniux sunucunuz varsa size verilen HTTPS adresini girin. Sunucunuz yoksa aşağıdaki otomatik yerel kurulum seçeneğiyle devam edin.</p>
    <form className="desktop-setup-form" onSubmit={event => { event.preventDefault(); complete('external'); }}><label htmlFor="setup-api">Veniux sunucu adresi</label><input id="setup-api" type="url" required value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://isletmeniz.example/api" autoComplete="off" disabled={busy}/><p>Giriş bilgileriniz seçtiğiniz sunucuya gönderilir. HTTPS zorunludur. Bu işlem mevcut işletme kayıtlarını taşımaz.</p>{error&&<p role="alert" className="desktop-setup-error">{error}</p>}<button type="submit" className="btn-primary" disabled={busy}><Server size={17}/>{busy?'Bağlantı kontrol ediliyor…':'Kontrol et ve bağlan'}<ArrowRight size={17}/></button></form>
    <button type="button" className="desktop-setup-local" disabled={busy} onClick={()=>complete('managed')}><Download size={16}/>Ayrı sunucu kullanmayacağım; otomatik yerel kuruluma dön</button>
    <p className="desktop-setup-note">Otomatik yerel kurulum gerekli veritabanı bileşenlerini indirir. Yerel kullanımda bilgisayar açık kalmalıdır. Her iki seçenekte de geçerli Veniux lisansı gerekir.</p><HostingSponsor/></div></main>;
}
