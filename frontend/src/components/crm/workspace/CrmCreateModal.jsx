import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Handshake, Plus, UserPlus, Users } from 'lucide-react';
import { Modal } from '../../ui';
import { useCRM } from '../../../context/CRMContext';
import { FormInput, FormSelect, FormTextarea } from './Parts';

/**
 * CRM kayıt oluşturma — fırsat, aday, kişi, şirket ve görev.
 *
 * Tüm yazma işlemleri CRMContext üzerinden gider (addDeal, addLead, …).
 * Kalıcılığa geçildiğinde yalnızca context'in içi API çağrısına döner,
 * bu form dosyasına dokunulmaz.
 */

export const CREATE_TYPES = [
  { id: 'deal', label: 'Fırsat', icon: Handshake },
  { id: 'lead', label: 'Aday müşteri', icon: UserPlus },
  { id: 'contact', label: 'Kişi', icon: Users },
  { id: 'company', label: 'Şirket', icon: Building2 },
  { id: 'task', label: 'Görev', icon: Plus }
];

const STAGES = [
  { id: 'qualification', label: 'Niteleme' },
  { id: 'proposal', label: 'Teklif' },
  { id: 'negotiation', label: 'Pazarlık' },
  { id: 'won', label: 'Kazanıldı' },
  { id: 'lost', label: 'Kaybedildi' }
];

const PRIORITIES = [
  { id: 'urgent', label: 'Acil' },
  { id: 'high', label: 'Yüksek' },
  { id: 'medium', label: 'Orta' },
  { id: 'low', label: 'Düşük' }
];

const LEAD_SOURCES = [
  'Doğrudan Web Başvurusu',
  'Tavsiye & Referans',
  'Sektörel Fuar',
  'Soğuk Arama',
  'Ecza Deposu Yönlendirmesi',
  'Mevcut Müşteri Genişlemesi'
];

const BLANK = {
  deal: { title: '', companyId: '', value: '', stage: 'qualification', probability: '50', salesRep: '', expectedCloseDate: '', priority: 'medium', tags: '' },
  lead: { name: '', company: '', jobTitle: '', email: '', phone: '', source: LEAD_SOURCES[0], estimatedValue: '', owner: '', notes: '' },
  contact: { fullName: '', jobTitle: '', companyId: '', email: '', phone: '', location: '', owner: '', tags: '' },
  company: { name: '', domain: '', industry: '', location: '', tier: '', employees: '', annualRevenue: '', accountOwner: '', description: '' },
  task: { title: '', priority: 'medium', assignee: '', dueDate: '', relatedCompany: '', relatedDeal: '', tags: '' }
};

