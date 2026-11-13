import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bell, BookOpen, ChevronRight, History, Mail, PlayCircle } from 'lucide-react';
import api from '../../api/client';
import release from '../../data/programRelease.json';
import { asList } from '../../lib/stockAnalytics';
import { isOpenAlert } from '../../lib/alerts.mjs';
import { readSessionUser } from '../../lib/sessionUser';
import { EmptyState, MobileTop, SUPPORT_URL, WHATSAPP_URL } from './mobileKit';

// "Bildirimlerim": stok uyarıları. Açık olanlar üstte ve "Okundu" ile kapatılır; okunanlar altta soluk görünür.
export function MobileNotifications() {
  const [items, setItems] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(null), [notice, setNotice] = useState('');
  const role = readSessionUser().role, canResolve = ['admin', 'manager'].includes(role);
  useEffect(() => { let live = true; api.get('/alerts').then(r => live && setItems(asList(r.data))).catch(e => live && setError(e.response?.data?.error || 'Bildirimler alınamadı.')); return () => { live = false; }; }, []);
  const resolve = async alert => {
    if (busy !== null) return;
    setBusy(alert.id); setError(''); setNotice('');
    try { await api.put('/alerts/' + alert.id, { status: 'read' }); setItems(list => list.map(item => (item.id === alert.id ? { ...item, status: 'read' } : item))); setNotice('Bildirim okundu olarak işaretlendi.'); }
    catch (e) { setError(e.response?.data?.error || 'İşlem tamamlanamadı.'); }
    finally { setBusy(null); }
  };
  const open = items ? items.filter(isOpenAlert) : [], done = items ? items.filter(a => !isOpenAlert(a)).slice(0, 20) : [];
  const row = (a, active) => <div key={a.id} className="vm-row" style={active ? undefined : { opacity: 0.6 }}>
    <Link to="/alerts" className="vm-row-main" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none' }}><AlertCircle size={20} /><span className="grow">{a.title || 'Stok bildirimi'}<small>{a.message || a.description || ''}</small></span></Link>
    {active && canResolve ? <button type="button" className="vm-btn ghost" style={{ width: 'auto', minHeight: 38, padding: '0 12px', fontSize: 13 }} disabled={busy !== null} onClick={() => resolve(a)}>{busy === a.id ? '…' : 'Okundu'}</button> : active ? <ChevronRight size={18} /> : <span className="vm-note">Okundu</span>}
  </div>;
  return <div className="vm">
    <MobileTop title="Bildirimlerim" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      {error && <p role="alert" className="vm-err">{error}</p>}
      {notice && <p role="status" className="vm-note">{notice}</p>}
      {!items && !error && <p role="status" className="vm-note">Bildirimler yükleniyor…</p>}
      {items && (items.length === 0
        ? <EmptyState icon={<Bell size={36} />} title="Bildirim Yok" text="Bildirim olduğunda buradan görüntüleyebilirsiniz." />
        : <>
          {open.length === 0 ? <EmptyState icon={<Bell size={36} />} title="Açık bildirim yok" text="Tüm bildirimler okundu." /> : <div className="vm-list">{open.slice(0, 50).map(a => row(a, true))}</div>}
          {done.length > 0 && <><div className="vm-label"><span>Okunanlar</span></div><div className="vm-list">{done.map(a => row(a, false))}</div></>}
        </>)}
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
      <section className="vm-hero"><p className="vm-eyebrow">Destek · Hafta içi 09:00–18:00</p><h2>Size nasıl <em>yardım</em> edelim?</h2></section>
      <section className="vm-card hot"><b style={{ fontSize: 18 }}>WhatsApp'tan yazın</b>
        <p className="vm-note" style={{ margin: '6px 0 14px' }}>En hızlı yol. Hangi ekranda olduğunuzu yazarsanız daha çabuk yardımcı oluruz.</p>
        <a className="vm-btn" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">WhatsApp'ı aç</a></section>
      <section className="vm-card"><Mail size={22} />
        <p style={{ margin: '10px 0' }}>İsterseniz iletişim formundan da yazabilirsiniz; size e-postayla dönelim.</p>
        <a className="vm-btn ghost" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">İletişim formunu aç</a></section>
    </div>
  </div>;
}
