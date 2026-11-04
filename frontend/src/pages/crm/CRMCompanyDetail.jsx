import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Globe,
  ExternalLink,
  Users,
  DollarSign,
  Briefcase,
  CheckSquare,
  FileText,
  Clock,
  ShieldCheck,
  Plus,
  Tag
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMCompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companies, contacts, deals, tasks, setIsQuickCreateOpen, setQuickCreateType } = useCRM();

  const company = companies.find((c) => c.id === id) || companies[0];

  const companyContacts = contacts.filter((c) => c.companyName === company.name || c.companyId === company.id);
  const companyDeals = deals.filter((d) => d.companyName === company.name || d.companyId === company.id);
  const companyTasks = tasks.filter((t) => t.relatedCompany === company.name);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/crm/companies')}
        className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Accounts Directory
      </button>

      {/* Account Header Card */}
      <div className="crm-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-brand-50 border border-brand-500/20 border-brand-500/20 text-brand-500 font-semibold text-2xl flex items-center justify-center shrink-0">
              {company.name.charAt(0)}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
                  {company.name}
                </h1>
                <span className="badge-info font-bold">{company.tier}</span>
                <span className="badge-success font-bold font-mono">HEALTH: {company.healthStatus.toUpperCase()}</span>
              </div>

              <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">{company.description}</p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1 font-mono">
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-brand-500"
                >
                  <Globe className="w-3.5 h-3.5" /> {company.domain}
                </a>
                <span>•</span>
                <span>{company.location}</span>
                <span>•</span>
                <span>{company.employees} employees</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setQuickCreateType('deal');
                setIsQuickCreateOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-3.5 h-3.5" /> New Deal
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Contacts & Deals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Stakeholders & Contacts */}
          <div className="crm-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 border-gray-200">
              <h3 className="font-bold text-sm text-gray-900 text-gray-900">
                Decision Makers & Contacts ({companyContacts.length})
              </h3>
              <button
                onClick={() => {
                  setQuickCreateType('contact');
                  setIsQuickCreateOpen(true);
                }}
                className="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Contact
              </button>
            </div>

            <div className="divide-y divide-border/40 dark:divide-slate-800">
              {companyContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                  className="py-3 flex items-center justify-between text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-white/40 p-2 rounded-lg transition"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={contact.avatar}
                      alt={contact.fullName}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <div>
                      <div className="font-bold text-gray-900 text-gray-900">{contact.fullName}</div>
                      <div className="text-[11px] text-gray-500">{contact.jobTitle}</div>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px]">
                    <div className="text-gray-900 text-gray-500">{contact.email}</div>
                    <div className="text-gray-500">{contact.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Deals with this Company */}
          <div className="crm-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 border-gray-200">
              <h3 className="font-bold text-sm text-gray-900 text-gray-900">
                Sales Opportunities ({companyDeals.length})
              </h3>
            </div>

            <div className="space-y-2.5">
              {companyDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="p-3.5 rounded-lg border border-gray-200/50 border-gray-200 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-gray-900 text-gray-900 text-[13px]">{deal.title}</div>
                    <div className="text-[11px] text-gray-500 font-mono">
                      Stage: {deal.stage.toUpperCase()} • Rep: {deal.salesRep}
                    </div>
                  </div>
                  <div className="font-mono font-semibold text-sm text-gray-900 text-gray-900 tabular-nums">
                    ${Number(deal.value).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Intelligence & Tech Stack */}
        <div className="space-y-6">
          {/* Tech Stack */}
          <div className="crm-card p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 pb-2 border-b border-gray-200/50 border-gray-200 font-mono">
              Detected Tech Stack
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {company.techStack?.map((t, idx) => (
                <span key={idx} className="badge-neutral text-[11px] font-mono font-semibold">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Account Metrics */}
          <div className="crm-card p-5 space-y-3 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 pb-2 border-b border-gray-200/50 border-gray-200 font-mono">
              Account Overview
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Account Owner:</span>
                <span className="font-bold text-gray-900 dark:text-gray-900">{company.accountOwner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Annual Revenue:</span>
                <span className="font-bold text-gray-900 dark:text-gray-900 font-mono">{company.annualRevenue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Open Deal Value:</span>
                <span className="font-bold text-gray-900 dark:text-gray-900 font-mono">
                  ${company.openDealsValue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


