import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
  CheckSquare,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  Plus,
  Send,
  MessageSquare,
  Video,
  Edit,
  Tag,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contacts, deals, tasks, activities, logActivity, setIsQuickCreateOpen, setQuickCreateType } = useCRM();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'activities' | 'emails' | 'deals' | 'tasks' | 'notes'
  const [noteInput, setNoteInput] = useState('');
  const [notesList, setNotesList] = useState([
    { id: 'n1', text: 'Confirmed Q4 budget allocation with CFO. Technical POC passed all benchmarks.', date: 'Yesterday at 14:20', author: 'Sarah Jenkins' },
    { id: 'n2', text: 'Requested 3 custom webhook endpoints for internal event logging.', date: '3 days ago', author: 'Sarah Jenkins' }
  ]);

  const contact = contacts.find((c) => c.id === id) || contacts[0];

  const contactDeals = deals.filter(
    (d) => d.contactId === contact.id || d.companyName === contact.companyName
  );

  const contactTasks = tasks.filter(
    (t) => t.relatedContact === contact.fullName || t.relatedCompany === contact.companyName
  );

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const newNote = {
      id: `note-${Date.now()}`,
      text: noteInput,
      date: 'Just now',
      author: 'Sarah Jenkins'
    };
    setNotesList([newNote, ...notesList]);
    logActivity({
      type: 'note',
      title: `Added Note on ${contact.fullName}`,
      description: noteInput,
      relatedObject: contact.fullName,
      badgeColor: 'neutral'
    });
    setNoteInput('');
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/crm/contacts')}
        className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Contacts Directory
      </button>

      {/* Profile Header Card */}
      <div className="crm-card p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={contact.avatar}
              alt={contact.fullName}
              className="w-16 h-16 rounded-xl object-cover ring-2 ring-slate-200 dark:ring-slate-700 shadow-md"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
                  {contact.fullName}
                </h1>
                <span className="badge-info font-bold">{contact.contactStatus}</span>
                <span className="badge-success font-mono font-bold">Score: {contact.leadScore}/100</span>
              </div>

              <div className="text-sm font-semibold text-gray-500 text-gray-500 flex items-center gap-2">
                <span>{contact.jobTitle}</span>
                <span>•</span>
                <span className="text-brand-500 dark:text-brand-500 font-bold">{contact.companyName}</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1 font-mono">
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-brand-500">
                  <Mail className="w-3.5 h-3.5" /> {contact.email}
                </a>
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 hover:text-brand-500">
                  <Phone className="w-3.5 h-3.5" /> {contact.phone}
                </a>
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> {contact.location}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                logActivity({
                  type: 'email',
                  title: `Drafted Email to ${contact.fullName}`,
                  description: 'Outreach regarding quarterly pipeline check-in.',
                  relatedObject: contact.fullName,
                  badgeColor: 'neutral'
                });
                alert(`Opening mail client to ${contact.email}`);
              }}
              className="btn-secondary"
            >
              <Mail className="w-3.5 h-3.5" /> Send Email
            </button>

            <button
              onClick={() => {
                logActivity({
                  type: 'call',
                  title: `Logged Call with ${contact.fullName}`,
                  description: 'Call connected via Zoom Phone integration.',
                  relatedObject: contact.fullName,
                  badgeColor: 'warning'
                });
                alert(`Initiating VoIP call to ${contact.phone}`);
              }}
              className="btn-secondary"
            >
              <Phone className="w-3.5 h-3.5 text-gray-500" /> Log Call
            </button>

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

        {/* Profile Tabs */}
        <div className="flex items-center gap-2 border-t border-gray-200/50 border-gray-200 pt-4 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'activities', label: 'Timeline & History' },
            { id: 'deals', label: `Deals (${contactDeals.length})` },
            { id: 'tasks', label: `Tasks (${contactTasks.length})` },
            { id: 'notes', label: `Notes (${notesList.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-md transition ${
                activeTab === tab
                  ? 'bg-gray-100 dark:bg-gray-100 text-white dark:text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content & Intelligence Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tab Views (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="crm-card p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Opportunity</span>
                  <div className="text-xl font-semibold text-gray-900 text-gray-900 font-mono tabular-nums">
                    ${contact.totalDealValue?.toLocaleString() || 0}
                  </div>
                  <span className="text-[10.5px] text-emerald-600 font-bold">{contactDeals.length} active deals</span>
                </div>

                <div className="crm-card p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Lead Score</span>
                  <div className="text-xl font-semibold text-brand-500 font-mono tabular-nums">
                    {contact.leadScore} / 100
                  </div>
                  <span className="text-[10.5px] text-gray-500">High buying authority</span>
                </div>

                <div className="crm-card p-4 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Account Owner</span>
                  <div className="text-base font-bold text-gray-900 text-gray-900 truncate">
                    {contact.owner}
                  </div>
                  <span className="text-[10.5px] text-gray-500">Assigned AE</span>
                </div>
              </div>

              {/* Associated Deals */}
              <div className="crm-card p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 border-gray-200">
                  <h3 className="font-bold text-sm text-gray-900 text-gray-900">Active Deals & Opportunities</h3>
                  <button
                    onClick={() => {
                      setQuickCreateType('deal');
                      setIsQuickCreateOpen(true);
                    }}
                    className="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Deal
                  </button>
                </div>

                <div className="divide-y divide-border/40 dark:divide-slate-800">
                  {contactDeals.map((deal) => (
                    <div key={deal.id} className="py-3 flex items-center justify-between text-xs gap-3">
                      <div>
                        <div className="font-bold text-gray-900 text-gray-900">{deal.title}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          Expected Close: {deal.expectedCloseDate} • Stage: {deal.stage}
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
          )}

          {/* TAB 2: ACTIVITIES / TIMELINE */}
          {activeTab === 'activities' && (
            <div className="crm-card p-5 space-y-4">
              <h3 className="font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
                Interaction History & Automated Events
              </h3>

              <div className="space-y-4 pt-2">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3.5 text-xs">
                    <div className="w-8 h-8 rounded-full bg-brand-500/10 dark:bg-blue-900/30 text-brand-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {act.user.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-gray-900">{act.title}</span>
                        <span className="text-[10.5px] font-mono text-gray-500">{act.timestamp}</span>
                      </div>
                      <p className="text-gray-500 text-gray-500 text-[11.5px] leading-relaxed">{act.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DEALS */}
          {activeTab === 'deals' && (
            <div className="crm-card p-5 space-y-4">
              <h3 className="font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
                Pipeline Deals ({contactDeals.length})
              </h3>
              <div className="space-y-3">
                {contactDeals.map((deal) => (
                  <div key={deal.id} className="p-3.5 rounded-lg border border-gray-200/50 border-gray-200 bg-gray-100/50 dark:bg-gray-100/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-gray-900 text-[13px]">{deal.title}</span>
                      <span className="font-mono font-semibold text-sm text-gray-900 text-gray-900 tabular-nums">
                        ${Number(deal.value).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-500 font-mono text-[11px]">
                      <span>Stage: {deal.stage.toUpperCase()}</span>
                      <span>Probability: {deal.probability}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TASKS */}
          {activeTab === 'tasks' && (
            <div className="crm-card p-5 space-y-4">
              <h3 className="font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
                Assigned Follow-ups & Deliverables
              </h3>
              <div className="space-y-2.5">
                {contactTasks.map((t) => (
                  <div key={t.id} className="p-3 rounded-lg border border-gray-200/50 border-gray-200 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-gray-900 text-gray-900">{t.title}</div>
                      <div className="text-[11px] text-gray-500 font-mono">Due: {t.dueDate} • Assignee: {t.assignee}</div>
                    </div>
                    <span className="badge-warning uppercase font-mono text-[10px] font-bold">{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: NOTES */}
          {activeTab === 'notes' && (
            <div className="crm-card p-5 space-y-4">
              <h3 className="font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
                Internal Account Notes
              </h3>

              {/* Note Creator */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={3}
                  placeholder="Add a call note, meeting takeaway or strategy remark..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full crm-input text-xs"
                />
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary text-xs">
                    <Plus className="w-3.5 h-3.5" /> Save Note
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="divide-y divide-border/40 dark:divide-slate-800 pt-2">
                {notesList.map((note) => (
                  <div key={note.id} className="py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-gray-500 font-mono text-[10.5px]">
                      <span>{note.author}</span>
                      <span>{note.date}</span>
                    </div>
                    <p className="text-gray-900 text-gray-500 leading-relaxed text-[12px]">{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Context Intelligence Panel (1 Col) */}
        <div className="space-y-6">
          {/* Company Context */}
          <div className="crm-card p-5 space-y-3.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 pb-2 border-b border-gray-200/50 border-gray-200 font-mono">
              Company Intelligence
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-500/20 text-brand-500 flex items-center justify-center font-bold text-sm">
                {contact.companyName.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-gray-900 text-gray-900 text-sm">{contact.companyName}</div>
                <div className="text-[11px] text-gray-500 font-mono">Enterprise Tier 1</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 text-xs border-t border-gray-200/50 border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500">Industry:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-900">Financial Infrastructure</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Headcount:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-900 font-mono">7,000+ employees</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Annual Rev:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-900 font-mono">$14.2B</span>
              </div>
            </div>
          </div>

          {/* Tags & Custom Fields */}
          <div className="crm-card p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 pb-2 border-b border-gray-200/50 border-gray-200 font-mono">
              Tags & Segments
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags?.map((t, idx) => (
                <span key={idx} className="badge-neutral text-[10.5px] font-semibold">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


