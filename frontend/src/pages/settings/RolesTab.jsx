import React, { useEffect, useMemo, useState } from 'react';
import { Check, Info, Minus, RefreshCw, Shield, Users, Warehouse } from 'lucide-react';
import apiClient from '../../api/client';
import { Panel } from '../../components/dashboard/AnalyticsKit';
import './RolesTab.css';

// Read-only view of the role matrix the server enforces (GET /settings/roles).
// Permissions are fixed per role in the route guards, so nothing here is editable.
export default function RolesTab({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('manager');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    apiClient.get('/settings/roles')
      .then(res => { if (active) setData(res.data); })
      .catch(() => { if (active) setError('Rol bilgileri alınamadı. Yenile düğmesiyle tekrar deneyin.'); });
    return () => { active = false; };
  }, [revision]);

  const items = useMemo(() => data?.capabilities.flatMap(group => group.items) || [], [data]);
  const countFor = roleId => items.filter(item => item.roles.includes(roleId)).length;
  const role = data?.roles.find(r => r.id === selected);

  if (error) {
    return <div className="roles-page">
      <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
      <button className="btn-soft mt-3" onClick={() => setRevision(n => n + 1)}><RefreshCw size={14} /> Yenile</button>
    </div>;
  }
  if (!data) return <div className="roles-page" role="status"><div className="skeleton h-28 w-full rounded-xl" /><div className="skeleton mt-4 h-96 w-full rounded-xl" /></div>;

  return (
    <div className="roles-page">
      <header className="ax-head" style={{ marginBottom: 18 }}>
        <div>
          <span className="ax-eyebrow"><i />Ayarlar · erişim</span>
          <h1>Roller ve yetkiler</h1>
          <p>Her rolün sistemde gerçekte neler yapabildiği. Yetkiler role göre sabittir; bir kişinin yetkisini değiştirmek için rolünü değiştirin.</p>
        </div>
        {onNavigate && <div className="ax-actions">
          <button className="ax-btn" onClick={() => onNavigate('users')}><Users size={15} /> Kullanıcı rollerini düzenle</button>
        </div>}
      </header>

      <div className="roles-cards" role="tablist" aria-label="Roller">
        {data.roles.map(r => {
          const count = countFor(r.id);
          return (
            <button key={r.id} role="tab" aria-selected={selected === r.id} className="roles-card" data-active={selected === r.id || undefined} onClick={() => setSelected(r.id)}>
              <span className="roles-card-top"><Shield size={15} /><b>{r.title}</b></span>
              <small>{r.summary}</small>
              <span className="roles-meter" aria-label={`${count} / ${items.length} yetki`}>
                <i style={{ width: `${(count / items.length) * 100}%` }} />
              </span>
              <em>{count} / {items.length} yetki</em>
            </button>
          );
        })}
      </div>

      {role && (
        <Panel icon={Shield} title={role.title} subtitle={role.summary}>
          <div className="roles-groups" role="tabpanel">
            {data.capabilities.map(group => (
              <section key={group.category}>
                <h3>{group.category}</h3>
                <ul>
                  {group.items.map(item => {
                    const allowed = item.roles.includes(role.id);
                    return (
                      <li key={item.id} data-allowed={allowed}>
                        <span className="roles-mark" aria-hidden="true">{allowed ? <Check size={14} /> : <Minus size={14} />}</span>
                        <div>
                          <b>{item.name}</b>
                          <p>{item.desc}</p>
                        </div>
                        <span className="sr-only">{allowed ? 'İzinli' : 'İzin yok'}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Panel>
      )}

      <Panel icon={Info} title="Tüm rollerin karşılaştırması" subtitle="Satırlar yetkiler, sütunlar roller" className="mt-[18px]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="roles-matrix">
            <thead>
              <tr>
                <th scope="col">Yetki</th>
                {data.roles.map(r => <th key={r.id} scope="col" data-active={selected === r.id || undefined}>{r.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.capabilities.map(group => (
                <React.Fragment key={group.category}>
                  <tr className="roles-matrix-group"><th colSpan={data.roles.length + 1} scope="colgroup">{group.category}</th></tr>
                  {group.items.map(item => (
                    <tr key={item.id}>
                      <th scope="row">{item.name}</th>
                      {data.roles.map(r => {
                        const allowed = item.roles.includes(r.id);
                        return <td key={r.id} data-active={selected === r.id || undefined}>
                          <span className="roles-mark" data-allowed={allowed} aria-label={allowed ? 'İzinli' : 'İzin yok'}>{allowed ? <Check size={13} /> : <Minus size={13} />}</span>
                        </td>;
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="roles-notes">
        <div><Warehouse size={16} /><p><b>Depo erişimi:</b> Yönetici dışındaki kullanıcılar yalnızca kendilerine atanan depoları görür ve işleyebilir. Atamayı Kullanıcılar sekmesindeki depo simgesinden yapabilirsiniz.</p></div>
        <div><Info size={16} /><p><b>Kasiyer yetkileri:</b> İndirim, fiyat değiştirme, iade, iptal ve gün sonu kapatma her kasiyer için ayrıca açılır.{onNavigate && <> <button className="btn-soft ml-1" data-size="sm" onClick={() => onNavigate('scanner')}>Kasa yetkilerine git</button></>}</p></div>
      </div>
    </div>
  );
}
