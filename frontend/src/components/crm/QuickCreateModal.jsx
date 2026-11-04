import { Dropdown } from '../ui';
﻿import React, { useState } from 'react';
import {
  X,
  DollarSign,
  UserPlus,
  Users,
  CheckSquare,
  Building2,
  Calendar,
  Tag,
  AlertCircle
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function QuickCreateModal() {
  const {
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    quickCreateType,
    setQuickCreateType,
    companies,
    contacts,
    deals,
    teamMembers,
    addDeal,
    addLead,
    addContact,
    addTask
  } = useCRM();

  // Deal Form
  const [dealForm, setDealForm] = useState({
    title: '',
    companyId: companies[0]?.id || '',
    contactName: '',
    value: 50000,
    stage: 'qualified',
    salesRep: teamMembers[0]?.name || 'Sarah Jenkins',
    expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    priority: 'high',
    tags: 'Enterprise, Annual Prepay'
  });

  // Lead Form
  const [leadForm, setLeadForm] = useState({
    name: '',
    company: '',
    jobTitle: '',
    email: '',
    phone: '',
    source: 'Inbound Demo Request',
    estimatedValue: 60000,
    owner: teamMembers[0]?.name || 'Sarah Jenkins',
    notes: ''
  });

  // Contact Form
  const [contactForm, setContactForm] = useState({
    fullName: '',
    jobTitle: '',
    companyId: companies[0]?.id || '',
    email: '',
    phone: '',
    tags: 'Decision Maker, C-Level'
  });

  // Task Form
  const [taskForm, setTaskForm] = useState({
    title: '',
    priority: 'high',
    assignee: teamMembers[0]?.name || 'Sarah Jenkins',
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    relatedDeal: deals[0]?.title || '',
    tags: 'Follow-up'
  });

  if (!isQuickCreateOpen) return null;

  const handleCreateDeal = (e) => {
    e.preventDefault();
    if (!dealForm.title) return;
    const selectedComp = companies.find((c) => c.id === dealForm.companyId);
    addDeal({
      ...dealForm,
      companyName: selectedComp?.name || 'Enterprise Account',
      companyLogo: selectedComp?.logo || null,
      value: Number(dealForm.value) || 0,
      tags: dealForm.tags.split(',').map((t) => t.trim())
    });
    setIsQuickCreateOpen(false);
  };

  const handleCreateLead = (e) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.company) return;
    addLead({
      ...leadForm,
      estimatedValue: Number(leadForm.estimatedValue) || 0
    });
    setIsQuickCreateOpen(false);
  };

  const handleCreateContact = (e) => {
    e.preventDefault();
    if (!contactForm.fullName) return;
    const selectedComp = companies.find((c) => c.id === contactForm.companyId);
    addContact({
      ...contactForm,
      companyName: selectedComp?.name || '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      tags: contactForm.tags.split(',').map((t) => t.trim())
    });
    setIsQuickCreateOpen(false);
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskForm.title) return;
    addTask({
      ...taskForm,
      tags: taskForm.tags.split(',').map((t) => t.trim())
    });
    setIsQuickCreateOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-gray-100 border border-gray-200/50 border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50 border-gray-200 bg-gray-100/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-white rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setQuickCreateType('deal')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                quickCreateType === 'deal'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 text-gray-900 shadow-xs'
                  : 'text-gray-500 text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Deal
            </button>

            <button
              type="button"
              onClick={() => setQuickCreateType('lead')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                quickCreateType === 'lead'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 text-gray-900 shadow-xs'
                  : 'text-gray-500 text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Lead
            </button>

            <button
              type="button"
              onClick={() => setQuickCreateType('contact')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                quickCreateType === 'contact'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 text-gray-900 shadow-xs'
                  : 'text-gray-500 text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Contact
            </button>

            <button
              type="button"
              onClick={() => setQuickCreateType('task')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                quickCreateType === 'task'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 text-gray-900 shadow-xs'
                  : 'text-gray-500 text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" /> Task
            </button>
          </div>

          <button
            onClick={() => setIsQuickCreateOpen(false)}
            className="p-1 text-gray-500 hover:text-gray-500 dark:hover:text-gray-900 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* DEAL FORM */}
          {quickCreateType === 'deal' && (
            <form onSubmit={handleCreateDeal} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Deal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise License Expansion (500 seats)"
                  value={dealForm.title}
                  onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
                  className="w-full crm-input"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Company *</label>
                  <Dropdown
                    value={dealForm.companyId}
                    onChange={(e) => setDealForm({ ...dealForm, companyId: e.target.value })}
                    className="w-full crm-input"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Dropdown>
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Deal Value ($) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={dealForm.value}
                    onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
                    className="w-full crm-input tabular-nums font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Pipeline Stage</label>
                  <Dropdown
                    value={dealForm.stage}
                    onChange={(e) => setDealForm({ ...dealForm, stage: e.target.value })}
                    className="w-full crm-input"
                  >
                    <option value="new_lead">New Lead (25%)</option>
                    <option value="qualified">Qualified (45%)</option>
                    <option value="proposal">Proposal Sent (65%)</option>
                    <option value="negotiation">Negotiation (85%)</option>
                    <option value="won">Closed Won (100%)</option>
                    <option value="lost">Closed Lost (0%)</option>
                  </Dropdown>
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Assigned Sales Rep</label>
                  <Dropdown
                    value={dealForm.salesRep}
                    onChange={(e) => setDealForm({ ...dealForm, salesRep: e.target.value })}
                    className="w-full crm-input"
                  >
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.role.split(' ')[0]})
                      </option>
                    ))}
                  </Dropdown>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Expected Close Date</label>
                  <input
                    type="date"
                    value={dealForm.expectedCloseDate}
                    onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                    className="w-full crm-input font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Priority</label>
                  <Dropdown
                    value={dealForm.priority}
                    onChange={(e) => setDealForm({ ...dealForm, priority: e.target.value })}
                    className="w-full crm-input"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Dropdown>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Tags (Comma separated)</label>
                <input
                  type="text"
                  placeholder="Enterprise, SOC2, Multi-Year"
                  value={dealForm.tags}
                  onChange={(e) => setDealForm({ ...dealForm, tags: e.target.value })}
                  className="w-full crm-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200/50 border-gray-200">
                <button type="button" onClick={() => setIsQuickCreateOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Opportunity
                </button>
              </div>
            </form>
          )}

          {/* LEAD FORM */}
          {quickCreateType === 'lead' && (
            <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Lead Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Mercer"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="w-full crm-input"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Cloud Corp"
                    value={leadForm.company}
                    onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                    className="w-full crm-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="alex@acme.com"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    className="w-full crm-input font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full crm-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Lead Source</label>
                  <Dropdown
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="w-full crm-input"
                  >
                    <option value="Inbound Demo Request">Inbound Demo Request</option>
                    <option value="Referral - Partner">Referral - Partner</option>
                    <option value="LinkedIn Campaign">LinkedIn Campaign</option>
                    <option value="Product Hunt Launch">Product Hunt Launch</option>
                    <option value="Organic Search">Organic Search</option>
                    <option value="Cold Outreach">Cold Outreach</option>
                  </Dropdown>
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Estimated Value ($)</label>
                  <input
                    type="number"
                    value={leadForm.estimatedValue}
                    onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: e.target.value })}
                    className="w-full crm-input tabular-nums font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Notes / Qualification Intent</label>
                <textarea
                  rows={2}
                  placeholder="Specific requirements, migration timeline, decision criteria..."
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  className="w-full crm-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200/50 border-gray-200">
                <button type="button" onClick={() => setIsQuickCreateOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Lead
                </button>
              </div>
            </form>
          )}

          {/* CONTACT FORM */}
          {quickCreateType === 'contact' && (
            <form onSubmit={handleCreateContact} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Katherine Pierce"
                    value={contactForm.fullName}
                    onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                    className="w-full crm-input"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. VP Engineering"
                    value={contactForm.jobTitle}
                    onChange={(e) => setContactForm({ ...contactForm, jobTitle: e.target.value })}
                    className="w-full crm-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Company</label>
                  <Dropdown
                    value={contactForm.companyId}
                    onChange={(e) => setContactForm({ ...contactForm, companyId: e.target.value })}
                    className="w-full crm-input"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Dropdown>
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="katherine@company.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full crm-input font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Tags (Comma separated)</label>
                <input
                  type="text"
                  placeholder="Decision Maker, Technical Lead, Security"
                  value={contactForm.tags}
                  onChange={(e) => setContactForm({ ...contactForm, tags: e.target.value })}
                  className="w-full crm-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200/50 border-gray-200">
                <button type="button" onClick={() => setIsQuickCreateOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Contact
                </button>
              </div>
            </form>
          )}

          {/* TASK FORM */}
          {quickCreateType === 'task' && (
            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prepare Security Architecture Deck for InfoSec"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full crm-input"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Assignee</label>
                  <Dropdown
                    value={taskForm.assignee}
                    onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                    className="w-full crm-input"
                  >
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </Dropdown>
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full crm-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Priority</label>
                  <Dropdown
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full crm-input"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Dropdown>
                </div>

                <div>
                  <label className="block font-semibold text-gray-900 text-gray-500 mb-1">Related Deal</label>
                  <Dropdown
                    value={taskForm.relatedDeal}
                    onChange={(e) => setTaskForm({ ...taskForm, relatedDeal: e.target.value })}
                    className="w-full crm-input"
                  >
                    <option value="">None / General</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.title}>
                        {d.title}
                      </option>
                    ))}
                  </Dropdown>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200/50 border-gray-200">
                <button type="button" onClick={() => setIsQuickCreateOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


