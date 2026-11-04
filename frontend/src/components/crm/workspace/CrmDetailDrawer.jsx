import React from 'react';
import {
  Activity, Building2, ClipboardList, ExternalLink, Globe, Handshake,
  Mail, MapPin, Target, Users
} from 'lucide-react';
import { Drawer } from '../../ui';
import { useCRM } from '../../../context/CRMContext';
import { Avatar, Bar, Chip, Empty, Field, tl, trDate } from './Parts';

const STAGE_LABEL = {
  qualification: 'Niteleme',
  proposal: 'Teklif',
  negotiation: 'Pazarlık',
  won: 'Kazanıldı',
  lost: 'Kaybedildi'
};
const STAGE_TONE = {
  qualification: 'slate',
  proposal: 'amber',
  negotiation: 'orange',
  won: 'green',
  lost: 'red'
};

const HEALTH = {
  champion: { label: 'Stratejik', tone: 'green' },
  healthy: { label: 'Sağlıklı', tone: 'orange' },
  at_risk: { label: 'Riskli', tone: 'red' }
};

function Section({ icon: Icon, title, children, right }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
        <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">{title}</h4>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function DealRow({ deal }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3.5 shadow-2xs">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-gray-900">{deal.title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Chip tone={STAGE_TONE[deal.stage]}>{STAGE_LABEL[deal.stage] || deal.stage}</Chip>
          <span className="text-[11px] font-semibold text-gray-500">{deal.salesRep}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Bar value={deal.probability} tone={deal.stage === 'won' ? '#10B981' : '#426b9c'} />
          <span className="w-9 text-right text-[10.5px] font-bold tabular-nums text-gray-500">%{deal.probability}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-semibold tabular-nums text-gray-900">{tl(deal.value)}</div>
        <div className="mt-0.5 text-[10.5px] font-semibold tabular-nums text-gray-400">{trDate(deal.expectedCloseDate)}</div>
      </div>
    </div>
  );
}

