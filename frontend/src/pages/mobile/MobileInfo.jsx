import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bell, BookOpen, ChevronRight, History, Mail, PlayCircle } from 'lucide-react';
import api from '../../api/client';
import release from '../../data/programRelease.json';
import { asList } from '../../lib/stockAnalytics';
import { EmptyState, MobileTop, SUPPORT_URL } from './mobileKit';

// "Bildirimlerim": stok uyarıları. Bildirim yoksa boş durum gösterilir.
export function MobileNotifications() {
  const [items, setItems] = useState(null), [error, setError] = useState('');
  useEffect(() => { let live = true; api.get('/alerts').then(r => live && setItems(asList(r.data))).catch(e => live && setError(e.response?.data?.error || 'Bildirimler alınamadı.')); return () => { live = false; }; }, []);
  return <div className="vm">
    <MobileTop title="Bildirimlerim" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      {error && <p role="alert" className="vm-err">{error}</p>}
      {!items && !error && <p role="status" className="vm-note">Bildirimler yükleniyor…</p>}
      {items && (items.length === 0
        ? <EmptyState icon={<Bell size={36} />} title="Bildirim Yok" text="Bildirim olduğunda buradan görüntüleyebilirsiniz." />
        : <div className="vm-list">{items.slice(0, 50).map(a => <Link key={a.id} to="/alerts" className="vm-row"><AlertCircle size={20} /><span className="grow">{a.title || 'Stok bildirimi'}<small>{a.message || a.description || ''}</small></span><ChevronRight size={18} /></Link>)}</div>)}
    </div>
  </div>;
}

// "Kılavuzlar" (A101'deki Dökümanlar karşılığı): uygulama içi yardım kaynakları.
export function MobileDocs() {
  const rows = [
    { to: '/m/surum-notlari', icon: <History size={20} />, title: 'Sürüm notları', text: 'Sürüm ' + release.version + ' ve önceki değişiklikler' },
    { to: '/setup', icon: <PlayCircle size={20} />, title: 'Kurulum rehberi', text: 'Hesap ve mağaza kurulum adımları' },
    { to: '/m/destek', icon: <BookOpen size={20} />, title: 'Yardım ve destek', text: 'Sorun yaşadığınızda bize ulaşın' }
  ];
  return <div className="vm">
    <MobileTop title="Kılavuzlar" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      <div className="vm-list">{rows.map(r => <Link key={r.to} to={r.to} className="vm-row">{r.icon}<span className="grow">{r.title}<small>{r.text}</small></span><ChevronRight size={18} /></Link>)}</div>
    </div>
  </div>;
}

export function MobileReleaseNotes() {
  return <div className="vm">
    <MobileTop title="Sürüm notları" back="/m/dokumanlar" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      {(release.releases || []).slice(0, 12).map(r => <section key={r.version} className="vm-card"><b>Sürüm {r.version}</b><div className="vm-note">{r.date}</div><p style={{ fontWeight: 650, margin: '8px 0 4px' }}>{r.title}</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>{(r.items || []).map((t, i) => <li key={i}>{t}</li>)}</ul></section>)}
    </div>
  </div>;
}

// "Bize Ulaşın": Veniux sitesindeki iletişim formuna gider (cevap e-postayla döner).
export function MobileSupport() {
  return <div className="vm">
    <MobileTop title="Bize Ulaşın" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      <section className="vm-card"><Mail size={22} />
        <p style={{ margin: '10px 0' }}>Sorun mu yaşıyorsunuz? Formu doldurun, hızlıca dönelim. Mümkünse hangi ekranda olduğunuzu yazın.</p>
        <a className="vm-btn" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">İletişim formunu aç</a></section>
    </div>
  </div>;
}
