import React, { useMemo, useState } from 'react';
import {
  AlarmClock, Building2, CalendarCheck, Check, CheckCircle2,
  ClipboardList, Handshake, Plus, Trash2
} from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { Dropdown } from '../../ui';
import { Panel, PanelHead, Stat, Avatar, Chip, Empty, trDate } from './Parts';
import { SearchBox } from './CrmSections';

const PRIORITY = {
  urgent: { label: 'Acil', tone: 'red', rank: 0 },
  high: { label: 'Yüksek', tone: 'amber', rank: 1 },
  medium: { label: 'Orta', tone: 'orange', rank: 2 },
  low: { label: 'Düşük', tone: 'slate', rank: 3 }
};

const STATUS = {
  todo: { label: 'Yapılacak', tone: 'slate' },
  in_progress: { label: 'Devam ediyor', tone: 'amber' },
  completed: { label: 'Tamamlandı', tone: 'green' }
};

// Örnek veri seti bu tarihe göre kurgulandı; kalıcılığa geçince Date.now() olur.
const TODAY = '2026-09-10';

const dayDiff = (iso) => {
  if (!iso) return null;
  const a = new Date(`${iso}T00:00:00`);
  const b = new Date(`${TODAY}T00:00:00`);
  if (Number.isNaN(a.getTime())) return null;
  return Math.round((a - b) / 86400000);
};

export default function CrmTasks({ onCreate }) {
  const { tasks, toggleTaskStatus, deleteTask, teamMembers } = useCRM();
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [q, setQ] = useState('');

  const assignees = useMemo(
    () => [...new Set([...tasks.map((t) => t.assignee), ...teamMembers.map((m) => m.name)].filter(Boolean))],
    [tasks, teamMembers]
  );

  const open = tasks.filter((t) => t.status !== 'completed');
  const overdue = open.filter((t) => {
    const d = dayDiff(t.dueDate);
    return d !== null && d < 0;
  });
  const dueToday = open.filter((t) => dayDiff(t.dueDate) === 0);

  const rows = tasks
    .filter((t) => {
      if (status === 'open' && t.status === 'completed') return false;
      if (status !== 'all' && status !== 'open' && t.status !== status) return false;
      if (priority !== 'all' && t.priority !== priority) return false;
      if (assignee !== 'all' && t.assignee !== assignee) return false;
      if (q.trim() && !`${t.title} ${t.relatedCompany || ''} ${t.relatedDeal || ''}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if ((a.status === 'completed') !== (b.status === 'completed')) return a.status === 'completed' ? 1 : -1;
      const pr = (PRIORITY[a.priority]?.rank ?? 9) - (PRIORITY[b.priority]?.rank ?? 9);
      if (pr !== 0) return pr;
      return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
    });

  const dueLabel = (task) => {
    const d = dayDiff(task.dueDate);
    if (d === null) return { text: 'Termin yok', tone: 'slate' };
    if (task.status === 'completed') return { text: trDate(task.dueDate), tone: 'slate' };
    if (d < 0) return { text: `${Math.abs(d)} gün gecikti`, tone: 'red' };
    if (d === 0) return { text: 'Bugün teslim', tone: 'amber' };
    if (d === 1) return { text: 'Yarın', tone: 'amber' };
    return { text: trDate(task.dueDate), tone: 'slate' };
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Açık Görev" value={open.length} detail={`${tasks.length} toplam`} icon={ClipboardList} />
        <Stat label="Bugün Teslim" value={dueToday.length} detail="termin bugün" icon={CalendarCheck} tone={dueToday.length ? 'amber' : 'slate'} />
        <Stat label="Geciken" value={overdue.length} detail="termini geçti" icon={AlarmClock} tone={overdue.length ? 'red' : 'slate'} />
        <Stat label="Tamamlanan" value={tasks.filter((t) => t.status === 'completed').length} detail="bu dönem" icon={CheckCircle2} tone="green" />
      </div>

      <Panel>
        <PanelHead icon={ClipboardList} title="Görevler" subtitle="Kutucuğa tıklayarak tamamlandı işaretleyin">
          <SearchBox value={q} onChange={setQ} placeholder="Görev, şirket veya fırsat…" />
          <Dropdown value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300">
            <option value="open">Açık görevler</option>
            <option value="all">Tümü</option>
            <option value="todo">Yapılacak</option>
            <option value="in_progress">Devam ediyor</option>
            <option value="completed">Tamamlanan</option>
          </Dropdown>
          <Dropdown value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300">
            <option value="all">Tüm öncelikler</option>
            {Object.entries(PRIORITY).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
          </Dropdown>
          <Dropdown value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-700 hover:border-gray-300">
            <option value="all">Herkes</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </Dropdown>
          <button onClick={() => onCreate?.('task')} className="btn-primary">
            <Plus className="h-3.5 w-3.5" /> Yeni görev
          </button>
        </PanelHead>

        <div className="divide-y divide-gray-100">
          {rows.map((t) => {
            const done = t.status === 'completed';
            const due = dueLabel(t);
            const pr = PRIORITY[t.priority] || PRIORITY.medium;
            return (
              <div key={t.id} className="group flex flex-wrap items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50/60">
                <button
                  onClick={() => toggleTaskStatus(t.id)}
                  aria-label={done ? 'Tamamlanmadı işaretle' : 'Tamamlandı işaretle'}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                    done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300 bg-white text-transparent hover:border-brand-400 hover:text-brand-300'
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </button>

                <div className="min-w-0 flex-1">
                  <p className={`text-[12.5px] font-bold ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {t.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                    {t.relatedCompany && (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-gray-400" />{t.relatedCompany}
                      </span>
                    )}
                    {t.relatedDeal && (
                      <span className="inline-flex max-w-[260px] items-center gap-1.5 truncate">
                        <Handshake className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">{t.relatedDeal}</span>
                      </span>
                    )}
                    {(t.tags || []).map((tag) => <Chip key={tag} tone="slate">{tag}</Chip>)}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone={pr.tone}>{pr.label}</Chip>
                  <Chip tone={due.tone}>{due.text}</Chip>
                  <Chip tone={STATUS[t.status]?.tone || 'slate'}>{STATUS[t.status]?.label || t.status}</Chip>
                  <span className="flex items-center gap-1.5">
                    <Avatar name={t.assignee} size={26} />
                    <span className="hidden text-[11.5px] font-semibold text-gray-600 sm:inline">{t.assignee}</span>
                  </span>
                  <button
                    onClick={() => deleteTask(t.id)}
                    title="Görevi sil"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <Empty
              icon={ClipboardList}
              title="Bu filtreye uyan görev yok"
              hint="Filtreleri gevşetin veya yeni bir görev oluşturun."
              action={
                <button onClick={() => onCreate?.('task')} className="btn-primary">
                  <Plus className="h-3.5 w-3.5" /> Yeni görev
                </button>
              }
            />
          )}
        </div>
      </Panel>
    </div>
  );
}
