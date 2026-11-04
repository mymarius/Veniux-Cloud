import React, { useMemo, useState } from 'react';
import {
  Activity, Building2, ChevronRight, Columns3, Flame, Handshake, Mail, Phone,
  Plus, Rows3, Search, Target, TrendingUp, UserPlus, Users, Wallet
} from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { DataTable, StatusBadge, Dropdown } from '../../ui';
import { Panel, PanelHead, Stat, Avatar, Bar, Chip, Empty, tl, trDate } from './Parts';
import CrmDealsBoard from './CrmDealsBoard';

const STAGES = [
  { id: 'qualification', label: 'Niteleme', tone: '#94A3B8' },
  { id: 'proposal', label: 'Teklif', tone: '#F59E0B' },
  { id: 'negotiation', label: 'Pazarlık', tone: '#426b9c' },
  { id: 'won', label: 'Kazanıldı', tone: '#10B981' },
  { id: 'lost', label: 'Kaybedildi', tone: '#EF4444' }
];
const stageOf = (id) => STAGES.find((s) => s.id === id) || { label: id, tone: '#94A3B8' };

const LEAD_STATUS = [
  { id: 'new', label: 'Yeni' },
  { id: 'contacted', label: 'İletişimde' },
  { id: 'qualified', label: 'Nitelikli' },
  { id: 'unqualified', label: 'Elendi' }
];
const leadStatusOf = (id) => LEAD_STATUS.find((s) => s.id === id) || { label: id };

const PRIORITY_TONE = { urgent: 'red', high: 'amber', medium: 'orange', low: 'slate' };
const PRIORITY_LABEL = { urgent: 'Acil', high: 'Yüksek', medium: 'Orta', low: 'Düşük' };

const ACTIVITY_LABEL = {
  deal_won: 'Fırsat kazanıldı',
  stage_change: 'Aşama değişti',
  meeting: 'Görüşme',
  call: 'Arama',
  email: 'E-posta',
  note: 'Not',
  automation: 'Otomasyon'
};
const ACTIVITY_TONE = {
  deal_won: 'green',
  stage_change: 'orange',
  meeting: 'violet',
  call: 'slate',
  email: 'slate',
  note: 'slate',
  automation: 'amber'
};

/* ─────────────────────────── PANEL ─────────────────────────── */

