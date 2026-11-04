import { Dropdown } from '../../components/ui';
﻿import React, { useState } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  CheckSquare,
  Square,
  Trash2,
  Mail,
  Phone,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Zap,
  Tag
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMLeads() {
  const { leads, addLead, updateLeadStatus, deleteLead, setIsQuickCreateOpen, setQuickCreateType } = useCRM();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [savedView, setSavedView] = useState('all'); // 'all' | 'high_score' | 'inbound' | 'uncontacted'
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Filtering Logic
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !searchQuery ||
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;

    let matchesSavedView = true;
    if (savedView === 'high_score') matchesSavedView = lead.score >= 80;
    if (savedView === 'inbound') matchesSavedView = lead.source.includes('Inbound');
    if (savedView === 'uncontacted') matchesSavedView = lead.status === 'new';

    return matchesSearch && matchesStatus && matchesSource && matchesSavedView;
  });

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelectLead = (id) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    selectedLeadIds.forEach((id) => deleteLead(id));
    setSelectedLeadIds([]);
  };

  const getScoreBadge = (score) => {
    if (score >= 85) return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    if (score >= 70) return 'bg-brand-500/10 dark:bg-blue-950/60 text-brand-500 dark:text-blue-300 border-blue-300 border-brand-500/20';
    if (score >= 50) return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    return 'bg-gray-100 dark:bg-white text-gray-500 border-gray-200 border-gray-200';
  };

  const exportLeadsCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Name,Company,Email,Phone,Source,Status,Score,Owner\n' +
      filteredLeads.map((l) => `"${l.name}","${l.company}","${l.email || ''}","${l.phone || ''}","${l.source}","${l.status}",${l.score},"${l.owner}"`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
              Lead Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-green-600 text-xs font-bold font-mono border border-emerald-200 dark:border-emerald-800">
              {leads.length} Total Inbound
            </span>
          </div>
          <p className="text-xs text-gray-500 text-gray-500 mt-1">
            Qualify, assign, and convert prospective enterprise buyers into active pipeline deals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={exportLeadsCSV} className="btn-secondary">
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setQuickCreateType('lead');
              setIsQuickCreateOpen(true);
            }}
            className="btn-primary"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Lead</span>
          </button>
        </div>
      </div>

      {/* Saved Views Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        {[
          { id: 'all', label: 'All Leads' },
          { id: 'high_score', label: 'High Intent (Score >= 80)' },
          { id: 'inbound', label: 'Inbound Requests' },
          { id: 'uncontacted', label: 'Uncontacted / New' }
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setSavedView(v.id)}
            className={`px-3 py-1.5 rounded-md transition ${
              savedView === v.id
                ? 'bg-gray-100 dark:bg-gray-100 text-white dark:text-gray-900 shadow-2xs font-bold'
                : 'bg-white dark:bg-gray-100 text-gray-500 text-gray-500 border border-gray-200/50 border-gray-200 hover:border-gray-200'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Table Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg crm-card text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, company, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 crm-input"
            />
          </div>

          <Dropdown
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="crm-input min-w-[130px]"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="unqualified">Unqualified</option>
          </Dropdown>

          <Dropdown
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="crm-input min-w-[160px]"
          >
            <option value="all">All Lead Sources</option>
            <option value="Inbound Demo Request">Inbound Demo Request</option>
            <option value="Referral - Partner">Referral - Partner</option>
            <option value="LinkedIn Campaign">LinkedIn Campaign</option>
            <option value="Product Hunt Launch">Product Hunt Launch</option>
            <option value="Organic Search">Organic Search</option>
          </Dropdown>
        </div>

        {/* Bulk Action Bar */}
        {selectedLeadIds.length > 0 && (
          <div className="flex items-center gap-2 bg-brand-500 text-white dark:bg-white px-3 py-1.5 rounded-md text-xs animate-in fade-in">
            <span className="font-bold">{selectedLeadIds.length} Selected</span>
            <button
              onClick={handleBulkDelete}
              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Enterprise Data Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-100 dark:bg-white border-b border-gray-200/50 border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 w-8">
                  <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-500">
                    {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-brand-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Lead Name & Title</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Lead Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 dark:divide-slate-800">
              {filteredLeads.map((lead) => {
                const isSelected = selectedLeadIds.includes(lead.id);
                return (
                  <tr
                    key={lead.id}
                    className={`hover:bg-gray-100 dark:hover:bg-white/50 transition ${
                      isSelected ? 'bg-brand-500/10/40 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <button onClick={() => toggleSelectLead(lead.id)} className="text-gray-500">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 text-gray-900 text-[12.5px]">{lead.name}</div>
                      <div className="text-[11px] text-gray-500">{lead.jobTitle || 'Decision Maker'}</div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-gray-900 dark:text-gray-900">
                      {lead.company}
                    </td>

                    <td className="py-3 px-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-gray-500 text-gray-500 font-mono text-[11px]">
                        <Mail className="w-3 h-3 text-gray-500" /> {lead.email || 'N/A'}
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[10.5px]">
                          <Phone className="w-3 h-3 text-gray-500" /> {lead.phone}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-gray-100 dark:bg-white text-gray-500 text-gray-500">
                        {lead.source}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono border ${getScoreBadge(lead.score)}`}>
                        <Zap className="w-3 h-3 fill-current" /> {lead.score}/100
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <Dropdown
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        className="crm-input text-[11px] py-1"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="unqualified">Unqualified</option>
                      </Dropdown>
                    </td>

                    <td className="py-3 px-4 text-gray-500 text-gray-500 font-medium">
                      {lead.owner}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="p-1 text-gray-500 hover:text-rose-500 transition"
                        title="Delete Lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}