const splitTags = (s) =>
  String(s || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

export default function CrmCreateModal({ isOpen, type, onClose, onCreated }) {
  const { companies, deals, teamMembers, addDeal, addLead, addContact, addCompany, addTask } = useCRM();
  const { flushChanges, saving } = useCRM();
  const [kind, setKind] = useState(type || 'deal');
  const [form, setForm] = useState(BLANK.deal);

  const owners = useMemo(() => teamMembers.map((m) => m.name), [teamMembers]);

  useEffect(() => {
    if (!isOpen) return;
    const next = type || 'deal';
    setKind(next);
    setForm(BLANK[next]);
  }, [isOpen, type]);

  const switchKind = (next) => {
    setKind(next);
    setForm(BLANK[next]);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = {
    deal: () => form.title.trim() && form.value,
    lead: () => form.name.trim() && form.company.trim(),
    contact: () => form.fullName.trim() && form.companyId,
    company: () => form.name.trim(),
    task: () => form.title.trim()
  }[kind]();

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;

    if (kind === 'deal') {
      const company = companies.find((c) => c.id === form.companyId);
      addDeal({
        title: form.title.trim(),
        companyId: form.companyId || null,
        companyName: company ? company.name : 'Bağımsız Fırsat',
        value: Number(form.value) || 0,
        stage: form.stage,
        probability: Number(form.probability) || 50,
        salesRep: form.salesRep || owners[0] || 'Atanmadı',
        expectedCloseDate: form.expectedCloseDate || null,
        priority: form.priority,
        tags: splitTags(form.tags)
      });
    } else if (kind === 'lead') {
      addLead({
        name: form.name.trim(),
        company: form.company.trim(),
        jobTitle: form.jobTitle,
        email: form.email,
        phone: form.phone,
        source: form.source,
        estimatedValue: Number(form.estimatedValue) || 0,
        owner: form.owner || owners[0] || 'Atanmadı',
        notes: form.notes
      });
    } else if (kind === 'contact') {
      const company = companies.find((c) => c.id === form.companyId);
      addContact({
        fullName: form.fullName.trim(),
        jobTitle: form.jobTitle,
        companyId: form.companyId,
        companyName: company ? company.name : '',
        email: form.email,
        phone: form.phone,
        location: form.location,
        owner: form.owner || owners[0] || 'Atanmadı',
        tags: splitTags(form.tags)
      });
    } else if (kind === 'company') {
      addCompany({
        name: form.name.trim(),
        domain: form.domain,
        industry: form.industry,
        location: form.location,
        tier: form.tier || 'Yeni Hesap',
        employees: form.employees,
        annualRevenue: form.annualRevenue,
        accountOwner: form.accountOwner || owners[0] || 'Atanmadı',
        description: form.description,
        techStack: []
      });
    } else if (kind === 'task') {
      addTask({
        title: form.title.trim(),
        priority: form.priority,
        assignee: form.assignee || owners[0] || 'Atanmadı',
        dueDate: form.dueDate || null,
        relatedCompany: form.relatedCompany,
        relatedDeal: form.relatedDeal,
        tags: splitTags(form.tags)
      });
    }

    if (!await flushChanges()) return;
    onCreated?.(kind);
    onClose();
  };

  const activeType = CREATE_TYPES.find((t) => t.id === kind);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Yeni ${activeType?.label.toLocaleLowerCase('tr')}`} size="xl">
      <form onSubmit={submit} className="space-y-4">
        {/* tip seçici */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {CREATE_TYPES.map((t) => {
            const Icon = t.icon;
            const on = kind === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchKind(t.id)}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold transition-all ${
                  on ? 'bg-white text-brand-600 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {kind === 'deal' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput label="Fırsat başlığı" required value={form.title} onChange={set('title')} placeholder="Örn. Selçuk Ecza İTS Entegrasyon Lisansı" />
            </div>
            <FormSelect label="Şirket" value={form.companyId} onChange={set('companyId')}>
              <option value="">Bağımsız fırsat</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FormSelect>
            <FormInput label="Değer (₺)" required type="number" min="0" value={form.value} onChange={set('value')} placeholder="950000" />
            <FormSelect label="Aşama" value={form.stage} onChange={set('stage')}>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </FormSelect>
            <FormInput label="Olasılık (%)" type="number" min="0" max="100" value={form.probability} onChange={set('probability')} />
            <FormSelect label="Temsilci" value={form.salesRep} onChange={set('salesRep')}>
              <option value="">Otomatik ata</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </FormSelect>
            <FormInput label="Beklenen kapanış" type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
            <FormSelect label="Öncelik" value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </FormSelect>
            <FormInput label="Etiketler" value={form.tags} onChange={set('tags')} placeholder="virgülle ayırın" />
          </div>
        )}

        {kind === 'lead' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput label="Ad Soyad" required value={form.name} onChange={set('name')} placeholder="Örn. Ecz. Halil İbrahim" />
            <FormInput label="Kurum" required value={form.company} onChange={set('company')} placeholder="Örn. Deniz Ticaret" />
            <FormInput label="Ünvan" value={form.jobTitle} onChange={set('jobTitle')} placeholder="Mesul Müdür Eczacı" />
            <FormSelect label="Kaynak" value={form.source} onChange={set('source')}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </FormSelect>
            <FormInput label="E-posta" type="email" value={form.email} onChange={set('email')} />
            <FormInput label="Telefon" value={form.phone} onChange={set('phone')} placeholder="+90 (5xx) xxx xx xx" />
            <FormInput label="Tahmini değer (₺)" type="number" min="0" value={form.estimatedValue} onChange={set('estimatedValue')} />
            <FormSelect label="Sorumlu" value={form.owner} onChange={set('owner')}>
              <option value="">Otomatik ata</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </FormSelect>
            <div className="sm:col-span-2">
              <FormTextarea label="Not" value={form.notes} onChange={set('notes')} placeholder="Talep, ihtiyaç, ilk görüşme notu…" />
            </div>
          </div>
        )}

        {kind === 'contact' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput label="Ad Soyad" required value={form.fullName} onChange={set('fullName')} />
            <FormInput label="Ünvan" value={form.jobTitle} onChange={set('jobTitle')} placeholder="Satın Alma Direktörü" />
            <FormSelect label="Şirket" required value={form.companyId} onChange={set('companyId')}>
              <option value="">Seçiniz…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FormSelect>
            <FormSelect label="Sorumlu" value={form.owner} onChange={set('owner')}>
              <option value="">Otomatik ata</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </FormSelect>
            <FormInput label="E-posta" type="email" value={form.email} onChange={set('email')} />
            <FormInput label="Telefon" value={form.phone} onChange={set('phone')} />
            <FormInput label="Konum" value={form.location} onChange={set('location')} placeholder="İstanbul, Türkiye" />
            <FormInput label="Etiketler" value={form.tags} onChange={set('tags')} placeholder="C-Level, Karar Verici" />
          </div>
        )}

        {kind === 'company' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput label="Şirket adı" required value={form.name} onChange={set('name')} />
            <FormInput label="Alan adı" value={form.domain} onChange={set('domain')} placeholder="ornek.com.tr" />
            <FormInput label="Sektör" value={form.industry} onChange={set('industry')} placeholder="İlaç Dağıtım & Lojistik" />
            <FormInput label="Konum" value={form.location} onChange={set('location')} placeholder="İstanbul, TR" />
            <FormInput label="Segment" value={form.tier} onChange={set('tier')} placeholder="Stratejik Ecza Deposu" />
            <FormSelect label="Hesap sorumlusu" value={form.accountOwner} onChange={set('accountOwner')}>
              <option value="">Otomatik ata</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </FormSelect>
            <FormInput label="Çalışan sayısı" value={form.employees} onChange={set('employees')} placeholder="1.200+" />
            <FormInput label="Yıllık ciro" value={form.annualRevenue} onChange={set('annualRevenue')} placeholder="₺8.4 Milyar" />
            <div className="sm:col-span-2">
              <FormTextarea label="Açıklama" value={form.description} onChange={set('description')} />
            </div>
          </div>
        )}

        {kind === 'task' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormInput label="Görev" required value={form.title} onChange={set('title')} placeholder="Örn. İTS webhook testi yapılacak" />
            </div>
            <FormSelect label="Öncelik" value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </FormSelect>
            <FormSelect label="Atanan" value={form.assignee} onChange={set('assignee')}>
              <option value="">Otomatik ata</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </FormSelect>
            <FormInput label="Termin" type="date" value={form.dueDate} onChange={set('dueDate')} />
            <FormSelect label="İlgili şirket" value={form.relatedCompany} onChange={set('relatedCompany')}>
              <option value="">Yok</option>
              {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </FormSelect>
            <FormSelect label="İlgili fırsat" value={form.relatedDeal} onChange={set('relatedDeal')}>
              <option value="">Yok</option>
              {deals.map((d) => <option key={d.id} value={d.title}>{d.title}</option>)}
            </FormSelect>
            <FormInput label="Etiketler" value={form.tags} onChange={set('tags')} placeholder="Teknik Test, İTS" />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Vazgeç</button>
          <button type="submit" disabled={!valid} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Oluştur
          </button>
        </div>
      </form>
    </Modal>
  );
}