export function CrmOverview({ onGoTab }) {
  const { deals, leads, companies, contacts, activities, tasks } = useCRM();
  const [allActivity, setAllActivity] = useState(false);
  const [actType, setActType] = useState('all');

  const openDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const pipeline = openDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  const won = deals.filter((d) => d.stage === 'won').reduce((s, d) => s + Number(d.value || 0), 0);
  const weighted = openDeals.reduce((s, d) => s + (Number(d.value || 0) * Number(d.probability || 0)) / 100, 0);
  const openTasks = tasks.filter((t) => t.status !== 'completed').length;

  const byStage = STAGES.filter((s) => s.id !== 'lost').map((s) => {
    const rows = deals.filter((d) => d.stage === s.id);
    return { ...s, count: rows.length, value: rows.reduce((a, d) => a + Number(d.value || 0), 0) };
  });
  const maxStage = Math.max(1, ...byStage.map((s) => s.value));

  const activityTypes = [...new Set(activities.map((a) => a.type).filter(Boolean))];
  const activityRows = actType === 'all' ? activities : activities.filter((a) => a.type === actType);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Açık Pipeline" value={tl(pipeline)} detail={`${openDeals.length} fırsat`} icon={Wallet} />
        <Stat label="Ağırlıklı Tahmin" value={tl(Math.round(weighted))} detail="olasılığa göre" icon={Target} tone="amber" />
        <Stat label="Kazanılan" value={tl(won)} detail="bu çeyrek" icon={TrendingUp} tone="green" />
        <Stat label="Açık Görev" value={openTasks} detail={`${leads.length} aday müşteri`} icon={Activity} tone="slate" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Panel>
          <PanelHead icon={Handshake} title="Aşamaya göre pipeline" subtitle="Fırsat sayısı ve toplam değer">
            <button onClick={() => onGoTab('firsatlar')} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-200 border border-slate-200">
              Fırsatlar <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </PanelHead>
          <div className="space-y-3.5 p-5">
            {byStage.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-[92px] shrink-0 text-[12px] font-bold text-slate-700">{s.label}</span>
                <span className="w-8 shrink-0 text-[11px] font-bold tabular-nums text-slate-400">{s.count}</span>
                <Bar value={s.value} max={maxStage} tone={s.tone} />
                <span className="w-[104px] shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-800">{tl(s.value)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead icon={Flame} title="Öncelikli fırsatlar" subtitle="Kapanışa en yakın kayıtlar" />
          <div className="divide-y divide-gray-100">
            {openDeals
              .slice()
              .sort((a, b) => Number(b.value) - Number(a.value))
              .slice(0, 4)
              .map((d) => (
                <div key={d.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-slate-800">{d.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{d.companyName} · {d.salesRep}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[12.5px] font-semibold tabular-nums text-slate-800">{tl(d.value)}</div>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      <Chip tone={PRIORITY_TONE[d.priority]}>{PRIORITY_LABEL[d.priority] || d.priority}</Chip>
                      <span className="text-[10.5px] font-bold tabular-nums text-slate-400">%{d.probability}</span>
                    </div>
                  </div>
                </div>
              ))}
            {openDeals.length === 0 && <Empty icon={Handshake} title="Açık fırsat yok" hint="Yeni fırsat eklendiğinde burada listelenir." />}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHead icon={Activity} title="Aktivite akışı" subtitle={`${activityRows.length} kayıt`}>
            <Dropdown
              value={actType}
              onChange={(e) => setActType(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer outline-none"
            >
              <option value="all">Tüm hareketler</option>
              {activityTypes.map((t) => (
                <option key={t} value={t}>{ACTIVITY_LABEL[t] || t}</option>
              ))}
            </Dropdown>
          </PanelHead>
          <div className="divide-y divide-gray-100">
            {(allActivity ? activityRows : activityRows.slice(0, 5)).map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar name={a.user} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-slate-800">{a.title}</p>
                    <Chip tone={ACTIVITY_TONE[a.type] || 'slate'}>{ACTIVITY_LABEL[a.type] || a.type}</Chip>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{a.description}</p>
                  <p className="mt-1 text-[10.5px] font-semibold text-slate-400">
                    {a.user}
                    {a.relatedObject && <> · <span className="text-slate-500">{a.relatedObject}</span></>}
                  </p>
                </div>
                <span className="shrink-0 text-[10.5px] font-semibold text-slate-400">{a.timestamp}</span>
              </div>
            ))}
            {activityRows.length === 0 && <Empty icon={Activity} title="Bu filtreye uyan hareket yok" />}
          </div>
          {activityRows.length > 5 && (
            <div className="border-t border-slate-100 px-5 py-3 text-center">
              <button
                onClick={() => setAllActivity((v) => !v)}
                className="text-[11.5px] font-bold text-slate-500 transition-colors hover:text-brand-600"
              >
                {allActivity ? 'Daha az göster' : `Tümünü gör (${activityRows.length})`}
              </button>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHead icon={Building2} title="Müşteri hesapları" subtitle={`${companies.length} şirket · ${contacts.length} kişi`}>
            <button onClick={() => onGoTab('hesaplar')} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-gray-50 px-3 py-1 text-xs font-bold text-slate-700 transition-colors hover:border-brand-200 hover:text-brand-600">
              Tümünü gör
            </button>
          </PanelHead>
          <div className="divide-y divide-gray-100">
            {companies.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={c.name} size={32} tone="#0EA5E9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-slate-800">{c.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{c.industry} · {c.location}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] font-semibold tabular-nums text-slate-800">{tl(c.openDealsValue)}</div>
                  <div className="text-[10.5px] font-semibold text-slate-400">{c.openDealsCount} açık fırsat</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── FIRSATLAR ─────────────────────────── */

export function CrmDeals({ onCreate }) {
  const { deals, updateDealStage } = useCRM();
  const [stage, setStage] = useState('all');
  const [rep, setRep] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState('board');

  const reps = useMemo(() => [...new Set(deals.map((d) => d.salesRep).filter(Boolean))], [deals]);

  const rows = deals.filter((d) => {
    if (stage !== 'all' && d.stage !== stage) return false;
    if (rep !== 'all' && d.salesRep !== rep) return false;
    if (q.trim() && !`${d.title} ${d.companyName}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) return false;
    return true;
  });

  const columns = [
    {
      key: 'title',
      label: 'Fırsat',
      render: (r) => (
        <div className="min-w-0 max-w-[320px]">
          <div className="truncate font-bold text-slate-800">{r.title}</div>
          <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{r.companyName}</div>
        </div>
      )
    },
    {
      key: 'stage',
      label: 'Aşama',
      render: (r) => (
        <Dropdown
          value={r.stage}
          onChange={(e) => updateDealStage(r.id, e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-800 hover:border-brand-300"
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Dropdown>
      )
    },
    { key: 'salesRep', label: 'Temsilci', render: (r) => <span className="text-[12px] font-semibold text-slate-700">{r.salesRep}</span> },
    {
      key: 'probability',
      label: 'Olasılık',
      render: (r) => (
        <div className="flex min-w-[120px] items-center gap-2">
          <Bar value={r.probability} tone={stageOf(r.stage).tone} />
          <span className="w-9 text-right text-[11px] font-bold tabular-nums text-slate-600">%{r.probability}</span>
        </div>
      )
    },
    { key: 'expectedCloseDate', label: 'Kapanış', render: (r) => <span className="text-[11.5px] tabular-nums text-slate-600">{trDate(r.expectedCloseDate)}</span> },
    { key: 'priority', label: 'Öncelik', render: (r) => <Chip tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABEL[r.priority] || r.priority}</Chip> },
    { key: 'value', label: 'Değer', align: 'right', render: (r) => <span className="font-semibold tabular-nums text-slate-800">{tl(r.value)}</span> }
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Filtrelenen" value={rows.length} detail={`${deals.length} toplam`} icon={Handshake} />
        <Stat label="Toplam Değer" value={tl(rows.reduce((s, d) => s + Number(d.value || 0), 0))} detail="seçili kayıtlar" icon={Wallet} tone="amber" />
        <Stat label="Kazanılan" value={rows.filter((d) => d.stage === 'won').length} detail="fırsat" icon={TrendingUp} tone="green" />
        <Stat label="Ortalama Olasılık" value={`%${Math.round(rows.reduce((s, d) => s + Number(d.probability || 0), 0) / (rows.length || 1))}`} detail="açık kayıtlar" icon={Target} tone="slate" />
      </div>

      {view === 'board' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitch view={view} onChange={setView} />
            <span className="text-[11.5px] font-semibold text-slate-500">
              Kartı sürükleyip başka aşamaya bırakın · veya kart altındaki ‹ › ile taşıyın
            </span>
            <button onClick={() => onCreate?.('deal')} className="btn-primary ml-auto">
              <Plus className="h-3.5 w-3.5" /> Yeni fırsat
            </button>
          </div>
          <CrmDealsBoard onCreate={onCreate} />
        </div>
      ) : (
        <Panel>
          <PanelHead icon={Handshake} title="Fırsatlar" subtitle="Aşamayı satır üzerinden değiştirebilirsiniz">
            <ViewSwitch view={view} onChange={setView} />
            <SearchBox value={q} onChange={setQ} placeholder="Fırsat veya şirket ara…" />
            <Dropdown value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer outline-none">
              <option value="all">Tüm aşamalar</option>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Dropdown>
            <Dropdown value={rep} onChange={(e) => setRep(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer outline-none">
              <option value="all">Tüm temsilciler</option>
              {reps.map((r) => <option key={r} value={r}>{r}</option>)}
            </Dropdown>
            <button onClick={() => onCreate?.('deal')} className="btn-primary">
              <Plus className="h-3.5 w-3.5" /> Yeni fırsat
            </button>
          </PanelHead>
          <DataTable flush columns={columns} data={rows} emptyState="Bu filtreye uyan fırsat bulunmuyor." />
        </Panel>
      )}
    </div>
  );
}

/* ─────────────────────────── ADAY MÜŞTERİLER ─────────────────────────── */

export function CrmLeads({ onCreate }) {
  const { leads, updateLeadStatus } = useCRM();
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');

  const rows = leads.filter((l) => {
    if (status !== 'all' && l.status !== status) return false;
    if (q.trim() && !`${l.name} ${l.company}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) return false;
    return true;
  });

  const scoreTone = (s) => (s >= 90 ? '#10B981' : s >= 75 ? '#426b9c' : '#94A3B8');

  const columns = [
    {
      key: 'name',
      label: 'Aday',
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={r.name} size={32} tone="#8B5CF6" />
          <div className="min-w-0">
            <div className="truncate font-bold text-slate-800">{r.name}</div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{r.jobTitle}</div>
          </div>
        </div>
      )
    },
    { key: 'company', label: 'Kurum', render: (r) => <span className="text-[12px] font-semibold text-slate-700">{r.company}</span> },
    {
      key: 'score',
      label: 'Skor',
      render: (r) => (
        <div className="flex min-w-[104px] items-center gap-2">
          <Bar value={r.score} tone={scoreTone(r.score)} />
          <span className="w-6 text-right text-[11px] font-bold tabular-nums text-slate-700">{r.score}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Durum',
      render: (r) => (
        <Dropdown
          value={r.status}
          onChange={(e) => updateLeadStatus(r.id, e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-800 hover:border-brand-300"
        >
          {LEAD_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Dropdown>
      )
    },
    { key: 'source', label: 'Kaynak', render: (r) => <Chip tone="slate">{r.source}</Chip> },
    { key: 'owner', label: 'Sorumlu', render: (r) => <span className="text-[12px] font-semibold text-slate-700">{r.owner}</span> },
    { key: 'estimatedValue', label: 'Tahmini', align: 'right', render: (r) => <span className="font-semibold tabular-nums text-slate-800">{tl(r.estimatedValue)}</span> }
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {LEAD_STATUS.map((s) => (
          <Stat
            key={s.id}
            label={s.label}
            value={leads.filter((l) => l.status === s.id).length}
            detail={tl(leads.filter((l) => l.status === s.id).reduce((a, l) => a + Number(l.estimatedValue || 0), 0))}
            icon={UserPlus}
            tone={s.id === 'qualified' ? 'green' : s.id === 'unqualified' ? 'slate' : 'orange'}
          />
        ))}
      </div>

      <Panel>
        <PanelHead icon={UserPlus} title="Aday müşteriler" subtitle="Durumu satır üzerinden güncelleyebilirsiniz">
          <SearchBox value={q} onChange={setQ} placeholder="Aday veya kurum ara…" />
          <Dropdown value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer outline-none">
            <option value="all">Tüm durumlar</option>
            {LEAD_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Dropdown>
          <button onClick={() => onCreate?.('lead')} className="btn-primary">
            <Plus className="h-3.5 w-3.5" /> Yeni aday
          </button>
        </PanelHead>
        <DataTable flush columns={columns} data={rows} emptyState="Bu filtreye uyan aday müşteri bulunmuyor." />
      </Panel>

      {rows.length > 0 && (
        <Panel>
          <PanelHead icon={Activity} title="Aday notları" subtitle="Saha ekibinin son girdileri" />
          <div className="divide-y divide-gray-100">
            {rows.map((l) => (
              <div key={l.id} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar name={l.name} size={28} tone="#8B5CF6" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-slate-800">{l.name} · <span className="font-semibold text-slate-500">{l.company}</span></p>
                  <p className="mt-0.5 text-[11.5px] text-slate-600">{l.notes}</p>
                </div>
                <StatusBadge status={l.status === 'qualified' ? 'success' : l.status === 'new' ? 'info' : 'warning'} text={leadStatusOf(l.status).label} />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ─────────────────────────── ŞİRKETLER & KİŞİLER ─────────────────────────── */

export function CrmAccounts({ onCreate, onOpenContact, onOpenCompany }) {
  const { companies, contacts } = useCRM();
  const [activeCompany, setActiveCompany] = useState('all');

  const shown = activeCompany === 'all' ? contacts : contacts.filter((c) => c.companyId === activeCompany);
  const selected = companies.find((c) => c.id === activeCompany);

  const healthTone = { champion: 'green', healthy: 'orange', at_risk: 'red' };
  const healthLabel = { champion: 'Stratejik', healthy: 'Sağlıklı', at_risk: 'Riskli' };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,380px)_1fr]">
      <Panel className="h-fit">
        <PanelHead icon={Building2} title="Şirketler" subtitle={`${companies.length} kurumsal hesap`}>
          <button onClick={() => onCreate?.('company')} className="btn-secondary" title="Yeni şirket">
            <Plus className="h-3.5 w-3.5" /> Şirket
          </button>
        </PanelHead>
        <div className="p-2">
          <button
            onClick={() => setActiveCompany('all')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${activeCompany === 'all' ? 'bg-brand-50 text-brand-800' : 'hover:bg-gray-50'}`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-slate-500">
              <Users className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[12.5px] font-bold">Tüm kişiler</span>
            <span className="text-[11px] font-bold tabular-nums text-slate-400">{contacts.length}</span>
          </button>

          {companies.map((c) => {
            const count = contacts.filter((k) => k.companyId === c.id).length;
            const on = activeCompany === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCompany(c.id)}
                className={`mt-1 flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${on ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
              >
                <Avatar name={c.name} size={32} tone="#0EA5E9" />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[12.5px] font-bold ${on ? 'text-brand-800' : 'text-slate-800'}`}>{c.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">{c.industry}</div>
                </div>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="space-y-5">
        {selected && (
          <Panel>
            <PanelHead icon={Building2} title={selected.name} subtitle={`${selected.tier} · ${selected.location}`}>
              <Chip tone={healthTone[selected.healthStatus]}>{healthLabel[selected.healthStatus] || selected.healthStatus}</Chip>
              <button
                onClick={() => onOpenCompany?.(selected.id)}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-200 border border-slate-200"
              >
                Şirket kartı <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </PanelHead>
            <div className="p-5">
              <p className="text-[12.5px] leading-relaxed text-slate-600">{selected.description}</p>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Açık fırsat</dt>
                  <dd className="mt-1 text-[13px] font-semibold tabular-nums text-slate-800">{tl(selected.openDealsValue)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hesap sorumlusu</dt>
                  <dd className="mt-1 text-[13px] font-bold text-slate-800">{selected.accountOwner}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Çalışan</dt>
                  <dd className="mt-1 text-[13px] font-bold tabular-nums text-slate-800">{selected.employees}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Yıllık ciro</dt>
                  <dd className="mt-1 text-[13px] font-bold tabular-nums text-slate-800">{selected.annualRevenue}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(selected.techStack || []).map((t) => <Chip key={t} tone="violet">{t}</Chip>)}
              </div>
            </div>
          </Panel>
        )}

        <Panel>
          <PanelHead icon={Users} title="Kişiler" subtitle={selected ? selected.name : 'Tüm hesaplar'}>
            <button onClick={() => onCreate?.('contact')} className="btn-primary">
              <Plus className="h-3.5 w-3.5" /> Yeni kişi
            </button>
          </PanelHead>
          <div className="divide-y divide-gray-100">
            {shown.map((k) => (
              <button
                type="button"
                key={k.id}
                onClick={() => onOpenContact?.(k.id)}
                className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50/70"
              >
                <Avatar name={k.fullName} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-slate-800">{k.fullName}</div>
                  <div className="mt-0.5 truncate text-[11.5px] text-slate-500">{k.jobTitle}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-400" />{k.email}</span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums"><Phone className="h-3 w-3 text-slate-400" />{k.phone}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge status="info" text={k.contactStatus} />
                  <div className="mt-1.5 text-[11px] font-semibold text-slate-500">
                    Skor <span className="font-semibold tabular-nums text-slate-800">{k.leadScore}</span> · {k.dealsCount} fırsat
                  </div>
                </div>
              </button>
            ))}
            {shown.length === 0 && <Empty icon={Users} title="Bu hesapta kişi yok" hint="Kişi eklendiğinde burada listelenir." />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── ortak ─────────────────────────── */

/** Tablo / pano görünüm anahtarı. */
function ViewSwitch({ view, onChange }) {
  const opts = [
    { id: 'board', label: 'Pano', icon: Columns3 },
    { id: 'table', label: 'Tablo', icon: Rows3 }
  ];
  return (
    <div className="flex gap-1 rounded-full border border-slate-200 bg-gray-50 p-1">
      {opts.map((o) => {
        const Icon = o.icon;
        const on = view === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold transition-all ${
              on ? 'bg-white text-brand-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-gray-50/80 px-3 transition-colors focus-within:border-brand-300 focus-within:bg-white">
      <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-40 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400 lg:w-52"
      />
    </label>
  );
}
