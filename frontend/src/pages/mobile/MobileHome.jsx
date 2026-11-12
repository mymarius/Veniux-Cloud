import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ShoppingCart, BarChart3, FileText } from 'lucide-react';
import api from '../../api/client';
import release from '../../data/programRelease.json';
import useCustomerSetup from '../../hooks/useCustomerSetup';
import { moduleForPath } from '../../lib/customerExperience.mjs';
import { readSessionUser } from '../../lib/sessionUser';
import { asList } from '../../lib/stockAnalytics';
import { greeting, roleLabel } from '../../lib/mobileHub.mjs';
import { HomeTop } from './mobileKit';
import { HOME_TILES, sectorFor, visibleModules } from './moduleList';
import { usePacks } from './sector/SectorKit';
import { useCriticalWatcher } from './sector/MobileHardware';

// Afiş: güncel sürüm notları ve kısa ipuçları, birkaç saniyede bir döner.
const TIPS = [
  { title: 'Etiket kontrolü', text: 'Rafın etiketini okutun, yazan fiyatı girin; sistem fiyatıyla karşılaştırılır.' },
  { title: 'Fiyat Gör', text: 'Barkodu okutun, ürünün güncel satış fiyatını anında görün ve listeye ekleyin.' }
];

export default function MobileHome() {
  const user = readSessionUser();
  const { setup } = useCustomerSetup();
  const packs = usePacks(), critical = useCriticalWatcher(Boolean(packs?.hardware));
  const [unread, setUnread] = useState(0), [slide, setSlide] = useState(0);
  const latest = release.releases?.[0];
  const slides = [...(latest ? [{ title: 'Sürüm ' + latest.version + ': ' + latest.title, text: latest.items?.[0] || '' }] : []), ...TIPS];
  useEffect(() => { const t = setInterval(() => setSlide(s => (s + 1) % slides.length), 5000); return () => clearInterval(t); }, [slides.length]);
  useEffect(() => {
    let live = true;
    api.get('/alerts').then(r => { if (live) setUnread(asList(r.data).filter(a => !a.is_read && !a.read).length); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const modules = visibleModules(setup, moduleForPath), first = (user.full_name || user.name || '').split(' ')[0];
  const current = slides[slide] || slides[0];
  return <div className="vm">
    <HomeTop unread={unread} />
    <div className="vm-body">
      <div className="vm-hello">
        <strong>{greeting()}{first ? ', ' + first : ''}</strong>
        <span>{[user.company_name, roleLabel(user.role)].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="vm-label"><span>İşlemler</span><Link to="/m/moduller">Tüm modüller</Link></div>
      <nav className="vm-tiles" aria-label="İşlemler">
        {[...modules.slice(0, HOME_TILES), ...sectorFor(packs)].map(({ key, title, to, Icon, tone }) => <Link key={key} to={to} className="vm-tile"><i className={'vm-tone-' + tone}><Icon size={26} /></i>{title}</Link>)}
      </nav>
      {critical && critical.count > 0 && <Link to="/m/kritik" className="vm-card" role="status" style={{ display: 'block', textDecoration: 'none', color: 'inherit', borderColor: 'var(--vm-accent)', marginTop: 16 }}><b>{critical.count} ürün kritik seviyede{critical.empty ? ' (' + critical.empty + ' tanesi bitti)' : ''}</b><div className="vm-note">{critical.items[0].message}</div></Link>}
      <div className="vm-label"><span>Duyurular</span></div>
      <section className="vm-banner" aria-live="polite">
        <b>{current.title}</b><span>{current.text}</span>
        <div className="vm-banner-dots" aria-hidden="true">{slides.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}</div>
      </section>
      <div className="vm-label"><span>Yönlendirmeler</span></div>
      <div className="vm-promos">
        <Link to="/magaza/kasa" className="vm-promo a"><ShoppingCart size={26} /><b>Kasa</b><span>Satış yap, vardiya ve nakit işlemlerini yönet.</span></Link>
        <Link to="/normal-depo/analytics" className="vm-promo b"><BarChart3 size={26} /><b>Raporlar</b><span>Satış ve stok hareketlerine göz at.</span></Link>
      </div>
      <div className="vm-label"><span>Diğer</span></div>
      <div className="vm-list"><Link to="/m/dokumanlar" className="vm-row"><FileText size={20} /><span className="grow">Kılavuzlar</span><ChevronRight size={18} /></Link></div>
    </div>
  </div>;
}
