import React, { useMemo, useState } from 'react';
import { useWorkspaceState } from '../../../hooks/useWorkspaceState';
import {
  Award, BadgeCheck, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck,
  Clock, LogIn, LogOut, Plus, Target, TrendingDown, TrendingUp, UserCheck,
  UserMinus, UserPlus, Users, XCircle
} from 'lucide-react';
import { DataTable, Drawer, Modal, Dropdown } from '../../ui';
import {
  Panel, PanelHead, Stat, Avatar, Bar, Chip, Empty, Field, trDate,
  FormInput, FormTextarea, FormSelect
} from './Parts';
import { SearchBox } from './CrmSections';
import {
  DEPARTMENTS, SHIFT_TYPES, LEAVE_TYPES,
  INITIAL_EMPLOYEES, INITIAL_SCHEDULE, INITIAL_ATTENDANCE, ATTENDANCE_TREND,
  INITIAL_LEAVE_BALANCES, INITIAL_LEAVE_REQUESTS, INITIAL_GOALS, INITIAL_REVIEWS
} from '../../../mock/hrData';

const SUB_TABS = [
  { id: 'kadro', label: 'Kadro & Özlük', icon: Users },
  { id: 'vardiya', label: 'Vardiya & Devam', icon: CalendarClock },
  { id: 'izin', label: 'İzinler', icon: CalendarDays },
  { id: 'performans', label: 'Performans', icon: Target }
];

const STATUS = {
  aktif: { label: 'Aktif', tone: 'green' },
  izinli: { label: 'İzinli', tone: 'amber' },
  ayrildi: { label: 'Ayrıldı', tone: 'slate' }
};

const ATT_STATUS = {
  icerde: { label: 'İçeride', tone: 'green' },
  bekleniyor: { label: 'Bekleniyor', tone: 'slate' },
  izinli: { label: 'İzinli', tone: 'amber' },
  gelmedi: { label: 'Gelmedi', tone: 'red' },
  cikti: { label: 'Çıkış yaptı', tone: 'slate' }
};

const LEAVE_STATUS = {
  bekliyor: { label: 'Onay bekliyor', tone: 'amber' },
  onaylandi: { label: 'Onaylandı', tone: 'green' },
  reddedildi: { label: 'Reddedildi', tone: 'red' }
};

const depOf = (id) => DEPARTMENTS.find((d) => d.id === id) || { name: '—', color: '#94A3B8' };
const shiftOf = (id) => SHIFT_TYPES.find((s) => s.id === id) || SHIFT_TYPES[0];
const leaveTypeOf = (id) => LEAVE_TYPES.find((t) => t.id === id) || { name: id };


const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const monday = new Date(todayISO() + 'T12:00:00');
monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => {
 const day = new Date(monday); day.setDate(day.getDate() + i);
 return { key: day.toLocaleDateString('sv-SE'), label: day.toLocaleDateString('tr-TR', { weekday: 'short' }), date: day.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) };
});

