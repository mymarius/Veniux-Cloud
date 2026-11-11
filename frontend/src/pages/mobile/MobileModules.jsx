import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import useCustomerSetup from '../../hooks/useCustomerSetup';
import { moduleForPath } from '../../lib/customerExperience.mjs';
import { MobileTop, EmptyState } from './mobileKit';
import { sectorFor, visibleModules } from './moduleList';
import { usePacks } from './sector/SectorKit';

// "Tüm modüller": arama kutusu ve iki sütunlu modül kartları.
export default function MobileModules() {
  const { setup } = useCustomerSetup();
  const [q, setQ] = useState('');
  const packs = usePacks();
  const all = [...visibleModules(setup, moduleForPath), ...sectorFor(packs)];
  const norm = s => s.toLocaleLowerCase('tr-TR');
  const shown = all.filter(m => norm(m.title).includes(norm(q.trim())));
  return <div className="vm">
    <MobileTop title="Tüm Modüller" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
      <label className="vm-search"><Search size={18} /><input type="search" placeholder="Modül ara" value={q} onChange={e => setQ(e.target.value)} aria-label="Modül ara" /></label>
      {shown.length === 0 ? <EmptyState icon={<Search size={34} />} title="Modül bulunamadı" text="Farklı bir arama deneyin." /> :
        <div className="vm-modgrid">{shown.map(({ key, title, to, Icon, tone }) => <Link key={key} to={to} className="vm-mod"><i className={'vm-tone-' + tone}><Icon size={22} /></i><b>{title}</b><ChevronRight className="go" size={18} /></Link>)}</div>}
    </div>
  </div>;
}
