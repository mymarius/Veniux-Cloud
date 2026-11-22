import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../api/client';
import { useToast } from '../components/Toast';
import { Modal, Input } from '../components/ui';
import { AlertTriangle, CheckCircle2, Clock, ListTodo, Plus, Trash2, Pencil } from 'lucide-react';

const STATUS = { open: 'Açık', doing: 'Yapılıyor', done: 'Bitti' };
const PRIORITY = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };
const PRIORITY_CLASS = { low: 'bg-slate-100 text-slate-600', normal: 'bg-sky-50 text-sky-700', high: 'bg-amber-100 text-amber-800', urgent: 'bg-red-100 text-red-700' };
const EMPTY = { title: '', description: '', assignee_id: '', due_date: '', priority: 'normal' };
const fmtDate = d => (d ? d.split('-').reverse().join('.') : 'Vade yok');

export default function BusinessTasks() {
  const { showToast } = useToast();
  const [data, setData] = useState({ tasks: [], summary: { open: 0, doing: 0, done: 0, overdue: 0 }, can_manage: false });
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('active');
  const [assignee, setAssignee] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      if (assignee) params.assignee = assignee;
      setData((await apiClient.get('/tasks', { params })).data);
    } catch (e) {
      showToast(e.response?.data?.error || 'Görevler yüklenemedi.', 'error');
    } finally { setLoading(false); }
  }, [filter, assignee, showToast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data.can_manage && !people.length) apiClient.get('/tasks/assignees').then(r => setPeople(r.data)).catch(() => {}); }, [data.can_manage, people.length]);

  const names = useMemo(() => Object.fromEntries(people.map(p => [p.id, p.name])), [people]);

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const body = { title: form.title, description: form.description, assignee_id: form.assignee_id === '' ? null : Number(form.assignee_id), due_date: form.due_date || null, priority: form.priority };
    try {
      if (form.id) await apiClient.put('/tasks/' + form.id, body); else await apiClient.post('/tasks', body);
      showToast(form.id ? 'Görev güncellendi.' : 'Görev atandı.', 'success');
      setForm(null); load();
    } catch (e) { showToast(e.response?.data?.error || 'Görev kaydedilemedi.', 'error'); }
    finally { setSaving(false); }
  };
  const move = async (task, status) => {
    try { await apiClient.patch(`/tasks/${task.id}/status`, { status }); load(); }
    catch (e) { showToast(e.response?.data?.error || 'Durum değiştirilemedi.', 'error'); }
  };
  const remove = async task => {
    if (!window.confirm('"' + task.title + '" görevi silinsin mi?')) return;
    try { await apiClient.delete('/tasks/' + task.id); load(); }
    catch (e) { showToast(e.response?.data?.error || 'Görev silinemedi.', 'error'); }
  };

  const s = data.summary;
  return (
    <div className="space-y-4" data-testid="business-tasks">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ListTodo className="w-5 h-5" /> {data.can_manage ? 'İşletme görevleri' : 'Görevlerim'}</h1>
          <p className="text-sm text-slate-500">{data.can_manage ? 'Ekibe görev atayın, vadesi geçenleri takip edin.' : 'Size atanan görevler. Başlayınca "Yapılıyor", bitince "Bitti" yapın.'}</p>
        </div>
        {data.can_manage && <button type="button" className="btn-primary inline-flex items-center gap-1" onClick={() => setForm({ ...EMPTY })}><Plus className="w-4 h-4" /> Yeni görev</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="veniux-card p-3"><div className="text-slate-500">Açık</div><div className="text-2xl font-bold">{s.open}</div></div>
        <div className="veniux-card p-3"><div className="text-slate-500">Yapılıyor</div><div className="text-2xl font-bold">{s.doing}</div></div>
        <div className={'veniux-card p-3 ' + (s.overdue ? 'border-red-300 bg-red-50' : '')}><div className="text-slate-500 flex items-center gap-1">{s.overdue ? <AlertTriangle className="w-4 h-4 text-red-600" /> : null} Vadesi geçen</div><div className={'text-2xl font-bold ' + (s.overdue ? 'text-red-700' : '')}>{s.overdue}</div></div>
        <div className="veniux-card p-3"><div className="text-slate-500">Biten</div><div className="text-2xl font-bold">{s.done}</div></div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {[['active', 'Yapılacaklar'], ['done', 'Biten'], ['', 'Tümü']].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={filter === v} className={filter === v ? 'btn-primary' : 'btn-secondary'} onClick={() => { setLoading(true); setFilter(v); }}>{l}</button>
        ))}
        {data.can_manage && (
          <select aria-label="Kişiye göre" className="border rounded p-2 text-sm" value={assignee} onChange={e => { setLoading(true); setAssignee(e.target.value); }}>
            <option value="">Herkes</option><option value="me">Bana atananlar</option><option value="none">Atanmamış</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {loading ? <p className="text-sm text-slate-500">Yükleniyor…</p> : data.tasks.length === 0 ? (
        <div className="veniux-card p-8 text-center text-slate-500">{filter === 'active' ? 'Yapılacak görev yok.' : 'Görev bulunamadı.'}</div>
      ) : (
        <ul className="space-y-2">
          {data.tasks.map(t => (
            <li key={t.id} data-testid="task-row" data-overdue={t.overdue ? '1' : '0'} className={'veniux-card p-3 flex flex-wrap items-start justify-between gap-3 ' + (t.overdue ? 'border-red-400 bg-red-50' : '')}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={'font-semibold ' + (t.status === 'done' ? 'line-through text-slate-400' : '')}>{t.title}</span>
                  <span className={'text-xs px-2 py-0.5 rounded-full ' + PRIORITY_CLASS[t.priority]}>{PRIORITY[t.priority]}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{STATUS[t.status]}</span>
                  {t.overdue && <span className="text-xs font-bold text-red-700 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Vadesi geçti</span>}
                </div>
                {t.description && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{t.description}</p>}
                <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-3"><span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {fmtDate(t.due_date)}</span>{data.can_manage && <span>{t.assignee_name || names[t.assignee_id] || 'Atanmamış'}</span>}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {t.status === 'open' && <button type="button" className="btn-secondary" onClick={() => move(t, 'doing')}>Başla</button>}
                {t.status !== 'done' && <button type="button" className="btn-primary inline-flex items-center gap-1" onClick={() => move(t, 'done')}><CheckCircle2 className="w-4 h-4" /> Bitti</button>}
                {t.status === 'done' && data.can_manage && <button type="button" className="btn-secondary" onClick={() => move(t, 'open')}>Yeniden aç</button>}
                {data.can_manage && <button type="button" aria-label="Düzenle" className="btn-secondary" onClick={() => setForm({ id: t.id, title: t.title, description: t.description, assignee_id: t.assignee_id ?? '', due_date: t.due_date || '', priority: t.priority })}><Pencil className="w-4 h-4" /></button>}
                {data.can_manage && <button type="button" aria-label="Sil" className="btn-secondary" onClick={() => remove(t)}><Trash2 className="w-4 h-4" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.id ? 'Görevi düzenle' : 'Yeni görev'} size="md">
        {form && (
          <form onSubmit={save} className="space-y-3">
            <Input label="Başlık" required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <label className="block text-sm">Açıklama<textarea className="border rounded p-2 w-full" rows={3} maxLength={4000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Atanan kişi<select className="border rounded p-2 w-full" value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}><option value="">Atanmamış</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="block text-sm">Öncelik<select className="border rounded p-2 w-full" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            </div>
            <Input type="date" label="Vade" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setForm(null)}>Vazgeç</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
