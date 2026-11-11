import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft, LogOut, Mail, UserRound, HelpCircle } from 'lucide-react';
import './mobile-hub.css';
import release from '../../data/programRelease.json';
import { readSessionUser } from '../../lib/sessionUser';
import { initials, roleLabel } from '../../lib/mobileHub.mjs';

export const sessionScope = () => { const u = readSessionUser(); return String(u.tenant_id ?? u.tenantId ?? 't') + ':' + String(u.id ?? u.userId ?? 'u'); };

// Üst bant: ana ekranda marka ve profil; iç ekranlarda geri ve başlık.
export function MobileTop({ title, back = '/m', right, children, flat = false }) {
  const navigate = useNavigate();
  return <header className={'vm-top' + (flat ? ' flat' : '')}>
    {title
      ? <><button type="button" className="vm-iconbtn" aria-label="Geri" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(back))}><ChevronLeft size={22} /></button><h1>{title}</h1><div className="vm-top-actions">{right}</div></>
      : children}
  </header>;
}

export function HomeTop({ unread = 0 }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className="vm-top">
      <Link to="/m" className="vm-brand" aria-label="Veniux ana ekran">VENIUX<small>Mağaza</small></Link>
      <div className="vm-top-actions">
        <Link to="/m/bildirimler" className="vm-iconbtn" aria-label={unread ? unread + ' bildirim' : 'Bildirimler'}><Bell size={20} />{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}</Link>
        <button type="button" className="vm-iconbtn" aria-label="Profil" onClick={() => setOpen(true)}><UserRound size={20} /></button>
      </div>
    </header>
    {open && <ProfileSheet onClose={() => setOpen(false)} />}
  </>;
}

// Alttan açılan sayfa: Esc veya dışa dokunma kapatır, açılınca odak içeri taşınır.
export function Sheet({ onClose, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement; ref.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return <div className="vm-sheet-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="vm-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>{children}</div>
  </div>;
}

export function ProfileSheet({ onClose }) {
  const user = readSessionUser();
  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    sessionStorage.removeItem('platform-tenant'); sessionStorage.removeItem('platform-tenant-name');
    window.location.href = '/login';
  };
  const name = user.full_name || user.name || user.email || 'Kullanıcı';
  return <Sheet onClose={onClose} label="Profil">
    <div style={{ textAlign: 'center' }}>
      <div className="vm-avatar" aria-hidden="true">{initials(name)}</div>
      <strong style={{ fontSize: 17 }}>{name}</strong>
      <div className="vm-note">{roleLabel(user.role)}{user.company_name ? ' · ' + user.company_name : ''}</div>
    </div>
    <div className="vm-list" style={{ margin: '16px 0', border: 0, borderRadius: 0, background: 'none' }}>
      <Link to="/m/bildirimler" className="vm-row" onClick={onClose}><Bell size={20} /><span className="grow">Bildirimlerim</span></Link>
      <Link to="/m/destek" className="vm-row" onClick={onClose}><Mail size={20} /><span className="grow">Bize Ulaşın</span></Link>
      <Link to="/settings" className="vm-row" onClick={onClose}><HelpCircle size={20} /><span className="grow">Hesap ve ayarlar</span></Link>
    </div>
    <button type="button" className="vm-btn ghost" onClick={logout}><LogOut size={18} /> Çıkış Yap</button>
    <p className="vm-note" style={{ textAlign: 'center', marginTop: 12 }}>v{release.version}</p>
  </Sheet>;
}

// Onay kutusu (A101'deki "Tamamlamadan çıkmak istediğine emin misin?" gibi).
export function ConfirmBox({ title, text, yes = 'Evet, Eminim', no = 'Vazgeç', onYes, onNo }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); const k = e => { if (e.key === 'Escape') onNo(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onNo]);
  return <div className="vm-sheet-back" style={{ alignItems: 'center' }}>
    <div className="vm-dialog" role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
      <h2>{title}</h2><p>{text}</p>
      <div className="two"><button type="button" className="vm-btn ghost" onClick={onNo}>{no}</button><button type="button" className="vm-btn" onClick={onYes}>{yes}</button></div>
    </div>
  </div>;
}

export function EmptyState({ icon, title, text }) {
  return <div className="vm-empty" role="status"><i>{icon}</i><b>{title}</b><span>{text}</span></div>;
}

export const money = value => Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