/** Kişi detayı */
export function ContactDrawer({ contactId, onClose }) {
  const { contacts, companies, deals, tasks, activities } = useCRM();
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) return null;

  const company = companies.find((c) => c.id === contact.companyId);
  const relatedDeals = deals.filter((d) => d.companyId === contact.companyId);
  const relatedTasks = tasks.filter((t) => t.relatedCompany === contact.companyName);
  const relatedActivities = activities.filter((a) => a.relatedObject === contact.companyName);

  return (
    <Drawer isOpen={!!contact} onClose={onClose} title="Kişi kartı" size="xl">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Avatar name={contact.fullName} size={56} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900">{contact.fullName}</h3>
            <p className="mt-0.5 text-[12.5px] font-semibold text-gray-500">{contact.jobTitle}</p>
            <p className="mt-0.5 text-[12px] font-bold text-brand-600">{contact.companyName}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="orange">{contact.contactStatus}</Chip>
              {(contact.tags || []).map((t) => <Chip key={t} tone="slate">{t}</Chip>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Skor</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{contact.leadScore}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fırsat</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{contact.dealsCount}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Toplam</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{tl(contact.totalDealValue)}</div>
          </div>
        </div>

        <Section icon={Mail} title="İletişim">
          <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <Field label="E-posta" value={contact.email} />
            <Field label="Telefon" value={contact.phone} mono />
            <Field label="Konum" value={contact.location} />
            <Field label="Hesap sorumlusu" value={contact.owner} />
            <Field label="Son temas" value={contact.lastContacted} />
            <Field label="Kayıt tarihi" value={trDate(contact.createdDate)} mono />
          </dl>
        </Section>

        {company && (
          <Section icon={Building2} title="Bağlı şirket">
            <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3.5 shadow-2xs">
              <Avatar name={company.name} size={36} tone="#0EA5E9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-gray-900">{company.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-500">{company.industry} · {company.location}</p>
              </div>
              <Chip tone={HEALTH[company.healthStatus]?.tone}>{HEALTH[company.healthStatus]?.label}</Chip>
            </div>
          </Section>
        )}

        <Section icon={Handshake} title={`İlgili fırsatlar (${relatedDeals.length})`}>
          <div className="space-y-2.5">
            {relatedDeals.map((d) => <DealRow key={d.id} deal={d} />)}
            {relatedDeals.length === 0 && <p className="text-[12px] text-gray-500">Bu hesapta açık fırsat yok.</p>}
          </div>
        </Section>

        {relatedTasks.length > 0 && (
          <Section icon={ClipboardList} title={`Açık görevler (${relatedTasks.length})`}>
            <div className="space-y-2">
              {relatedTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-gray-800">{t.title}</span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gray-500">{trDate(t.dueDate)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {relatedActivities.length > 0 && (
          <Section icon={Activity} title="Geçmiş">
            <div className="space-y-3 border-l-2 border-gray-100 pl-4">
              {relatedActivities.map((a) => (
                <div key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-400" />
                  <p className="text-[12px] font-bold text-gray-900">{a.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-gray-500">{a.description}</p>
                  <p className="mt-1 text-[10.5px] font-semibold text-gray-400">{a.user} · {a.timestamp}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Drawer>
  );
}

/** Şirket detayı */
export function CompanyDrawer({ companyId, onClose, onOpenContact }) {
  const { companies, contacts, deals, activities } = useCRM();
  const company = companies.find((c) => c.id === companyId);
  if (!company) return null;

  const people = contacts.filter((c) => c.companyId === company.id);
  const relatedDeals = deals.filter((d) => d.companyId === company.id);
  const openValue = relatedDeals
    .filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    .reduce((s, d) => s + Number(d.value || 0), 0);
  const wonValue = relatedDeals.filter((d) => d.stage === 'won').reduce((s, d) => s + Number(d.value || 0), 0);
  const relatedActivities = activities.filter((a) => a.relatedObject === company.name);
  const health = HEALTH[company.healthStatus] || HEALTH.healthy;

  return (
    <Drawer isOpen={!!company} onClose={onClose} title="Şirket kartı" size="xl">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Avatar name={company.name} size={56} tone="#0EA5E9" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900">{company.name}</h3>
            <p className="mt-0.5 text-[12.5px] font-semibold text-gray-500">{company.industry}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone={health.tone}>{health.label}</Chip>
              <Chip tone="slate">{company.tier}</Chip>
            </div>
          </div>
        </div>

        {company.description && (
          <p className="text-[12.5px] leading-relaxed text-gray-600">{company.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Açık fırsat</div>
            <div className="mt-1 text-[17px] font-bold tabular-nums text-gray-900">{tl(openValue)}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Kazanılan</div>
            <div className="mt-1 text-[17px] font-bold tabular-nums text-emerald-600">{tl(wonValue)}</div>
          </div>
        </div>

        <Section icon={Target} title="Hesap künyesi">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
            <Field label="Hesap sorumlusu" value={company.accountOwner} />
            <Field label="Çalışan" value={company.employees} mono />
            <Field label="Yıllık ciro" value={company.annualRevenue} mono />
            <Field label="Konum" value={company.location} />
            <Field label="Alan adı" value={company.domain} />
            <Field label="Kayıt" value={trDate(company.createdDate)} mono />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px] font-semibold">
            {company.website && (
              <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Web sitesi
              </a>
            )}
            {company.linkedin && (
              <a href={company.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
              </a>
            )}
            {company.location && (
              <span className="inline-flex items-center gap-1.5 text-gray-500">
                <MapPin className="h-3.5 w-3.5" /> {company.location}
              </span>
            )}
          </div>
        </Section>

        {(company.techStack || []).length > 0 && (
          <Section title="Teknoloji altyapısı">
            <div className="flex flex-wrap gap-1.5">
              {company.techStack.map((t) => <Chip key={t} tone="violet">{t}</Chip>)}
            </div>
          </Section>
        )}

        <Section icon={Users} title={`Yetkili kişiler (${people.length})`}>
          <div className="space-y-2.5">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenContact?.(p.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-100 bg-white p-3.5 text-left shadow-2xs transition-colors hover:border-brand-200"
              >
                <Avatar name={p.fullName} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-gray-900">{p.fullName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">{p.jobTitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-semibold text-gray-500">Skor</div>
                  <div className="text-[13px] font-semibold tabular-nums text-gray-900">{p.leadScore}</div>
                </div>
              </button>
            ))}
            {people.length === 0 && <Empty icon={Users} title="Bu hesapta kayıtlı kişi yok" />}
          </div>
        </Section>

        <Section icon={Handshake} title={`Fırsatlar (${relatedDeals.length})`}>
          <div className="space-y-2.5">
            {relatedDeals.map((d) => <DealRow key={d.id} deal={d} />)}
            {relatedDeals.length === 0 && <p className="text-[12px] text-gray-500">Kayıtlı fırsat yok.</p>}
          </div>
        </Section>

        {relatedActivities.length > 0 && (
          <Section icon={Activity} title="Geçmiş">
            <div className="space-y-3 border-l-2 border-gray-100 pl-4">
              {relatedActivities.map((a) => (
                <div key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-400" />
                  <p className="text-[12px] font-bold text-gray-900">{a.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-gray-500">{a.description}</p>
                  <p className="mt-1 text-[10.5px] font-semibold text-gray-400">{a.user} · {a.timestamp}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Drawer>
  );
}
