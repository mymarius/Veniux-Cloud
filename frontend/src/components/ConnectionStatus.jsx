import { useEffect, useState } from 'react';

// Sunucu çevrimdışı lisans izniyle yanıt verdiğinde X-Veniux-Offline-Until başlığı gelir; api/client bunu olay olarak yayar.
const remaining = until => {
  const hours = Math.max(0, Math.floor((until * 1000 - Date.now()) / 3600000));
  return hours >= 1 ? `${hours} saat` : '1 saatten az';
};

export default function ConnectionStatus() {
  const [state, setState] = useState({ offlineUntil: null, blocked: false });
  useEffect(() => {
    const listen = event => setState(event.detail);
    window.addEventListener('veniux-connection', listen);
    return () => window.removeEventListener('veniux-connection', listen);
  }, []);
  if (state.blocked) return <div role="alert" className="veniux-connection veniux-connection-blocked">İnternet yok ve çevrimdışı çalışma süresi doldu. İşlemler internet bağlantısı gelince açılır.</div>;
  if (!state.offlineUntil) return null;
  return <div role="status" className="veniux-connection">İnternet bağlantısı yok · Kasa ve depo bu bilgisayarda çalışmaya devam ediyor · Kalan süre: {remaining(state.offlineUntil)}</div>;
}