const nowHM = () =>
  new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function StaffModule() {
  const store = useWorkspaceState('hr', ['employees','schedule','attendance','leaveRequests','balances','goals','reviews']);
  const [tab, setTab] = useState('kadro');
  const employees = store.data.employees;
  const schedule = store.data.schedule;
  const attendance = store.data.attendance;
  const leaveRequests = store.data.leaveRequests;
  const balances = store.data.balances;
  const goals = store.data.goals;
  const reviews = store.data.reviews;

  const [detailId, setDetailId] = useState(null);
  const [newStaffOpen, setNewStaffOpen] = useState(false);
  const [newLeaveOpen, setNewLeaveOpen] = useState(false);

  const active = employees.filter((e) => e.status !== 'ayrildi');
  const detail = employees.find((e) => e.id === detailId) || null;

  /* ── eylemler ── */


  const addEmployee = async form => {
    const id = crypto.randomUUID();
    const saved = await store.set(null, prev => ({ ...prev,
      employees: [{ ...form, id, sicilNo: form.sicilNo || 'VNX-' + id.slice(0,8), status:'aktif', weeklyHours:45 }, ...prev.employees],
      schedule: [...prev.schedule, { employeeId:id, week:WEEK_DAYS[0].key, days:Array(7).fill(form.defaultShift) }],
      attendance: [...prev.attendance, { id:crypto.randomUUID(), employeeId:id, date:todayISO(), checkIn:null,checkOut:null,lateMinutes:0,overtimeMinutes:0,status:'bekleniyor' }],
      balances: [...prev.balances, { employeeId:id, year:new Date().getFullYear(), entitled:14,used:0,pending:0 }]
    }));
    if(saved) setNewStaffOpen(false);
    return saved;
  };
  const setEmployeeStatus = (id,status) => store.set('employees', prev => prev.map(e=>e.id===id?{...e,status}:e));
  const setShift = (employeeId,dayIndex,shiftId) => store.set('schedule', prev => {
    const row=prev.find(r=>r.employeeId===employeeId && r.week===WEEK_DAYS[0].key);
    const days=row ? [...row.days] : Array(7).fill('gunduz'); days[dayIndex]=shiftId;
    return [...prev.filter(r=>!(r.employeeId===employeeId && r.week===WEEK_DAYS[0].key)),{employeeId,week:WEEK_DAYS[0].key,days}];
  });
  const punch = (attId,kind) => store.set('attendance', prev => {
    const employeeId=attId.startsWith('today-')?attId.slice(6):prev.find(a=>a.id===attId)?.employeeId;
    if(!employeeId) return prev;
    const existing=prev.find(a=>a.employeeId===employeeId && a.date===todayISO());
    const row=existing || {id:crypto.randomUUID(),employeeId,date:todayISO(),lateMinutes:0,overtimeMinutes:0};
    if(kind==='in' && row.checkIn) return prev;
    if(kind==='out' && (!row.checkIn || row.checkOut)) return prev;
    const updated={...row, [kind==='in'?'checkIn':'checkOut']:nowHM(),status:kind==='in'?'icerde':'cikti'};
    return [...prev.filter(a=>a.id!==row.id),updated];
  });
  const decideLeave = (id,status) => store.set(null, prev => {
    const request=prev.leaveRequests.find(r=>r.id===id);
    if(!request || request.status!=='bekliyor') return prev;
    return {...prev,
      leaveRequests:prev.leaveRequests.map(r=>r.id===id?{...r,status,approver:'Yönetici'}:r),
      balances:prev.balances.map(b=>b.employeeId===request.employeeId?{...b,pending:Math.max(0,(b.pending||0)-request.days),used:(b.used||0)+(status==='onaylandi'?request.days:0)}:b)
    };
  });
  const addLeave = async form => {
    const days=Math.round((new Date(form.endDate)-new Date(form.startDate))/86400000)+1;
    if(!Number.isFinite(days)||days<1) return false;
    const saved=await store.set(null,prev=>({...prev,
      leaveRequests:[{...form,id:crypto.randomUUID(),days,status:'bekliyor',requestedAt:todayISO(),approver:null},...prev.leaveRequests],
      balances:prev.balances.map(b=>b.employeeId===form.employeeId?{...b,pending:(b.pending||0)+days}:b)
    }));
    if(saved) setNewLeaveOpen(false);
    return saved;
  };
  if(store.loading) return <p className="p-4">Personel kayıtları yükleniyor…</p>;
  return (
    <div className="space-y-5">
      {store.error && <p role="alert" className="text-red-700">{store.error} <button onClick={store.reload}>Yeniden yükle</button></p>}
      {store.saving && <p role="status">Kaydediliyor…</p>}
      {/* alt sekmeler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-2xs">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all ${
                  on ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/20' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {tab === 'izin' && (
            <button onClick={() => setNewLeaveOpen(true)} className="btn-secondary">
              <Plus className="h-3.5 w-3.5" /> İzin talebi
            </button>
          )}
          <button onClick={() => setNewStaffOpen(true)} className="btn-primary">
            <UserPlus className="h-3.5 w-3.5" /> Yeni personel
          </button>
        </div>
      </div>

      {tab === 'kadro' && (
        <Roster employees={employees} active={active} onOpen={setDetailId} onStatus={setEmployeeStatus} />
      )}
      {tab === 'vardiya' && (
        <ShiftsAndAttendance
          employees={employees}
          active={active}
          schedule={active.map(e => schedule.find(r => r.employeeId === e.id && r.week === WEEK_DAYS[0].key) || {employeeId:e.id,days:Array(7).fill(e.defaultShift || 'gunduz')})}
          attendance={active.map(e => attendance.find(a => a.employeeId === e.id && a.date === todayISO()) || {id:'today-'+e.id,employeeId:e.id,date:todayISO(),status:'bekleniyor'})}
          onShift={setShift}
          onPunch={punch}
        />
      )}
      {tab === 'izin' && (
        <LeaveBoard employees={employees} balances={balances} requests={leaveRequests} onDecide={decideLeave} />
      )}
      {tab === 'performans' && (
        <Performance employees={active} goals={goals} reviews={reviews} onOpen={setDetailId} />
      )}

      <StaffDetail
        employee={detail}
        employees={employees}
        balances={balances}
        goals={goals}
        reviews={reviews}
        onClose={() => setDetailId(null)}
      />
      <NewStaffModal isOpen={newStaffOpen} onClose={() => setNewStaffOpen(false)} onSave={addEmployee} employees={active} />
      <NewLeaveModal isOpen={newLeaveOpen} onClose={() => setNewLeaveOpen(false)} onSave={addLeave} employees={active} />
    </div>
  );
}

/* ─────────────────────────── KADRO ─────────────────────────── */

function Roster({ employees, active, onOpen, onStatus }) {
  const [q, setQ] = useState('');
  const [dep, setDep] = useState('all');
  const [status, setStatus] = useState('all');

  const rows = employees.filter((e) => {
    if (dep !== 'all' && e.departmentId !== dep) return false;
    if (status !== 'all' && e.status !== status) return false;
    if (q.trim() && !`${e.fullName} ${e.title} ${e.sicilNo}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) return false;
    return true;
  });

  const columns = [
    {
      key: 'fullName',
      label: 'Personel',
      render: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={r.fullName} size={34} tone={depOf(r.departmentId).color} />
          <div className="min-w-0">
            <div className="truncate font-bold text-gray-900">{r.fullName}</div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-gray-500">{r.title}</div>
          </div>
        </div>
      )
    },
    { key: 'sicilNo', label: 'Sicil', render: (r) => <span className="text-[11.5px] font-semibold tabular-nums text-gray-600">{r.sicilNo}</span> },
    {
      key: 'departmentId',
      label: 'Departman',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-700">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: depOf(r.departmentId).color }} />
          {depOf(r.departmentId).name}
        </span>
      )
    },
    { key: 'workSite', label: 'Görev yeri', render: (r) => <span className="text-[11.5px] text-gray-600">{r.workSite}</span> },
    { key: 'hireDate', label: 'İşe giriş', render: (r) => <span className="text-[11.5px] tabular-nums text-gray-600">{trDate(r.hireDate)}</span> },
    {
      key: 'status',
      label: 'Durum',
      render: (r) => (
        <Dropdown
          value={r.status}
          onChange={(e) => onStatus(r.id, e.target.value)}
          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11.5px] font-bold text-gray-800 hover:border-brand-300"
        >
          {Object.entries(STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
        </Dropdown>
      )
    },
    {
      key: 'detay',
      label: '',
      align: 'right',
      render: (r) => (
        <button onClick={() => onOpen(r.id)} className="rounded-full bg-brand-50 px-3 py-1 text-[11.5px] font-bold text-brand-600 transition-colors hover:bg-brand-100">
          Özlük
        </button>
      )
    }
  ];

  const byDep = DEPARTMENTS.map((d) => ({
    ...d,
    count: active.filter((e) => e.departmentId === d.id).length
  })).filter((d) => d.count > 0);
  const maxDep = Math.max(1, ...byDep.map((d) => d.count));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Aktif Kadro" value={active.filter((e) => e.status === 'aktif').length} detail={`${employees.length} kayıt`} icon={UserCheck} tone="green" />
        <Stat label="İzinli" value={employees.filter((e) => e.status === 'izinli').length} detail="bugün" icon={CalendarDays} tone="amber" />
        <Stat label="Ayrılan" value={employees.filter((e) => e.status === 'ayrildi').length} detail="bu yıl" icon={UserMinus} tone="slate" />
        <Stat label="Departman" value={byDep.length} detail={`${DEPARTMENTS.length} tanımlı`} icon={Users} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_minmax(0,340px)]">
        <Panel>
          <PanelHead icon={Users} title="Personel kadrosu" subtitle="Satırdaki durumu doğrudan değiştirebilirsiniz">
            <SearchBox value={q} onChange={setQ} placeholder="Ad, ünvan veya sicil…" />
            <Dropdown value={dep} onChange={(e) => setDep(e.target.value)} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300">
              <option value="all">Tüm departmanlar</option>
              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Dropdown>
            <Dropdown value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300">
              <option value="all">Tüm durumlar</option>
              {Object.entries(STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </Dropdown>
          </PanelHead>
          <DataTable flush columns={columns} data={rows} emptyState="Bu filtreye uyan personel bulunmuyor." />
        </Panel>

        <Panel className="h-fit">
          <PanelHead icon={Users} title="Departman dağılımı" subtitle="Aktif kadro" />
          <div className="space-y-3.5 p-5">
            {byDep.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <span className="w-[128px] shrink-0 truncate text-[12px] font-bold text-gray-700">{d.name}</span>
                <Bar value={d.count} max={maxDep} tone={d.color} />
                <span className="w-5 shrink-0 text-right text-[12px] font-bold tabular-nums text-gray-800">{d.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── VARDİYA & DEVAM ─────────────────────────── */

function ShiftsAndAttendance({ employees, active, schedule, attendance, onShift, onPunch }) {
  const nameOf = (id) => employees.find((e) => e.id === id)?.fullName || '—';
  const rows = schedule.filter((r) => active.some((e) => e.id === r.employeeId));

  const today = attendance.filter((a) => active.some((e) => e.id === a.employeeId));
  const onTime = today.filter((a) => a.checkIn && a.lateMinutes === 0).length;
  const late = today.filter((a) => a.lateMinutes > 0).length;
  const absent = today.filter((a) => a.status === 'gelmedi').length;
  const inside = today.filter((a) => a.status === 'icerde').length;
  const maxTrend = Math.max(...ATTENDANCE_TREND.map((d) => d.zamaninda + d.gec + d.devamsiz));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="İçeride" value={inside} detail="şu an" icon={UserCheck} tone="green" />
        <Stat label="Zamanında" value={onTime} detail="bugün giriş" icon={CheckCircle2} tone="green" />
        <Stat label="Geç Kalan" value={late} detail={`${today.reduce((s, a) => s + a.lateMinutes, 0)} dk toplam`} icon={Clock} tone="amber" />
        <Stat label="Devamsız" value={absent} detail="bugün" icon={XCircle} tone={absent ? 'red' : 'slate'} />
      </div>

      <Panel>
        <PanelHead icon={CalendarClock} title="Haftalık vardiya çizelgesi" subtitle="Bu haftanın vardiyaları · hücreden değiştirin" />
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[880px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-gray-100 bg-gray-50/90 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Personel</th>
                {WEEK_DAYS.map((d) => (
                  <th key={d.key} className="border-b border-gray-100 bg-gray-50/90 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    {d.label}
                    <span className="ml-1 font-semibold tabular-nums text-gray-400">{d.date}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId} className="transition-colors hover:bg-gray-50/60">
                  <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={nameOf(row.employeeId)} size={28} tone={depOf(employees.find((e) => e.id === row.employeeId)?.departmentId).color} />
                      <span className="truncate text-[12.5px] font-bold text-gray-900">{nameOf(row.employeeId)}</span>
                    </div>
                  </td>
                  {row.days.map((shiftId, i) => (
                    <td key={i} className="border-b border-gray-100 px-2 py-2.5 text-center">
                      <Dropdown
                        value={shiftId}
                        onChange={(e) => onShift(row.employeeId, i, e.target.value)}
                        className="w-full justify-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{
                          background: `${shiftOf(shiftId).color}14`,
                          color: shiftOf(shiftId).color,
                          border: `1px solid ${shiftOf(shiftId).color}33`
                        }}
                      >
                        {SHIFT_TYPES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </Dropdown>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-3">
          {SHIFT_TYPES.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.name} <span className="tabular-nums text-gray-400">{s.start}–{s.end}</span>
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_minmax(0,340px)]">
        <Panel>
          <PanelHead icon={Clock} title="Bugünün devam kayıtları" subtitle="Bugünün giriş ve çıkış kayıtları" />
          <div className="divide-y divide-gray-100">
            {today.map((a) => {
              const st = ATT_STATUS[a.status] || ATT_STATUS.bekleniyor;
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Avatar name={nameOf(a.employeeId)} size={32} tone={depOf(employees.find((e) => e.id === a.employeeId)?.departmentId).color} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-bold text-gray-900">{nameOf(a.employeeId)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-gray-500">
                      <span className="tabular-nums">Giriş <b className="font-bold text-gray-700">{a.checkIn || '—'}</b></span>
                      <span className="tabular-nums">Çıkış <b className="font-bold text-gray-700">{a.checkOut || '—'}</b></span>
                      {a.lateMinutes > 0 && <span className="font-bold tabular-nums text-amber-600">{a.lateMinutes} dk geç</span>}
                    </div>
                  </div>
                  <Chip tone={st.tone}>{st.label}</Chip>
                  {!a.checkIn && a.status !== 'izinli' && (
                    <button onClick={() => onPunch(a.id, 'in')} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11.5px] font-bold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-600">
                      <LogIn className="h-3.5 w-3.5" /> Giriş
                    </button>
                  )}
                  {a.checkIn && !a.checkOut && (
                    <button onClick={() => onPunch(a.id, 'out')} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11.5px] font-bold text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-600">
                      <LogOut className="h-3.5 w-3.5" /> Çıkış
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="h-fit">
          <PanelHead icon={TrendingUp} title="Son 5 iş günü" subtitle="Devam dağılımı" />
          <div className="space-y-3 p-5">
            {ATTENDANCE_TREND.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="w-11 shrink-0 text-[11.5px] font-bold tabular-nums text-gray-500">{d.date}</span>
                <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <span className="h-full bg-emerald-500" style={{ width: `${(d.zamaninda / maxTrend) * 100}%` }} />
                  <span className="h-full bg-amber-500" style={{ width: `${(d.gec / maxTrend) * 100}%` }} />
                  <span className="h-full bg-rose-500" style={{ width: `${(d.devamsiz / maxTrend) * 100}%` }} />
                </span>
                <span className="w-14 shrink-0 text-right text-[11px] font-bold tabular-nums text-gray-600">
                  {d.zamaninda}/{d.gec}/{d.devamsiz}
                </span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-gray-500">
              <span className="font-bold text-emerald-600">Zamanında</span> / <span className="font-bold text-amber-600">geç</span> / <span className="font-bold text-rose-600">devamsız</span>
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── İZİNLER ─────────────────────────── */

function LeaveBoard({ employees, balances, requests, onDecide }) {
  const [status, setStatus] = useState('all');
  const nameOf = (id) => employees.find((e) => e.id === id)?.fullName || '—';

  const rows = requests.filter((r) => (status === 'all' ? true : r.status === status));
  const pending = requests.filter((r) => r.status === 'bekliyor');
  const totalEntitled = balances.reduce((s, b) => s + b.entitled, 0);
  const totalUsed = balances.reduce((s, b) => s + b.used, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Onay Bekleyen" value={pending.length} detail={`${pending.reduce((s, r) => s + r.days, 0)} gün`} icon={CalendarClock} tone={pending.length ? 'amber' : 'slate'} />
        <Stat label="Onaylanan" value={requests.filter((r) => r.status === 'onaylandi').length} detail="bu dönem" icon={CheckCircle2} tone="green" />
        <Stat label="Kullanılan Hak" value={`${totalUsed}/${totalEntitled}`} detail="gün · tüm kadro" icon={CalendarDays} />
        <Stat label="Kalan Hak" value={totalEntitled - totalUsed} detail="gün" icon={BadgeCheck} tone="slate" />
      </div>

      <Panel>
        <PanelHead icon={CalendarDays} title="İzin talepleri" subtitle="Bekleyen talepleri buradan onaylayın">
          <Dropdown value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300">
            <option value="all">Tüm talepler</option>
            {Object.entries(LEAVE_STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </Dropdown>
        </PanelHead>
        <div className="divide-y divide-gray-100">
          {rows.map((r) => {
            const st = LEAVE_STATUS[r.status];
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Avatar name={nameOf(r.employeeId)} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[12.5px] font-bold text-gray-900">{nameOf(r.employeeId)}</span>
                    <Chip tone="slate">{leaveTypeOf(r.type).name}</Chip>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-gray-500">
                    <span className="tabular-nums">{trDate(r.startDate)} – {trDate(r.endDate)}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    <b className="font-bold tabular-nums text-gray-700">{r.days} gün</b>
                    <span className="mx-1.5 text-gray-300">·</span>
                    {r.reason}
                  </div>
                </div>
                <Chip tone={st.tone}>{st.label}</Chip>
                {r.status === 'bekliyor' ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onDecide(r.id, 'onaylandi')} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Onayla
                    </button>
                    <button onClick={() => onDecide(r.id, 'reddedildi')} className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11.5px] font-bold text-rose-700 transition-colors hover:bg-rose-100">
                      <XCircle className="h-3.5 w-3.5" /> Reddet
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-gray-400">{r.approver || '—'}</span>
                )}
              </div>
            );
          })}
          {rows.length === 0 && <Empty icon={CalendarDays} title="Bu filtreye uyan talep yok" />}
        </div>
      </Panel>

      <Panel>
        <PanelHead icon={BadgeCheck} title="İzin bakiyeleri" subtitle="Yıllık hakediş ve kullanım" />
        <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 p-5 md:grid-cols-2">
          {balances
            .filter((b) => employees.some((e) => e.id === b.employeeId && e.status !== 'ayrildi'))
            .map((b) => {
              const remaining = b.entitled - b.used - b.pending;
              return (
                <div key={b.employeeId} className="flex items-center gap-3">
                  <span className="w-[130px] shrink-0 truncate text-[12px] font-bold text-gray-800">{nameOf(b.employeeId)}</span>
                  <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span className="h-full bg-brand-500" style={{ width: `${(b.used / b.entitled) * 100}%` }} />
                    <span className="h-full bg-amber-300" style={{ width: `${(b.pending / b.entitled) * 100}%` }} />
                  </span>
                  <span className="w-[86px] shrink-0 text-right text-[11.5px] font-bold tabular-nums text-gray-600">
                    {remaining} gün kaldı
                  </span>
                </div>
              );
            })}
        </div>
      </Panel>
    </div>
  );
}

/* ─────────────────────────── PERFORMANS ─────────────────────────── */

const goalRatio = (g) => {
  if (!g.target) return 0;
  return g.direction === 'lower'
    ? Math.min(150, (g.target / Math.max(g.actual, 0.0001)) * 100)
    : Math.min(150, (g.actual / g.target) * 100);
};

function Performance({ employees, goals, reviews, onOpen }) {
  const scored = employees
    .map((e) => {
      const own = goals.filter((g) => g.employeeId === e.id);
      const avg = own.length ? own.reduce((s, g) => s + goalRatio(g), 0) / own.length : 0;
      const review = reviews.find((r) => r.employeeId === e.id);
      return { employee: e, goals: own, attainment: Math.round(avg), review };
    })
    .filter((r) => r.goals.length > 0)
    .sort((a, b) => b.attainment - a.attainment);

  const teamAvg = Math.round(scored.reduce((s, r) => s + r.attainment, 0) / (scored.length || 1));
  const above = scored.filter((r) => r.attainment >= 100).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Ekip Ortalaması" value={`%${teamAvg}`} detail="hedef gerçekleşme" icon={Target} tone={teamAvg >= 100 ? 'green' : 'amber'} />
        <Stat label="Hedefin Üstünde" value={above} detail={`${scored.length} personel`} icon={TrendingUp} tone="green" />
        <Stat label="Hedefin Altında" value={scored.length - above} detail="destek gerekli" icon={TrendingDown} tone={scored.length - above ? 'amber' : 'slate'} />
        <Stat label="Değerlendirme" value={reviews.length} detail="2026 Q2 kaydı" icon={Award} tone="slate" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {scored.map((row, idx) => (
          <Panel key={row.employee.id}>
            <PanelHead
              icon={idx === 0 ? Award : Target}
              title={row.employee.fullName}
              subtitle={`${row.employee.title} · ${depOf(row.employee.departmentId).name}`}
            >
              <Chip tone={row.attainment >= 100 ? 'green' : row.attainment >= 85 ? 'amber' : 'red'}>%{row.attainment}</Chip>
              <button onClick={() => onOpen(row.employee.id)} className="rounded-full bg-gray-50 px-3 py-1 text-[11.5px] font-bold text-gray-600 transition-colors hover:text-brand-600">
                Özlük
              </button>
            </PanelHead>
            <div className="space-y-3.5 p-5">
              {row.goals.map((g) => {
                const ratio = goalRatio(g);
                const ok = ratio >= 100;
                return (
                  <div key={g.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-bold text-gray-800">{g.label}</span>
                      <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-gray-600">
                        {g.unit === '₺' ? `₺${Number(g.actual).toLocaleString('tr-TR')}` : `${g.actual} ${g.unit}`}
                        <span className="font-semibold text-gray-400"> / {g.unit === '₺' ? `₺${Number(g.target).toLocaleString('tr-TR')}` : `${g.target} ${g.unit}`}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Bar value={Math.min(100, ratio)} tone={ok ? '#10B981' : '#426b9c'} />
                      <span className={`w-10 shrink-0 text-right text-[11px] font-bold tabular-nums ${ok ? 'text-emerald-600' : 'text-brand-600'}`}>%{Math.round(ratio)}</span>
                    </div>
                    {g.direction === 'lower' && (
                      <p className="mt-1 text-[10.5px] font-semibold text-gray-400">Düşük olması hedeflenir</p>
                    )}
                  </div>
                );
              })}
              {row.review && (
                <div className="mt-1 rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{row.review.period} değerlendirmesi</span>
                    <span className="text-[12px] font-semibold tabular-nums text-gray-900">{row.review.score} / 5</span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-gray-600">{row.review.note}</p>
                  <p className="mt-1 text-[10.5px] font-semibold text-gray-400">{row.review.reviewer}</p>
                </div>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── ÖZLÜK DETAYI ─────────────────────────── */

function tenure(hireDate, exitDate) {
  if (!hireDate) return '—';
  const start = new Date(hireDate);
  const end = exitDate ? new Date(exitDate) : new Date();
  if (Number.isNaN(start.getTime())) return '—';
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return `${m} ay`;
  return m ? `${y} yıl ${m} ay` : `${y} yıl`;
}

/** Sürücü panelinde bölümleri birbirinden ayıran kart. */
function Block({ icon: Icon, title, children, right }) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-2xs">
      <header className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
        <h4 className="text-[11px] font-semibold tracking-tight text-gray-700">{title}</h4>
        {right && <span className="ml-auto">{right}</span>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MiniStat({ label, value, sub, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5">
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`mt-1 text-[15px] font-bold leading-none tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] font-semibold text-gray-400">{sub}</div>}
    </div>
  );
}

function StaffDetail({ employee, employees, balances, goals, reviews, onClose }) {
  if (!employee) return null;
  const dep = depOf(employee.departmentId);
  const manager = employees.find((e) => e.id === employee.managerId);
  const balance = balances.find((b) => b.employeeId === employee.id);
  const own = goals.filter((g) => g.employeeId === employee.id);
  const review = reviews.find((r) => r.employeeId === employee.id);
  const st = STATUS[employee.status] || STATUS.aktif;

  const remaining = balance ? balance.entitled - balance.used - balance.pending : null;
  const avgAttainment = own.length
    ? Math.round(own.reduce((s, g) => s + goalRatio(g), 0) / own.length)
    : null;

  const fmtGoal = (v, unit) =>
    unit === '₺' ? `₺${Number(v).toLocaleString('tr-TR')}` : `${Number(v).toLocaleString('tr-TR')} ${unit}`;

  return (
    <Drawer isOpen={!!employee} onClose={onClose} title="Personel özlük dosyası" size="xl">
      <div className="space-y-4">
        {/* Kimlik — kaydırınca üstte kalır */}
        <div className="sticky top-0 z-10 -mx-6 -mt-6 border-b border-gray-100 bg-white/95 px-6 pb-4 pt-6 backdrop-blur">
          <div className="flex items-start gap-3.5">
            <Avatar name={employee.fullName} size={52} tone={dep.color} />
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-semibold leading-tight tracking-tight text-gray-900">
                {employee.fullName}
              </h3>
              <p className="mt-0.5 text-[12.5px] font-semibold text-gray-500">{employee.title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip tone={st.tone}>{st.label}</Chip>
                <Chip tone="slate">{dep.name}</Chip>
                <Chip tone="orange">{employee.sicilNo}</Chip>
              </div>
            </div>
          </div>
        </div>

        {/* Özet */}
        <div className="grid grid-cols-3 gap-2.5">
          <MiniStat label="Kıdem" value={tenure(employee.hireDate, employee.exitDate)} sub={trDate(employee.hireDate)} />
          <MiniStat
            label="Kalan izin"
            value={remaining == null ? '—' : `${remaining}`}
            sub={balance ? `${balance.entitled} günün` : 'tanımsız'}
            tone={remaining != null && remaining <= 3 ? 'text-rose-600' : 'text-gray-900'}
          />
          <MiniStat
            label="Hedef"
            value={avgAttainment == null ? '—' : `%${avgAttainment}`}
            sub={own.length ? `${own.length} hedef` : 'hedef yok'}
            tone={avgAttainment != null && avgAttainment >= 100 ? 'text-emerald-600' : 'text-gray-900'}
          />
        </div>

        <Block icon={BadgeCheck} title="Özlük bilgileri">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5">
            <Field label="İşe giriş" value={trDate(employee.hireDate)} mono />
            <Field label="Sözleşme" value={employee.employmentType} />
            {employee.exitDate && <Field label="Çıkış" value={trDate(employee.exitDate)} mono />}
            <Field label="Doğum tarihi" value={employee.birthDate ? trDate(employee.birthDate) : '—'} mono />
            <Field label="T.C. no" value={employee.tcNo} mono />
            <Field label="SGK sicil" value={employee.sgkNo} mono />
            <Field label="Eğitim" value={employee.education} />
            <Field label="Yönetici" value={manager ? manager.fullName : 'Genel Müdürlük'} />
            <Field label="Görev yeri" value={employee.workSite} />
            <Field label="Şehir" value={employee.city} />
            <Field label="Haftalık saat" value={`${employee.weeklyHours} saat`} mono />
            <Field label="Varsayılan vardiya" value={shiftOf(employee.defaultShift).name} />
          </dl>
        </Block>

        <Block icon={Users} title="İletişim">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5">
            <Field label="E-posta" value={employee.email} />
            <Field label="Telefon" value={employee.phone} mono />
            <div className="col-span-2">
              <Field label="Acil durumda aranacak" value={employee.emergencyContact} />
            </div>
          </dl>
        </Block>

        {balance && (
          <Block
            icon={CalendarDays}
            title="İzin durumu"
            right={<span className="text-[11px] font-bold tabular-nums text-gray-500">{balance.entitled} gün hakediş</span>}
          >
            <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
              <span className="h-full bg-brand-500" style={{ width: `${(balance.used / balance.entitled) * 100}%` }} />
              <span className="h-full bg-amber-300" style={{ width: `${(balance.pending / balance.entitled) * 100}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[13px] font-semibold tabular-nums text-brand-600">{balance.used}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Kullanılan</div>
              </div>
              <div>
                <div className="text-[13px] font-semibold tabular-nums text-amber-600">{balance.pending}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Bekleyen</div>
              </div>
              <div>
                <div className="text-[13px] font-semibold tabular-nums text-gray-900">{remaining}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Kalan</div>
              </div>
            </div>
          </Block>
        )}

        {own.length > 0 && (
          <Block
            icon={Target}
            title="Dönem hedefleri"
            right={<span className="text-[11px] font-bold text-gray-500">{own[0].period}</span>}
          >
            <div className="space-y-3.5">
              {own.map((g) => {
                const ratio = goalRatio(g);
                const ok = ratio >= 100;
                return (
                  <div key={g.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 flex-1 text-[12px] font-bold text-gray-800">{g.label}</span>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-700">
                        {fmtGoal(g.actual, g.unit)}
                        <span className="font-semibold text-gray-400"> / {fmtGoal(g.target, g.unit)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <Bar value={Math.min(100, ratio)} tone={ok ? '#15803D' : '#426b9c'} />
                      <span className={`w-10 shrink-0 text-right text-[11px] font-bold tabular-nums ${ok ? 'text-emerald-600' : 'text-brand-600'}`}>
                        %{Math.round(ratio)}
                      </span>
                    </div>
                    {g.direction === 'lower' && (
                      <p className="mt-1 text-[10px] font-semibold text-gray-400">Düşük olması hedeflenir</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Block>
        )}

        {review && (
          <Block
            icon={Award}
            title="Son değerlendirme"
            right={<span className="text-[12px] font-semibold tabular-nums text-gray-900">{review.score} / 5</span>}
          >
            <p className="text-[12px] leading-relaxed text-gray-600">{review.note}</p>
            <p className="mt-2 text-[10.5px] font-semibold text-gray-400">{review.period} · {review.reviewer}</p>
          </Block>
        )}

        {employee.notes && (
          <Block icon={ClipboardCheck} title="Notlar">
            <p className="text-[12px] leading-relaxed text-gray-600">{employee.notes}</p>
          </Block>
        )}
      </div>
    </Drawer>
  );
}

/* ─────────────────────────── MODALLAR ─────────────────────────── */

const EMPTY_STAFF = {
  fullName: '', title: '', departmentId: DEPARTMENTS[0].id, managerId: '',
  employmentType: 'Belirsiz Süreli', hireDate: todayISO(), phone: '', email: '',
  city: '', workSite: '', defaultShift: 'gunduz', sicilNo: '', notes: '', salesQuota: ''
};

function NewStaffModal({ isOpen, onClose, onSave, employees }) {
  const [form, setForm] = useState(EMPTY_STAFF);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.fullName.trim() && form.title.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    if (!await onSave(form)) return;
    setForm(EMPTY_STAFF);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni personel" size="xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Ad Soyad *" value={form.fullName} onChange={set('fullName')} placeholder="Örn. Zeynep Aksoy" />
          <Input label="Ünvan *" value={form.title} onChange={set('title')} placeholder="Örn. Depo Görevlisi" />
          <Select label="Departman" value={form.departmentId} onChange={set('departmentId')}>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select label="Yönetici" value={form.managerId} onChange={set('managerId')}>
            <option value="">Genel Müdürlük</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </Select>
          <Select label="Sözleşme tipi" value={form.employmentType} onChange={set('employmentType')}>
            <option value="Belirsiz Süreli">Belirsiz Süreli</option>
            <option value="Belirli Süreli">Belirli Süreli</option>
            <option value="Kısmi Süreli">Kısmi Süreli</option>
            <option value="Stajyer">Stajyer</option>
          </Select>
          <Input label="İşe giriş" type="date" value={form.hireDate} onChange={set('hireDate')} />
          <Input label="E-posta" type="email" value={form.email} onChange={set('email')} placeholder="ad.soyad@veniux.com" />
          <Input label="Telefon" value={form.phone} onChange={set('phone')} placeholder="+90 (5xx) xxx xx xx" />
          <Input label="Şehir" value={form.city} onChange={set('city')} placeholder="İstanbul" />
          <Input label="Görev yeri" value={form.workSite} onChange={set('workSite')} placeholder="Ana Merkez Depo · IST-01" />
          <Select label="Varsayılan vardiya" value={form.defaultShift} onChange={set('defaultShift')}>
            {SHIFT_TYPES.filter((s) => s.id !== 'izinli').map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start}–{s.end})</option>)}
          </Select>
          <Input label="Sicil no" value={form.sicilNo} onChange={set('sicilNo')} placeholder="otomatik" />
          <Input label="Çeyreklik satış hedefi (₺, isteğe bağlı)" type="number" min="0" value={form.salesQuota} onChange={set('salesQuota')} placeholder="CRM performansında kullanılır" />
        </div>
        <Textarea label="Not" value={form.notes} onChange={set('notes')} placeholder="Görev tanımı, sorumluluk alanı…" />

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Vazgeç</button>
          <button type="submit" disabled={!valid} className="btn-primary disabled:opacity-50">
            <UserPlus className="h-3.5 w-3.5" /> Kadroya ekle
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewLeaveModal({ isOpen, onClose, onSave, employees }) {
  const [form, setForm] = useState({
    employeeId: employees[0]?.id || '',
    type: 'yillik',
    startDate: todayISO(),
    endDate: todayISO(),
    reason: ''
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employeeId) return;
    if (!await onSave(form)) return;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="İzin talebi" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Select label="Personel" value={form.employeeId} onChange={set('employeeId')}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
        </Select>
        <Select label="İzin türü" value={form.type} onChange={set('type')}>
          {LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Başlangıç" type="date" value={form.startDate} onChange={set('startDate')} />
          <Input label="Bitiş" type="date" value={form.endDate} onChange={set('endDate')} />
        </div>
        <Textarea label="Gerekçe" value={form.reason} onChange={set('reason')} placeholder="Kısa açıklama" />
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Vazgeç</button>
          <button type="submit" className="btn-primary">
            <Plus className="h-3.5 w-3.5" /> Talebi oluştur
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* form parçaları CRM formlarıyla ortak — bkz. Parts.jsx */
const Input = FormInput;
const Textarea = FormTextarea;
const Select = FormSelect;

